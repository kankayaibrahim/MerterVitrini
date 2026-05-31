package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"mertervitrini/admin/backend/config"
	"mertervitrini/admin/backend/models"
)

type AuthHandler struct {
	Cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{Cfg: cfg}
}

// Login is deprecated and returns 410 Gone, redirecting users to Keycloak OIDC authentication flow
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusGone)
	w.Write([]byte(`{"error":"Authentication is migrated to Keycloak. Please login using the OIDC login interface."}`))
}

// VerifyOTP is deprecated and returns 410 Gone
func (h *AuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusGone)
	w.Write([]byte(`{"error":"OTP verification is no longer supported on the local database. Keycloak handles all MFA/OTP challenges."}`))
}

type KeycloakCallbackRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

// KeycloakCallback securely exchanges Keycloak authorization code for Access & ID tokens
func (h *AuthHandler) KeycloakCallback(w http.ResponseWriter, r *http.Request) {
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

	// 1. Build secure back-channel token exchange call to Keycloak
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", h.Cfg.KeycloakURL, h.Cfg.KeycloakRealm)
	
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", req.Code)
	form.Set("redirect_uri", req.RedirectURI)
	form.Set("client_id", h.Cfg.KeycloakClientID)
	form.Set("client_secret", h.Cfg.KeycloakClientSecret)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		log.Printf("[KEYCLOAK ERROR] Failed to construct request: %v", err)
		http.Error(w, `{"error":"Internal error generating authentication request"}`, http.StatusInternalServerError)
		return
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("[KEYCLOAK ERROR] Unreachable Keycloak endpoint: %v", err)
		http.Error(w, `{"error":"Keycloak server is unreachable"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read response from Keycloak"}`, http.StatusInternalServerError)
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[KEYCLOAK ERROR] Authorization code exchange failed (status %d): %s", resp.StatusCode, string(respBytes))
		http.Error(w, fmt.Sprintf(`{"error":"Authorization exchange failed: %s"}`, string(respBytes)), resp.StatusCode)
		return
	}

	// 2. Decode response
	var exchangeResp map[string]any
	if err := json.Unmarshal(respBytes, &exchangeResp); err != nil {
		http.Error(w, `{"error":"Failed to parse Keycloak OIDC payload"}`, http.StatusInternalServerError)
		return
	}

	accessToken, _ := exchangeResp["access_token"].(string)
	if accessToken == "" {
		http.Error(w, `{"error":"No access token returned from identity provider"}`, http.StatusInternalServerError)
		return
	}

	// 3. Decode token claims to return immediate user metadata to client
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

	// Mapping user details from standard claims
	var userID, firstName, lastName, email string
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

	// Assign role
	role := models.RoleAdmin // Standard Admin fallback
	
	// Check Realm Roles
	if realmAccess, ok := claims["realm_access"].(map[string]any); ok {
		if roles, ok := realmAccess["roles"].([]any); ok {
			for _, r := range roles {
				roleStr := strings.ToLower(fmt.Sprintf("%v", r))
				switch models.UserRole(roleStr) {
				case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
					role = models.UserRole(roleStr)
				}
			}
		}
	}
	
	// Check Client specific roles
	if resourceAccess, ok := claims["resource_access"].(map[string]any); ok {
		for _, clientData := range resourceAccess {
			if clientMap, ok := clientData.(map[string]any); ok {
				if roles, ok := clientMap["roles"].([]any); ok {
					for _, r := range roles {
						roleStr := strings.ToLower(fmt.Sprintf("%v", r))
						switch models.UserRole(roleStr) {
						case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
							role = models.UserRole(roleStr)
						}
					}
				}
			}
		}
	}

	// Respond with complete authentication parameters
	w.Header().Set("Content-Type", "application/json")
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
