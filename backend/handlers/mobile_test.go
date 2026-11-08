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
	mediaSvc := services.NewLocalImageMediaService(t.TempDir())
	mh := NewMobileHandler(&config.Config{JWTSecret: "secret"}, nil, nil, MobileHandlerDeps{
		Media: mediaSvc,
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
	req.Header.Set("X-Chat-Customer-Id", "guest-mob-123")
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
