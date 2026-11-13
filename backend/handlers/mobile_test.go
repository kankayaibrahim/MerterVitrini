package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
	"mertervitrini/backend/config"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/services"
)

type mockDeletionStrategy struct {
	role         string
	deletedEmail string
	reason       string
}

func (m *mockDeletionStrategy) Role() string { return m.role }

func (m *mockDeletionStrategy) DeleteAccount(_ context.Context, principal services.MobilePrincipal, reason string) error {
	m.deletedEmail = principal.Email
	m.reason = reason
	return nil
}

func TestSupplierLocalJWTAndMobileDeleteAccountViaDIP(t *testing.T) {
	secret := "test-mobile-jwt-secret-key-2026"
	supUser := &models.SupplierUser{
		ID:          "01950000-0000-7000-8000-000000000001",
		BrandID:     "01950000-0000-7000-8000-000000000099",
		BrandName:   "Lustrin Tekstil",
		AliasCode:   "MIMOZA",
		Email:       "satis@mimoza.test",
		ContactName: "Ahmet Yılmaz",
		IsOwner:     false,
		IsActive:    true,
	}

	tokenSvc := services.NewUnifiedTokenService(secret, "", nil)
	tok := tokenSvc.IssueSupplierJWT(supUser)
	if tok == "" {
		t.Fatalf("expected non-empty supplier JWT")
	}

	mw := middleware.SupplierAuthMiddleware(secret, "")
	var capturedBrandID, capturedUserID string
	protected := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := middleware.GetSupplierFromContext(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		capturedBrandID = claims.BrandID
		capturedUserID = claims.UserID
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/mobile/supplier/dashboard", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from SupplierAuthMiddleware, got %d (%s)", rec.Code, rec.Body.String())
	}
	if capturedBrandID != supUser.BrandID || capturedUserID != supUser.ID {
		t.Fatalf("unexpected claims brand=%s user=%s", capturedBrandID, capturedUserID)
	}

	supDeletion := &mockDeletionStrategy{role: "supplier"}
	deletionReg := services.NewAccountDeletionRegistry(nil, supDeletion)
	mh := NewMobileHandler(&config.Config{JWTSecret: secret}, nil, nil, MobileHandlerDeps{
		Media:    services.NewLocalImageMediaService(t.TempDir()),
		Tokens:   tokenSvc,
		Deletion: deletionReg,
	})

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/mobile/auth/account", strings.NewReader(`{"reason":"test closure"}`))
	delReq.Header.Set("Authorization", "Bearer "+tok)
	delRec := httptest.NewRecorder()
	mh.DeleteAccount(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from DeleteAccount, got %d (%s)", delRec.Code, delRec.Body.String())
	}
	if supDeletion.deletedEmail != supUser.Email || supDeletion.reason != "test closure" {
		t.Fatalf("expected injected strategy to capture email=%s reason='test closure', got email=%s reason=%s",
			supUser.Email, supDeletion.deletedEmail, supDeletion.reason)
	}
}

func TestMobileChatImageUploadViaInjectedMediaProcessor(t *testing.T) {
	secret := "test-chat-upload-jwt-secret"
	tokenSvc := services.NewUnifiedTokenService(secret, "", nil)
	chatTok := tokenSvc.IssueSupplierJWT(&models.SupplierUser{
		ID:          "01950000-0000-7000-8000-000000000011",
		BrandID:     "01950000-0000-7000-8000-000000000022",
		BrandName:   "Test Tedarikçi",
		AliasCode:   "TST",
		Email:       "chat@test.local",
		ContactName: "Chat Test",
		IsActive:    true,
	})

	mediaSvc := services.NewLocalImageMediaService(t.TempDir())
	mh := NewMobileHandler(&config.Config{JWTSecret: secret}, nil, nil, MobileHandlerDeps{
		Media:  mediaSvc,
		Tokens: tokenSvc,
	})

	src := image.NewRGBA(image.Rect(0, 0, 2000, 1500))
	for y := range 20 {
		for x := range 20 {
			src.Set(x, y, color.RGBA{R: 200, G: 140, B: 40, A: 255})
		}
	}
	var jpegBuf bytes.Buffer
	if err := jpeg.Encode(&jpegBuf, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("jpeg encode failed: %v", err)
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("image", "numune.jpg")
	if err != nil {
		t.Fatalf("CreateFormFile failed: %v", err)
	}
	_, _ = part.Write(jpegBuf.Bytes())
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/chat/upload-image", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+chatTok)
	rec := httptest.NewRecorder()

	mh.UploadChatImage(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from UploadChatImage, got %d (%s)", rec.Code, rec.Body.String())
	}

	var resp map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if !strings.HasPrefix(resp["image_url"], "/uploads/chat/chat_") {
		t.Fatalf("unexpected image_url: %s", resp["image_url"])
	}
}

func TestCentrifugeWireProtocolJSONHandshakeAndPubSub(t *testing.T) {
	chatHandler := NewChatHandler(&config.Config{}, services.NoopNotificationDispatcher{})
	defer func() {
		_ = chatHandler.Node.Shutdown(context.Background())
	}()

	srv := httptest.NewServer(chatHandler.WebsocketHandler())
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	wsCfg, err := websocket.NewConfig(wsURL, "http://localhost")
	if err != nil {
		t.Fatalf("websocket config error: %v", err)
	}

	conn, err := websocket.DialConfig(wsCfg)
	if err != nil {
		t.Fatalf("websocket dial error: %v", err)
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	connectCmd := `{"id":1,"connect":{"token":"cust-mobile-test"}}` + "\n"
	if _, err := conn.Write([]byte(connectCmd)); err != nil {
		t.Fatalf("write connect failed: %v", err)
	}

	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("read connect reply failed: %v", err)
	}
	connectReply := string(buf[:n])
	if !strings.Contains(connectReply, `"connect"`) || !strings.Contains(connectReply, `"client"`) {
		t.Fatalf("unexpected connect reply: %s", connectReply)
	}

	subCmd := `{"id":2,"subscribe":{"channel":"chat:room#test-room-1"}}` + "\n"
	if _, err := conn.Write([]byte(subCmd)); err != nil {
		t.Fatalf("write subscribe failed: %v", err)
	}
	n, err = conn.Read(buf)
	if err != nil {
		t.Fatalf("read subscribe reply failed: %v", err)
	}
	subReply := string(buf[:n])
	if !strings.Contains(subReply, `"id":2`) {
		t.Fatalf("unexpected subscribe reply: %s", subReply)
	}

	chatHandler.publishEvent("chat:room#test-room-1", "new_message", map[string]any{
		"id":           "msg-99",
		"content":      "Merhaba toptan fiyat teklifimiz hazırdır",
		"message_type": "text",
	})

	n, err = conn.Read(buf)
	if err != nil {
		t.Fatalf("read push message failed: %v", err)
	}
	pushFrame := strings.TrimSpace(string(buf[:n]))

	var parsed map[string]any
	firstLine := strings.Split(pushFrame, "\n")[0]
	if err := json.Unmarshal([]byte(firstLine), &parsed); err != nil {
		t.Fatalf("failed to unmarshal push frame (%s): %v", firstLine, err)
	}
	pushObj, ok := parsed["push"].(map[string]any)
	if !ok {
		t.Fatalf("expected push field in frame: %s", firstLine)
	}
	if pushObj["channel"] != "chat:room#test-room-1" {
		t.Fatalf("unexpected push channel: %v", pushObj["channel"])
	}
}

func TestChatMessagePayloadAndSupplierSenderHelpers(t *testing.T) {
	senderID, senderName := resolveSupplierSender(&middleware.SupplierClaims{
		UserID:      "user-1",
		BrandID:     "brand-1",
		BrandName:   "Lustrin Tekstil",
		AliasCode:   "MIMOZA",
		ContactName: "Ahmet Yılmaz",
	})
	if senderID != "user-1" || senderName != "Ahmet Yılmaz (MIMOZA)" {
		t.Fatalf("unexpected sender resolution: id=%s name=%s", senderID, senderName)
	}

	fallbackID, fallbackName := resolveSupplierSender(&middleware.SupplierClaims{
		BrandID:   "brand-2",
		BrandName: "Flora Tekstil",
	})
	if fallbackID != "brand-2" || fallbackName != "Flora Tekstil" {
		t.Fatalf("unexpected fallback sender resolution: id=%s name=%s", fallbackID, fallbackName)
	}

	msgType, content, metaBytes, err := buildSupplierMessagePayload(context.Background(), "brand-1", SendSupplierMessageRequest{
		ImageUrl: "/uploads/chat/sample.jpg",
	})
	if err != nil || msgType != "image" || content != "📷 Fotoğraf" || !strings.Contains(string(metaBytes), "/uploads/chat/sample.jpg") {
		t.Fatalf("unexpected supplier image payload: type=%s content=%s meta=%s err=%v", msgType, content, string(metaBytes), err)
	}

	if _, _, _, err := buildSupplierMessagePayload(context.Background(), "brand-1", SendSupplierMessageRequest{}); err == nil {
		t.Fatalf("expected error for empty supplier text message")
	}

	custType, custContent, _, err := buildCustomerMessagePayload(SendCustomerMessageRequest{Content: "  Merhaba seri kaçlı?  "})
	if err != nil || custType != "text" || custContent != "Merhaba seri kaçlı?" {
		t.Fatalf("unexpected customer text payload: type=%s content=%s err=%v", custType, custContent, err)
	}
}

func TestMobileCustomerPhoneCompletionLoginResponse(t *testing.T) {
	missingPhoneUser := &UserInfo{
		ID:        "01950000-0000-7000-8000-000000000101",
		FirstName: "Ayşe",
		LastName:  "Demir",
		Email:     "ayse@example.com",
		Phone:     "",
		Role:      "customer",
	}
	if !requiresCustomerPhoneCompletion(missingPhoneUser, true) {
		t.Fatalf("expected requiresCustomerPhoneCompletion=true when user has empty phone")
	}
	if !requiresCustomerPhoneCompletion(&UserInfo{ID: "u-2", Email: "x@y.com", Phone: "+905337192845"}, false) {
		t.Fatalf("expected requiresCustomerPhoneCompletion=true when user does not exist in local DB yet")
	}

	completeUser := &UserInfo{
		ID:        "01950000-0000-7000-8000-000000000102",
		FirstName: "Mehmet",
		LastName:  "Kaya",
		Email:     "mehmet@example.com",
		Phone:     "+905324891726",
		Role:      "customer",
	}
	if requiresCustomerPhoneCompletion(completeUser, true) {
		t.Fatalf("expected requiresCustomerPhoneCompletion=false when user exists with valid phone")
	}

	resp := buildMobileCustomerLoginResponse("access-jwt", "refresh-jwt", 3600, missingPhoneUser, true, false)
	if resp["role"] != "customer" {
		t.Fatalf("expected role=customer, got %v", resp["role"])
	}
	if resp["requires_phone"] != true {
		t.Fatalf("expected non-blocking requires_phone=true, got %v", resp["requires_phone"])
	}
	if resp["token"] != "access-jwt" || resp["refresh_token"] != "refresh-jwt" || resp["expires_in"] != 3600 {
		t.Fatalf("unexpected token fields in login response: %+v", resp)
	}
	if resp["has_supplier_account"] != false {
		t.Fatalf("expected has_supplier_account=false, got %v", resp["has_supplier_account"])
	}
}

func TestMobileChallengeIssueVerifyAndHTTP(t *testing.T) {
	cfg := &config.Config{JWTSecret: "mobile-challenge-test-secret-2026"}
	now := time.Date(2026, 11, 14, 10, 0, 0, 0, time.UTC)

	regToken, err := issueMobileChallengeToken(cfg, mobileChallengePurposeReg, now)
	if err != nil || regToken == "" {
		t.Fatalf("failed to issue mobile challenge token: %v", err)
	}
	if err := verifyMobileChallengeToken(cfg, regToken, mobileChallengePurposeReg, now.Add(5*time.Minute)); err != nil {
		t.Fatalf("expected valid register token within TTL, got %v", err)
	}

	// Mismatched purpose must be rejected
	if err := verifyMobileChallengeToken(cfg, regToken, mobileChallengePurposeSupp, now.Add(time.Minute)); err != errMobileChallengeMismatch {
		t.Fatalf("expected errMobileChallengeMismatch, got %v", err)
	}

	// Bootstrap default mobile_form token works across all 3 mobile form endpoints
	bootstrapToken, err := issueMobileChallengeToken(cfg, mobileChallengeDefaultPurpose, now)
	if err != nil {
		t.Fatalf("failed to issue bootstrap challenge token: %v", err)
	}
	for _, purpose := range []string{mobileChallengePurposeReg, mobileChallengePurposeSupp, mobileChallengePurposeService} {
		if err := verifyMobileChallengeToken(cfg, bootstrapToken, purpose, now.Add(time.Minute)); err != nil {
			t.Fatalf("expected bootstrap token accepted for %s, got %v", purpose, err)
		}
	}

	// Empty, malformed, tampered, and expired checks
	if err := verifyMobileChallengeToken(cfg, "   ", mobileChallengePurposeReg, now); err != errMobileChallengeMissing {
		t.Fatalf("expected errMobileChallengeMissing, got %v", err)
	}
	if err := verifyMobileChallengeToken(cfg, "not-a-valid-token", mobileChallengePurposeReg, now); err != errMobileChallengeInvalid {
		t.Fatalf("expected errMobileChallengeInvalid for missing dot, got %v", err)
	}
	parts := strings.Split(regToken, ".")
	tampered := parts[0] + ".AAAA" + parts[1][4:]
	if err := verifyMobileChallengeToken(cfg, tampered, mobileChallengePurposeReg, now); err != errMobileChallengeInvalid {
		t.Fatalf("expected errMobileChallengeInvalid for tampered sig, got %v", err)
	}
	if err := verifyMobileChallengeToken(cfg, regToken, mobileChallengePurposeReg, now.Add(mobileChallengeTTL+time.Second)); err != errMobileChallengeExpired {
		t.Fatalf("expected errMobileChallengeExpired after TTL, got %v", err)
	}
	if err := verifyMobileChallengeToken(cfg, regToken, mobileChallengePurposeReg, now.Add(-2*time.Minute)); err != errMobileChallengeInvalid {
		t.Fatalf("expected errMobileChallengeInvalid for future token beyond skew, got %v", err)
	}

	// HTTP GET /api/v1/mobile/challenge
	mh := NewMobileHandler(cfg, NewStoreAuthHandler(cfg), NewSupplierPortalHandler(cfg, nil))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mobile/challenge?purpose=supplier_apply", nil)
	rec := httptest.NewRecorder()
	mh.GetChallenge(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from GetChallenge, got %d (%s)", rec.Code, rec.Body.String())
	}
	var chalResp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &chalResp); err != nil {
		t.Fatalf("failed to decode challenge response: %v", err)
	}
	issuedTok, _ := chalResp["challenge_token"].(string)
	if issuedTok == "" || chalResp["token"] != issuedTok {
		t.Fatalf("expected matching token and challenge_token in response: %+v", chalResp)
	}
	if err := verifyMobileChallengeToken(cfg, issuedTok, mobileChallengePurposeSupp, time.Now().UTC()); err != nil {
		t.Fatalf("expected HTTP-issued challenge token to verify for supplier_apply, got %v", err)
	}

	// Mobile public endpoints reject missing/bad challenge tokens with 403
	for _, tc := range []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		path    string
		body    string
	}{
		{"register", mh.Register, "/api/v1/mobile/auth/register", `{"email":"a@b.com","password":"Password123!"}`},
		{"supplier", mh.SubmitSupplierApplication, "/api/v1/mobile/supplier-applications", `{"company_name":"Test","contact_name":"Ali","email":"a@b.com","phone":"+905551112233","city":"İstanbul","district":"Güngören"}`},
		{"service_provider", mh.CreateServiceProviderApplication, "/api/v1/mobile/service-providers", `{"company_name":"Kargo","contact_name":"Ali","service_category":"kargo_lojistik","short_description":"Hızlı teslimat","phone":"+905551112233","email":"a@b.com"}`},
	} {
		t.Run("reject_missing_challenge_"+tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(tc.body))
			r.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			tc.handler(w, r)
			if w.Code != http.StatusForbidden {
				t.Fatalf("expected 403 for %s without challenge token, got %d (%s)", tc.name, w.Code, w.Body.String())
			}
		})
	}

	// Strict IP rate limiter rejects overflow with 429
	limited := middleware.StrictRateLimitMiddleware("test_mobile_forms", 2)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for i := 0; i < 3; i++ {
		r := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/auth/register", nil)
		r.RemoteAddr = "198.51.100.77:54321"
		w := httptest.NewRecorder()
		limited.ServeHTTP(w, r)
		if i < 2 && w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d", i+1, w.Code)
		}
		if i == 2 && w.Code != http.StatusTooManyRequests {
			t.Fatalf("request 3 expected 429, got %d", w.Code)
		}
	}
}

func TestMerterVitriniAppUserAgentClassification(t *testing.T) {
	cases := []struct {
		name        string
		ua          string
		screenWidth int
		wantDevice  string
		wantBrowser string
		wantOS      string
	}{
		{
			name:        "android_app",
			ua:          "MerterVitriniApp/1.0.3+12 (Android 14; Pixel 8; Dart/3.6)",
			screenWidth: 0,
			wantDevice:  "mobile",
			wantBrowser: "Mobil Uygulama",
			wantOS:      "Android",
		},
		{
			name:        "ios_app",
			ua:          "MerterVitriniApp/1.0.3+12 (iOS 17.5; iPhone16,1; Dart/3.6)",
			screenWidth: 0,
			wantDevice:  "mobile",
			wantBrowser: "Mobil Uygulama",
			wantOS:      "iOS",
		},
		{
			name:        "ipad_app",
			ua:          "MerterVitriniApp/1.0.3+12 (iOS 17.5; iPad14,5)",
			screenWidth: 0,
			wantDevice:  "tablet",
			wantBrowser: "Mobil Uygulama",
			wantOS:      "iOS",
		},
		{
			name:        "android_tablet_app",
			ua:          "MerterVitriniApp/1.0.3 (Android 14; Tablet; SM-X910)",
			screenWidth: 1280,
			wantDevice:  "tablet",
			wantBrowser: "Mobil Uygulama",
			wantOS:      "Android",
		},
		{
			name:        "app_with_large_screen_remains_mobile",
			ua:          "mertervitriniapp/1.0.3 (Windows Desktop)",
			screenWidth: 1920,
			wantDevice:  "mobile",
			wantBrowser: "Mobil Uygulama",
			wantOS:      "Windows",
		},
		{
			name:        "web_desktop_chrome",
			ua:          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			screenWidth: 1920,
			wantDevice:  "desktop",
			wantBrowser: "Chrome",
			wantOS:      "Windows",
		},
		{
			name:        "web_macos_safari",
			ua:          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
			screenWidth: 1440,
			wantDevice:  "desktop",
			wantBrowser: "Safari",
			wantOS:      "macOS",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dev, browser, osName := parseDeviceAndBrowser(tc.ua, tc.screenWidth)
			if dev != tc.wantDevice || browser != tc.wantBrowser || osName != tc.wantOS {
				t.Fatalf("UA %q -> got (%q, %q, %q), want (%q, %q, %q)", tc.ua, dev, browser, osName, tc.wantDevice, tc.wantBrowser, tc.wantOS)
			}
		})
	}

	// Verify X-Visitor-Id header stitching in buildPageViewRecord
	req := httptest.NewRequest(http.MethodPost, "/api/v1/store/track", nil)
	req.Header.Set("User-Agent", "MerterVitriniApp/1.0.3 (Android 14; Pixel 8)")
	req.Header.Set("X-Visitor-Id", "app-visitor-uuid-12345")
	rec := buildPageViewRecord(req, &TrackPageViewRequest{URL: "/tr/urun/elbise"}, "/tr/urun/elbise")
	if rec.visitorID != "app-visitor-uuid-12345" {
		t.Fatalf("expected visitor_id from X-Visitor-Id header, got %q", rec.visitorID)
	}
	if rec.deviceType != "mobile" || rec.browser != "Mobil Uygulama" || rec.os != "Android" {
		t.Fatalf("unexpected page view device fields: %+v", rec)
	}
}

func TestMobileReleaseManifestEightLanguages(t *testing.T) {
	expectedLangs := []string{"tr", "en", "ru", "ar", "de", "fr", "pl", "bg"}

	manifest := defaultReleaseManifest()
	for _, lang := range expectedLangs {
		if strings.TrimSpace(manifest.ReleaseNotes[lang]) == "" {
			t.Fatalf("defaultReleaseManifest missing release notes for language %q", lang)
		}
	}

	partial := MobileReleaseManifest{
		Version: "1.0.4",
		ReleaseNotes: map[string]string{
			"tr": "Özel Türkçe sürüm notu",
			"bg": "   ",
		},
	}
	applyManifestFallbacks(&partial)
	if partial.ReleaseNotes["tr"] != "Özel Türkçe sürüm notu" {
		t.Fatalf("expected custom tr release note preserved, got %q", partial.ReleaseNotes["tr"])
	}
	for _, lang := range expectedLangs {
		if strings.TrimSpace(partial.ReleaseNotes[lang]) == "" {
			t.Fatalf("applyManifestFallbacks failed to populate fallback release note for %q", lang)
		}
	}
}
