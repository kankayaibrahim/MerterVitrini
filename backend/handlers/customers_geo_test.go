package handlers

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"mertervitrini/backend/pkg/mailer"
)

func TestResolveCountryFromPhone(t *testing.T) {
	cases := []struct {
		name     string
		phone    string
		wantOK   bool
		wantCode string
	}{
		{name: "Turkey +90", phone: "+90 532 111 22 33", wantOK: true, wantCode: "TR"},
		{name: "Turkey 05xx", phone: "05424074528", wantOK: true, wantCode: "TR"},
		{name: "Turkey 5xx", phone: "5321234567", wantOK: true, wantCode: "TR"},
		{name: "Germany +49", phone: "+49 176 12345678", wantOK: true, wantCode: "DE"},
		{name: "Montenegro +382", phone: "+382 67 123456", wantOK: true, wantCode: "ME"},
		{name: "Italy 0039", phone: "0039 347 1234567", wantOK: true, wantCode: "IT"},
		{name: "Lebanon +961", phone: "+961 3 123456", wantOK: true, wantCode: "LB"},
		{name: "Kazakhstan +77", phone: "+7 701 123 4567", wantOK: true, wantCode: "KZ"},
		{name: "Russia +79", phone: "+7 916 123 4567", wantOK: true, wantCode: "RU"},
		{name: "Ivory Coast +225", phone: "+225 07 12 34 56", wantOK: true, wantCode: "CI"},
		{name: "Kenya +254", phone: "+254 712 345678", wantOK: true, wantCode: "KE"},
		{name: "Too short", phone: "12345", wantOK: false, wantCode: ""},
		{name: "Empty", phone: "", wantOK: false, wantCode: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := ResolveCountryFromPhone(tc.phone)
			if ok != tc.wantOK {
				t.Fatalf("ResolveCountryFromPhone(%q) ok = %v, want %v", tc.phone, ok, tc.wantOK)
			}
			if got.Code != tc.wantCode {
				t.Fatalf("ResolveCountryFromPhone(%q) code = %q, want %q", tc.phone, got.Code, tc.wantCode)
			}
			if tc.wantOK && (got.Name == "" || (got.Lat == 0 && got.Lon == 0)) {
				t.Fatalf("expected non-empty name and centroid for %q, got %+v", tc.wantCode, got)
			}
		})
	}
}

func TestNormalizeISO2AndLookup(t *testing.T) {
	if got := NormalizeISO2(" tr "); got != "TR" {
		t.Fatalf("NormalizeISO2(' tr ') = %q, want TR", got)
	}
	if got := NormalizeISO2("XX"); got != "" {
		t.Fatalf("NormalizeISO2('XX') = %q, want empty", got)
	}
	if got := NormalizeISO2("USA"); got != "" {
		t.Fatalf("NormalizeISO2('USA') = %q, want empty", got)
	}
	meta, ok := LookupCountryMeta("de")
	if !ok || meta.Name != "Almanya" {
		t.Fatalf("LookupCountryMeta('de') = (%+v, %v), want Almanya", meta, ok)
	}
	if got := CanonicalCountryNameTr("DE", "Germany"); got != "Almanya" {
		t.Fatalf("CanonicalCountryNameTr('DE', 'Germany') = %q, want Almanya", got)
	}
	if got := CanonicalCountryNameTr("TR", "Turkey"); got != "Türkiye" {
		t.Fatalf("CanonicalCountryNameTr('TR', 'Turkey') = %q, want Türkiye", got)
	}
}

func TestBuildCustomerGeoFromMeta(t *testing.T) {
	geoAPI, ok := buildCustomerGeoFromMeta("+49 170 0000000", mailer.ClientMeta{
		CountryCode: "de",
		Country:     "Almanya",
		City:        "Berlin",
		RegionName:  "Berlin",
		Lat:         52.52,
		Lon:         13.405,
	})
	if !ok || geoAPI.CountryCode != "DE" || geoAPI.Source != "ip_api" || geoAPI.City != "Berlin" {
		t.Fatalf("unexpected ip_api result: %+v ok=%v", geoAPI, ok)
	}

	geoCF, ok := buildCustomerGeoFromMeta("+905321234567", mailer.ClientMeta{
		CountryCode: "FR",
		City:        "Bilinmiyor",
	})
	if !ok || geoCF.CountryCode != "FR" || geoCF.Source != "cf_header" || geoCF.Lat == nil {
		t.Fatalf("unexpected cf_header result: %+v ok=%v", geoCF, ok)
	}

	geoPhone, ok := buildCustomerGeoFromMeta("+382 69 111222", mailer.ClientMeta{
		Country: "Bilinmiyor",
		City:    "Bilinmiyor",
	})
	if !ok || geoPhone.CountryCode != "ME" || geoPhone.Source != "phone_prefix" || geoPhone.CountryName != "Karadağ" {
		t.Fatalf("unexpected phone_prefix result: %+v ok=%v", geoPhone, ok)
	}
}

func TestAggregateCustomerOverview(t *testing.T) {
	loc, _ := time.LoadLocation("Europe/Istanbul")
	now := time.Date(2026, 11, 15, 14, 0, 0, 0, loc)
	latBer, lonBer := 52.5200, 13.4050
	latIst, lonIst := 41.0082, 28.9784

	rows := []customerOverviewRow{
		{
			ID: "u1", Name: "Ali Veli", Email: "ali@example.com",
			CreatedAt: now.Add(-2 * time.Hour), Verified: true, Blocked: false,
			CountryCode: "TR", CountryName: "Türkiye", City: "İstanbul",
			Lat: &latIst, Lon: &lonIst, GeoSource: "ip_api",
			LastActive: now.Add(-3 * time.Minute), OrdersCount: 2, TotalSpend: 15000, CartItems: 3,
		},
		{
			ID: "u2", Name: "Hans Weber", Email: "hans@example.com",
			CreatedAt: now.Add(-26 * time.Hour), Verified: false, Blocked: false,
			CountryCode: "DE", CountryName: "Almanya", City: "Berlin",
			Lat: &latBer, Lon: &lonBer, GeoSource: "ip_api",
			LastActive: now.Add(-1 * time.Hour), OrdersCount: 1, TotalSpend: 8200, CartItems: 0,
		},
		{
			ID: "u3", Name: "Unknown Shop", Email: "unknown@example.com",
			CreatedAt: now.Add(-10 * 24 * time.Hour), Verified: true, Blocked: true,
			LastActive: now.Add(-5 * 24 * time.Hour), OrdersCount: 0, TotalSpend: 0, CartItems: 1,
		},
	}

	overview := aggregateCustomerOverview(rows, now)

	if overview.KPIs.TotalCustomers != 3 {
		t.Fatalf("TotalCustomers = %d, want 3", overview.KPIs.TotalCustomers)
	}
	if overview.KPIs.TodayCount != 1 {
		t.Fatalf("TodayCount = %d, want 1", overview.KPIs.TodayCount)
	}
	if overview.KPIs.YesterdayCount != 1 {
		t.Fatalf("YesterdayCount = %d, want 1", overview.KPIs.YesterdayCount)
	}
	if overview.KPIs.Last7DaysCount != 2 {
		t.Fatalf("Last7DaysCount = %d, want 2", overview.KPIs.Last7DaysCount)
	}
	if overview.KPIs.OnlineNowCount != 1 {
		t.Fatalf("OnlineNowCount = %d, want 1", overview.KPIs.OnlineNowCount)
	}
	if overview.KPIs.CountriesCount != 2 || overview.KPIs.InternationalCount != 1 {
		t.Fatalf("unexpected geo KPIs: %+v", overview.KPIs)
	}
	if len(overview.DailyRegistrations) != 30 {
		t.Fatalf("len(DailyRegistrations) = %d, want 30", len(overview.DailyRegistrations))
	}
	if overview.DailyRegistrations[29].Count != 1 || overview.DailyRegistrations[29].TurkeyCount != 1 {
		t.Fatalf("unexpected today daily point: %+v", overview.DailyRegistrations[29])
	}
	if len(overview.MapPoints) != 2 {
		t.Fatalf("len(MapPoints) = %d, want 2", len(overview.MapPoints))
	}
	if overview.Countries[len(overview.Countries)-1].CountryCode != "UNKNOWN" {
		t.Fatalf("expected UNKNOWN country bucket sorted last, got %+v", overview.Countries)
	}
}

func TestBuildCustomerListFilters(t *testing.T) {
	q := url.Values{}
	q.Set("search", "berlin")
	q.Set("country", "FOREIGN")
	q.Set("period", "today")
	q.Set("status", "with_orders")
	q.Set("sort", "highest_spend")

	whereSQL, args, orderBySQL := buildCustomerListFilters(q)
	if len(args) != 1 || args[0] != "%berlin%" {
		t.Fatalf("unexpected args: %#v", args)
	}
	for _, substr := range []string{"ILIKE $1", "UPPER(country_code) <> 'TR'", "Europe/Istanbul", "orders_count > 0"} {
		if !strings.Contains(whereSQL, substr) {
			t.Fatalf("whereSQL %q missing %q", whereSQL, substr)
		}
	}
	if !strings.Contains(orderBySQL, "orders_total_amount DESC") {
		t.Fatalf("unexpected orderBySQL: %q", orderBySQL)
	}
}
