package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mertervitrini/backend/models"
)

const (
	testAdminBrandUUID    = "11111111-1111-1111-1111-111111111111"
	testAdminCategoryUUID = "22222222-2222-2222-2222-222222222222"
)

func assertSQLContainsAll(t *testing.T, sql string, snippets []string) {
	t.Helper()
	for _, snip := range snippets {
		if !strings.Contains(sql, snip) {
			t.Fatalf("expected SQL to contain %q, got:\n%s", snip, sql)
		}
	}
}

func mustWriteTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func testBuildProductFilterExcludesSoftDeleted(t *testing.T) {
	sql, args := buildProductFilterSQL("", "", "", "")
	if !strings.Contains(sql, "p.deleted_at IS NULL") {
		t.Fatalf("expected p.deleted_at IS NULL in filter SQL, got: %s", sql)
	}
	if len(args) != 0 {
		t.Fatalf("expected 0 args for empty filters, got %d", len(args))
	}
}

func testBuildProductFilterBrandBinding(t *testing.T) {
	sql, args := buildProductFilterSQL("", testAdminBrandUUID, "", "")
	if !strings.Contains(sql, "p.brand_id = $1 OR p.feed_id IN (SELECT id FROM integration.xml_feeds WHERE brand_id = $1)") {
		t.Fatalf("unexpected brand filter SQL: %s", sql)
	}
	if len(args) != 1 || args[0] != testAdminBrandUUID {
		t.Fatalf("expected single brand arg %q, got %+v", testAdminBrandUUID, args)
	}
}

func testBuildProductFilterStatus(t *testing.T) {
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
}

func testBuildProductFilterCombinedPlaceholders(t *testing.T) {
	sql, args := buildProductFilterSQL("saten elbise", testAdminBrandUUID, testAdminCategoryUUID, "inactive")
	if len(args) != 4 {
		t.Fatalf("expected 4 bound args (2 search words + brand + category), got %d: %+v", len(args), args)
	}
	assertSQLContainsAll(t, sql, []string{
		"ILIKE $1",
		"ILIKE $2",
		"p.brand_id = $3",
		"p.category_id = $4",
		"AND p.is_active = false",
	})
}

func TestBuildProductFilterSQL(t *testing.T) {
	t.Run("always excludes soft deleted products", testBuildProductFilterExcludesSoftDeleted)
	t.Run("brand filter binds single arg for brand and feeds", testBuildProductFilterBrandBinding)
	t.Run("status filter handles active inactive and all", testBuildProductFilterStatus)
	t.Run("combined filters number placeholders sequentially", testBuildProductFilterCombinedPlaceholders)
}

func TestParseBulkProductActionRequest(t *testing.T) {
	validID := testAdminBrandUUID

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

func testResolveSafeMediaPathsValid(t *testing.T, mediaRoot string) {
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
}

func testResolveSafeMediaPathsRejectsTraversal(t *testing.T, mediaRoot string) {
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
}

func testRemoveUnreferencedMediaFiles(t *testing.T, tempDir, mediaRoot string) {
	unusedURL := "/uploads/products/black_fashion/unused.webp"
	sharedURL := "/uploads/products/black_fashion/shared.webp"
	outsideSecret := filepath.Join(tempDir, "secret.txt")

	for _, p := range resolveSafeMediaPaths(mediaRoot, unusedURL) {
		mustWriteTestFile(t, p, "unused")
	}
	sharedPath := resolveSafeMediaPaths(mediaRoot, sharedURL)[0]
	mustWriteTestFile(t, sharedPath, "shared")
	mustWriteTestFile(t, outsideSecret, "keep")

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
}

func TestResolveSafeMediaPathsAndDiskCleanup(t *testing.T) {
	tempDir := t.TempDir()
	mediaRoot := filepath.Join(tempDir, "media")

	t.Run("returns original and cache paths for valid uploads path", func(t *testing.T) {
		testResolveSafeMediaPathsValid(t, mediaRoot)
	})
	t.Run("rejects traversal and non-uploads URLs", func(t *testing.T) {
		testResolveSafeMediaPathsRejectsTraversal(t, mediaRoot)
	})
	t.Run("removes unreferenced original and cache files without touching shared or sibling files", func(t *testing.T) {
		testRemoveUnreferencedMediaFiles(t, tempDir, mediaRoot)
	})
}

func testParseAndBuildAdvancedAdminFilter(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/products?q=tunik&brand_id=11111111-1111-1111-1111-111111111111&category_id=uncategorized&status=active&currency=tl&min_price=120.5&max_price=-50&price_status=discounted&stock_status=in_stock&has_image=yes&gender=Kad%C4%B1n&season=Yazl%C4%B1k&source=xml&date_from=2026-01-01&date_to=bad-date&sort_by=price_asc",
		nil,
	)
	params := parseAdminProductFilterParams(req)
	if params.Currency != "TRY" {
		t.Fatalf("expected currency normalized to TRY, got %q", params.Currency)
	}
	if params.MinPrice == nil || *params.MinPrice != 120.5 {
		t.Fatalf("expected MinPrice=120.5, got %v", params.MinPrice)
	}
	if params.MaxPrice != nil {
		t.Fatalf("expected negative MaxPrice to be ignored, got %v", *params.MaxPrice)
	}
	if params.DateFrom != "2026-01-01" || params.DateTo != "" {
		t.Fatalf("unexpected date parsing: from=%q to=%q", params.DateFrom, params.DateTo)
	}

	sql, args := buildAdminProductFilterSQL(params)
	assertSQLContainsAll(t, sql, []string{
		"p.category_id IS NULL",
		"UPPER(COALESCE(NULLIF(p.currency, ''), 'TRY')) IN ('TRY', 'TL')",
		">= $",
		"p.discounted_price IS NOT NULL",
		"AND COALESCE(p.stock, 0) > 0",
		"EXISTS (SELECT 1 FROM catalog.product_images",
		"p.feed_id IS NOT NULL",
		"LOWER(TRIM(COALESCE(p.gender, ''))) = LOWER($",
		"LOWER(TRIM(COALESCE(p.season, ''))) = LOWER($",
		"p.created_at >= $",
	})
	if len(args) != 6 {
		t.Fatalf("expected 6 bound args (search, brand, minPrice, gender, season, dateFrom), got %d: %+v", len(args), args)
	}
}

func testValidateCurrencyWhitelistAndNonTRYFilter(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/products?currency=usd&price_status=unpriced&stock_status=out_of_stock&has_image=no&source=manual", nil)
	params := parseAdminProductFilterParams(req)
	sql, args := buildAdminProductFilterSQL(params)
	assertSQLContainsAll(t, sql, []string{
		"UPPER(COALESCE(p.currency, '')) = $1",
		"COALESCE(p.price, 0) <= 0",
		"AND COALESCE(p.stock, 0) <= 0",
		"p.feed_id IS NULL",
		"NOT EXISTS (SELECT 1 FROM catalog.product_images",
	})
	if len(args) != 1 || args[0] != "USD" {
		t.Fatalf("expected single USD arg, got %+v", args)
	}
}

func TestParseAndBuildAdminProductFilterSQL(t *testing.T) {
	t.Run("parses valid advanced params and rejects negative prices or invalid dates", testParseAndBuildAdvancedAdminFilter)
	t.Run("validates currency whitelist and non-TRY SQL parameter", testValidateCurrencyWhitelistAndNonTRYFilter)
}

func TestBuildAdminProductOrderBy(t *testing.T) {
	if got := buildAdminProductOrderBy("price_asc"); !strings.Contains(got, "(COALESCE(p.price, 0) <= 0) ASC") {
		t.Fatalf("expected zero-priced items last in price_asc, got %q", got)
	}
	if got := buildAdminProductOrderBy("price_desc"); !strings.Contains(got, "DESC") {
		t.Fatalf("expected DESC in price_desc, got %q", got)
	}
	if got := buildAdminProductOrderBy("unknown_injected; DROP TABLE"); got != "ORDER BY p.created_at DESC, p.id DESC" {
		t.Fatalf("expected safe default order by on unknown sort, got %q", got)
	}
}

func TestBuildCategoryTreePreservesProductCounts(t *testing.T) {
	parentID := testAdminBrandUUID
	childID := testAdminCategoryUUID
	flat := []*models.Category{
		{
			ID:                   parentID,
			Title:                "Kadın Giyim",
			Slug:                 "kadin-giyim",
			NodePath:             "kadin",
			IsActive:             true,
			TotalProducts:        500,
			ActiveProducts:       320,
			DirectTotalProducts:  5,
			DirectActiveProducts: 3,
		},
		{
			ID:                   childID,
			ParentID:             &parentID,
			Title:                "Elbise",
			Slug:                 "elbise",
			NodePath:             "kadin.elbise",
			IsActive:             true,
			TotalProducts:        495,
			ActiveProducts:       317,
			DirectTotalProducts:  495,
			DirectActiveProducts: 317,
		},
	}

	tree := buildCategoryTree(flat)
	if len(tree) != 1 || len(tree[0].Children) != 1 {
		t.Fatalf("expected 1 root with 1 child, got %+v", tree)
	}
	if tree[0].TotalProducts != 500 || tree[0].ActiveProducts != 320 || tree[0].DirectTotalProducts != 5 || tree[0].DirectActiveProducts != 3 {
		t.Fatalf("root counts not preserved: %+v", tree[0])
	}
	if tree[0].Children[0].TotalProducts != 495 || tree[0].Children[0].ActiveProducts != 317 {
		t.Fatalf("child counts not preserved: %+v", tree[0].Children[0])
	}
}
