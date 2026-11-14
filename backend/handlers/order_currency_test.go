package handlers

import (
	"context"
	"math"
	"testing"
)

func TestComputeOrderCurrencySummarySingleUSD(t *testing.T) {
	items := []orderCartItem{
		{
			ProductID: "prod-edusa-1",
			BrandID:   "brand-edusa",
			Quantity:  6,
			Price:     7.60,
			Currency:  "USD",
		},
	}
	rates := map[string]float64{
		"TRY": 1.0,
		"USD": 44.0,
		"EUR": 48.0,
	}

	summary := computeOrderCurrencySummary(items, "TRY", rates)

	if summary.OrderCurrency != "USD" {
		t.Fatalf("expected OrderCurrency=USD, got %s", summary.OrderCurrency)
	}
	if math.Abs(summary.OrderTotalAmount-45.60) > 0.001 {
		t.Fatalf("expected OrderTotalAmount=45.60, got %.2f", summary.OrderTotalAmount)
	}
	if math.Abs(summary.TotalAmountTRY-2006.40) > 0.001 {
		t.Fatalf("expected TotalAmountTRY=2006.40, got %.2f", summary.TotalAmountTRY)
	}
	if summary.CustomerCurrency != "TRY" {
		t.Fatalf("expected CustomerCurrency=TRY, got %s", summary.CustomerCurrency)
	}
	if math.Abs(summary.CustomerTotalAmount-2006.40) > 0.001 {
		t.Fatalf("expected CustomerTotalAmount=2006.40, got %.2f", summary.CustomerTotalAmount)
	}
	if len(summary.CurrencyTotals) != 1 || math.Abs(summary.CurrencyTotals["USD"]-45.60) > 0.001 {
		t.Fatalf("unexpected CurrencyTotals: %#v", summary.CurrencyTotals)
	}

	formatted := formatCurrencyBreakdownSummary(summary.CurrencyTotals, summary.OrderTotalAmount, summary.OrderCurrency)
	if formatted != "$45.60 USD" {
		t.Fatalf("expected '$45.60 USD', got %q", formatted)
	}
}

func TestComputeOrderCurrencySummaryMixedAndSubOrderGrouping(t *testing.T) {
	items := []orderCartItem{
		{
			ProductID: "p-usd-1",
			BrandID:   "brand-a",
			Quantity:  16,
			Price:     60.66,
			Currency:  "$",
		},
		{
			ProductID: "p-try-1",
			BrandID:   "brand-a",
			Quantity:  10,
			Price:     597.42,
			Currency:  "TL",
		},
	}
	rates := map[string]float64{
		"TRY": 1.0,
		"USD": 44.0,
		"EUR": 48.0,
	}

	summary := computeOrderCurrencySummary(items, "EUR", rates)

	if summary.OrderCurrency != "TRY" {
		t.Fatalf("expected mixed OrderCurrency=TRY, got %s", summary.OrderCurrency)
	}
	expectedTRY := 970.56*44.0 + 5974.20
	if math.Abs(summary.TotalAmountTRY-expectedTRY) > 0.02 {
		t.Fatalf("expected TotalAmountTRY=%.2f, got %.2f", expectedTRY, summary.TotalAmountTRY)
	}
	if math.Abs(summary.OrderTotalAmount-summary.TotalAmountTRY) > 0.001 {
		t.Fatalf("expected OrderTotalAmount to match TotalAmountTRY, got %.2f vs %.2f", summary.OrderTotalAmount, summary.TotalAmountTRY)
	}
	if math.Abs(summary.CurrencyTotals["USD"]-970.56) > 0.001 || math.Abs(summary.CurrencyTotals["TRY"]-5974.20) > 0.001 {
		t.Fatalf("unexpected CurrencyTotals: %#v", summary.CurrencyTotals)
	}
	if summary.CustomerCurrency != "EUR" {
		t.Fatalf("expected CustomerCurrency=EUR, got %s", summary.CustomerCurrency)
	}

	expectedEUR := math.Round(((970.56*44.0)/48.0)*100)/100 + math.Round((5974.20/48.0)*100)/100
	if math.Abs(summary.CustomerTotalAmount-expectedEUR) > 0.02 {
		t.Fatalf("expected CustomerTotalAmount=%.2f, got %.2f", expectedEUR, summary.CustomerTotalAmount)
	}

	formatted := formatCurrencyBreakdownSummary(summary.CurrencyTotals, summary.OrderTotalAmount, summary.OrderCurrency)
	if formatted != "$970.56 USD + ₺5974.20 TRY" {
		t.Fatalf("expected '$970.56 USD + ₺5974.20 TRY', got %q", formatted)
	}

	groups := groupOrderItemsByBrandAndCurrency(items)
	if len(groups) != 2 {
		t.Fatalf("expected 2 (brand_id, currency) groups for same brand with USD & TRY items, got %d", len(groups))
	}
	if groups[0].BrandID != "brand-a" || groups[0].Currency != "USD" {
		t.Fatalf("unexpected group[0]: %+v", groups[0])
	}
	if groups[1].BrandID != "brand-a" || groups[1].Currency != "TRY" {
		t.Fatalf("unexpected group[1]: %+v", groups[1])
	}
}

func TestOrderCurrencyConversionAndJSONFallback(t *testing.T) {
	rates := loadLatestExchangeRatesMap(context.Background())
	if rates["TRY"] != 1.0 || rates["USD"] <= 0 {
		t.Fatalf("expected nil-pool fallback exchange rates, got %#v", rates)
	}

	discounted := 8.0
	summary := computeOrderCurrencySummary([]orderCartItem{
		{ProductID: "p1", BrandID: "b1", Quantity: 5, Price: 12.0, DiscountedPrice: &discounted, Currency: "USD"},
	}, "EUR", map[string]float64{"TRY": 1.0, "USD": 40.0, "EUR": 45.0})

	if math.Abs(summary.OrderTotalAmount-40.0) > 0.001 {
		t.Fatalf("expected discounted total 40.00 USD, got %.2f", summary.OrderTotalAmount)
	}
	if math.Abs(summary.TotalAmountTRY-1600.0) > 0.001 {
		t.Fatalf("expected 1600.00 TRY, got %.2f", summary.TotalAmountTRY)
	}
	if math.Abs(summary.CustomerTotalAmount-35.56) > 0.01 {
		t.Fatalf("expected 35.56 EUR, got %.2f", summary.CustomerTotalAmount)
	}

	parsed := parseCurrencyTotalsJSON([]byte(`{"usd":45.6,"TL":120.5}`), "TRY", 999)
	if math.Abs(parsed["USD"]-45.60) > 0.001 || math.Abs(parsed["TRY"]-120.50) > 0.001 {
		t.Fatalf("unexpected parsed map: %#v", parsed)
	}

	fallback := parseCurrencyTotalsJSON([]byte(`{}`), "$", 45.60)
	if len(fallback) != 1 || math.Abs(fallback["USD"]-45.60) > 0.001 {
		t.Fatalf("unexpected fallback map: %#v", fallback)
	}
}
