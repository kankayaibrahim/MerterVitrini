package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"mertervitrini/backend/config"
	"mertervitrini/backend/pkg/httpclient"
)

// getKeycloakAdminToken retrieves a client_credentials admin token for realm operations
func getKeycloakAdminToken(ctx context.Context, cfg *config.Config) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.KeycloakRealm)
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", cfg.KeycloakClientID)
	form.Set("client_secret", cfg.KeycloakClientSecret)

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
		return "", fmt.Errorf("keycloak admin token failed with status %d: %s", resp.StatusCode, body)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}
	if tokenResp.AccessToken == "" {
		return "", errors.New("empty access token in keycloak response")
	}
	return tokenResp.AccessToken, nil
}

// createKeycloakSupplierUser creates a user in Keycloak and sets credentials
func createKeycloakSupplierUser(ctx context.Context, cfg *config.Config, email, contactName, password, phone, brandID string) (string, error) {
	adminToken, err := getKeycloakAdminToken(ctx, cfg)
	if err != nil {
		return "", fmt.Errorf("admin token error: %w", err)
	}

	names := strings.Fields(contactName)
	firstName := contactName
	lastName := "Tedarikçi"
	if len(names) >= 2 {
		firstName = names[0]
		lastName = strings.Join(names[1:], " ")
	}

	userPayload := map[string]any{
		"username":      email,
		"email":         email,
		"enabled":       true,
		"emailVerified": true,
		"firstName":     firstName,
		"lastName":      lastName,
		"credentials": []map[string]any{
			{
				"type":      "password",
				"value":     password,
				"temporary": false,
			},
		},
	}

	attributes := map[string][]string{}
	if strings.TrimSpace(phone) != "" {
		attributes["phone"] = []string{strings.TrimSpace(phone)}
	}
	if strings.TrimSpace(brandID) != "" {
		attributes["brand_id"] = []string{strings.TrimSpace(brandID)}
	}
	if len(attributes) > 0 {
		userPayload["attributes"] = attributes
	}

	bodyBytes, err := json.Marshal(userPayload)
	if err != nil {
		return "", err
	}

	createURL := fmt.Sprintf("%s/admin/realms/%s/users", cfg.KeycloakURL, cfg.KeycloakRealm)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set(headerContentType, mimeApplicationJSON)
	req.Header.Set("Authorization", authBearerPrefix+adminToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("create user request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		// User already exists in Keycloak, find existing user ID
		return findKeycloakUserIDByEmail(ctx, cfg, adminToken, email)
	}

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("keycloak create user failed with status %d: %s", resp.StatusCode, body)
	}

	loc := resp.Header.Get("Location")
	if loc == "" {
		return findKeycloakUserIDByEmail(ctx, cfg, adminToken, email)
	}
	parts := strings.Split(loc, "/")
	return parts[len(parts)-1], nil
}

// findKeycloakUserIDByEmail looks up user by email
func findKeycloakUserIDByEmail(ctx context.Context, cfg *config.Config, adminToken, email string) (string, error) {
	lookupURL := fmt.Sprintf("%s/admin/realms/%s/users?email=%s&exact=true", cfg.KeycloakURL, cfg.KeycloakRealm, url.QueryEscape(email))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, lookupURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", authBearerPrefix+adminToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var users []struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return "", err
	}
	if len(users) == 0 || users[0].ID == "" {
		return "", fmt.Errorf("user %s not found in keycloak", email)
	}
	return users[0].ID, nil
}

// updateKeycloakSupplierUser updates enabled status, names, and optionally resets password
func updateKeycloakSupplierUser(ctx context.Context, cfg *config.Config, keycloakID, contactName, password string, isActive bool) error {
	if keycloakID == "" {
		return nil
	}
	adminToken, err := getKeycloakAdminToken(ctx, cfg)
	if err != nil {
		return err
	}

	names := strings.Fields(contactName)
	firstName := contactName
	lastName := "Tedarikçi"
	if len(names) >= 2 {
		firstName = names[0]
		lastName = strings.Join(names[1:], " ")
	}

	updatePayload := map[string]any{
		"enabled":   isActive,
		"firstName": firstName,
		"lastName":  lastName,
	}

	bodyBytes, err := json.Marshal(updatePayload)
	if err != nil {
		return err
	}

	updateURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", cfg.KeycloakURL, cfg.KeycloakRealm, keycloakID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, updateURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set(headerContentType, mimeApplicationJSON)
	req.Header.Set("Authorization", authBearerPrefix+adminToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[KEYCLOAK WARNING] Failed to update user %s: %s", keycloakID, body)
	}

	// Password reset if provided
	if strings.TrimSpace(password) != "" {
		resetPayload := map[string]any{
			"type":      "password",
			"value":     password,
			"temporary": false,
		}
		pwBytes, _ := json.Marshal(resetPayload)
		resetURL := fmt.Sprintf("%s/admin/realms/%s/users/%s/reset-password", cfg.KeycloakURL, cfg.KeycloakRealm, keycloakID)
		pwReq, err := http.NewRequestWithContext(ctx, http.MethodPut, resetURL, bytes.NewReader(pwBytes))
		if err == nil {
			pwReq.Header.Set(headerContentType, mimeApplicationJSON)
			pwReq.Header.Set("Authorization", authBearerPrefix+adminToken)
			pwResp, pwErr := httpclient.FastClient.Do(pwReq)
			if pwErr == nil {
				pwResp.Body.Close()
			}
		}
	}

	return nil
}

// deleteKeycloakSupplierUser deletes a user in Keycloak
func deleteKeycloakSupplierUser(ctx context.Context, cfg *config.Config, keycloakID string) error {
	if keycloakID == "" {
		return nil
	}
	adminToken, err := getKeycloakAdminToken(ctx, cfg)
	if err != nil {
		return err
	}

	deleteURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", cfg.KeycloakURL, cfg.KeycloakRealm, keycloakID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", authBearerPrefix+adminToken)

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// loginKeycloakUser attempts Direct Access Grants (Resource Owner Password Credentials Grant)
func loginKeycloakUser(ctx context.Context, cfg *config.Config, email, password string) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", cfg.KeycloakURL, cfg.KeycloakRealm)
	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("client_id", cfg.KeycloakClientID)
	form.Set("client_secret", cfg.KeycloakClientSecret)
	form.Set("username", email)
	form.Set("password", password)

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
		return "", fmt.Errorf("login failed: status %d, body: %s", resp.StatusCode, body)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}
	if tokenResp.AccessToken == "" {
		return "", errors.New("access_token not found in keycloak response")
	}
	return tokenResp.AccessToken, nil
}
