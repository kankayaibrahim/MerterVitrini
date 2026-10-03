package handlers

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/safe"
)

type StoreAuthHandler struct {
	Cfg *config.Config
}

func NewStoreAuthHandler(cfg *config.Config) *StoreAuthHandler {
	return &StoreAuthHandler{Cfg: cfg}
}

type RegisterRequest struct {
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	Phone        string `json:"phone"`
	CaptchaToken string `json:"captcha_token"`
	WebsiteHP    string `json:"website_hp"`
}

type LoginRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	CaptchaToken string `json:"captcha_token"`
	WebsiteHP    string `json:"website_hp"`
}

type UserInfo struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Role      string `json:"role"`
}

type AuthResponse struct {
	Token string    `json:"token"`
	User  *UserInfo `json:"user"`
}

func decodeJWTClaims(tokenStr string) (map[string]any, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid token format")
	}
	payloadSegment := parts[1]
	if l := len(payloadSegment) % 4; l > 0 {
		payloadSegment += strings.Repeat("=", 4-l)
	}
	raw, err := base64.URLEncoding.DecodeString(payloadSegment)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(payloadSegment)
		if err != nil {
			return nil, err
		}
	}
	var claims map[string]any
	if err := json.Unmarshal(raw, &claims); err != nil {
		return nil, err
	}
	return claims, nil
}

func (h *StoreAuthHandler) getAdminAccessToken(ctx context.Context) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to get admin token: status %d, body: %s", resp.StatusCode, body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("access_token not found in response")
	}

	return accessToken, nil
}

func (h *StoreAuthHandler) requestKeycloakPasswordToken(ctx context.Context, email, password string) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)

	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)
	form.Set("username", email)
	form.Set("password", password)
	form.Set("scope", "openid profile email")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("invalid_credentials: %s", body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("no access token in response")
	}
	return accessToken, nil
}

func extractClaimsUserInfo(claims map[string]any, defaultEmail string) (userID, firstName, lastName, email string) {
	userID, _ = claims["sub"].(string)
	firstName, _ = claims["given_name"].(string)
	lastName, _ = claims["family_name"].(string)
	email, _ = claims["email"].(string)
	if email == "" {
		email = defaultEmail
	}
	if firstName == "" {
		name, _ := claims["name"].(string)
		parts := strings.Fields(name)
		if len(parts) > 0 {
			firstName = parts[0]
			if len(parts) > 1 {
				lastName = strings.Join(parts[1:], " ")
			}
		}
	}
	return userID, firstName, lastName, email
}

func syncOrFetchLocalUser(ctx context.Context, userID, firstName, lastName, email string) (*UserInfo, error) {
	role := "customer"
	var isBlocked bool
	var dbRole string
	var phone string
	dbErr := db.Pool.QueryRow(ctx, "SELECT is_blocked, user_role, phone, first_name, last_name FROM identity.users WHERE id = $1 OR email = $2", userID, email).
		Scan(&isBlocked, &dbRole, &phone, &firstName, &lastName)

	if dbErr != nil {
		_, syncErr := db.Pool.Exec(ctx, `
			INSERT INTO identity.users (id, first_name, last_name, email, phone, user_role, is_active, is_blocked)
			VALUES ($1, $2, $3, $4, '', 'customer', true, false)
			ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
		`, userID, firstName, lastName, email)
		if syncErr != nil {
			log.Printf("[AUTH SYNC WARNING] Failed to dynamically sync logged-in Keycloak user locally: %v", syncErr)
		}
	} else {
		if isBlocked {
			return nil, fmt.Errorf("blocked_user")
		}
		if dbRole != "" {
			role = dbRole
		}
		_, syncErr := db.Pool.Exec(ctx, "UPDATE identity.users SET id = $1 WHERE email = $2 AND (id IS NULL OR id = '')", userID, email)
		if syncErr != nil {
			log.Printf("[AUTH SYNC WARNING] Failed to update keycloak ID for user %s: %v", email, syncErr)
		}
	}

	return &UserInfo{
		ID:        userID,
		FirstName: firstName,
		LastName:  lastName,
		Email:     email,
		Phone:     phone,
		Role:      role,
	}, nil
}

func (h *StoreAuthHandler) performKeycloakLogin(ctx context.Context, email, password string) (string, *UserInfo, error) {
	accessToken, err := h.requestKeycloakPasswordToken(ctx, email, password)
	if err != nil {
		return "", nil, err
	}

	claims, err := decodeJWTClaims(accessToken)
	if err != nil {
		return "", nil, err
	}

	userID, firstName, lastName, emailClaim := extractClaimsUserInfo(claims, email)
	userInfo, err := syncOrFetchLocalUser(ctx, userID, firstName, lastName, emailClaim)
	if err != nil {
		return "", nil, err
	}

	return accessToken, userInfo, nil
}

func (h *StoreAuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	// Honeypot trap: if this field is filled, it's a bot!
	if req.WebsiteHP != "" {
		log.Printf("[HONEYPOT DETECTED] Bot registration attempt from IP: %s (field filled: %s)", r.RemoteAddr, req.WebsiteHP)
		// Return fake success response to isolate the bot without putting load on system
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Kayıt başarıyla oluşturuldu.",
			"user_id": "fake-register-id-99124",
		})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Phone = strings.TrimSpace(req.Phone)

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		http.Error(w, `{"error":"Ad, soyad, e-posta ve şifre alanları zorunludur"}`, http.StatusBadRequest)
		return
	}

	// Verify reCAPTCHA v3
	captchaValid, captchaErr := h.verifyReCaptchaV3(req.CaptchaToken, "register")
	if captchaErr != nil {
		log.Printf("[AUTH ERROR] reCAPTCHA validation error: %v", captchaErr)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, captchaErr.Error()), http.StatusBadRequest)
		return
	}
	if !captchaValid {
		http.Error(w, `{"error":"Güvenlik doğrulaması (reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	adminToken, err := h.getAdminAccessToken(ctx)
	if err != nil {
		log.Printf("[AUTH ERROR] Failed to fetch Keycloak admin token: %v", err)
		http.Error(w, `{"error":"Kimlik sağlayıcı bağlantı hatası"}`, http.StatusInternalServerError)
		return
	}

	createUserURL := fmt.Sprintf("%s/admin/realms/%s/users", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	
	keycloakUser := map[string]any{
		"username":      req.Email,
		"email":         req.Email,
		"enabled":       true,
		"emailVerified": true,
		"firstName":     req.FirstName,
		"lastName":      req.LastName,
		"credentials": []map[string]any{
			{
				"type":      "password",
				"value":     req.Password,
				"temporary": false,
			},
		},
		"attributes": map[string][]string{
			"phone": {req.Phone},
		},
	}

	payload, err := json.Marshal(keycloakUser)
	if err != nil {
		http.Error(w, `{"error":"İç hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	kcReq, err := http.NewRequestWithContext(ctx, http.MethodPost, createUserURL, strings.NewReader(string(payload)))
	if err != nil {
		http.Error(w, `{"error":"İç hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	kcReq.Header.Set(headerContentType, mimeApplicationJSON)
	kcReq.Header.Set("Authorization", authBearerPrefix+adminToken)

	kcResp, err := httpclient.FastClient.Do(kcReq)
	if err != nil {
		log.Printf("[AUTH ERROR] Failed to make register call to Keycloak: %v", err)
		http.Error(w, `{"error":"Kimlik sağlayıcı sunucusu yanıt vermedi"}`, http.StatusBadGateway)
		return
	}
	defer kcResp.Body.Close()

	if kcResp.StatusCode == http.StatusConflict {
		http.Error(w, `{"error":"Bu e-posta adresi ile zaten kayıtlı bir kullanıcı bulunuyor"}`, http.StatusConflict)
		return
	}

	if kcResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(kcResp.Body)
		log.Printf("[AUTH ERROR] Keycloak registration failed with status %d: %s", kcResp.StatusCode, string(body))
		http.Error(w, `{"error":"Kayıt işlemi gerçekleştirilemedi"}`, http.StatusInternalServerError)
		return
	}

	location := kcResp.Header.Get("Location")
	if location == "" {
		log.Printf("[AUTH ERROR] Location header missing in Keycloak response")
		http.Error(w, `{"error":"Kayıt sonrası kullanıcı tanımlayıcı alınamadı"}`, http.StatusInternalServerError)
		return
	}

	parts := strings.Split(location, "/")
	keycloakUserID := parts[len(parts)-1]

	ip := getClientIP(r)
	_, dbErr := db.Pool.Exec(ctx, `
		INSERT INTO identity.users (id, first_name, last_name, email, phone, user_role, is_active, is_blocked, registration_ip)
		VALUES ($1, $2, $3, $4, $5, 'customer', true, false, $6)
		ON CONFLICT (email) DO UPDATE SET
			id = EXCLUDED.id,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			phone = EXCLUDED.phone,
			user_role = 'customer',
			registration_ip = COALESCE(identity.users.registration_ip, EXCLUDED.registration_ip),
			updated_at = CURRENT_TIMESTAMP
	`, keycloakUserID, req.FirstName, req.LastName, req.Email, req.Phone, ip)

	if dbErr != nil {
		log.Printf("[AUTH DB ERROR] Failed to save user to local postgres: %v", dbErr)
	}

	loginToken, loginUser, err := h.performKeycloakLogin(ctx, req.Email, req.Password)
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Kayıt başarıyla oluşturuldu.",
			"user_id": keycloakUserID,
		})
		return
	}

	safe.Go("Record Login History Register", func() {
		recordLoginHistory(context.Background(), loginUser.ID, ip)
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Token: loginToken,
		User:  loginUser,
	})
}

func (h *StoreAuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	// Honeypot trap: if this field is filled, it's a bot!
	if req.WebsiteHP != "" {
		log.Printf("[HONEYPOT DETECTED] Bot login attempt from IP: %s (field filled: %s)", r.RemoteAddr, req.WebsiteHP)
		// Return fake token to lead bot into a dead-end
		w.Header().Set(headerContentType, mimeApplicationJSON)
		json.NewEncoder(w).Encode(AuthResponse{
			Token: "fake-jwt-token-to-isolate-bot-activity-9988",
			User: &UserInfo{
				ID:        "fake-user-id-9988",
				FirstName: "Admin",
				LastName:  "User",
				Email:     req.Email,
				Phone:     "",
				Role:      "customer",
			},
		})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"E-posta ve şifre alanları zorunludur"}`, http.StatusBadRequest)
		return
	}

	// Verify reCAPTCHA v3
	captchaValid, captchaErr := h.verifyReCaptchaV3(req.CaptchaToken, "login")
	if captchaErr != nil {
		log.Printf("[AUTH ERROR] reCAPTCHA validation error: %v", captchaErr)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, captchaErr.Error()), http.StatusBadRequest)
		return
	}
	if !captchaValid {
		http.Error(w, `{"error":"Güvenlik doğrulaması (reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	token, user, err := h.performKeycloakLogin(ctx, req.Email, req.Password)
	if err != nil {
		if err.Error() == "blocked_user" {
			http.Error(w, `{"error":"Hesabınız yönetici tarafından engellenmiştir. Lütfen iletişime geçiniz."}`, http.StatusForbidden)
			return
		}
		log.Printf("[LOGIN WARNING] Failed login attempt for %s: %v", req.Email, err)
		http.Error(w, `{"error":"E-posta veya şifre hatalı"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	ip := getClientIP(r)
	safe.Go("Record Login History Login", func() {
		recordLoginHistory(context.Background(), user.ID, ip)
	})

	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

// verifyTokenAndGetUserID decodes the token from Authorization header and returns keycloak userID if valid and not expired
func verifyTokenAndGetUserID(authHeader string) (string, error) {
	tokenStr := strings.TrimPrefix(strings.TrimSpace(authHeader), authBearerPrefix)
	if tokenStr == "" {
		return "", fmt.Errorf("missing authorization token")
	}

	claims, err := decodeJWTClaims(tokenStr)
	if err != nil {
		return "", fmt.Errorf("failed to decode jwt claims: %w", err)
	}

	// Check for token expiration
	if expVal, exists := claims["exp"]; exists {
		if expFloat, ok := expVal.(float64); ok {
			if time.Now().Unix() > int64(expFloat) {
				return "", fmt.Errorf("token expired")
			}
		}
	}

	userID, _ := claims["sub"].(string)
	if userID == "" {
		return "", fmt.Errorf("subject missing from token")
	}
	return userID, nil
}

// verifyReCaptchaV3 validates Google reCAPTCHA v3 token against Google siteverify API.
// It enforces that the verification succeeds and returned score is >= 0.5 threshold.
func (h *StoreAuthHandler) verifyReCaptchaV3(token string, action string) (bool, error) {
	if h.Cfg.ReCaptchaSecret == "" {
		log.Printf("[RECAPTCHA WARNING] reCAPTCHA secret is empty. Skipping verification as a fail-safe.")
		return true, nil
	}

	if token == "" {
		return false, fmt.Errorf("reCAPTCHA doğrulama token'ı eksik")
	}

	resp, err := http.PostForm("https://www.google.com/recaptcha/api/siteverify",
		url.Values{
			"secret":   {h.Cfg.ReCaptchaSecret},
			"response": {token},
		})
	if err != nil {
		return false, fmt.Errorf("reCAPTCHA servis bağlantı hatası: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		Score      float64  `json:"score"`
		Action     string   `json:"action"`
		ErrorCodes []string `json:"error-codes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("reCAPTCHA yanıtı ayrıştırılamadı: %w", err)
	}

	if !result.Success {
		log.Printf("[RECAPTCHA WARNING] Google returned failure. Error codes: %v", result.ErrorCodes)
		return false, nil
	}

	// Verify action matches to prevent cross-action token attacks
	if result.Action != action {
		log.Printf("[RECAPTCHA WARNING] Action mismatch. Expected: %s, Got: %s", action, result.Action)
		return false, nil
	}

	// We enforce a threshold of 0.5
	if result.Score < 0.5 {
		log.Printf("[RECAPTCHA WARNING] Low trust score detected: %f for action: %s", result.Score, result.Action)
		return false, nil
	}

	return true, nil
}

type UserProfile struct {
	ID                string `json:"id"`
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	Email             string `json:"email"`
	Phone             string `json:"phone"`
	PreferredLang     string `json:"preferred_lang"`
	PreferredCurrency string `json:"preferred_currency"`
	BillingAddress    string `json:"billing_address"`
	DeliveryAddress   string `json:"delivery_address"`
	TaxNoTCKN         string `json:"tax_no_tckn"`
	InstagramUsername string `json:"instagram_username"`
}

func (h *StoreAuthHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		log.Printf("[PROFILE WARNING] Unauthorized access attempt: %v", err)
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var p UserProfile
	p.ID = userID

	var billingAddr, deliveryAddr, taxNo, instaUser sql.NullString

	err = db.Pool.QueryRow(ctx, `
		SELECT first_name, last_name, email, phone, preferred_lang, preferred_currency, 
		       billing_address, delivery_address, tax_no_tckn, instagram_username
		FROM identity.users
		WHERE id = $1
	`, userID).Scan(
		&p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.PreferredLang, &p.PreferredCurrency,
		&billingAddr, &deliveryAddr, &taxNo, &instaUser,
	)

	if err != nil {
		log.Printf("[PROFILE ERROR] Failed to fetch user %s profile: %v", userID, err)
		http.Error(w, `{"error":"Kullanıcı profili veritabanında bulunamadı"}`, http.StatusNotFound)
		return
	}

	p.BillingAddress = billingAddr.String
	p.DeliveryAddress = deliveryAddr.String
	p.TaxNoTCKN = taxNo.String
	p.InstagramUsername = instaUser.String

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(p)
}

type UpdateProfileRequest struct {
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	Phone             string `json:"phone"`
	PreferredLang     string `json:"preferred_lang"`
	PreferredCurrency string `json:"preferred_currency"`
	BillingAddress    string `json:"billing_address"`
	DeliveryAddress   string `json:"delivery_address"`
	TaxNoTCKN         string `json:"tax_no_tckn"`
	InstagramUsername string `json:"instagram_username"`
}

func (h *StoreAuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Phone = strings.TrimSpace(req.Phone)
	req.PreferredLang = strings.TrimSpace(strings.ToLower(req.PreferredLang))
	req.PreferredCurrency = strings.TrimSpace(strings.ToUpper(req.PreferredCurrency))

	if req.FirstName == "" || req.LastName == "" {
		http.Error(w, `{"error":"Ad ve soyad alanları boş bırakılamaz"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// 1. Update local database
	_, dbErr := db.Pool.Exec(ctx, `
		UPDATE identity.users SET
			first_name = $1,
			last_name = $2,
			phone = $3,
			preferred_lang = $4,
			preferred_currency = $5,
			billing_address = $6,
			delivery_address = $7,
			tax_no_tckn = $8,
			instagram_username = $9,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $10
	`, req.FirstName, req.LastName, req.Phone, req.PreferredLang, req.PreferredCurrency,
		req.BillingAddress, req.DeliveryAddress, req.TaxNoTCKN, req.InstagramUsername, userID)

	if dbErr != nil {
		log.Printf("[PROFILE ERROR] Failed to update user %s in postgres: %v", userID, dbErr)
		http.Error(w, `{"error":"Profil güncellenirken veritabanı hatası oluştu"}`, http.StatusInternalServerError)
		return
	}

	// 2. Synchronize to Keycloak asynchronously
	safe.Go("Keycloak Async Profile Sync", func() {
		id, first, last, ph := userID, req.FirstName, req.LastName, req.Phone
		ctxBG, cancelBG := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBG()

		adminToken, err := h.getAdminAccessToken(ctxBG)
		if err != nil {
			log.Printf("[PROFILE SYNC WARNING] Failed to get admin token for Keycloak user sync: %v", err)
			return
		}

		updateURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm, id)
		
		keycloakUpdate := map[string]any{
			"firstName": first,
			"lastName":  last,
			"attributes": map[string][]string{
				"phone": {ph},
			},
		}

		payload, err := json.Marshal(keycloakUpdate)
		if err != nil {
			return
		}

		kcReq, err := http.NewRequestWithContext(ctxBG, http.MethodPut, updateURL, strings.NewReader(string(payload)))
		if err != nil {
			return
		}
		kcReq.Header.Set(headerContentType, mimeApplicationJSON)
		kcReq.Header.Set("Authorization", authBearerPrefix+adminToken)

		kcResp, err := httpclient.FastClient.Do(kcReq)
		if err != nil {
			log.Printf("[PROFILE SYNC WARNING] Failed to make Keycloak update call: %v", err)
			return
		}
		defer kcResp.Body.Close()

		if kcResp.StatusCode != http.StatusNoContent && kcResp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(kcResp.Body)
			log.Printf("[PROFILE SYNC WARNING] Keycloak user update returned status %d: %s", kcResp.StatusCode, string(body))
		} else {
			log.Printf("[PROFILE SYNC SUCCESS] Keycloak account successfully synchronized for user %s", id)
		}
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"success":true,"message":"Profiliniz başarıyla güncellendi."}`))
}

func (h *StoreAuthHandler) exchangeGoogleCodeForToken(ctx context.Context, code, redirectURI string) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("status %d, body: %s", resp.StatusCode, body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("no access token in response")
	}
	return accessToken, nil
}

func (h *StoreAuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	code := r.URL.Query().Get("code")
	redirectURI := r.URL.Query().Get("redirect_uri")

	if code == "" || redirectURI == "" {
		http.Error(w, `{"error":"Eksik veya geçersiz parametreler"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	accessToken, err := h.exchangeGoogleCodeForToken(ctx, code, redirectURI)
	if err != nil {
		log.Printf("[GOOGLE AUTH ERROR] Failed to exchange token: %v", err)
		http.Error(w, `{"error":"Google kod doğrulaması başarısız oldu"}`, http.StatusUnauthorized)
		return
	}

	claims, err := decodeJWTClaims(accessToken)
	if err != nil {
		log.Printf("[GOOGLE AUTH ERROR] Failed to decode JWT claims: %v", err)
		http.Error(w, `{"error":"Kimlik bilgileri çözümlenemedi"}`, http.StatusInternalServerError)
		return
	}

	userID, firstName, lastName, emailClaim := extractClaimsUserInfo(claims, "")
	if emailClaim == "" {
		log.Printf("[GOOGLE AUTH ERROR] Email missing in Keycloak claims")
		http.Error(w, `{"error":"Google hesabınızdan e-posta adresi alınamadı"}`, http.StatusBadRequest)
		return
	}

	userInfo, err := syncOrFetchLocalUser(ctx, userID, firstName, lastName, emailClaim)
	if err != nil {
		http.Error(w, `{"error":"Hesabınız engellenmiştir"}`, http.StatusForbidden)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	ip := getClientIP(r)
	safe.Go("Record Login History Token", func() {
		recordLoginHistory(context.Background(), userID, ip)
	})

	json.NewEncoder(w).Encode(AuthResponse{
		Token: accessToken,
		User:  userInfo,
	})
}

// UserAddress maps the relational model in identity.user_addresses joined with country and state lookups
type UserAddress struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	AddressType  string    `json:"address_type"` // 'billing' or 'shipping'
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	CompanyName  *string   `json:"company_name"` // nullable
	Phone        string    `json:"phone"`
	CountryID    string    `json:"country_id"`
	StateID      *string   `json:"state_id"`     // nullable
	CityID       *string   `json:"city_id"`      // nullable
	AddressLine  string    `json:"address_line"`
	PostalCode   string    `json:"postal_code"`
	TaxNoTCKN    *string   `json:"tax_no_tckn"`  // nullable
	TaxOffice    *string   `json:"tax_office"`   // nullable
	IsDefault    bool      `json:"is_default"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Joined fields for display
	CountryName  string    `json:"country_name,omitempty"`
	StateName    string    `json:"state_name,omitempty"`
	CityName     string    `json:"city_name,omitempty"`
}

type CountryLookup struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	PhoneCode int    `json:"phone_code"`
	NameTR    string `json:"name_tr"`
	NameEN    string `json:"name_en"`
}

type StateLookup struct {
	ID        string `json:"id"`
	CountryID string `json:"country_id"`
	Code      string `json:"code"`
	StateName string `json:"state_name"`
}

// ListAddresses lists all shipping and billing addresses for the current authenticated user
func (h *StoreAuthHandler) ListAddresses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT a.id, a.user_id, a.title, a.address_type, a.first_name, a.last_name, 
		       a.company_name, a.phone, a.country_id, a.state_id, a.address_line, 
		       a.tax_no_tckn, a.tax_office, a.is_default, a.created_at, a.updated_at,
		       coalesce(c.localized_names->>'tr_TR', c.localized_names->>'en_US', c.code) as country_name,
		       coalesce(s.state_name, '') as state_name, a.postal_code, a.city_id, coalesce(ci.name, '') as city_name
		FROM identity.user_addresses a
		JOIN catalog.countries c ON a.country_id = c.id
		LEFT JOIN catalog.country_states s ON a.state_id = s.id
		LEFT JOIN catalog.country_cities ci ON a.city_id = ci.id
		WHERE a.user_id = $1
		ORDER BY a.is_default DESC, a.created_at DESC
	`, userID)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to list addresses for user %s: %v", userID, err)
		http.Error(w, `{"error":"Adresler listelenirken bir hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	addresses := []UserAddress{}
	for rows.Next() {
		var addr UserAddress
		var company, taxNo, taxOff, stateID, stateName, cityID, cityName sql.NullString
		err := rows.Scan(
			&addr.ID, &addr.UserID, &addr.Title, &addr.AddressType, &addr.FirstName, &addr.LastName,
			&company, &addr.Phone, &addr.CountryID, &stateID, &addr.AddressLine,
			&taxNo, &taxOff, &addr.IsDefault, &addr.CreatedAt, &addr.UpdatedAt,
			&addr.CountryName, &stateName, &addr.PostalCode, &cityID, &cityName,
		)
		if err != nil {
			log.Printf("[ADDRESS ERROR] Scan error: %v", err)
			http.Error(w, `{"error":"Adres bilgileri okunurken hata oluştu"}`, http.StatusInternalServerError)
			return
		}
		if company.Valid {
			addr.CompanyName = &company.String
		}
		if taxNo.Valid {
			addr.TaxNoTCKN = &taxNo.String
		}
		if taxOff.Valid {
			addr.TaxOffice = &taxOff.String
		}
		if stateID.Valid {
			addr.StateID = &stateID.String
		}
		if cityID.Valid {
			addr.CityID = &cityID.String
		}
		addr.StateName = stateName.String
		addr.CityName = cityName.String
		addresses = append(addresses, addr)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(addresses)
}

type AddressRequestPayload struct {
	Title       string  `json:"title"`
	AddressType string  `json:"address_type"` // 'billing' or 'shipping'
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	CompanyName *string `json:"company_name"`
	Phone       string  `json:"phone"`
	CountryID   string  `json:"country_id"`
	StateID     *string `json:"state_id"`
	CityID      *string `json:"city_id"`
	AddressLine string  `json:"address_line"`
	PostalCode  string  `json:"postal_code"`
	TaxNoTCKN   *string `json:"tax_no_tckn"`
	TaxOffice   *string `json:"tax_office"`
	IsDefault   bool    `json:"is_default"`
}

func validateAddressRequestPayload(req *AddressRequestPayload) error {
	req.Title = strings.TrimSpace(req.Title)
	req.AddressType = strings.TrimSpace(req.AddressType)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Phone = strings.TrimSpace(req.Phone)
	req.AddressLine = strings.TrimSpace(req.AddressLine)
	req.PostalCode = strings.TrimSpace(req.PostalCode)

	if req.Title == "" || req.AddressType == "" || req.FirstName == "" || req.LastName == "" || req.Phone == "" || req.CountryID == "" || req.AddressLine == "" || req.PostalCode == "" {
		return errors.New("Lütfen tüm zorunlu alanları doldurun")
	}

	if req.AddressType != "billing" && req.AddressType != "shipping" {
		return errors.New("Geçersiz adres tipi")
	}

	if len(req.AddressLine) > 500 {
		return errors.New("Adres satırı en fazla 500 karakter olabilir")
	}
	return nil
}

func adjustAddressDefaultOnUpdate(ctx context.Context, tx pgx.Tx, userID, id string, req *AddressRequestPayload) error {
	if req.IsDefault {
		_, err := tx.Exec(ctx, `
			UPDATE identity.user_addresses 
			SET is_default = false 
			WHERE user_id = $1 AND address_type = $2 AND id != $3
		`, userID, req.AddressType, id)
		return err
	}

	var wasDefault bool
	err := tx.QueryRow(ctx, `SELECT is_default FROM identity.user_addresses WHERE id = $1`, id).Scan(&wasDefault)
	if err == nil && wasDefault {
		var otherCount int
		err = tx.QueryRow(ctx, `
			SELECT count(*) FROM identity.user_addresses 
			WHERE user_id = $1 AND address_type = $2 AND id != $3
		`, userID, req.AddressType, id).Scan(&otherCount)
		if err == nil && otherCount == 0 {
			req.IsDefault = true
		}
	}
	return nil
}

// CreateAddress creates a new shipping or billing address
func (h *StoreAuthHandler) CreateAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	var req AddressRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	if err := validateAddressRequestPayload(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Transaction to update defaults & insert
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// If is_default is true, set all other addresses of this type for this user to false
	if req.IsDefault {
		_, err = tx.Exec(ctx, `
			UPDATE identity.user_addresses 
			SET is_default = false 
			WHERE user_id = $1 AND address_type = $2
		`, userID, req.AddressType)
		if err != nil {
			log.Printf("[ADDRESS ERROR] Failed to clear defaults: %v", err)
			http.Error(w, `{"error":"Varsayılan adres güncellenirken hata oluştu"}`, http.StatusInternalServerError)
			return
		}
	} else {
		// If there are no other addresses of this type, force this one to be default
		var count int
		err = tx.QueryRow(ctx, `
			SELECT count(*) FROM identity.user_addresses 
			WHERE user_id = $1 AND address_type = $2
		`, userID, req.AddressType).Scan(&count)
		if err == nil && count == 0 {
			req.IsDefault = true
		}
	}

	var newID string
	err = tx.QueryRow(ctx, `
		INSERT INTO identity.user_addresses (
			user_id, title, address_type, first_name, last_name, company_name, 
			phone, country_id, state_id, address_line, tax_no_tckn, tax_office, is_default, postal_code, city_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`, userID, req.Title, req.AddressType, req.FirstName, req.LastName, req.CompanyName,
		req.Phone, req.CountryID, req.StateID, req.AddressLine, req.TaxNoTCKN, req.TaxOffice, req.IsDefault, req.PostalCode, req.CityID).Scan(&newID)

	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to insert address: %v", err)
		http.Error(w, `{"error":"Adres kaydedilirken bir hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"İşlem tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"id":      newID,
		"message": "Adres başarıyla oluşturuldu.",
	})
}

// UpdateAddress updates an existing address
func (h *StoreAuthHandler) UpdateAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Adres ID gereklidir"}`, http.StatusBadRequest)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	var req AddressRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Geçersiz istek gövdesi"}`, http.StatusBadRequest)
		return
	}

	if err := validateAddressRequestPayload(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var exists bool
	err = db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM identity.user_addresses WHERE id = $1 AND user_id = $2)
	`, id, userID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"Adres bulunamadı veya yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	if err := adjustAddressDefaultOnUpdate(ctx, tx, userID, id, &req); err != nil {
		log.Printf("[ADDRESS ERROR] Failed to adjust defaults: %v", err)
		http.Error(w, `{"error":"Varsayılan adres güncellenirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE identity.user_addresses SET
			title = $1,
			address_type = $2,
			first_name = $3,
			last_name = $4,
			company_name = $5,
			phone = $6,
			country_id = $7,
			state_id = $8,
			address_line = $9,
			tax_no_tckn = $10,
			tax_office = $11,
			is_default = $12,
			postal_code = $13,
			city_id = $14,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $15 AND user_id = $16
	`, req.Title, req.AddressType, req.FirstName, req.LastName, req.CompanyName,
		req.Phone, req.CountryID, req.StateID, req.AddressLine, req.TaxNoTCKN, req.TaxOffice, req.IsDefault, req.PostalCode, req.CityID, id, userID)

	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to update address: %v", err)
		http.Error(w, `{"error":"Adres güncellenirken bir hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		log.Printf("[ADDRESS ERROR] Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"İşlem tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Adres başarıyla güncellendi.",
	})
}

// DeleteAddress deletes an address of the authenticated user
func (h *StoreAuthHandler) DeleteAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"Adres ID gereklidir"}`, http.StatusBadRequest)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Geçersiz veya oturum süresi dolmuş token"}`))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Check if this address exists and get its default status & type
	var isDefault bool
	var addrType string
	err = db.Pool.QueryRow(ctx, `
		SELECT is_default, address_type FROM identity.user_addresses 
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&isDefault, &addrType)
	if err != nil {
		http.Error(w, `{"error":"Adres bulunamadı veya yetkiniz yok"}`, http.StatusNotFound)
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to begin transaction: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Delete the address
	_, err = tx.Exec(ctx, `
		DELETE FROM identity.user_addresses WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to delete address: %v", err)
		http.Error(w, `{"error":"Adres silinirken hata oluştu"}`, http.StatusInternalServerError)
		return
	}

	// If the deleted address was the default, make the next most recent address of this type the default
	if isDefault {
		var nextID string
		err = tx.QueryRow(ctx, `
			SELECT id FROM identity.user_addresses 
			WHERE user_id = $1 AND address_type = $2 
			ORDER BY created_at DESC LIMIT 1
		`, userID, addrType).Scan(&nextID)
		if err == nil && nextID != "" {
			_, err = tx.Exec(ctx, `
				UPDATE identity.user_addresses SET is_default = true WHERE id = $1
			`, nextID)
			if err != nil {
				log.Printf("[ADDRESS ERROR] Failed to set new default: %v", err)
				http.Error(w, `{"error":"Yeni varsayılan adres atanırken hata oluştu"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[ADDRESS ERROR] Failed to commit transaction: %v", err)
		http.Error(w, `{"error":"İşlem tamamlanamadı"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Adres başarıyla silindi.",
	})
}

// ListCountries fetches all registered countries with localized names
func (h *StoreAuthHandler) ListCountries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT id, code, phone_code,
		       coalesce(localized_names->>'tr_TR', localized_names->>'en_US', code) as name_tr,
		       coalesce(localized_names->>'en_US', localized_names->>'tr_TR', code) as name_en
		FROM catalog.countries
		ORDER BY name_tr ASC
	`)
	if err != nil {
		log.Printf("[LOCATION ERROR] Failed to query countries: %v", err)
		http.Error(w, `{"error":"Ülke listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	countries := []CountryLookup{}
	for rows.Next() {
		var c CountryLookup
		var phoneCode sql.NullInt64
		err := rows.Scan(&c.ID, &c.Code, &phoneCode, &c.NameTR, &c.NameEN)
		if err != nil {
			log.Printf("[LOCATION ERROR] Scan error: %v", err)
			http.Error(w, `{"error":"Ülke bilgileri okunurken hata oluştu"}`, http.StatusInternalServerError)
			return
		}
		c.PhoneCode = int(phoneCode.Int64)
		countries = append(countries, c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(countries)
}

// ListStatesByCountry fetches states / provinces for the given country
func (h *StoreAuthHandler) ListStatesByCountry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	countryID := r.PathValue("country_id")
	if countryID == "" {
		http.Error(w, `{"error":"Ülke ID gereklidir"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT id, country_id, code, state_name
		FROM catalog.country_states
		WHERE country_id = $1
		ORDER BY state_name ASC
	`, countryID)
	if err != nil {
		log.Printf("[LOCATION ERROR] Failed to query states: %v", err)
		http.Error(w, `{"error":"İl listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	states := []StateLookup{}
	for rows.Next() {
		var s StateLookup
		err := rows.Scan(&s.ID, &s.CountryID, &s.Code, &s.StateName)
		if err != nil {
			log.Printf("[LOCATION ERROR] Scan error: %v", err)
			http.Error(w, `{"error":"İl bilgileri okunurken hata oluştu"}`, http.StatusInternalServerError)
			return
		}
		states = append(states, s)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(states)
}

type CityLookup struct {
	ID      string `json:"id"`
	StateID string `json:"state_id"`
	Code    string `json:"code"`
	Name    string `json:"name"`
}

// ListCitiesByState fetches cities / towns for the given state
func (h *StoreAuthHandler) ListCitiesByState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	stateID := r.PathValue("state_id")
	if stateID == "" {
		http.Error(w, `{"error":"Eyalet ID gereklidir"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT id, state_id, code, name
		FROM catalog.country_cities
		WHERE state_id = $1
		ORDER BY name ASC
	`, stateID)
	if err != nil {
		log.Printf("[LOCATION ERROR] Failed to query cities: %v", err)
		http.Error(w, `{"error":"İlçe/şehir listesi alınırken hata oluştu"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	cities := []CityLookup{}
	for rows.Next() {
		var c CityLookup
		err := rows.Scan(&c.ID, &c.StateID, &c.Code, &c.Name)
		if err != nil {
			log.Printf("[LOCATION ERROR] Scan error: %v", err)
			http.Error(w, `{"error":"İlçe/şehir bilgileri okunurken hata oluştu"}`, http.StatusInternalServerError)
			return
		}
		cities = append(cities, c)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(cities)
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return rip
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func recordLoginHistory(ctx context.Context, userID, ipAddress string) {
	if userID == "" {
		return
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO identity.user_login_history (user_id, ip_address)
		VALUES ($1, $2)
	`, userID, ipAddress)
	if err != nil {
		log.Printf("[AUTH WARNING] Failed to record login history for user %s: %v", userID, err)
	}
}




