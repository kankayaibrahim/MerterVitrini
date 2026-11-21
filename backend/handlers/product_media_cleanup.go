package handlers

import (
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"

	"mertervitrini/backend/db"
)

var cachedImageSizeKeys = []string{"288x385", "80x106", "600x800"}

func isSubPath(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// resolveSafeMediaPaths returns the original upload path and its resized cache paths
// inside mediaRoot for local /uploads/... URLs, rejecting traversal or external URLs.
func resolveSafeMediaPaths(mediaRoot, imageURL string) []string {
	trimmedRoot := strings.TrimSpace(mediaRoot)
	trimmedURL := strings.TrimSpace(imageURL)
	if trimmedRoot == "" || !strings.HasPrefix(trimmedURL, uploadsPrefix) {
		return nil
	}

	relURL := strings.TrimPrefix(trimmedURL, uploadsPrefix)
	relURL = strings.ReplaceAll(relURL, "\\", "/")
	relURL = strings.TrimLeft(relURL, "/")
	if relURL == "" {
		return nil
	}

	cleanRel := filepath.Clean(filepath.FromSlash(relURL))
	if cleanRel == "." || cleanRel == ".." || strings.HasPrefix(cleanRel, ".."+string(filepath.Separator)) || filepath.IsAbs(cleanRel) {
		return nil
	}

	absRoot := filepath.Clean(trimmedRoot)
	absOriginal := filepath.Clean(filepath.Join(absRoot, cleanRel))
	if !isSubPath(absRoot, absOriginal) {
		return nil
	}

	paths := make([]string, 0, 1+len(cachedImageSizeKeys))
	paths = append(paths, absOriginal)
	for _, sizeKey := range cachedImageSizeKeys {
		cacheCandidate := filepath.Clean(filepath.Join(absRoot, "cache", sizeKey, cleanRel))
		if isSubPath(absRoot, cacheCandidate) {
			paths = append(paths, cacheCandidate)
		}
	}
	return paths
}

func loadStillReferencedImageSet(ctx context.Context, imageURLs []string) map[string]bool {
	referenced := make(map[string]bool)
	if db.Pool == nil || len(imageURLs) == 0 {
		return referenced
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT image_url
		FROM catalog.product_images
		WHERE image_url = ANY($1::text[])`, imageURLs)
	if err != nil {
		log.Printf("[MEDIA CLEANUP WARNING] Could not check remaining image references: %v", err)
		return referenced
	}
	defer rows.Close()

	for rows.Next() {
		var u string
		if scanErr := rows.Scan(&u); scanErr == nil && u != "" {
			referenced[u] = true
		}
	}
	return referenced
}

func removeUnreferencedFilesOnDisk(mediaRoot string, imageURLs []string, stillReferenced map[string]bool) int {
	removedOriginals := 0
	for _, imgURL := range imageURLs {
		if stillReferenced[imgURL] {
			continue
		}
		paths := resolveSafeMediaPaths(mediaRoot, imgURL)
		for idx, filePath := range paths {
			err := os.Remove(filePath)
			if err != nil {
				if !errors.Is(err, os.ErrNotExist) {
					log.Printf("[MEDIA CLEANUP WARNING] Failed to remove %s: %v", filePath, err)
				}
				continue
			}
			if idx == 0 {
				removedOriginals++
			}
		}
	}
	return removedOriginals
}

func cleanupUnreferencedProductImages(ctx context.Context, imageURLs []string) int {
	cleanURLs := dedupeNonEmptyStrings(imageURLs)
	if len(cleanURLs) == 0 {
		return 0
	}
	stillReferenced := loadStillReferencedImageSet(ctx, cleanURLs)
	return removeUnreferencedFilesOnDisk(getMediaDir(), cleanURLs, stillReferenced)
}
