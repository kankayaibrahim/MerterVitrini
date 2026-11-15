package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/services"
)

func TestValidateHumanAddressTextRejectsGibberishAndAcceptsRealAddresses(t *testing.T) {
	invalidCases := []struct {
		name  string
		input string
	}{
		{"empty", ""},
		{"too short", "Merter 5"},
		{"gibberish single token 1", "Osiskdlskdpsopdpappdpxpxppspupapa"},
		{"gibberish single token 2", "Xidskdlskskkdksodsoaooaoa"},
		{"repeated chars", "aaaaa mahallesi bbbbb sokak no 1"},
		{"keyboard mash multiword", "asdfasdfasdfasdf qwertyuiopasdfghjkl"},
		{"gibberish with short prefix", "Mh psopdpappdpxpxppspupapa no 5"},
		{"only digits and symbols", "1234567890 / 12-34"},
		{"low diversity mash", "abab abab abab abab"},
	}

	for _, tc := range invalidCases {
		t.Run("reject_"+tc.name, func(t *testing.T) {
			if err := ValidateHumanAddressText(tc.input); err == nil {
				t.Fatalf("expected address %q to be rejected, got nil", tc.input)
			}
		})
	}

	validCases := []struct {
		name  string
		input string
	}{
		{"turkish merter address", "Mehmet Nesih Özmen Mah. Gülsever Sok. No:12 D:4"},
		{"turkish tower address", "Akevler Mah. 1076 Sok. Regnum Astrum Tower 8A C2 No:204"},
		{"english wholesale warehouse", "245 West 38th Street, Suite 702, Garment District"},
		{"russian street address", "ул. Ленина, д. 15, офис 4"},
		{"arabic street address", "شارع الملك فهد، مبنى 42، الطابق الثاني"},
	}

	for _, tc := range validCases {
		t.Run("accept_"+tc.name, func(t *testing.T) {
			if err := ValidateHumanAddressText(tc.input); err != nil {
				t.Fatalf("expected valid address %q to pass, got error: %v", tc.input, err)
			}
		})
	}
}

func TestValidateHumanPersonNameRejectsGibberish(t *testing.T) {
	for _, bad := range []string{"", "A", "Osiskdlskdpsopdpappdpxpxppspupapa", "Aaaaaa Kkkkkk", "12345"} {
		if err := ValidateHumanPersonName(bad); err == nil {
			t.Fatalf("expected person name %q to fail validation", bad)
		}
	}
	for _, good := range []string{"Alperen Köse", "Altini Official", "Мария Петрова"} {
		if err := ValidateHumanPersonName(good); err != nil {
			t.Fatalf("expected valid name %q to pass, got %v", good, err)
		}
	}
}

func TestVerifyOrderOrInquiryAntiBotExemptionsAndEnforcement(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:                "unit-test-secret-key-2026-merter",
		GoogleReCaptchaSiteKey:   "site-key-test",
		GoogleReCaptchaSecretKey: "secret-key-test",
	}

	// 1. Enforced web request without reCAPTCHA token must fail cleanly.
	reqNoToken := httptest.NewRequest(http.MethodPost, "/api/v1/store/orders", nil)
	status, msg := verifyOrderOrInquiryAntiBot(context.Background(), cfg, reqNoToken, "", "", "create_order", mobileChallengePurposeCreateOrder)
	if status != http.StatusBadRequest || msg == "" {
		t.Fatalf("expected 400 rejection when reCAPTCHA pair is configured and token is missing; got status=%d msg=%q", status, msg)
	}

	// 2. Valid HMAC mobile challenge must pass without reCAPTCHA token.
	challengeTok, err := issueMobileChallengeToken(cfg, mobileChallengePurposeCreateOrder, time.Now().UTC())
	if err != nil {
		t.Fatalf("failed to issue mobile challenge token: %v", err)
	}
	reqMobile := httptest.NewRequest(http.MethodPost, "/api/v1/store/orders", nil)
	reqMobile.Header.Set("X-Mobile-Challenge", challengeTok)
	if status, msg := verifyOrderOrInquiryAntiBot(context.Background(), cfg, reqMobile, "", "", "create_order", mobileChallengePurposeCreateOrder); status != 0 || msg != "" {
		t.Fatalf("expected valid X-Mobile-Challenge to pass, got status=%d msg=%q", status, msg)
	}

	// 3. Mismatched or tampered mobile challenge header must be rejected with 403.
	reqBadMobile := httptest.NewRequest(http.MethodPost, "/api/v1/store/orders", nil)
	reqBadMobile.Header.Set("X-Mobile-Challenge", challengeTok+"tampered")
	if status, _ := verifyOrderOrInquiryAntiBot(context.Background(), cfg, reqBadMobile, "", "", "create_order", mobileChallengePurposeCreateOrder); status != http.StatusForbidden {
		t.Fatalf("expected tampered X-Mobile-Challenge to return 403, got %d", status)
	}

	// 4. Customer impersonation JWT signed by admin must bypass web reCAPTCHA.
	configureStoreVerifier(cfg.JWTSecret, "")
	tokenSvc := services.NewUnifiedTokenService(cfg.JWTSecret, "", nil)
	impTok := tokenSvc.IssueCustomerImpersonationJWT(services.CustomerImpersonationInput{
		CustomerID:    "cust-123",
		CustomerEmail: "cust@example.com",
		CustomerName:  "Test Buyer",
		AdminID:       "admin-1",
		AdminEmail:    "admin@mertervitrini.com.tr",
		TTL:           time.Hour,
	})
	if impTok == "" {
		t.Fatal("expected non-empty impersonation token")
	}
	reqImp := httptest.NewRequest(http.MethodPost, "/api/v1/store/orders", nil)
	reqImp.Header.Set("Authorization", "Bearer "+impTok)
	if status, msg := verifyOrderOrInquiryAntiBot(context.Background(), cfg, reqImp, "", "", "create_order", mobileChallengePurposeCreateOrder); status != 0 || msg != "" {
		t.Fatalf("expected admin impersonation token to pass anti-bot check, got status=%d msg=%q", status, msg)
	}
}
