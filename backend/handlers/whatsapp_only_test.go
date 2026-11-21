package handlers

import (
	"net/url"
	"strings"
	"testing"

	"mertervitrini/backend/models"
)

func TestSanitizePublicStoreProductRespectsBrandWhatsappOnly(t *testing.T) {
	disc := 180.0
	single := 250.0
	varDisc := 175.0

	waProduct := models.Product{
		ID:              "prod-wa-1",
		Title:           "Black Fashion Bluz",
		Price:           200.0,
		DiscountedPrice: &disc,
		SinglePrice:     &single,
		BrandProfile: &models.Brand{
			ID:                   "brand-bf",
			Name:                 "Black Fashion",
			WhatsappOnlyOrdering: true,
		},
		Variants: []*models.ProductVariant{
			{
				ID:              "var-wa-1",
				ProductID:       "prod-wa-1",
				SourceVariantID: "src-var-1",
				Price:           200.0,
				DiscountedPrice: &varDisc,
			},
		},
	}

	// Even when caller normally sees prices (logged-in member), WhatsApp-only supplier hides prices
	sanitizePublicStoreProduct(&waProduct, true)

	if waProduct.Price != 0 {
		t.Fatalf("expected WhatsApp-only product price=0 even when showPrices=true, got %v", waProduct.Price)
	}
	if waProduct.DiscountedPrice != nil {
		t.Fatalf("expected WhatsApp-only product discounted_price=nil, got %v", *waProduct.DiscountedPrice)
	}
	if waProduct.SinglePrice != nil {
		t.Fatalf("expected WhatsApp-only product single_price=nil, got %v", *waProduct.SinglePrice)
	}
	if waProduct.Variants[0].Price != 0 || waProduct.Variants[0].DiscountedPrice != nil {
		t.Fatalf("expected WhatsApp-only variant prices zeroed, got price=%v disc=%v", waProduct.Variants[0].Price, waProduct.Variants[0].DiscountedPrice)
	}

	normalProduct := models.Product{
		ID:              "prod-std-1",
		Title:           "Etika Elbise",
		Price:           350.0,
		DiscountedPrice: &disc,
		BrandProfile: &models.Brand{
			ID:                   "brand-etika",
			Name:                 "Etika Fashion",
			WhatsappOnlyOrdering: false,
		},
	}
	sanitizePublicStoreProduct(&normalProduct, true)
	if normalProduct.Price != 350.0 || normalProduct.DiscountedPrice == nil || *normalProduct.DiscountedPrice != 180.0 {
		t.Fatalf("expected standard supplier prices preserved when showPrices=true, got price=%v", normalProduct.Price)
	}
}

func TestBuildCatalogOrderByPlacesUnknownPriceLast(t *testing.T) {
	for _, sortKey := range []string{"price_asc", "price_desc"} {
		clause := buildCatalogOrderBy(sortKey, "p.price")
		if !strings.Contains(clause, "b_wo.whatsapp_only_ordering") {
			t.Fatalf("expected %s order clause to rank whatsapp_only_ordering unknown-price items, got: %s", sortKey, clause)
		}
		if !strings.Contains(clause, "THEN 1 ELSE 0 END ASC") {
			t.Fatalf("expected %s order clause to sort unknown-price flag ASC so known prices come first, got: %s", sortKey, clause)
		}
	}
}

func TestAppendCatalogPriceFilterExcludesWhatsappOnlyOnlyWhenFiltered(t *testing.T) {
	baseNoFilter := ""
	argsNoFilter := []any{}
	idxNoFilter := 1
	appendCatalogPriceFilter(&baseNoFilter, url.Values{}, 1.0, "p.price", &idxNoFilter, &argsNoFilter)
	if baseNoFilter != "" || len(argsNoFilter) != 0 {
		t.Fatalf("expected empty filter when no min/max price provided, got sql=%q args=%v", baseNoFilter, argsNoFilter)
	}

	baseWithMin := ""
	argsWithMin := []any{}
	idxWithMin := 1
	q := url.Values{"min_price": []string{"100"}}
	appendCatalogPriceFilter(&baseWithMin, q, 1.0, "p.price", &idxWithMin, &argsWithMin)
	if !strings.Contains(baseWithMin, "AND NOT EXISTS") || !strings.Contains(baseWithMin, "whatsapp_only_ordering") {
		t.Fatalf("expected price filter to exclude whatsapp_only_ordering suppliers, got: %s", baseWithMin)
	}
	if !strings.Contains(baseWithMin, "COALESCE(p.discounted_price, p.price) > 0") {
		t.Fatalf("expected price filter to require positive price, got: %s", baseWithMin)
	}
}
