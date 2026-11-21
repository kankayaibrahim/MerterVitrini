package handlers

import (
	"strings"
	"testing"

	"mertervitrini/backend/models"
)

func TestNormalizeCartHydrateIDs(t *testing.T) {
	if got := normalizeCartHydrateIDs(nil); got != nil {
		t.Fatalf("expected nil for empty input, got %#v", got)
	}

	deduped := normalizeCartHydrateIDs([]string{" a ", "", "b", "a", "  ", "c"})
	if len(deduped) != 3 || deduped[0] != "a" || deduped[1] != "b" || deduped[2] != "c" {
		t.Fatalf("unexpected deduped slice: %#v", deduped)
	}

	many := make([]string, 0, 120)
	for i := 0; i < 120; i++ {
		many = append(many, strings.Repeat("x", 1)+string(rune('0'+i%10))+string(rune('a'+i/10)))
	}
	capped := normalizeCartHydrateIDs(many)
	if len(capped) != 100 {
		t.Fatalf("expected cap at 100 items, got %d", len(capped))
	}
}

func TestFormatSupplierSubOrderLineText(t *testing.T) {
	lineSeries, itemSeries := formatSupplierSubOrderLineText(orderCartItem{
		ProductID:   "p-series",
		Title:       "Keten Takım",
		CustomSku:   "FLORA-101",
		Quantity:    12,
		Price:       150,
		SeriesRatio: "2-2-2",
	}, "TRY")

	if itemSeries.PackagesQty != 2 || itemSeries.UnitsPerPackage != 6 || itemSeries.PiecesQty != 12 {
		t.Fatalf("unexpected series item summary: %+v", itemSeries)
	}
	if !strings.Contains(lineSeries, "2 Seri (12 Adet)") {
		t.Fatalf("expected packs+pieces format in WhatsApp line, got %q", lineSeries)
	}

	lineSingle, itemSingle := formatSupplierSubOrderLineText(orderCartItem{
		ProductID:   "p-single",
		Title:       "Tekli Elbise",
		CustomSku:   "EDUSA-202",
		Quantity:    5,
		Price:       0,
		SeriesRatio: "",
	}, "USD")

	if itemSingle.PackagesQty != 5 || itemSingle.UnitsPerPackage != 1 || itemSingle.PiecesQty != 5 {
		t.Fatalf("unexpected single item summary: %+v", itemSingle)
	}
	if !strings.Contains(lineSingle, "5 Adet") || strings.Contains(lineSingle, "Seri") {
		t.Fatalf("expected single-unit format without Seri label, got %q", lineSingle)
	}
}

func TestValidateInquiryRequestOptionalSkuFallback(t *testing.T) {
	req := models.B2bInquiry{
		FullName: "Ahmet Yılmaz",
		Phone:    "+905321234567",
		Items: []models.InquiryItem{
			{ProductID: "prod-1", Title: "Toptan Tunik", CustomSku: "", Quantity: 6, Price: 120},
		},
	}
	if err := validateInquiryRequest(&req); err != nil {
		t.Fatalf("expected blank custom_sku to fallback cleanly, got err: %v", err)
	}
	if req.Items[0].CustomSku != "-" {
		t.Fatalf("expected fallback CustomSku='-', got %q", req.Items[0].CustomSku)
	}

	bad := models.B2bInquiry{FullName: "Ahmet Yılmaz", Phone: "+905321234567"}
	if err := validateInquiryRequest(&bad); err == nil {
		t.Fatalf("expected error for empty inquiry items")
	}
}
