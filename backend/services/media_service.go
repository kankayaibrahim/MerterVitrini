package services

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	DefaultMaxSingleImageBytes = 25 << 20 // 25 MB
	DefaultMaxSingleVideoBytes = 50 << 20 // 50 MB
	DefaultMaxCameraDimension  = 1600

	mimeImageJPEG = "image/jpeg"
	mimeImagePNG  = "image/png"
	mimeImageWebP = "image/webp"
)

var nonSafeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

var allowedMP4Brands = map[string]bool{
	"isom": true,
	"iso2": true,
	"iso3": true,
	"iso4": true,
	"iso5": true,
	"iso6": true,
	"avc1": true,
	"mp41": true,
	"mp42": true,
	"M4V ": true,
	"M4VH": true,
	"M4VP": true,
	"MSNV": true,
	"dash": true,
}

// MediaProcessor defines the DIP contract for validating, optimizing, and storing uploaded media.
type MediaProcessor interface {
	SaveUploadedImage(reader io.Reader, originalFilename, subFolder, prefix string) (string, error)
	RootDir() string
}

// VideoMediaProcessor segregates video storage operations so existing image-only test mocks stay compatible.
type VideoMediaProcessor interface {
	SaveUploadedVideo(reader io.Reader, originalFilename, subFolder, prefix string) (string, error)
}

// IsVideoMediaURL returns true if rawURL points to a supported web video file extension (ignoring query/fragment).
func IsVideoMediaURL(rawURL string) bool {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return false
	}
	pathPart := trimmed
	if parsed, err := url.Parse(trimmed); err == nil && parsed.Path != "" {
		pathPart = parsed.Path
	} else {
		if idx := strings.IndexAny(pathPart, "?#"); idx >= 0 {
			pathPart = pathPart[:idx]
		}
	}
	switch strings.ToLower(filepath.Ext(pathPart)) {
	case ".mp4", ".webm", ".m4v", ".mov":
		return true
	default:
		return false
	}
}

// LocalImageMediaService implements MediaProcessor and VideoMediaProcessor on the local/server filesystem with
// magic-byte MIME verification and automatic high-quality Catmull-Rom downscaling for images.
type LocalImageMediaService struct {
	rootDir       string
	maxBytes      int64
	maxVideoBytes int64
	maxDimension  int
}

// DefaultMediaRootDir resolves the platform-appropriate upload root directory.
func DefaultMediaRootDir() string {
	if runtime.GOOS == "windows" {
		return "./uploads"
	}
	return "/var/www/media"
}

func NewLocalImageMediaService(rootDir string) *LocalImageMediaService {
	resolved := strings.TrimSpace(rootDir)
	if resolved == "" {
		resolved = DefaultMediaRootDir()
	}
	return &LocalImageMediaService{
		rootDir:       resolved,
		maxBytes:      DefaultMaxSingleImageBytes,
		maxVideoBytes: DefaultMaxSingleVideoBytes,
		maxDimension:  DefaultMaxCameraDimension,
	}
}

func (s *LocalImageMediaService) RootDir() string {
	return s.rootDir
}

func (s *LocalImageMediaService) DetectAllowedImageMime(raw []byte) (string, string, error) {
	if len(raw) < 12 {
		return "", "", errors.New("görsel dosyası bozuk veya çok küçük")
	}
	sniffLen := min(len(raw), 512)
	mimeType := http.DetectContentType(raw[:sniffLen])
	switch mimeType {
	case mimeImageJPEG:
		return mimeType, ".jpg", nil
	case mimeImagePNG:
		return mimeType, ".png", nil
	case mimeImageWebP:
		return mimeType, ".webp", nil
	default:
		return "", "", errors.New("desteklenmeyen görsel formatı (yalnızca JPG, PNG ve WebP kabul edilir)")
	}
}

func (s *LocalImageMediaService) ResizeImageIfOversized(raw []byte, mimeType, defaultExt string) ([]byte, string) {
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return raw, defaultExt
	}

	maxDim := s.maxDimension
	if maxDim <= 0 {
		maxDim = DefaultMaxCameraDimension
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxDim && h <= maxDim {
		return raw, defaultExt
	}

	newW, newH := w, h
	if w >= h {
		newW = maxDim
		newH = int(float64(h) * float64(maxDim) / float64(w))
	} else {
		newH = maxDim
		newW = int(float64(w) * float64(maxDim) / float64(h))
	}
	newW = max(newW, 1)
	newH = max(newH, 1)

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

	var out bytes.Buffer
	if mimeType == mimeImagePNG {
		if err := png.Encode(&out, dst); err == nil {
			return out.Bytes(), ".png"
		}
	}
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 88}); err == nil {
		return out.Bytes(), ".jpg"
	}
	return raw, defaultExt
}

func (s *LocalImageMediaService) SaveUploadedImage(reader io.Reader, originalFilename, subFolder, prefix string) (string, error) {
	maxBytes := s.maxBytes
	if maxBytes <= 0 {
		maxBytes = DefaultMaxSingleImageBytes
	}

	limited := io.LimitReader(reader, maxBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return "", errors.New("görsel verisi okunamadı")
	}
	if int64(len(raw)) > maxBytes {
		return "", errors.New("görsel boyutu çok büyük (maksimum 25 MB)")
	}

	mimeType, ext, err := s.DetectAllowedImageMime(raw)
	if err != nil {
		return "", err
	}

	finalBytes, finalExt := s.ResizeImageIfOversized(raw, mimeType, ext)
	targetDir, urlFolder, stem, err := s.prepareTargetDirAndStem(originalFilename, subFolder, "photo")
	if err != nil {
		return "", err
	}

	filename := fmt.Sprintf("%s_%d_%s%s", prefix, time.Now().UnixNano(), stem, finalExt)
	destPath := filepath.Join(targetDir, filename)
	if err := os.WriteFile(destPath, finalBytes, 0644); err != nil {
		log.Printf("[MEDIA SERVICE] WriteFile failed: %v", err)
		return "", errors.New("görsel sunucuya kaydedilemedi")
	}

	return fmt.Sprintf("/uploads/%s/%s", urlFolder, filename), nil
}

// DetectAllowedVideoMime verifies MP4 (ISO BMFF ftyp) or WebM (EBML) container magic bytes.
func (s *LocalImageMediaService) DetectAllowedVideoMime(header []byte) (string, string, error) {
	if len(header) < 12 {
		return "", "", errors.New("video dosyası bozuk veya çok küçük")
	}
	if header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3 {
		return "video/webm", ".webm", nil
	}
	if string(header[4:8]) == "ftyp" && allowedMP4Brands[string(header[8:12])] {
		return "video/mp4", ".mp4", nil
	}
	return "", "", errors.New("desteklenmeyen video formatı (yalnızca MP4 ve WebM kabul edilir)")
}

// SaveUploadedVideo streams up to maxVideoBytes directly to a temp file, validates MP4/WebM magic bytes,
// and atomically promotes it into /uploads/<subFolder>/<prefix>_...
func (s *LocalImageMediaService) SaveUploadedVideo(reader io.Reader, originalFilename, subFolder, prefix string) (string, error) {
	maxBytes := s.maxVideoBytes
	if maxBytes <= 0 {
		maxBytes = DefaultMaxSingleVideoBytes
	}

	targetDir, urlFolder, stem, err := s.prepareTargetDirAndStem(originalFilename, subFolder, "video")
	if err != nil {
		return "", err
	}

	tmpFile, err := os.CreateTemp(targetDir, ".upload_vid_*.tmp")
	if err != nil {
		log.Printf("[MEDIA SERVICE] CreateTemp failed: %v", err)
		return "", errors.New("sunucu video geçici dosyası oluşturulamadı")
	}
	tmpPath := tmpFile.Name()
	cleanupTmp := true
	defer func() {
		if cleanupTmp {
			_ = tmpFile.Close()
			_ = os.Remove(tmpPath)
		}
	}()

	written, copyErr := io.Copy(tmpFile, io.LimitReader(reader, maxBytes+1))
	if copyErr != nil {
		return "", errors.New("video verisi okunamadı")
	}
	if written > maxBytes {
		return "", fmt.Errorf("video boyutu çok büyük (maksimum %d MB)", maxBytes>>20)
	}

	if _, seekErr := tmpFile.Seek(0, io.SeekStart); seekErr != nil {
		return "", errors.New("video başlığı doğrulama için okunamadı")
	}
	header := make([]byte, 512)
	n, readErr := io.ReadFull(tmpFile, header)
	if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) && !errors.Is(readErr, io.EOF) {
		return "", errors.New("video başlığı okunamadı")
	}
	header = header[:n]

	_, ext, mimeErr := s.DetectAllowedVideoMime(header)
	if mimeErr != nil {
		return "", mimeErr
	}

	if closeErr := tmpFile.Close(); closeErr != nil {
		return "", errors.New("video dosyası kapatılamadı")
	}
	_ = os.Chmod(tmpPath, 0644)

	filename := fmt.Sprintf("%s_%d_%s%s", prefix, time.Now().UnixNano(), stem, ext)
	destPath := filepath.Join(targetDir, filename)
	if renameErr := os.Rename(tmpPath, destPath); renameErr != nil {
		log.Printf("[MEDIA SERVICE] Video rename failed: %v", renameErr)
		return "", errors.New("video sunucuya kaydedilemedi")
	}
	cleanupTmp = false
	return fmt.Sprintf("/uploads/%s/%s", urlFolder, filename), nil
}

func (s *LocalImageMediaService) prepareTargetDirAndStem(originalFilename, subFolder, fallbackStem string) (string, string, string, error) {
	stem := sanitizeBaseFilename(originalFilename, fallbackStem)
	cleanSubFolder := strings.Trim(filepath.Clean(subFolder), `/\`)
	targetDir := filepath.Join(s.rootDir, cleanSubFolder)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Printf("[MEDIA SERVICE] MkdirAll failed: %v", err)
		return "", "", "", errors.New("sunucu medya dizini oluşturulamadı")
	}
	urlFolder := strings.ReplaceAll(cleanSubFolder, `\`, "/")
	return targetDir, urlFolder, stem, nil
}

func sanitizeBaseFilename(original, fallbackStem string) string {
	base := filepath.Base(strings.TrimSpace(original))
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	cleanStem := nonSafeFilenameRegex.ReplaceAllString(stem, "_")
	cleanStem = strings.Trim(cleanStem, "._-")
	if cleanStem == "" {
		cleanStem = fallbackStem
	}
	if len(cleanStem) > 40 {
		cleanStem = cleanStem[:40]
	}
	return cleanStem
}

