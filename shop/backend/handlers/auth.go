package handlers

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/shop/backend/config"
	"mertervitrini/shop/backend/db"
)

type AuthHandler struct {
	Cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{Cfg: cfg}
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

func (h *AuthHandler) getAdminAccessToken(ctx context.Context) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

func (h *AuthHandler) performKeycloakLogin(ctx context.Context, email, password string) (string, *UserInfo, error) {
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
		return "", nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", nil, fmt.Errorf("invalid_credentials: %s", body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", nil, err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	if accessToken == "" {
		return "", nil, fmt.Errorf("no access token in response")
	}

	claims, err := decodeJWTClaims(accessToken)
	if err != nil {
		return "", nil, err
	}

	userID, _ := claims["sub"].(string)
	firstName, _ := claims["given_name"].(string)
	lastName, _ := claims["family_name"].(string)
	emailClaim, _ := claims["email"].(string)
	if emailClaim == "" {
		emailClaim = email
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

	role := "customer"
	var isBlocked bool
	var dbRole string
	var phone string
	dbErr := db.Pool.QueryRow(ctx, "SELECT is_blocked, user_role, phone, first_name, last_name FROM identity.users WHERE id = $1 OR email = $2", userID, emailClaim).
		Scan(&isBlocked, &dbRole, &phone, &firstName, &lastName)

	if dbErr != nil {
		_, syncErr := db.Pool.Exec(ctx, `
			INSERT INTO identity.users (id, first_name, last_name, email, phone, user_role, is_active, is_blocked)
			VALUES ($1, $2, $3, $4, '', 'customer', true, false)
			ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
		`, userID, firstName, lastName, emailClaim)
		if syncErr != nil {
			log.Printf("[AUTH SYNC WARNING] Failed to dynamically sync logged-in Keycloak user locally: %v", syncErr)
		}
	} else {
		if isBlocked {
			return "", nil, fmt.Errorf("blocked_user")
		}
		if dbRole != "" {
			role = dbRole
		}
	}

	userInfo := &UserInfo{
		ID:        userID,
		FirstName: firstName,
		LastName:  lastName,
		Email:     emailClaim,
		Phone:     phone,
		Role:      role,
	}

	return accessToken, userInfo, nil
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Content-Type", "application/json")
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
	kcReq.Header.Set("Content-Type", "application/json")
	kcReq.Header.Set("Authorization", "Bearer "+adminToken)

	client := &http.Client{Timeout: 10 * time.Second}
	kcResp, err := client.Do(kcReq)
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

	_, dbErr := db.Pool.Exec(ctx, `
		INSERT INTO identity.users (id, first_name, last_name, email, phone, user_role, is_active, is_blocked)
		VALUES ($1, $2, $3, $4, $5, 'customer', true, false)
		ON CONFLICT (email) DO UPDATE SET
			id = EXCLUDED.id,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			phone = EXCLUDED.phone,
			user_role = 'customer',
			updated_at = CURRENT_TIMESTAMP
	`, keycloakUserID, req.FirstName, req.LastName, req.Email, req.Phone)

	if dbErr != nil {
		log.Printf("[AUTH DB ERROR] Failed to save user to local postgres: %v", dbErr)
	}

	loginToken, loginUser, err := h.performKeycloakLogin(ctx, req.Email, req.Password)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Kayıt başarıyla oluşturuldu.",
			"user_id": keycloakUserID,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Token: loginToken,
		User:  loginUser,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

// verifyTokenAndGetUserID decodes the token from Authorization header and returns keycloak userID if valid and not expired
func verifyTokenAndGetUserID(authHeader string) (string, error) {
	tokenStr := strings.TrimPrefix(strings.TrimSpace(authHeader), "Bearer ")
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
func (h *AuthHandler) verifyReCaptchaV3(token string, action string) (bool, error) {
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

func (h *AuthHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		log.Printf("[PROFILE WARNING] Unauthorized access attempt: %v", err)
		w.Header().Set("Content-Type", "application/json")
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

	w.Header().Set("Content-Type", "application/json")
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

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
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
	go func(id, first, last, ph string) {
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
		kcReq.Header.Set("Content-Type", "application/json")
		kcReq.Header.Set("Authorization", "Bearer "+adminToken)

		client := &http.Client{Timeout: 8 * time.Second}
		kcResp, err := client.Do(kcReq)
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
	}(userID, req.FirstName, req.LastName, req.Phone)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true,"message":"Profiliniz başarıyla güncellendi."}`))
}
