package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"mertervitrini/backend/config"
	"mertervitrini/backend/services"
)

func TestMobileOtaVersionAndApkDownload(t *testing.T) {
	tempRoot := t.TempDir()
	releasesDir := filepath.Join(tempRoot, "releases")
	if err := os.MkdirAll(releasesDir, 0o755); err != nil {
		t.Fatalf("failed to create releases dir: %v", err)
	}

	dummyApkBytes := []byte("PK\x03\x04dummy-signed-apk-payload-merter-vitrini")
	apkName := "mertervitrini-v1.0.2+3.apk"
	if err := os.WriteFile(filepath.Join(releasesDir, apkName), dummyApkBytes, 0o644); err != nil {
		t.Fatalf("failed to write dummy apk: %v", err)
	}

	manifestJSON := `{
		"version": "1.0.2",
		"build_number": 3,
		"min_build_number": 1,
		"force_update": false,
		"apk_filename": "../../releases/mertervitrini-v1.0.2+3.apk",
		"sha256": "abc123def456",
		"release_notes": {"tr": "Test OTA sürümü"}
	}`
	if err := os.WriteFile(filepath.Join(releasesDir, "version.json"), []byte(manifestJSON), 0o644); err != nil {
		t.Fatalf("failed to write version.json: %v", err)
	}

	h := NewMobileHandler(&config.Config{}, nil, nil, MobileHandlerDeps{
		Media: services.NewLocalImageMediaService(tempRoot),
	})

	// 1. Test GET /api/v1/mobile/version
	verReq := httptest.NewRequest(http.MethodGet, "/api/v1/mobile/version", nil)
	verRec := httptest.NewRecorder()
	h.GetVersion(verRec, verReq)

	if verRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from GetVersion, got %d", verRec.Code)
	}
	var got MobileReleaseManifest
	if err := json.Unmarshal(verRec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid version json: %v", err)
	}
	if !got.ApkAvailable || got.BuildNumber != 3 || got.Version != "1.0.2" {
		t.Fatalf("unexpected manifest payload: %+v", got)
	}
	if got.ApkFilename != apkName {
		t.Fatalf("expected path traversal stripped to %s, got %s", apkName, got.ApkFilename)
	}
	if got.FileSizeBytes != int64(len(dummyApkBytes)) {
		t.Fatalf("expected file size %d, got %d", len(dummyApkBytes), got.FileSizeBytes)
	}

	// 2. Test GET /api/v1/mobile/apk
	apkReq := httptest.NewRequest(http.MethodGet, "/api/v1/mobile/apk", nil)
	apkRec := httptest.NewRecorder()
	h.DownloadApk(apkRec, apkReq)

	if apkRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from DownloadApk, got %d", apkRec.Code)
	}
	if ct := apkRec.Header().Get("Content-Type"); ct != mimeAndroidPackageArchive {
		t.Fatalf("expected Content-Type %s, got %s", mimeAndroidPackageArchive, ct)
	}
	if apkRec.Body.String() != string(dummyApkBytes) {
		t.Fatalf("downloaded apk payload mismatch")
	}
}

