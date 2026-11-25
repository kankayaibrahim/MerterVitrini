package services

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mertervitrini/backend/models"
)

type spyDeletionStrategy struct {
	role       string
	calledWith *MobilePrincipal
}

func (s *spyDeletionStrategy) Role() string { return s.role }

func (s *spyDeletionStrategy) DeleteAccount(_ context.Context, principal MobilePrincipal, _ string) error {
	pCopy := principal
	s.calledWith = &pCopy
	return nil
}

func TestMediaServiceRejectsSpoofedBytesAndResizesOversizedPhoto(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewLocalImageMediaService(tmpDir)

	if _, _, err := svc.DetectAllowedImageMime([]byte("<html><script>alert(1)</script></html>")); err == nil {
		t.Fatalf("expected spoofed HTML/script bytes to be rejected")
	}

	src := image.NewRGBA(image.Rect(0, 0, 2400, 1800))
	for y := range 32 {
		for x := range 32 {
			src.Set(x, y, color.RGBA{R: 15, G: 80, B: 190, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("jpeg encode failed: %v", err)
	}

	publicURL, err := svc.SaveUploadedImage(bytes.NewReader(buf.Bytes()), "Model Çekim #1.JPG", "products", "cam")
	if err != nil {
		t.Fatalf("SaveUploadedImage failed: %v", err)
	}
	if !strings.HasPrefix(publicURL, "/uploads/products/cam_") {
		t.Fatalf("unexpected public URL: %s", publicURL)
	}

	relFile := strings.TrimPrefix(publicURL, "/uploads/")
	savedBytes, err := os.ReadFile(filepath.Join(tmpDir, filepath.FromSlash(relFile)))
	if err != nil {
		t.Fatalf("failed reading saved file: %v", err)
	}
	decoded, _, err := image.Decode(bytes.NewReader(savedBytes))
	if err != nil {
		t.Fatalf("failed decoding saved image: %v", err)
	}
	if decoded.Bounds().Dx() != 1600 || decoded.Bounds().Dy() != 1200 {
		t.Fatalf("expected 1600x1200 resized image, got %dx%d", decoded.Bounds().Dx(), decoded.Bounds().Dy())
	}
}

func TestUnifiedTokenServiceVerifiesSignatureAndRejectsTampering(t *testing.T) {
	secret := "solid-test-hs256-secret-2026"
	tokenSvc := NewUnifiedTokenService(secret, "", nil)

	sup := &models.SupplierUser{
		ID:          "01950000-0000-7000-8000-000000000010",
		BrandID:     "01950000-0000-7000-8000-000000000099",
		BrandName:   "Flora Tekstil",
		AliasCode:   "FLORA",
		Email:       "iletisim@flora.test",
		ContactName: "Zeynep Demir",
		IsOwner:     true,
		IsActive:    true,
	}

	signed := tokenSvc.IssueSupplierJWT(sup)
	if signed == "" {
		t.Fatalf("expected signed JWT")
	}

	principal, err := tokenSvc.ResolvePrincipal(context.Background(), "Bearer "+signed)
	if err != nil {
		t.Fatalf("ResolvePrincipal failed: %v", err)
	}
	if principal.Role != "supplier" || principal.BrandID != sup.BrandID || principal.UserID != sup.ID {
		t.Fatalf("unexpected principal: %+v", principal)
	}

	tampered := signed[:len(signed)-4] + "XXXX"
	if _, err := tokenSvc.ResolvePrincipal(context.Background(), "Bearer "+tampered); err == nil {
		t.Fatalf("expected tampered HS256 token to be rejected")
	}
}

func TestAccountDeletionRegistryOCPDispatch(t *testing.T) {
	custSpy := &spyDeletionStrategy{role: "customer"}
	supSpy := &spyDeletionStrategy{role: "supplier"}
	agentSpy := &spyDeletionStrategy{role: "sales_agent"} // OCP extension without modifying registry

	reg := NewAccountDeletionRegistry(nil, custSpy, supSpy)
	reg.Register(agentSpy)

	err := reg.Execute(context.Background(), MobilePrincipal{
		UserID: "ag-42",
		Role:   "sales_agent",
		Email:  "agent@merter.test",
	}, "test cleanup", "127.0.0.1")
	if err != nil {
		t.Fatalf("Execute failed for registered custom role: %v", err)
	}
	if agentSpy.calledWith == nil || agentSpy.calledWith.UserID != "ag-42" {
		t.Fatalf("expected sales_agent strategy to be invoked")
	}
	if custSpy.calledWith != nil || supSpy.calledWith != nil {
		t.Fatalf("expected other strategies not to be invoked")
	}

	if err := reg.Execute(context.Background(), MobilePrincipal{UserID: "u-1", Role: "unknown_role"}, "", "127.0.0.1"); err == nil {
		t.Fatalf("expected error for unregistered role")
	}
}

func TestVideoMediaServiceValidationAndStorage(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewLocalImageMediaService(tmpDir)

	mp4Sample := []byte{
		0x00, 0x00, 0x00, 0x18,
		'f', 't', 'y', 'p',
		'm', 'p', '4', '2',
		0x00, 0x00, 0x00, 0x00,
		'i', 's', 'o', 'm', 'm', 'p', '4', '2',
	}
	mp4URL, err := svc.SaveUploadedVideo(bytes.NewReader(mp4Sample), "Yeni Sezon Tanitim.mp4", "products", "vid")
	if err != nil {
		t.Fatalf("expected valid MP4 sample to succeed, got %v", err)
	}
	if !strings.HasPrefix(mp4URL, "/uploads/products/vid_") || !strings.HasSuffix(mp4URL, ".mp4") {
		t.Fatalf("unexpected MP4 public URL: %s", mp4URL)
	}
	if !IsVideoMediaURL(mp4URL + "?v=1") {
		t.Fatalf("expected IsVideoMediaURL to detect %s", mp4URL)
	}

	webmSample := []byte{0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81, 0x01}
	webmURL, err := svc.SaveUploadedVideo(bytes.NewReader(webmSample), "clip.webm", "products", "vid")
	if err != nil {
		t.Fatalf("expected valid WebM sample to succeed, got %v", err)
	}
	if !strings.HasSuffix(webmURL, ".webm") {
		t.Fatalf("expected .webm URL, got %s", webmURL)
	}

	if _, err := svc.SaveUploadedVideo(strings.NewReader("<html>not a video</html>"), "fake.mp4", "products", "vid"); err == nil {
		t.Fatalf("expected spoofed HTML file to be rejected")
	}

	svc.maxVideoBytes = 1024
	oversized := append(append([]byte{}, mp4Sample...), bytes.Repeat([]byte{'A'}, 1200)...)
	if _, err := svc.SaveUploadedVideo(bytes.NewReader(oversized), "big.mp4", "products", "vid"); err == nil {
		t.Fatalf("expected oversized video to be rejected")
	}
}

