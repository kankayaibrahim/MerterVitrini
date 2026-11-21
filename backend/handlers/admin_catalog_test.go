package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildProductFilterSQL(t *testing.T) {
	t.Run("always excludes soft deleted products", func(t *testing.T) {
		sql, args := buildProductFilterSQL("", "", "", "")
		if !strings.Contains(sql, "p.deleted_at IS NULL") {
			t.Fatalf("expected p.deleted_at IS NULL in filter SQL, got: %s", sql)
		}
		if len(args) != 0 {
			t.Fatalf("expected 0 args for empty filters, got %d", len(args))
		}
	})

	t.Run("brand filter binds single arg for brand and feeds", func(t *testing.T) {
		brandID := "11111111-1111-1111-1111-111111111111"
		sql, args := buildProductFilterSQL("", brandID, "", "")
		if !strings.Contains(sql, "p.brand_id = $1 OR p.feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)") {
			t.Fatalf("unexpected brand filter SQL: %s", sql)
		}
		if len(args) != 1 || args[0] != brandID {
			t.Fatalf("expected single brand arg %q, got %+v", brandID, args)
		}
	})

	t.Run("status filter handles active inactive and all", func(t *testing.T) {
		activeSQL, _ := buildProductFilterSQL("", "", "", "active")
		if !strings.Contains(activeSQL, "AND p.is_active = true") {
			t.Fatalf("expected active predicate, got: %s", activeSQL)
		}

		inactiveSQL, _ := buildProductFilterSQL("", "", "", "INACTIVE")
		if !strings.Contains(inactiveSQL, "AND p.is_active = false") {
			t.Fatalf("expected inactive predicate, got: %s", inactiveSQL)
		}

		allSQL, _ := buildProductFilterSQL("", "", "", "all")
		if strings.Contains(allSQL, "p.is_active =") {
			t.Fatalf("did not expect is_active predicate for 'all', got: %s", allSQL)
		}
	})

	t.Run("combined filters number placeholders sequentially", func(t *testing.T) {
		brandID := "11111111-1111-1111-1111-111111111111"
		catID := "22222222-2222-2222-2222-222222222222"
		sql, args := buildProductFilterSQL("saten elbise", brandID, catID, "inactive")

		if len(args) != 4 {
			t.Fatalf("expected 4 bound args (2 search words + brand + category), got %d: %+v", len(args), args)
		}
		if !strings.Contains(sql, "ILIKE $1") || !strings.Contains(sql, "ILIKE $2") {
			t.Fatalf("expected $1 and $2 search placeholders, got: %s", sql)
		}
		if !strings.Contains(sql, "p.brand_id = $3") {
			t.Fatalf("expected $3 brand placeholder, got: %s", sql)
		}
		if !strings.Contains(sql, "p.category_id = $4") {
			t.Fatalf("expected $4 category placeholder, got: %s", sql)
		}
		if !strings.Contains(sql, "AND p.is_active = false") {
			t.Fatalf("expected inactive status filter, got: %s", sql)
		}
	})
}

func TestParseBulkProductActionRequest(t *testing.T) {
	validID := "11111111-1111-1111-1111-111111111111"

	t.Run("valid delete request deduplicates ids", func(t *testing.T) {
		body := `{"action":"DELETE","product_ids":["` + validID + `"," ` + validID + ` "],"delete_images":true}`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/products/bulk-action", strings.NewReader(body))
		action, ids, delImgs, err := parseBulkProductActionRequest(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if action != "delete" || !delImgs || len(ids) != 1 || ids[0] != validID {
			t.Fatalf("unexpected parsed result: action=%q ids=%v delImgs=%v", action, ids, delImgs)
		}
	})

	t.Run("rejects invalid action and invalid uuid", func(t *testing.T) {
		reqBadAction := httptest.NewRequest(http.MethodPost, "/api/v1/products/bulk-action", strings.NewReader(`{"action":"drop","product_ids":["`+validID+`"]}`))
		if _, _, _, err := parseBulkProductActionRequest(reqBadAction); err == nil {
			t.Fatalf("expected error for invalid action")
		}

		reqBadUUID := httptest.NewRequest(http.MethodPost, "/api/v1/products/bulk-action", strings.NewReader(`{"action":"activate","product_ids":["not-a-uuid"]}`))
		if _, _, _, err := parseBulkProductActionRequest(reqBadUUID); err == nil {
			t.Fatalf("expected error for invalid uuid")
		}

		reqEmpty := httptest.NewRequest(http.MethodPost, "/api/v1/products/bulk-action", strings.NewReader(`{"action":"activate","product_ids":[]}`))
		if _, _, _, err := parseBulkProductActionRequest(reqEmpty); err == nil {
			t.Fatalf("expected error for empty product_ids")
		}
	})
}

func TestResolveSafeMediaPathsAndDiskCleanup(t *testing.T) {
	tempDir := t.TempDir()
	mediaRoot := filepath.Join(tempDir, "media")

	t.Run("returns original and cache paths for valid uploads path", func(t *testing.T) {
		paths := resolveSafeMediaPaths(mediaRoot, "/uploads/products/black_fashion/item1.webp")
		if len(paths) != 4 {
			t.Fatalf("expected 4 paths (original + 3 cache sizes), got %d: %v", len(paths), paths)
		}
		expectedOriginal := filepath.Join(mediaRoot, "products", "black_fashion", "item1.webp")
		if paths[0] != expectedOriginal {
			t.Fatalf("expected %q, got %q", expectedOriginal, paths[0])
		}
		expectedCache := filepath.Join(mediaRoot, "cache", "288x385", "products", "black_fashion", "item1.webp")
		if paths[1] != expectedCache {
			t.Fatalf("expected cache path %q, got %q", expectedCache, paths[1])
		}
	})

	t.Run("rejects traversal and non-uploads URLs", func(t *testing.T) {
		badInputs := []string{
			"",
			"https://cdn.example.com/a.jpg",
			"/uploads/../../etc/passwd",
			"/uploads/products/../../../secret.txt",
			`/uploads/products\..\..\secret.txt`,
			"/uploads/",
		}
		for _, url := range badInputs {
			if paths := resolveSafeMediaPaths(mediaRoot, url); len(paths) != 0 {
				t.Fatalf("expected rejection for %q, got %v", url, paths)
			}
		}
	})

	t.Run("removes unreferenced original and cache files without touching shared or sibling files", func(t *testing.T) {
		unusedURL := "/uploads/products/black_fashion/unused.webp"
		sharedURL := "/uploads/products/black_fashion/shared.webp"
		outsideSecret := filepath.Join(tempDir, "secret.txt")

		for _, p := range resolveSafeMediaPaths(mediaRoot, unusedURL) {
			if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(p, []byte("unused"), 0644); err != nil {
				t.Fatal(err)
			}
		}
		sharedPath := resolveSafeMediaPaths(mediaRoot, sharedURL)[0]
		if err := os.MkdirAll(filepath.Dir(sharedPath), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(sharedPath, []byte("shared"), 0644); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(outsideSecret, []byte("keep"), 0644); err != nil {
			t.Fatal(err)
		}

		removed := removeUnreferencedFilesOnDisk(mediaRoot, []string{unusedURL, sharedURL, "/uploads/../../secret.txt"}, map[string]bool{
			sharedURL: true,
		})
		if removed != 1 {
			t.Fatalf("expected 1 original removed, got %d", removed)
		}

		for _, p := range resolveSafeMediaPaths(mediaRoot, unusedURL) {
			if _, err := os.Stat(p); !os.IsNotExist(err) {
				t.Fatalf("expected removed file %s to be gone", p)
			}
		}
		if _, err := os.Stat(sharedPath); err != nil {
			t.Fatalf("expected shared file %s to remain, err=%v", sharedPath, err)
		}
		if _, err := os.Stat(outsideSecret); err != nil {
			t.Fatalf("expected outside file %s to remain, err=%v", outsideSecret, err)
		}
	})
}
