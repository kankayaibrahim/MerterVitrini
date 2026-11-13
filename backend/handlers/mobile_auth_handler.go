package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"
)

type MobileLoginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	Role       string `json:"role"` // "customer", "supplier", or "auto"
	DeviceName string `json:"device_name,omitempty"`
	VisitorID  string `json:"visitor_id,omitempty"`
}

type MobileRefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type DeleteAccountRequest struct {
	Reason string `json:"reason"`
}

type RegisterDeviceRequest struct {
	DeviceToken string `json:"device_token"`
	Platform    string `json:"platform"` // "android" or "ios"
	AppVersion  string `json:"app_version"`
	DeviceModel string `json:"device_model"`
	Locale      string `json:"locale"`
}

func (h *MobileHandler) requestKeycloakTokensWithRefresh(ctx context.Context, email, password string) (string, string, int, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)

	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)
	form.Set("username", email)
	form.Set("password", password)
	form.Set("scope", "openid profile email offline_access")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", 0, err
	}
	req.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", "", 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", 0, fmt.Errorf("invalid_credentials: %s", body)
	}

	var tokenResp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", "", 0, err
	}

	accessToken, _ := tokenResp["access_token"].(string)
	refreshToken, _ := tokenResp["refresh_token"].(string)
	expiresInFloat, _ := tokenResp["expires_in"].(float64)
	if accessToken == "" {
		return "", "", 0, errors.New("empty_access_token")
	}
	return accessToken, refreshToken, int(expiresInFloat), nil
}

func (h *MobileHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req MobileLoginRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek formatı.")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	rolePref := strings.ToLower(strings.TrimSpace(req.Role))
	if rolePref == "" {
		rolePref = "auto"
	}

	if email == "" || req.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "E-posta ve şifre zorunludur.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	if rolePref == "supplier" {
		h.loginAsSupplier(ctx, w, email, req.Password)
		return
	}

	if rolePref == "auto" && h.tryAutoSupplierLogin(ctx, w, email, req.Password) {
		return
	}

	visitorID := firstNonEmptyStr(req.VisitorID, r.Header.Get(headerVisitorID))
	h.loginAsCustomer(ctx, w, r, email, req.Password, visitorID)
}

func (h *MobileHandler) tryAutoSupplierLogin(ctx context.Context, w http.ResponseWriter, email, password string) bool {
	u, pwHash, brandActive, err := lookupSupplierUserByEmail(ctx, email)
	if err != nil || !u.IsActive || !brandActive {
		return false
	}
	tok, refTok := h.authenticateSupplierCredentials(ctx, u, pwHash, email, password)
	if tok == "" {
		return false
	}
	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", u.ID)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"role":          "supplier",
		"token":         tok,
		"refresh_token": refTok,
		"supplier_user": u,
	})
	return true
}

func (h *MobileHandler) authenticateSupplierCredentials(ctx context.Context, u *models.SupplierUser, pwHash *string, email, password string) (string, string) {
	tok, refTok, _, err := h.requestKeycloakTokensWithRefresh(ctx, email, password)
	if err == nil && tok != "" {
		return tok, refTok
	}
	legacyTok := h.SupplierAuth.attemptLegacySupplierMigration(ctx, u, pwHash, password)
	return legacyTok, ""
}

func (h *MobileHandler) loginAsSupplier(ctx context.Context, w http.ResponseWriter, email, password string) {
	u, pwHash, brandActive, err := lookupSupplierUserByEmail(ctx, email)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errMsgInvalidCredentials)
		return
	}
	if !u.IsActive {
		httpx.Error(w, http.StatusForbidden, "Tedarikçi hesabınız askıya alınmıştır.")
		return
	}
	if !brandActive {
		httpx.Error(w, http.StatusForbidden, "Bağlı olduğunuz tedarikçi firma pasif durumdadır.")
		return
	}

	tok, refTok := h.authenticateSupplierCredentials(ctx, u, pwHash, email, password)
	if tok == "" {
		httpx.Error(w, http.StatusUnauthorized, errMsgInvalidCredentials)
		return
	}

	_, _ = db.Pool.Exec(ctx, "UPDATE catalog.supplier_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", u.ID)

	var hasCustomerAccount bool
	_ = db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM identity.users WHERE lower(email) = $1 AND is_blocked = false)", email).Scan(&hasCustomerAccount)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"role":                 "supplier",
		"token":                tok,
		"refresh_token":        refTok,
		"supplier_user":        u,
		"has_customer_account": hasCustomerAccount,
	})
}

func buildMobileCustomerLoginResponse(
	accessToken string,
	refreshToken string,
	expiresIn int,
	userInfo *UserInfo,
	requiresPhone bool,
	hasSupplierAccount bool,
) map[string]any {
	return map[string]any{
		"role":                 "customer",
		"token":                accessToken,
		"refresh_token":        refreshToken,
		"expires_in":           expiresIn,
		"user":                 userInfo,
		"requires_phone":       requiresPhone,
		"has_supplier_account": hasSupplierAccount,
	}
}

func (h *MobileHandler) loginAsCustomer(ctx context.Context, w http.ResponseWriter, r *http.Request, email, password, visitorID string) {
	accessToken, refreshToken, expiresIn, err := h.requestKeycloakTokensWithRefresh(ctx, email, password)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errMsgInvalidCredentials)
		return
	}

	var jwtSecret, kcPubKey string
	if h.Cfg != nil {
		jwtSecret = h.Cfg.JWTSecret
		kcPubKey = h.Cfg.KeycloakPublicKey
	}
	claims, err := services.VerifyJWTWithKeys(accessToken, jwtSecret, kcPubKey)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "Oturum doğrulanamadı.")
		return
	}

	userID, firstName, lastName, emailClaim := extractClaimsUserInfo(claims, email)
	userInfo, existsInDB, err := lookupLocalUserForAuth(ctx, userID, firstName, lastName, emailClaim)
	if err != nil {
		if err.Error() == "blocked_user" {
			httpx.Error(w, http.StatusForbidden, "Hesabınız yönetici tarafından engellenmiştir.")
			return
		}
		httpx.Error(w, http.StatusUnauthorized, "Kullanıcı bilgileri alınamadı.")
		return
	}

	requiresPhone := requiresCustomerPhoneCompletion(userInfo, existsInDB)
	if !requiresPhone {
		ip := getClientIP(r)
		safe.Go("Mobile Login History", func() {
			recordLoginHistory(context.Background(), userInfo.ID, ip)
		})
		RecordMemberActivityAsync(r, MemberActivityInput{
			UserID:        userInfo.ID,
			VisitorID:     visitorID,
			EventType:     "login",
			EventCategory: "auth",
			Title:         "Mobil uygulamadan oturum açtı",
			Subtitle:      "IP: " + ip,
			DeviceType:    "mobile_app",
			EntityType:    "user",
			EntityID:      userInfo.ID,
		})
	}

	var hasSupplierAccount bool
	_ = db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog.supplier_users WHERE lower(email) = $1 AND is_active = true)", email).Scan(&hasSupplierAccount)

	httpx.JSON(w, http.StatusOK, buildMobileCustomerLoginResponse(
		accessToken,
		refreshToken,
		expiresIn,
		userInfo,
		requiresPhone,
		hasSupplierAccount,
	))
}

func (h *MobileHandler) exchangeKeycloakRefreshToken(ctx context.Context, refreshToken string) (string, string, int, bool) {
	trimmed := strings.TrimSpace(refreshToken)
	if trimmed == "" || h.Cfg == nil {
		return "", "", 0, false
	}

	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)
	form.Set("refresh_token", trimmed)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", 0, false
	}
	httpReq.Header.Set(headerContentType, mimeFormURLEncoded)

	resp, err := httpclient.FastClient.Do(httpReq)
	if err != nil {
		return "", "", 0, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", 0, false
	}

	var tokenResp map[string]any
	if json.NewDecoder(resp.Body).Decode(&tokenResp) != nil {
		return "", "", 0, false
	}
	acc, _ := tokenResp["access_token"].(string)
	ref, _ := tokenResp["refresh_token"].(string)
	exp, _ := tokenResp["expires_in"].(float64)
	if acc == "" {
		return "", "", 0, false
	}
	return acc, ref, int(exp), true
}

func (h *MobileHandler) tryReissueSupplierToken(ctx context.Context, authHeader string) (string, bool) {
	if h == nil || h.Tokens == nil {
		return "", false
	}
	principal, err := h.Tokens.ResolvePrincipal(ctx, authHeader)
	if err != nil || principal == nil || principal.Role != "supplier" || principal.UserID == "" || principal.Email == "" {
		return "", false
	}
	u, _, brandActive, err := lookupSupplierUserByEmail(ctx, principal.Email)
	if err != nil || !u.IsActive || !brandActive {
		return "", false
	}
	if u.ID != principal.UserID && !strings.EqualFold(u.Email, principal.Email) {
		return "", false
	}
	newTok := h.Tokens.IssueSupplierJWT(u)
	return newTok, newTok != ""
}

func (h *MobileHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req MobileRefreshRequest
	_ = httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if acc, ref, exp, ok := h.exchangeKeycloakRefreshToken(ctx, req.RefreshToken); ok {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"token":         acc,
			"refresh_token": ref,
			"expires_in":    exp,
		})
		return
	}

	if newTok, ok := h.tryReissueSupplierToken(ctx, r.Header.Get("Authorization")); ok {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"token":         newTok,
			"refresh_token": "",
		})
		return
	}

	httpx.Error(w, http.StatusUnauthorized, "Oturum yenilenemedi, lütfen tekrar giriş yapın.")
}

// DeleteAccount implements Google Play Store mandatory in-app account deletion via OCP AccountDeletionRegistry.
func (h *MobileHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	if h == nil || h.Tokens == nil {
		httpx.Error(w, http.StatusUnauthorized, "Yetkilendirme servisi yapılandırılmamış.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	principal, err := h.Tokens.ResolvePrincipal(ctx, r.Header.Get("Authorization"))
	if err != nil || principal == nil || principal.UserID == "" {
		msg := "Geçersiz oturum anahtarı."
		if err != nil {
			msg = err.Error()
		}
		httpx.Error(w, http.StatusUnauthorized, msg)
		return
	}

	var req DeleteAccountRequest
	_ = httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes)

	if err := h.Deletion.Execute(ctx, *principal, req.Reason, getClientIP(r)); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Hesabınız ve ilişkili kişisel verileriniz kalıcı olarak silindi.",
	})
}

func (h *MobileHandler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	principal, err := h.Tokens.ResolvePrincipal(ctx, r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req RegisterDeviceRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil || strings.TrimSpace(req.DeviceToken) == "" {
		httpx.Error(w, http.StatusBadRequest, "Cihaz anahtarı (device_token) zorunludur.")
		return
	}

	platform := strings.ToLower(strings.TrimSpace(req.Platform))
	if platform != "ios" && platform != "web" {
		platform = "android"
	}
	locale := strings.TrimSpace(req.Locale)
	if locale == "" {
		locale = "tr"
	}

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO identity.mobile_devices (
			user_id, user_role, brand_id, fcm_token, device_token, platform, app_version, device_model, language_code, locale, is_active, last_seen_at
		) VALUES ($1, $2, NULLIF($3, '')::uuid, $4, $4, $5, $6, $7, $8, $8, true, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, user_role, device_token)
		DO UPDATE SET
			fcm_token = EXCLUDED.fcm_token,
			platform = EXCLUDED.platform,
			app_version = EXCLUDED.app_version,
			device_model = EXCLUDED.device_model,
			language_code = EXCLUDED.language_code,
			locale = EXCLUDED.locale,
			is_active = true,
			last_seen_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
	`, principal.UserID, principal.Role, principal.BrandID, strings.TrimSpace(req.DeviceToken), platform, req.AppVersion, req.DeviceModel, locale)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Cihaz kaydı yapılamadı.")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *MobileHandler) UnregisterDevice(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	principal, err := h.Tokens.ResolvePrincipal(ctx, r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("device_token"))
	if token != "" {
		_, _ = db.Pool.Exec(ctx, `DELETE FROM identity.mobile_devices WHERE user_id = $1 AND device_token = $2`, principal.UserID, token)
	} else {
		_, _ = db.Pool.Exec(ctx, `UPDATE identity.mobile_devices SET is_active = false WHERE user_id = $1 AND user_role = $2`, principal.UserID, principal.Role)
	}

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// Register handles POST /api/v1/mobile/auth/register using HMAC challenge verification instead of browser ReCAPTCHA.
func (h *MobileHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek gövdesi")
		return
	}

	if req.WebsiteHP != "" {
		writeFakeHoneypotRegisterResponse(w, r, req.WebsiteHP)
		return
	}

	if !h.requireMobileChallenge(w, r, mobileChallengePurposeReg, req.ChallengeToken, req.FormChallengeToken) {
		return
	}

	if errJSON := normalizeAndValidateRegisterInput(&req); errJSON != "" {
		http.Error(w, errJSON, http.StatusBadRequest)
		return
	}

	if h.StoreAuth == nil {
		httpx.Error(w, http.StatusInternalServerError, "Kimlik servisi hazır değil.")
		return
	}
	h.StoreAuth.completeCustomerRegistration(w, r, req, true)
}

// SubmitSupplierApplication handles POST /api/v1/mobile/supplier-applications using HMAC challenge verification.
func (h *MobileHandler) SubmitSupplierApplication(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSupplierApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz istek formatı")
		return
	}

	if !h.requireMobileChallenge(w, r, mobileChallengePurposeSupp, req.ChallengeToken, req.FormChallengeToken) {
		return
	}

	if errMsg := normalizeAndValidateSupplierApplicationRequest(&req); errMsg != "" {
		httpx.Error(w, http.StatusBadRequest, errMsg)
		return
	}

	if h.SupplierApps == nil {
		httpx.Error(w, http.StatusInternalServerError, "Tedarikçi başvuru servisi hazır değil.")
		return
	}
	h.SupplierApps.createSupplierApplication(w, r, req)
}

// CreateServiceProviderApplication handles POST /api/v1/mobile/service-providers using HMAC challenge verification.
func (h *MobileHandler) CreateServiceProviderApplication(w http.ResponseWriter, r *http.Request) {
	var req serviceProviderApplyPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz başvuru verisi")
		return
	}

	if !h.requireMobileChallenge(w, r, mobileChallengePurposeService, req.ChallengeToken, req.FormChallengeToken) {
		return
	}

	if errMsg := validateServiceProviderApplyPayload(&req); errMsg != "" {
		httpx.Error(w, http.StatusBadRequest, errMsg)
		return
	}

	if h.Marketplace == nil {
		httpx.Error(w, http.StatusInternalServerError, "Hizmet sağlayıcı servisi hazır değil.")
		return
	}
	h.Marketplace.createServiceProviderApplication(w, r, req)
}

