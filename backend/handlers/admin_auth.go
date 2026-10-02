package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/models"
)

type AdminAuthHandler struct {
	Cfg *config.Config
}

func NewAdminAuthHandler(cfg *config.Config) *AdminAuthHandler {
	return &AdminAuthHandler{Cfg: cfg}
}

// Login is deprecated and returns 410 Gone, redirecting users to Keycloak OIDC authentication flow
func (h *AdminAuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusGone)
	w.Write([]byte(`{"error":"Authentication is migrated to Keycloak. Please login using the OIDC login interface."}`))
}

// VerifyOTP is deprecated and returns 410 Gone
func (h *AdminAuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusGone)
	w.Write([]byte(`{"error":"OTP verification is no longer supported on the local database. Keycloak handles all MFA/OTP challenges."}`))
}

type KeycloakCallbackRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

func matchUserRole(r any) (models.UserRole, bool) {
	roleStr := strings.ToLower(fmt.Sprintf("%v", r))
	switch models.UserRole(roleStr) {
	case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
		return models.UserRole(roleStr), true
	default:
		return "", false
	}
}

func extractRealmRole(claims jwt.MapClaims, currentRole models.UserRole) models.UserRole {
	realmAccess, ok := claims["realm_access"].(map[string]any)
	if !ok {
		return currentRole
	}
	roles, ok := realmAccess["roles"].([]any)
	if !ok {
		return currentRole
	}
	for _, r := range roles {
		if matched, ok := matchUserRole(r); ok {
			currentRole = matched
		}
	}
	return currentRole
}

func extractResourceAccessRole(claims jwt.MapClaims, currentRole models.UserRole) models.UserRole {
	resourceAccess, ok := claims["resource_access"].(map[string]any)
	if !ok {
		return currentRole
	}
	for _, clientData := range resourceAccess {
		clientMap, ok := clientData.(map[string]any)
		if !ok {
			continue
		}
		roles, ok := clientMap["roles"].([]any)
		if !ok {
			continue
		}
		for _, r := range roles {
			if matched, ok := matchUserRole(r); ok {
				currentRole = matched
			}
		}
	}
	return currentRole
}

func extractUserRole(claims jwt.MapClaims) models.UserRole {
	role := models.RoleAdmin
	role = extractRealmRole(claims, role)
	role = extractResourceAccessRole(claims, role)
	return role
}

func extractUserMetadata(claims jwt.MapClaims) (userID, firstName, lastName, email string) {
	if sub, ok := claims["sub"].(string); ok {
		userID = sub
	}
	if givenName, ok := claims["given_name"].(string); ok {
		firstName = givenName
	} else if fName, ok := claims["first_name"].(string); ok {
		firstName = fName
	}
	if familyName, ok := claims["family_name"].(string); ok {
		lastName = familyName
	} else if lName, ok := claims["last_name"].(string); ok {
		lastName = lName
	}
	if emailClaim, ok := claims["email"].(string); ok {
		email = emailClaim
	}
	return userID, firstName, lastName, email
}

func exchangeKeycloakCode(ctx context.Context, cfg *config.Config, code, redirectURI string) (string, int, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.KeycloakRealm)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", cfg.KeycloakClientID)
	form.Set("client_secret", cfg.KeycloakClientSecret)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("internal error generating authentication request: %w", err)
	}
	httpReq.Header.Set(headerContentType, mimeFormURLEncoded)

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", http.StatusBadGateway, fmt.Errorf("keycloak server is unreachable: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("failed to read response from Keycloak: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", resp.StatusCode, fmt.Errorf("authorization exchange failed: %s", string(respBytes))
	}

	var exchangeResp map[string]any
	if err := json.Unmarshal(respBytes, &exchangeResp); err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("failed to parse Keycloak OIDC payload: %w", err)
	}

	accessToken, _ := exchangeResp["access_token"].(string)
	if accessToken == "" {
		return "", http.StatusInternalServerError, errors.New("no access token returned from identity provider")
	}
	return accessToken, http.StatusOK, nil
}

// KeycloakCallback securely exchanges Keycloak authorization code for Access & ID tokens
func (h *AdminAuthHandler) KeycloakCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req KeycloakCallbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.RedirectURI == "" {
		http.Error(w, `{"error":"Code and redirect_uri are required"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	accessToken, status, err := exchangeKeycloakCode(ctx, h.Cfg, req.Code, req.RedirectURI)
	if err != nil {
		log.Printf("[KEYCLOAK ERROR] Token exchange error: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), status)
		return
	}

	parser := jwt.NewParser()
	token, _, err := parser.ParseUnverified(accessToken, jwt.MapClaims{})
	if err != nil {
		log.Printf("[KEYCLOAK ERROR] JWT claim parse failure: %v", err)
		http.Error(w, `{"error":"Failed to unpack user session claims"}`, http.StatusInternalServerError)
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Session profile claims are missing"}`, http.StatusInternalServerError)
		return
	}

	userID, firstName, lastName, email := extractUserMetadata(claims)
	role := extractUserRole(claims)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(models.AuthResponse{
		RequireOtp: false,
		Token:      accessToken,
		User: &models.UserInfo{
			ID:        userID,
			FirstName: firstName,
			LastName:  lastName,
			Email:     email,
			Role:      role,
		},
	})
}


