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
	DefaultMaxCameraDimension  = 1600
)

var nonSafeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

// MediaProcessor defines the DIP contract for validating, optimizing, and storing uploaded media.
type MediaProcessor interface {
	SaveUploadedImage(reader io.Reader, originalFilename, subFolder, prefix string) (string, error)
	RootDir() string
}

// LocalImageMediaService implements MediaProcessor on the local/server filesystem with
// magic-byte MIME verification and automatic high-quality Catmull-Rom downscaling.
type LocalImageMediaService struct {
	rootDir      string
	maxBytes     int64
	maxDimension int
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
		rootDir:      resolved,
		maxBytes:     DefaultMaxSingleImageBytes,
		maxDimension: DefaultMaxCameraDimension,
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
	case "image/jpeg":
		return mimeType, ".jpg", nil
	case "image/png":
		return mimeType, ".png", nil
	case "image/webp":
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
	if mimeType == "image/png" {
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
	stem := sanitizeBaseFilename(originalFilename)
	cleanSubFolder := strings.Trim(filepath.Clean(subFolder), `/\`)

	targetDir := filepath.Join(s.rootDir, cleanSubFolder)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Printf("[MEDIA SERVICE] MkdirAll failed: %v", err)
		return "", errors.New("sunucu medya dizini oluşturulamadı")
	}

	filename := fmt.Sprintf("%s_%d_%s%s", prefix, time.Now().UnixNano(), stem, finalExt)
	destPath := filepath.Join(targetDir, filename)
	if err := os.WriteFile(destPath, finalBytes, 0644); err != nil {
		log.Printf("[MEDIA SERVICE] WriteFile failed: %v", err)
		return "", errors.New("görsel sunucuya kaydedilemedi")
	}

	urlFolder := strings.ReplaceAll(cleanSubFolder, `\`, "/")
	return fmt.Sprintf("/uploads/%s/%s", urlFolder, filename), nil
}

func sanitizeBaseFilename(original string) string {
	base := filepath.Base(strings.TrimSpace(original))
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	cleanStem := nonSafeFilenameRegex.ReplaceAllString(stem, "_")
	cleanStem = strings.Trim(cleanStem, "._-")
	if cleanStem == "" {
		cleanStem = "photo"
	}
	if len(cleanStem) > 40 {
		cleanStem = cleanStem[:40]
	}
	return cleanStem
}

