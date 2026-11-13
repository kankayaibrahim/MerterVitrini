package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mertervitrini/backend/pkg/httpx"
)

const (
	defaultMobileVersion      = "1.0.0"
	defaultMobileApkFilename  = "mertervitrini-latest.apk"
	defaultMobileDownloadURL  = "https://mertervitrini.com.tr/api/v1/mobile/apk"
	defaultMobileWebPageURL   = "https://mertervitrini.com.tr/mobil-uygulama"
	headerCacheControl        = "Cache-Control"
	noCacheHeaderValue        = "no-store, no-cache, must-revalidate"
	mimeAndroidPackageArchive = "application/vnd.android.package-archive"
)

// MobileReleaseManifest describes the published Android APK metadata used by OTA self-updater clients and the website.
type MobileReleaseManifest struct {
	AppName        string            `json:"app_name"`
	PackageID      string            `json:"package_id"`
	Version        string            `json:"version"`
	BuildNumber    int               `json:"build_number"`
	MinBuildNumber int               `json:"min_build_number"`
	ForceUpdate    bool              `json:"force_update"`
	ApkFilename    string            `json:"apk_filename"`
	DownloadURL    string            `json:"download_url"`
	DirectCdnURL   string            `json:"direct_cdn_url"`
	WebPageURL     string            `json:"web_page_url"`
	SHA256         string            `json:"sha256"`
	FileSizeBytes  int64             `json:"file_size_bytes"`
	PublishedAt    string            `json:"published_at"`
	ApkAvailable   bool              `json:"apk_available"`
	ReleaseNotes   map[string]string `json:"release_notes"`
}

func defaultMobileReleaseNotes() map[string]string {
	return map[string]string{
		"tr": "Merter Vitrini B2B Müşteri Mağazası ve Tedarikçi Kamera Stüdyosu güncel sürümü.",
		"en": "Merter Vitrini B2B Wholesale Storefront & Supplier Camera Studio latest release.",
		"ru": "Актуальный релиз B2B-платформы Merter Vitrini и фотостудии поставщика.",
		"ar": "أحدث إصدار من منصة الجملة Merter Vitrini واستوديو الموردين.",
		"de": "Aktuelle Version des Merter Vitrini B2B-Großhandels und Lieferanten-Studios.",
		"fr": "Dernière version de la boutique B2B Merter Vitrini et du studio fournisseur.",
		"pl": "Najnowsza wersja hurtowni B2B Merter Vitrini i studia fotograficznego dostawcy.",
		"bg": "Последна версия на B2B платформата Merter Vitrini и студиото за доставчици.",
	}
}

func normalizeReleaseNotes(existing map[string]string) map[string]string {
	defaults := defaultMobileReleaseNotes()
	normalized := make(map[string]string, len(defaults)+len(existing))
	for k, v := range existing {
		cleanKey := strings.ToLower(strings.TrimSpace(k))
		if cleanKey == "" {
			continue
		}
		if cleanVal := strings.TrimSpace(v); cleanVal != "" {
			normalized[cleanKey] = cleanVal
		}
	}
	for lang, fallback := range defaults {
		if strings.TrimSpace(normalized[lang]) == "" {
			normalized[lang] = fallback
		}
	}
	return normalized
}

func defaultReleaseManifest() MobileReleaseManifest {
	return MobileReleaseManifest{
		AppName:        "Merter Vitrini",
		PackageID:      "com.mertervitrini.app",
		Version:        defaultMobileVersion,
		BuildNumber:    1,
		MinBuildNumber: 1,
		ForceUpdate:    false,
		ApkFilename:    defaultMobileApkFilename,
		DownloadURL:    defaultMobileDownloadURL,
		DirectCdnURL:   "https://mertervitrini.com.tr/uploads/releases/" + defaultMobileApkFilename,
		WebPageURL:     defaultMobileWebPageURL,
		PublishedAt:    time.Now().UTC().Format(time.RFC3339),
		ApkAvailable:   false,
		ReleaseNotes:   defaultMobileReleaseNotes(),
	}
}

func (h *MobileHandler) releasesDir() string {
	root := getMediaDir()
	if h != nil && h.Media != nil && strings.TrimSpace(h.Media.RootDir()) != "" {
		root = h.Media.RootDir()
	}
	return filepath.Join(root, "releases")
}

func sanitizeApkFilename(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return defaultMobileApkFilename
	}
	base := filepath.Base(trimmed)
	if base == "." || base == "/" || base == `\` || !strings.HasSuffix(strings.ToLower(base), ".apk") {
		return defaultMobileApkFilename
	}
	return base
}

func applyManifestFallbacks(m *MobileReleaseManifest) {
	if strings.TrimSpace(m.AppName) == "" {
		m.AppName = "Merter Vitrini"
	}
	if strings.TrimSpace(m.PackageID) == "" {
		m.PackageID = "com.mertervitrini.app"
	}
	if strings.TrimSpace(m.Version) == "" {
		m.Version = defaultMobileVersion
	}
	if m.BuildNumber <= 0 {
		m.BuildNumber = 1
	}
	if m.MinBuildNumber <= 0 {
		m.MinBuildNumber = 1
	}
	m.ApkFilename = sanitizeApkFilename(m.ApkFilename)
	if strings.TrimSpace(m.DownloadURL) == "" {
		m.DownloadURL = defaultMobileDownloadURL
	}
	if strings.TrimSpace(m.WebPageURL) == "" {
		m.WebPageURL = defaultMobileWebPageURL
	}
	if strings.TrimSpace(m.DirectCdnURL) == "" {
		m.DirectCdnURL = "https://mertervitrini.com.tr/uploads/releases/" + m.ApkFilename
	}
	m.ReleaseNotes = normalizeReleaseNotes(m.ReleaseNotes)
}

func (h *MobileHandler) resolveApkFilePath(relDir, preferredName string) (string, os.FileInfo) {
	candidates := []string{sanitizeApkFilename(preferredName), defaultMobileApkFilename}
	for _, name := range candidates {
		full := filepath.Join(relDir, name)
		info, err := os.Stat(full)
		if err == nil && !info.IsDir() && info.Size() > 0 {
			return full, info
		}
	}
	return "", nil
}

func (h *MobileHandler) loadMobileReleaseManifest() MobileReleaseManifest {
	manifest := defaultReleaseManifest()
	relDir := h.releasesDir()
	manifestPath := filepath.Join(relDir, "version.json")

	if raw, err := os.ReadFile(manifestPath); err == nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, &manifest)
	}
	applyManifestFallbacks(&manifest)

	if _, info := h.resolveApkFilePath(relDir, manifest.ApkFilename); info != nil {
		manifest.ApkAvailable = true
		manifest.FileSizeBytes = info.Size()
		if strings.TrimSpace(manifest.PublishedAt) == "" {
			manifest.PublishedAt = info.ModTime().UTC().Format(time.RFC3339)
		}
	}
	return manifest
}

// GetVersion serves GET /api/v1/mobile/version for Android OTA update checks and the web download center.
func (h *MobileHandler) GetVersion(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set(headerCacheControl, noCacheHeaderValue)
	w.Header().Set("Pragma", "no-cache")
	manifest := h.loadMobileReleaseManifest()
	httpx.JSON(w, http.StatusOK, manifest)
}

// DownloadApk streams GET/HEAD /api/v1/mobile/apk with Android package-archive MIME headers and HTTP Range support.
func (h *MobileHandler) DownloadApk(w http.ResponseWriter, r *http.Request) {
	manifest := h.loadMobileReleaseManifest()
	apkPath, info := h.resolveApkFilePath(h.releasesDir(), manifest.ApkFilename)
	if apkPath == "" || info == nil {
		httpx.Error(w, http.StatusNotFound, "Güncel Android APK paketi henüz sunucuya yüklenmedi.")
		return
	}

	file, err := os.Open(apkPath)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "APK paketi okunamadı.")
		return
	}
	defer file.Close()

	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Now().Add(15 * time.Minute))

	downloadName := fmt.Sprintf("MerterVitrini-v%s-b%d.apk", manifest.Version, manifest.BuildNumber)
	w.Header().Set("Content-Type", mimeAndroidPackageArchive)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, downloadName))
	w.Header().Set(headerCacheControl, noCacheHeaderValue)
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("X-APK-Version", fmt.Sprintf("%s+%d", manifest.Version, manifest.BuildNumber))
	if manifest.SHA256 != "" {
		w.Header().Set("X-APK-SHA256", manifest.SHA256)
	}

	http.ServeContent(w, r, downloadName, info.ModTime(), file)
}

