package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/phoneutil"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"

	"github.com/jackc/pgx/v5"
)

type StoreAuthHandler struct {
	Cfg *config.Config
}

func ensureIdentityUserVerificationSchema(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	query := `
		ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
		ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(128);
		ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP WITH TIME ZONE;
		ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
		CREATE INDEX IF NOT EXISTS idx_identity_users_email_verified ON identity.users(email_verified);
		CREATE INDEX IF NOT EXISTS idx_identity_users_verification_token ON identity.users(email_verification_token) WHERE email_verification_token IS NOT NULL;
	`
	if _, err := db.Pool.Exec(ctx, query); err != nil {
		log.Printf("[SCHEMA WARNING] Failed to ensure identity.users verification columns: %v", err)
	}
}

func generateVerificationToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

var (
	storeVerifierMu          sync.Mutex
	storeVerifierInitialized bool
)

func ensureDefaultTokenVerifier() {
	storeVerifierMu.Lock()
	defer storeVerifierMu.Unlock()
	if storeVerifierInitialized {
		return
	}
	cfg := config.LoadConfig()
	services.ConfigureDefaultVerifier(cfg.JWTSecret, cfg.KeycloakPublicKey)
	storeVerifierInitialized = true
}

func configureStoreVerifier(jwtSecret, keycloakPublicKey string) {
	storeVerifierMu.Lock()
	defer storeVerifierMu.Unlock()
	services.ConfigureDefaultVerifier(jwtSecret, keycloakPublicKey)
	storeVerifierInitialized = true
}

func NewStoreAuthHandler(cfg *config.Config) *StoreAuthHandler {
	if cfg != nil && (cfg.JWTSecret != "" || cfg.KeycloakPublicKey != "") {
		configureStoreVerifier(cfg.JWTSecret, cfg.KeycloakPublicKey)
	}
	safe.Go("Ensure Identity Verification Schema", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		ensureIdentityUserVerificationSchema(ctx)
	})
	return &StoreAuthHandler{Cfg: cfg}
}

type RegisterRequest struct {
	FirstName          string `json:"first_name"`
	LastName           string `json:"last_name"`
	Email              string `json:"email"`
	Password           string `json:"password"`
	Phone              string `json:"phone"`
	VisitorID          string `json:"visitor_id,omitempty"`
	CaptchaToken       string `json:"captcha_token"`
	ChallengeToken     string `json:"challenge_token,omitempty"`
	FormChallengeToken string `json:"form_challenge_token,omitempty"`
	WebsiteHP          string `json:"website_hp"`
}

type LoginRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	VisitorID    string `json:"visitor_id,omitempty"`
	CaptchaToken string `json:"captcha_token"`
	WebsiteHP    string `json:"website_hp"`
}

type UserInfo struct {
	ID            string `json:"id"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	Role          string `json:"role"`
	EmailVerified bool   `json:"email_verified"`
}

type AuthResponse struct {
	Token         string    `json:"token"`
	User          *UserInfo `json:"user"`
	RequiresPhone bool      `json:"requires_phone,omitempty"`
}

func decodeJWTClaims(tokenStr string) (map[string]any, error) {
	ensureDefaultTokenVerifier()
	return services.VerifyTokenClaims(tokenStr)
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

func lookupLocalUserForAuth(ctx context.Context, userID, firstName, lastName, email string) (*UserInfo, bool, error) {
	var existingID, dbRole, phone, dbFirst, dbLast string
	var isBlocked, emailVerified bool

	dbErr := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(id, ''), is_blocked, COALESCE(user_role, ''), COALESCE(phone, ''),
		       COALESCE(first_name, ''), COALESCE(last_name, ''), COALESCE(email_verified, false)
		FROM identity.users
		WHERE id = $1 OR (lower(email) = lower($2) AND $2 <> '')
		LIMIT 1
	`, userID, email).Scan(&existingID, &isBlocked, &dbRole, &phone, &dbFirst, &dbLast, &emailVerified)

	if dbErr != nil {
		if !errors.Is(dbErr, pgx.ErrNoRows) {
			log.Printf("[AUTH LOOKUP WARNING] Failed checking local user %s: %v", email, dbErr)
		}
		return &UserInfo{
			ID:            userID,
			FirstName:     firstName,
			LastName:      lastName,
			Email:         email,
			Phone:         "",
			Role:          "customer",
			EmailVerified: false,
		}, false, nil
	}

	if isBlocked {
		return nil, true, fmt.Errorf("blocked_user")
	}

	role := "customer"
	if dbRole != "" {
		role = dbRole
	}
	if dbFirst == "" {
		dbFirst = firstName
	}
	if dbLast == "" {
		dbLast = lastName
	}

	if userID != "" && existingID != userID {
		_, syncErr := db.Pool.Exec(ctx, "UPDATE identity.users SET id = $1 WHERE lower(email) = lower($2) AND (id IS NULL OR id = '' OR id != $1)", userID, email)
		if syncErr != nil {
			log.Printf("[AUTH SYNC WARNING] Failed to update keycloak ID for user %s: %v", email, syncErr)
		}
	}

	return &UserInfo{
		ID:            userID,
		FirstName:     dbFirst,
		LastName:      dbLast,
		Email:         email,
		Phone:         phone,
		Role:          role,
		EmailVerified: emailVerified,
	}, true, nil
}

func requiresCustomerPhoneCompletion(u *UserInfo, existsInDB bool) bool {
	if u == nil {
		return true
	}
	if u.Role != "" && u.Role != "customer" {
		return false
	}
	return !existsInDB || !phoneutil.IsRealisticPhone(u.Phone)
}

func (h *StoreAuthHandler) performKeycloakLogin(ctx context.Context, email, password string) (string, *UserInfo, bool, error) {
	accessToken, err := h.requestKeycloakPasswordToken(ctx, email, password)
	if err != nil {
		return "", nil, false, err
	}

	claims, err := decodeJWTClaims(accessToken)
	if err != nil {
		return "", nil, false, err
	}

	userID, firstName, lastName, emailClaim := extractClaimsUserInfo(claims, email)
	userInfo, existsInDB, err := lookupLocalUserForAuth(ctx, userID, firstName, lastName, emailClaim)
	if err != nil {
		return "", nil, false, err
	}

	if existsInDB {
		if kcVerified, ok := claims["email_verified"].(bool); ok && kcVerified && !userInfo.EmailVerified {
			if _, updErr := db.Pool.Exec(ctx, `UPDATE identity.users SET email_verified = true WHERE id = $1 OR lower(email) = lower($2)`, userID, emailClaim); updErr == nil {
				userInfo.EmailVerified = true
			}
		}
	}

	return accessToken, userInfo, requiresCustomerPhoneCompletion(userInfo, existsInDB), nil
}

func normalizeAndValidateRegisterInput(req *RegisterRequest) string {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Phone = strings.TrimSpace(req.Phone)

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return `{"error":"Ad, soyad, e-posta ve şifre alanları zorunludur"}`
	}

	normalizedPhone, err := phoneutil.NormalizeAndValidatePhone(req.Phone)
	if err != nil {
		return fmt.Sprintf(`{"error":%q}`, err.Error())
	}
	req.Phone = normalizedPhone
	return ""
}

func (h *StoreAuthHandler) createKeycloakCustomer(ctx context.Context, adminToken string, req RegisterRequest) (string, int, string) {
	createUserURL := fmt.Sprintf("%s/admin/realms/%s/users", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	keycloakUser := map[string]any{
		"username":      req.Email,
		"email":         req.Email,
		"enabled":       true,
		"emailVerified": false,
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
		return "", http.StatusInternalServerError, `{"error":"İç hata oluştu"}`
	}

	kcReq, err := http.NewRequestWithContext(ctx, http.MethodPost, createUserURL, strings.NewReader(string(payload)))
	if err != nil {
		return "", http.StatusInternalServerError, `{"error":"İç hata oluştu"}`
	}
	kcReq.Header.Set(headerContentType, mimeApplicationJSON)
	kcReq.Header.Set("Authorization", authBearerPrefix+adminToken)

	kcResp, err := httpclient.FastClient.Do(kcReq)
	if err != nil {
		log.Printf("[AUTH ERROR] Failed to make register call to Keycloak: %v", err)
		return "", http.StatusBadGateway, `{"error":"Kimlik sağlayıcı sunucusu yanıt vermedi"}`
	}
	defer kcResp.Body.Close()

	if kcResp.StatusCode == http.StatusConflict {
		return "", http.StatusConflict, `{"error":"Bu e-posta adresi ile zaten kayıtlı bir kullanıcı bulunuyor"}`
	}
	if kcResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(kcResp.Body)
		log.Printf("[AUTH ERROR] Keycloak registration failed with status %d: %s", kcResp.StatusCode, string(body))
		return "", http.StatusInternalServerError, `{"error":"Kayıt işlemi gerçekleştirilemedi"}`
	}

	location := kcResp.Header.Get("Location")
	if location == "" {
		log.Printf("[AUTH ERROR] Location header missing in Keycloak response")
		return "", http.StatusInternalServerError, `{"error":"Kayıt sonrası kullanıcı tanımlayıcı alınamadı"}`
	}

	parts := strings.Split(location, "/")
	return parts[len(parts)-1], http.StatusCreated, ""
}

func writeFakeHoneypotRegisterResponse(w http.ResponseWriter, r *http.Request, filled string) {
	log.Printf("[HONEYPOT DETECTED] Bot registration attempt from IP: %s (field filled: %s)", r.RemoteAddr, filled)
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"message": "Kayıt başarıyla oluşturuldu.",
		"user_id": "fake-register-id-99124",
	})
}

func (h *StoreAuthHandler) completeCustomerRegistration(w http.ResponseWriter, r *http.Request, req RegisterRequest, isMobile bool) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	adminToken, err := h.getAdminAccessToken(ctx)
	if err != nil {
		log.Printf("[AUTH ERROR] Failed to fetch Keycloak admin token: %v", err)
		http.Error(w, `{"error":"Kimlik sağlayıcı bağlantı hatası"}`, http.StatusInternalServerError)
		return
	}

	keycloakUserID, statusCode, kcErrJSON := h.createKeycloakCustomer(ctx, adminToken, req)
	if kcErrJSON != "" {
		http.Error(w, kcErrJSON, statusCode)
		return
	}

	ip := getClientIP(r)
	verificationToken, _ := generateVerificationToken()
	verificationExpires := time.Now().Add(24 * time.Hour)

	_, dbErr := db.Pool.Exec(ctx, `
		INSERT INTO identity.users (
			id, first_name, last_name, email, phone, user_role, is_active, is_blocked, registration_ip,
			email_verified, email_verification_token, email_verification_expires_at
		)
		VALUES ($1, $2, $3, $4, $5, 'customer', true, false, $6, false, $7, $8)
		ON CONFLICT (email) DO UPDATE SET
			id = EXCLUDED.id,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			phone = EXCLUDED.phone,
			user_role = 'customer',
			registration_ip = COALESCE(identity.users.registration_ip, EXCLUDED.registration_ip),
			email_verified = COALESCE(identity.users.email_verified, false),
			email_verification_token = EXCLUDED.email_verification_token,
			email_verification_expires_at = EXCLUDED.email_verification_expires_at,
			updated_at = CURRENT_TIMESTAMP
	`, keycloakUserID, req.FirstName, req.LastName, req.Email, req.Phone, ip, verificationToken, verificationExpires)

	if dbErr != nil {
		log.Printf("[AUTH DB ERROR] Failed to save user to local postgres: %v", dbErr)
	}

	meta := mailer.ExtractClientMeta(r)
	PersistCustomerGeoFromMeta(ctx, keycloakUserID, req.Phone, meta)
	mailer.SendCustomerRegisteredNotification(h.Cfg, req.FirstName, req.LastName, req.Email, req.Phone, meta)

	visitorID := firstNonEmptyStr(req.VisitorID, r.Header.Get(headerVisitorID))
	activityTitle := "Üye oldu (B2B müşteri kaydı tamamlandı)"
	if isMobile {
		activityTitle = "Mobil uygulamadan üye oldu (B2B müşteri kaydı tamamlandı)"
	}
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        keycloakUserID,
		VisitorID:     visitorID,
		EventType:     "register",
		EventCategory: "auth",
		Title:         activityTitle,
		Subtitle:      fmt.Sprintf("%s %s • %s", req.FirstName, req.LastName, req.Email),
		EntityType:    "user",
		EntityID:      keycloakUserID,
	})

	if verificationToken != "" {
		safe.Go("Send Customer Email Verification", func() {
			mailer.SendCustomerEmailVerification(h.Cfg, req.FirstName, req.Email, verificationToken)
		})
	}

	loginToken, loginUser, _, err := h.performKeycloakLogin(ctx, req.Email, req.Password)
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
	if isMobile {
		var hasSupplierAccount bool
		_ = db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.supplier_users WHERE lower(email) = $1 AND is_active = true)", req.Email).Scan(&hasSupplierAccount)
		json.NewEncoder(w).Encode(map[string]any{
			"role":                 "customer",
			"token":                loginToken,
			"user":                 loginUser,
			"requires_phone":       false,
			"has_supplier_account": hasSupplierAccount,
		})
		return
	}
	json.NewEncoder(w).Encode(AuthResponse{
		Token: loginToken,
		User:  loginUser,
	})
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
		writeFakeHoneypotRegisterResponse(w, r, req.WebsiteHP)
		return
	}

	if errJSON := normalizeAndValidateRegisterInput(&req); errJSON != "" {
		http.Error(w, errJSON, http.StatusBadRequest)
		return
	}

	captchaValid, captchaErr := verifyPublicFormReCaptcha(h.Cfg, req.CaptchaToken, "register", true)
	if captchaErr != nil {
		log.Printf("[AUTH ERROR] reCAPTCHA validation error: %v", captchaErr)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, captchaErr.Error()), http.StatusBadRequest)
		return
	}
	if !captchaValid {
		http.Error(w, `{"error":"Güvenlik doğrulaması (reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."}`, http.StatusBadRequest)
		return
	}

	h.completeCustomerRegistration(w, r, req, false)
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

	// On Login, IP rate-limiting + credential check protect the endpoint; verify reCAPTCHA only when token is supplied.
	captchaValid, captchaErr := verifyPublicFormReCaptcha(h.Cfg, req.CaptchaToken, "login", false)
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

	token, user, reqPhone, err := h.performKeycloakLogin(ctx, req.Email, req.Password)
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
	if !reqPhone {
		ip := getClientIP(r)
		safe.Go("Record Login History Login", func() {
			recordLoginHistory(context.Background(), user.ID, ip)
		})
		RecordMemberActivityAsync(r, MemberActivityInput{
			UserID:        user.ID,
			VisitorID:     req.VisitorID,
			EventType:     "login",
			EventCategory: "auth",
			Title:         "Web mağazasından oturum açtı",
			Subtitle:      "IP: " + ip,
			EntityType:    "user",
			EntityID:      user.ID,
		})
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Token:         token,
		User:          user,
		RequiresPhone: reqPhone,
	})
}

// verifyTokenAndGetClaims cryptographically verifies the JWT Bearer token and returns userID and claims.
func verifyTokenAndGetClaims(authHeader string) (string, map[string]any, error) {
	trimmed := strings.TrimSpace(authHeader)
	if len(trimmed) < 7 || !strings.EqualFold(trimmed[:7], authBearerPrefix) {
		return "", nil, errors.New("missing or malformed authorization header")
	}
	tokenStr := strings.TrimSpace(trimmed[7:])
	if tokenStr == "" {
		return "", nil, errors.New("missing authorization token")
	}

	claims, err := decodeJWTClaims(tokenStr)
	if err != nil {
		return "", nil, fmt.Errorf("failed to verify jwt claims: %w", err)
	}

	expVal, exists := claims["exp"]
	if !exists {
		return "", nil, errors.New("token missing exp claim")
	}
	if expFloat, ok := expVal.(float64); !ok || time.Now().Unix() > int64(expFloat) {
		return "", nil, errors.New("token expired")
	}

	userID, _ := claims["sub"].(string)
	if strings.TrimSpace(userID) == "" {
		return "", nil, errors.New("subject missing from token")
	}
	return userID, claims, nil
}

// verifyTokenAndGetUserID cryptographically verifies the JWT Bearer token (RS256 Keycloak or HS256 local) and returns userID if valid and not expired.
func verifyTokenAndGetUserID(authHeader string) (string, error) {
	userID, _, err := verifyTokenAndGetClaims(authHeader)
	return userID, err
}

// isImpersonatedToken reports whether authHeader holds a verified customer impersonation JWT and returns the acting staff email.
func isImpersonatedToken(authHeader string) (bool, string) {
	if strings.TrimSpace(authHeader) == "" {
		return false, ""
	}
	_, claims, err := verifyTokenAndGetClaims(authHeader)
	if err != nil || claims == nil {
		return false, ""
	}
	isImp, ok := claims["impersonated"].(bool)
	if !ok || !isImp {
		return false, ""
	}
	adminEmail, _ := claims["impersonated_by"].(string)
	return true, strings.TrimSpace(adminEmail)
}

const (
	recaptchaSiteVerifyURL = "https://www.google.com/recaptcha/api/siteverify"
	profileURLPath         = "/profile"
)

// verifyGoogleReCaptcha validates a Google reCAPTCHA token against siteverify using FastClient with timeout.
func verifyGoogleReCaptcha(secret, token, action string) (bool, error) {
	trimmedSecret := strings.TrimSpace(secret)
	if trimmedSecret == "" {
		return true, nil
	}

	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return false, errors.New("Güvenlik doğrulaması (reCAPTCHA) gerekli.")
	}

	form := url.Values{
		"secret":   {trimmedSecret},
		"response": {trimmedToken},
	}
	req, err := http.NewRequest(http.MethodPost, recaptchaSiteVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, errors.New("Güvenlik doğrulaması başlatılamadı.")
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		log.Printf("[RECAPTCHA ERROR] siteverify connection error: %v", err)
		return false, errors.New("Güvenlik doğrulama servisine ulaşılamadı.")
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		Score      float64  `json:"score"`
		Action     string   `json:"action"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[RECAPTCHA ERROR] siteverify decode error: %v", err)
		return false, errors.New("Güvenlik doğrulama yanıtı okunamadı.")
	}

	if !result.Success {
		log.Printf("[RECAPTCHA REJECT] Google verification failed with codes %v for action %s", result.ErrorCodes, action)
		return false, nil
	}

	if result.Action != "" && action != "" && result.Action != action {
		log.Printf("[RECAPTCHA WARNING] Action mismatch: expected %s, got %s", action, result.Action)
	}

	if result.Action != "" && result.Score < 0.2 {
		log.Printf("[RECAPTCHA REJECT] Confirmed bot activity detected: %f for action: %s", result.Score, result.Action)
		return false, fmt.Errorf("bot aktivitesi şüphesi (skor: %.2f)", result.Score)
	}

	return result.Success, nil
}

// verifyPublicFormReCaptcha verifies Google reCAPTCHA tokens without deadlocking public forms when site_key is absent.
// When token is non-empty and a secret key exists, it always verifies with Google.
// When token is empty, it only rejects if enforceWhenPairConfigured is true AND both site_key + secret_key are configured.
func verifyPublicFormReCaptcha(cfg *config.Config, token, action string, enforceWhenPairConfigured bool) (bool, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		if enforceWhenPairConfigured && cfg != nil && cfg.HasReCaptchaPair() {
			return false, errors.New("Güvenlik doğrulaması (reCAPTCHA) gerekli.")
		}
		return true, nil
	}
	secret := ""
	if cfg != nil {
		secret = cfg.EffectiveReCaptchaSecret()
	}
	if secret == "" {
		return true, nil
	}
	return verifyGoogleReCaptcha(secret, trimmedToken, action)
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
	EmailVerified     bool   `json:"email_verified"`
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
		       billing_address, delivery_address, tax_no_tckn, instagram_username,
		       COALESCE(email_verified, false)
		FROM identity.users
		WHERE id = $1
	`, userID).Scan(
		&p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.PreferredLang, &p.PreferredCurrency,
		&billingAddr, &deliveryAddr, &taxNo, &instaUser, &p.EmailVerified,
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

func (h *StoreAuthHandler) asyncSyncKeycloakProfile(id, first, last, ph string) {
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
}

func (h *StoreAuthHandler) insertOAuthCustomerProfile(ctx context.Context, r *http.Request, userID, email string, req UpdateProfileRequest) (int, string) {
	if email == "" {
		return http.StatusBadRequest, `{"error":"Oturum e-posta adresi doğrulanamadı"}`
	}
	ip := getClientIP(r)
	_, dbErr := db.Pool.Exec(ctx, `
		INSERT INTO identity.users (
			id, first_name, last_name, email, phone, user_role, is_active, is_blocked,
			registration_ip, preferred_lang, preferred_currency,
			billing_address, delivery_address, tax_no_tckn, instagram_username,
			email_verified, email_verified_at
		)
		VALUES ($1, $2, $3, $4, $5, 'customer', true, false, $6, $7, $8, $9, $10, $11, $12, true, CURRENT_TIMESTAMP)
		ON CONFLICT (email) DO UPDATE SET
			id = EXCLUDED.id,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			phone = EXCLUDED.phone,
			preferred_lang = EXCLUDED.preferred_lang,
			preferred_currency = EXCLUDED.preferred_currency,
			billing_address = EXCLUDED.billing_address,
			delivery_address = EXCLUDED.delivery_address,
			tax_no_tckn = EXCLUDED.tax_no_tckn,
			instagram_username = EXCLUDED.instagram_username,
			email_verified = true,
			email_verified_at = COALESCE(identity.users.email_verified_at, CURRENT_TIMESTAMP),
			updated_at = CURRENT_TIMESTAMP
	`, userID, req.FirstName, req.LastName, email, req.Phone, ip, req.PreferredLang, req.PreferredCurrency,
		req.BillingAddress, req.DeliveryAddress, req.TaxNoTCKN, req.InstagramUsername)
	if dbErr != nil {
		log.Printf("[PROFILE ERROR] Failed to insert pending customer %s in postgres: %v", userID, dbErr)
		return http.StatusInternalServerError, `{"error":"Profil oluşturulurken veritabanı hatası oluştu"}`
	}

	meta := mailer.ExtractClientMeta(r)
	PersistCustomerGeoFromMeta(ctx, userID, req.Phone, meta)
	mailer.SendCustomerRegisteredNotification(h.Cfg, req.FirstName, req.LastName, email, req.Phone, meta)
	safe.Go("Record Login History OAuth Phone", func() {
		recordLoginHistory(context.Background(), userID, ip)
	})
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		EventType:     "register",
		EventCategory: "auth",
		Title:         "Google hesabı ve telefon numarası ile üyeliğini tamamladı",
		Subtitle:      fmt.Sprintf("%s %s • %s", req.FirstName, req.LastName, email),
		URLPath:       profileURLPath,
		EntityType:    "user",
		EntityID:      userID,
	})
	return 0, ""
}

func (h *StoreAuthHandler) persistProfileWithPhone(ctx context.Context, r *http.Request, userID string, claims map[string]any, req UpdateProfileRequest) (int, string) {
	_, _, _, claimEmail := extractClaimsUserInfo(claims, "")
	claimEmail = strings.TrimSpace(strings.ToLower(claimEmail))

	var existingID, prevPhone string
	var isBlocked bool
	lookupErr := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(id, ''), is_blocked, COALESCE(phone, '')
		FROM identity.users
		WHERE id = $1 OR (lower(email) = lower($2) AND $2 <> '')
		LIMIT 1
	`, userID, claimEmail).Scan(&existingID, &isBlocked, &prevPhone)

	if errors.Is(lookupErr, pgx.ErrNoRows) {
		return h.insertOAuthCustomerProfile(ctx, r, userID, claimEmail, req)
	}
	if lookupErr != nil {
		log.Printf("[PROFILE ERROR] Failed to query user %s in postgres: %v", userID, lookupErr)
		return http.StatusInternalServerError, `{"error":"Profil güncellenirken veritabanı hatası oluştu"}`
	}
	if isBlocked {
		return http.StatusForbidden, `{"error":"Hesabınız yönetici tarafından engellenmiştir."}`
	}

	_, dbErr := db.Pool.Exec(ctx, `
		UPDATE identity.users SET
			id = $10,
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
		WHERE id = $11 OR (lower(email) = lower($12) AND $12 <> '')
	`, req.FirstName, req.LastName, req.Phone, req.PreferredLang, req.PreferredCurrency,
		req.BillingAddress, req.DeliveryAddress, req.TaxNoTCKN, req.InstagramUsername, userID, existingID, claimEmail)
	if dbErr != nil {
		log.Printf("[PROFILE ERROR] Failed to update user %s in postgres: %v", userID, dbErr)
		return http.StatusInternalServerError, `{"error":"Profil güncellenirken veritabanı hatası oluştu"}`
	}

	if !phoneutil.IsRealisticPhone(prevPhone) && claimEmail != "" {
		meta := mailer.ExtractClientMeta(r)
		mailer.SendCustomerRegisteredNotification(h.Cfg, req.FirstName, req.LastName, claimEmail, req.Phone, meta)
		RecordMemberActivityAsync(r, MemberActivityInput{
			UserID:        userID,
			EventType:     "register",
			EventCategory: "auth",
			Title:         "Cep telefonu tamamlanarak üyelik aktive edildi",
			Subtitle:      fmt.Sprintf("%s %s • %s", req.FirstName, req.LastName, claimEmail),
			URLPath:       profileURLPath,
			EntityType:    "user",
			EntityID:      userID,
		})
		return 0, ""
	}

	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		EventType:     "profile_update",
		EventCategory: "auth",
		Title:         "Profil ve hesap tercihlerini güncelledi",
		URLPath:       profileURLPath,
		EntityType:    "user",
		EntityID:      userID,
	})
	return 0, ""
}

func (h *StoreAuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, claims, err := verifyTokenAndGetClaims(r.Header.Get("Authorization"))
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

	normalizedPhone, phoneErr := phoneutil.NormalizeAndValidatePhone(req.Phone)
	if phoneErr != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, phoneErr.Error()), http.StatusBadRequest)
		return
	}
	req.Phone = normalizedPhone

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	if statusCode, errJSON := h.persistProfileWithPhone(ctx, r, userID, claims, req); errJSON != "" {
		http.Error(w, errJSON, statusCode)
		return
	}

	safe.Go("Keycloak Async Profile Sync", func() {
		h.asyncSyncKeycloakProfile(userID, req.FirstName, req.LastName, req.Phone)
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"phone":   req.Phone,
		"message": "Profiliniz başarıyla güncellendi.",
	})
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

	userInfo, existsInDB, err := lookupLocalUserForAuth(ctx, userID, firstName, lastName, emailClaim)
	if err != nil {
		http.Error(w, `{"error":"Hesabınız engellenmiştir"}`, http.StatusForbidden)
		return
	}

	if requiresCustomerPhoneCompletion(userInfo, existsInDB) {
		userInfo.EmailVerified = true
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_ = json.NewEncoder(w).Encode(AuthResponse{
			Token:         accessToken,
			User:          userInfo,
			RequiresPhone: true,
		})
		return
	}

	if !userInfo.EmailVerified {
		_, _ = db.Pool.Exec(ctx, "UPDATE identity.users SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1", userInfo.ID)
		userInfo.EmailVerified = true
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	ip := getClientIP(r)
	safe.Go("Record Login History Token", func() {
		recordLoginHistory(context.Background(), userID, ip)
	})

	_ = json.NewEncoder(w).Encode(AuthResponse{
		Token:         accessToken,
		User:          userInfo,
		RequiresPhone: false,
	})
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userInfo.ID,
		VisitorID:     strings.TrimSpace(r.URL.Query().Get("visitor_id")),
		EventType:     "login",
		EventCategory: "auth",
		Title:         "Google hesabı ile oturum açtı",
		EntityType:    "user",
		EntityID:      userInfo.ID,
	})
}

// UserAddress maps the relational model in identity.user_addresses joined with country and state lookups
type UserAddress struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Title       string    `json:"title"`
	AddressType string    `json:"address_type"` // 'billing' or 'shipping'
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	CompanyName *string   `json:"company_name"` // nullable
	Phone       string    `json:"phone"`
	CountryID   string    `json:"country_id"`
	StateID     *string   `json:"state_id"` // nullable
	CityID      *string   `json:"city_id"`  // nullable
	AddressLine string    `json:"address_line"`
	PostalCode  string    `json:"postal_code"`
	TaxNoTCKN   *string   `json:"tax_no_tckn"` // nullable
	TaxOffice   *string   `json:"tax_office"`  // nullable
	IsDefault   bool      `json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Joined fields for display
	CountryName string `json:"country_name,omitempty"`
	StateName   string `json:"state_name,omitempty"`
	CityName    string `json:"city_name,omitempty"`
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

	normalizedPhone, phoneErr := phoneutil.NormalizeAndValidatePhone(req.Phone)
	if phoneErr != nil {
		return phoneErr
	}
	req.Phone = normalizedPhone

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
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		EventType:     "address_update",
		EventCategory: "auth",
		Title:         fmt.Sprintf("“%s” başlıklı yeni adres tanımladı", req.Title),
		Subtitle:      req.AddressLine,
		URLPath:       profileURLPath,
		EntityType:    "address",
		EntityID:      newID,
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
	ResolveAndPersistCustomerGeoByIP(ctx, userID, ipAddress)
}

func (h *StoreAuthHandler) setKeycloakEmailVerified(ctx context.Context, keycloakUserID string) {
	if keycloakUserID == "" {
		return
	}
	adminToken, err := h.getAdminAccessToken(ctx)
	if err != nil {
		log.Printf("[KEYCLOAK SYNC WARNING] Failed to get admin token for email verify sync: %v", err)
		return
	}

	urlStr := fmt.Sprintf("%s/admin/realms/%s/users/%s", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm, keycloakUserID)
	payload := []byte(`{"emailVerified":true}`)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, urlStr, strings.NewReader(string(payload)))
	if err != nil {
		return
	}
	req.Header.Set(headerContentType, mimeApplicationJSON)
	req.Header.Set("Authorization", authBearerPrefix+adminToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		log.Printf("[KEYCLOAK SYNC WARNING] Failed to PUT user emailVerified: %v", err)
		return
	}
	defer resp.Body.Close()
}

// VerifyEmail processes the verification link clicked by the customer
func (h *StoreAuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	frontendURL := "https://mertervitrini.com.tr/profile"
	if token == "" {
		http.Redirect(w, r, frontendURL+"?verified=invalid", http.StatusSeeOther)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var userID, email string
	var expiresAt time.Time
	var alreadyVerified bool

	err := db.Pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(email_verification_expires_at, CURRENT_TIMESTAMP), COALESCE(email_verified, false)
		FROM identity.users
		WHERE email_verification_token = $1
	`, token).Scan(&userID, &email, &expiresAt, &alreadyVerified)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Redirect(w, r, frontendURL+"?verified=not_found", http.StatusSeeOther)
			return
		}
		log.Printf("[VERIFY EMAIL ERROR] DB query error: %v", err)
		http.Redirect(w, r, frontendURL+"?verified=error", http.StatusSeeOther)
		return
	}

	if alreadyVerified {
		http.Redirect(w, r, frontendURL+"?verified=already_verified", http.StatusSeeOther)
		return
	}

	if time.Now().After(expiresAt) {
		http.Redirect(w, r, frontendURL+"?verified=expired", http.StatusSeeOther)
		return
	}

	_, updateErr := db.Pool.Exec(ctx, `
		UPDATE identity.users
		SET email_verified = true,
		    email_verified_at = CURRENT_TIMESTAMP,
		    email_verification_token = NULL,
		    email_verification_expires_at = NULL,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, userID)
	if updateErr != nil {
		log.Printf("[VERIFY EMAIL ERROR] DB update failed for user %s: %v", userID, updateErr)
		http.Redirect(w, r, frontendURL+"?verified=error", http.StatusSeeOther)
		return
	}

	safe.Go("Sync Keycloak Email Verified", func() {
		timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer timeoutCancel()
		h.setKeycloakEmailVerified(timeoutCtx, userID)
	})
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		EventType:     "email_verified",
		EventCategory: "auth",
		Title:         "E-posta adresini doğruladı",
		Subtitle:      email,
		EntityType:    "user",
		EntityID:      userID,
	})

	http.Redirect(w, r, frontendURL+"?verified=success", http.StatusSeeOther)
}

// ResendVerificationEmail sends a new verification link to the customer
func (h *StoreAuthHandler) ResendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var email, firstName string
	var emailVerified bool

	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		userID, err := verifyTokenAndGetUserID(authHeader)
		if err == nil && userID != "" {
			_ = db.Pool.QueryRow(ctx, "SELECT email, first_name, COALESCE(email_verified, false) FROM identity.users WHERE id = $1", userID).
				Scan(&email, &firstName, &emailVerified)
		}
	}

	if email == "" {
		var req struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			trimmedEmail := strings.TrimSpace(strings.ToLower(req.Email))
			if trimmedEmail != "" {
				_ = db.Pool.QueryRow(ctx, "SELECT email, first_name, COALESCE(email_verified, false) FROM identity.users WHERE LOWER(email) = LOWER($1)", trimmedEmail).
					Scan(&email, &firstName, &emailVerified)
			}
		}
	}

	if email == "" {
		http.Error(w, `{"error":"Geçerli bir kullanıcı veya e-posta bulunamadı"}`, http.StatusBadRequest)
		return
	}

	if emailVerified {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"message":          "Bu e-posta adresi zaten doğrulanmış durumdadır.",
			"already_verified": true,
		})
		return
	}

	token, err := generateVerificationToken()
	if err != nil {
		http.Error(w, `{"error":"Doğrulama bağlantısı oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}
	expiresAt := time.Now().Add(24 * time.Hour)

	_, updateErr := db.Pool.Exec(ctx, `
		UPDATE identity.users
		SET email_verification_token = $1,
		    email_verification_expires_at = $2,
		    updated_at = CURRENT_TIMESTAMP
		WHERE LOWER(email) = LOWER($3)
	`, token, expiresAt, email)
	if updateErr != nil {
		log.Printf("[RESEND VERIFY ERROR] DB update failed for %s: %v", email, updateErr)
		http.Error(w, `{"error":"İç sunucu hatası oluştu"}`, http.StatusInternalServerError)
		return
	}

	safe.Go("Resend Email Verification", func() {
		mailer.SendCustomerEmailVerification(h.Cfg, firstName, email, token)
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Doğrulama e-postası başarıyla gönderildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol ediniz.",
		"sent":    true,
	})
}
