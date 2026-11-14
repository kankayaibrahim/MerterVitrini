package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"

	"mertervitrini/backend/db"
)

var defaultOrderExchangeRates = map[string]float64{
	"TRY": 1.0,
	"USD": 44.0,
	"EUR": 48.0,
	"GBP": 56.0,
	"RUB": 0.48,
}

func normalizeOrderCurrencyCode(raw string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(raw))
	switch cleaned {
	case "", "TL", "₺", "TRY":
		return "TRY"
	case "$", "USD":
		return "USD"
	case "€", "EUR":
		return "EUR"
	case "£", "GBP":
		return "GBP"
	case "₽", "RUB":
		return "RUB"
	default:
		if len(cleaned) > 3 {
			return cleaned[:3]
		}
		return cleaned
	}
}

func firstNonEmptyCurrencyPref(primary, secondary string) string {
	if strings.TrimSpace(primary) != "" {
		return normalizeOrderCurrencyCode(primary)
	}
	if strings.TrimSpace(secondary) != "" {
		return normalizeOrderCurrencyCode(secondary)
	}
	return ""
}

func orderCurrencySymbol(currency string) string {
	switch normalizeOrderCurrencyCode(currency) {
	case "USD":
		return "$"
	case "EUR":
		return "€"
	case "GBP":
		return "£"
	case "RUB":
		return "₽"
	case "TRY":
		return "₺"
	default:
		return normalizeOrderCurrencyCode(currency) + " "
	}
}

func formatOrderMoney(amount float64, currency string) string {
	code := normalizeOrderCurrencyCode(currency)
	sym := orderCurrencySymbol(code)
	rounded := math.Round(amount*100) / 100
	if strings.HasSuffix(sym, " ") {
		return fmt.Sprintf("%.2f %s", rounded, code)
	}
	return fmt.Sprintf("%s%.2f %s", sym, rounded, code)
}

func loadLatestExchangeRatesMap(ctx context.Context) map[string]float64 {
	rates := make(map[string]float64, len(defaultOrderExchangeRates))
	for k, v := range defaultOrderExchangeRates {
		rates[k] = v
	}
	if db.Pool == nil {
		return rates
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (UPPER(TRIM(currency_code)))
		       UPPER(TRIM(currency_code)),
		       buying_rate
		FROM catalog.exchange_rates
		WHERE buying_rate > 0
		ORDER BY UPPER(TRIM(currency_code)), publication_date DESC, updated_at DESC
	`)
	if err != nil {
		return rates
	}
	defer rows.Close()

	for rows.Next() {
		var code string
		var rate float64
		if rows.Scan(&code, &rate) == nil && rate > 0 {
			rates[normalizeOrderCurrencyCode(code)] = rate
		}
	}
	rates["TRY"] = 1.0
	return rates
}

func resolveRateToTRY(currency string, rates map[string]float64) float64 {
	code := normalizeOrderCurrencyCode(currency)
	if code == "TRY" {
		return 1.0
	}
	if rates != nil {
		if r, ok := rates[code]; ok && r > 0 {
			return r
		}
	}
	if def, ok := defaultOrderExchangeRates[code]; ok && def > 0 {
		return def
	}
	return 1.0
}

func convertOrderAmount(amount float64, fromCurrency, toCurrency string, rates map[string]float64) float64 {
	from := normalizeOrderCurrencyCode(fromCurrency)
	to := normalizeOrderCurrencyCode(toCurrency)
	if from == to {
		return math.Round(amount*100) / 100
	}
	fromRate := resolveRateToTRY(from, rates)
	toRate := resolveRateToTRY(to, rates)
	if toRate <= 0 {
		toRate = 1.0
	}
	converted := (amount * fromRate) / toRate
	return math.Round(converted*100) / 100
}

type orderCurrencySummary struct {
	OrderCurrency       string
	OrderTotalAmount    float64
	CustomerCurrency    string
	CustomerTotalAmount float64
	TotalAmountTRY      float64
	CurrencyTotals      map[string]float64
}

func roundCurrencyTotalsMap(raw map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(raw))
	for k, v := range raw {
		code := normalizeOrderCurrencyCode(k)
		out[code] = math.Round(v*100) / 100
	}
	return out
}

func computeOrderCurrencySummary(items []orderCartItem, requestedCustomerCurrency string, rates map[string]float64) orderCurrencySummary {
	rawTotals := make(map[string]float64)
	for _, it := range items {
		code := normalizeOrderCurrencyCode(it.Currency)
		rawTotals[code] += getEffectiveItemPrice(it) * float64(it.Quantity)
	}
	currencyTotals := roundCurrencyTotalsMap(rawTotals)

	var totalTryRaw float64
	for code, subtotal := range currencyTotals {
		totalTryRaw += convertOrderAmount(subtotal, code, "TRY", rates)
	}
	totalTRY := math.Round(totalTryRaw*100) / 100

	orderCurr := "TRY"
	orderTotal := totalTRY
	if len(currencyTotals) == 1 {
		for code, subtotal := range currencyTotals {
			orderCurr = code
			orderTotal = subtotal
		}
	} else if len(currencyTotals) == 0 {
		orderTotal = 0
	}

	custCurr := orderCurr
	if strings.TrimSpace(requestedCustomerCurrency) != "" {
		custCurr = normalizeOrderCurrencyCode(requestedCustomerCurrency)
	}

	var custTotal float64
	if len(currencyTotals) == 1 && custCurr == orderCurr {
		custTotal = orderTotal
	} else {
		var custRaw float64
		for code, subtotal := range currencyTotals {
			custRaw += convertOrderAmount(subtotal, code, custCurr, rates)
		}
		custTotal = math.Round(custRaw*100) / 100
	}

	return orderCurrencySummary{
		OrderCurrency:       orderCurr,
		OrderTotalAmount:    orderTotal,
		CustomerCurrency:    custCurr,
		CustomerTotalAmount: custTotal,
		TotalAmountTRY:      totalTRY,
		CurrencyTotals:      currencyTotals,
	}
}

func parseCurrencyTotalsJSON(raw []byte, fallbackCurrency string, fallbackTotal float64) map[string]float64 {
	if len(raw) > 0 {
		var parsed map[string]float64
		if err := json.Unmarshal(raw, &parsed); err == nil && len(parsed) > 0 {
			return roundCurrencyTotalsMap(parsed)
		}
	}
	if fallbackTotal <= 0 {
		return map[string]float64{}
	}
	return map[string]float64{
		normalizeOrderCurrencyCode(fallbackCurrency): math.Round(fallbackTotal*100) / 100,
	}
}

var currencySortPriority = map[string]int{
	"USD": 1,
	"EUR": 2,
	"GBP": 3,
	"RUB": 4,
	"TRY": 5,
}

func sortCurrencyCodes(totals map[string]float64) []string {
	codes := make([]string, 0, len(totals))
	for k := range totals {
		codes = append(codes, normalizeOrderCurrencyCode(k))
	}
	sort.Slice(codes, func(i, j int) bool {
		pi := currencySortPriority[codes[i]]
		pj := currencySortPriority[codes[j]]
		if pi == 0 {
			pi = 99
		}
		if pj == 0 {
			pj = 99
		}
		if pi != pj {
			return pi < pj
		}
		return codes[i] < codes[j]
	})
	return codes
}

func formatCurrencyBreakdownSummary(currencyTotals map[string]float64, fallbackAmount float64, fallbackCurrency string) string {
	if len(currencyTotals) == 0 {
		return formatOrderMoney(fallbackAmount, fallbackCurrency)
	}
	codes := sortCurrencyCodes(currencyTotals)
	parts := make([]string, 0, len(codes))
	for _, code := range codes {
		parts = append(parts, formatOrderMoney(currencyTotals[code], code))
	}
	return strings.Join(parts, " + ")
}
