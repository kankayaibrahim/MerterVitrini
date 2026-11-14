package handlers

import (
	"context"
	"strings"
	"testing"

	"mertervitrini/backend/models"
)

func strPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

func TestBuildSiblingGroupMapKeyAndAssignProductSiblings(t *testing.T) {
	if got := buildSiblingGroupMapKey(strPtr("brand-1"), nil, nil); got != "" {
		t.Fatalf("expected empty key for nil groupID, got %q", got)
	}
	if got := buildSiblingGroupMapKey(strPtr("brand-1"), nil, strPtr("   ")); got != "" {
		t.Fatalf("expected empty key for blank groupID, got %q", got)
	}
	if got := buildSiblingGroupMapKey(nil, nil, strPtr("GRP-100")); got != "" {
		t.Fatalf("expected empty key when both brandID and feedID are nil, got %q", got)
	}
	if got := buildSiblingGroupMapKey(strPtr(" brand-1 "), nil, strPtr(" GRP-100 ")); got != "b:brand-1|GRP-100" {
		t.Fatalf("expected brand-scoped key b:brand-1|GRP-100, got %q", got)
	}
	if got := buildSiblingGroupMapKey(nil, strPtr(" feed-9 "), strPtr(" GRP-200 ")); got != "f:feed-9|GRP-200" {
		t.Fatalf("expected feed-scoped key f:feed-9|GRP-200, got %q", got)
	}
	if got := buildSiblingGroupMapKey(strPtr("brand-1"), strPtr("feed-9"), strPtr("GRP-300")); got != "b:brand-1|GRP-300" {
		t.Fatalf("expected brand key to take precedence when both brandID and feedID exist, got %q", got)
	}

	// Manual supplier products have FeedID == nil and non-empty BrandID + SourceProductGroupID.
	pBlack := &models.Product{
		ID:                   "prod-black",
		FeedID:               nil,
		BrandID:              strPtr("brand-42"),
		SourceProductGroupID: strPtr("GRP-M42"),
		Title:                "Saten Elbise Siyah",
	}
	pRed := &models.Product{
		ID:                   "prod-red",
		FeedID:               nil,
		BrandID:              strPtr("brand-42"),
		SourceProductGroupID: strPtr(" GRP-M42 "),
		Title:                "Saten Elbise Kırmızı",
	}
	pNoGroup := &models.Product{
		ID:                   "prod-single",
		FeedID:               nil,
		BrandID:              strPtr("brand-42"),
		SourceProductGroupID: nil,
	}
	products := []*models.Product{pBlack, pRed, pNoGroup}

	groupIDs := collectProductGroupIDs(products)
	if len(groupIDs) != 1 || groupIDs[0] != "GRP-M42" {
		t.Fatalf("expected deduplicated groupIDs [GRP-M42], got %#v", groupIDs)
	}

	siblingsMap := map[string][]*models.SiblingProduct{
		"b:brand-42|GRP-M42": {
			{ID: "prod-black", CustomSku: "PRD-BLK", Slug: "saten-elbise-siyah", SlugID: "blk1", Color: "Siyah", ImageUrl: "/uploads/black.webp"},
			{ID: "prod-red", CustomSku: "PRD-RED", Slug: "saten-elbise-kirmizi", SlugID: "red1", Color: "Kırmızı", ImageUrl: "/uploads/red.webp"},
		},
	}

	assignProductSiblings(products, siblingsMap)

	if len(pBlack.ColorVariants) != 1 || pBlack.ColorVariants[0].ID != "prod-red" {
		t.Fatalf("expected pBlack to receive only prod-red sibling, got %#v", pBlack.ColorVariants)
	}
	if len(pRed.ColorVariants) != 1 || pRed.ColorVariants[0].ID != "prod-black" {
		t.Fatalf("expected pRed to receive only prod-black sibling, got %#v", pRed.ColorVariants)
	}
	if len(pNoGroup.ColorVariants) != 0 {
		t.Fatalf("expected pNoGroup to have 0 siblings, got %#v", pNoGroup.ColorVariants)
	}
}

func TestNormalizeSupplierDraftOrPublishInput(t *testing.T) {
	ctx := context.Background()

	// 1. Draft mode: allows Price: 0 and empty Title when images + fallback CategoryID are present.
	draftReq := models.SupplierProductInput{
		Title:      "   ",
		CategoryID: "cat-1",
		Price:      0,
		IsActive:   false,
		Images:     []string{" ", "/uploads/products/cam_1.webp", "/uploads/products/cam_1.webp"},
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &draftReq, false); err != nil {
		t.Fatalf("expected valid draft input to pass, got error: %v", err)
	}
	if !strings.HasPrefix(draftReq.Title, "Taslak Model ") {
		t.Fatalf("expected auto-generated draft title, got %q", draftReq.Title)
	}
	if draftReq.Currency != "TRY" {
		t.Fatalf("expected default currency TRY, got %q", draftReq.Currency)
	}
	if len(draftReq.Images) != 1 || draftReq.Images[0] != "/uploads/products/cam_1.webp" {
		t.Fatalf("expected cleaned deduplicated images, got %#v", draftReq.Images)
	}

	// 2. IsDraft: true must force IsActive: false even if caller sent IsActive: true.
	forcedDraftReq := models.SupplierProductInput{
		Title:      "Hızlı Taslak",
		CategoryID: "cat-1",
		Price:      -50,
		IsActive:   true,
		IsDraft:    boolPtr(true),
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &forcedDraftReq, false); err != nil {
		t.Fatalf("expected IsDraft=true to pass without images/price, got: %v", err)
	}
	if forcedDraftReq.IsActive {
		t.Fatalf("expected IsDraft=true to force IsActive=false")
	}
	if forcedDraftReq.Price != 0 {
		t.Fatalf("expected negative price to clamp to 0, got %v", forcedDraftReq.Price)
	}

	// 3. Draft mode with neither title nor images should fail.
	emptyDraftReq := models.SupplierProductInput{
		CategoryID: "cat-1",
		IsActive:   false,
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &emptyDraftReq, false); err == nil {
		t.Fatalf("expected empty draft without title or images to fail")
	}

	// 4. Publish mode failing with Price: 0.
	publishZeroPrice := models.SupplierProductInput{
		Title:      "Kadın Triko Kazak",
		CategoryID: "cat-1",
		Price:      0,
		IsActive:   true,
		Images:     []string{"/uploads/products/kazak.webp"},
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &publishZeroPrice, false); err == nil {
		t.Fatalf("expected publish with Price=0 to fail")
	}

	// 5. Publish mode failing without images (when hasExistingImages is false).
	publishNoImages := models.SupplierProductInput{
		Title:      "Kadın Triko Kazak",
		CategoryID: "cat-1",
		Price:      350,
		IsActive:   true,
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &publishNoImages, false); err == nil {
		t.Fatalf("expected publish without images to fail")
	}

	// 6. Publish mode passing with existing images (hasExistingImages = true) or new images.
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &publishNoImages, true); err != nil {
		t.Fatalf("expected publish with existing images to pass, got: %v", err)
	}
	publishValid := models.SupplierProductInput{
		Title:      "  Kadın Triko Kazak  ",
		CategoryID: " cat-1 ",
		Price:      350,
		Currency:   "usd",
		IsActive:   true,
		Images:     []string{"/uploads/products/kazak.webp"},
	}
	if err := normalizeSupplierDraftOrPublishInput(ctx, "brand-1", &publishValid, false); err != nil {
		t.Fatalf("expected valid publish input to pass, got: %v", err)
	}
	if publishValid.Title != "Kadın Triko Kazak" || publishValid.CategoryID != "cat-1" || publishValid.Currency != "USD" {
		t.Fatalf("unexpected normalized fields: title=%q cat=%q cur=%q", publishValid.Title, publishValid.CategoryID, publishValid.Currency)
	}
}

func TestSupplierDraftFilterAndBatchHelpers(t *testing.T) {
	conds, args, nextIdx := buildProductFilterConditions("brand-1", "", "", "draft")
	if len(args) != 1 || args[0] != "brand-1" || nextIdx != 2 {
		t.Fatalf("unexpected filter args/index: args=%#v nextIdx=%d", args, nextIdx)
	}
	joined := strings.Join(conds, " AND ")
	if !strings.Contains(joined, "p.is_active = false AND COALESCE(p.is_archived, false) = false") {
		t.Fatalf("expected draft filter to match non-archived inactive products, got %q", joined)
	}

	mode, err := normalizeBatchDraftMode("color_siblings")
	if err != nil || mode != "color_siblings" {
		t.Fatalf("expected valid mode color_siblings, got mode=%q err=%v", mode, err)
	}
	if _, err := normalizeBatchDraftMode("invalid_mode"); err == nil {
		t.Fatalf("expected invalid batch draft mode to fail")
	}

	specs := buildBatchDraftSpecs("color_siblings", "Keten Gömlek", []string{"/a.webp", "/b.webp"})
	if len(specs) != 2 || specs[0].title != "Keten Gömlek #1" || specs[1].title != "Keten Gömlek #2" {
		t.Fatalf("unexpected batch draft specs: %#v", specs)
	}
	singleSpecs := buildBatchDraftSpecs("single_product", "Keten Gömlek", []string{"/a.webp", "/b.webp"})
	if len(singleSpecs) != 1 || len(singleSpecs[0].images) != 2 {
		t.Fatalf("unexpected single_product batch specs: %#v", singleSpecs)
	}
}
