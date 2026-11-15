package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/mailer"
	"mertervitrini/backend/pkg/safe"
)

// CountryCentroidMeta stores the Turkish display name and representative map coordinates for an ISO-2 country.
type CountryCentroidMeta struct {
	Code string
	Name string
	Lat  float64
	Lon  float64
}

var customerGeoSchemaOnce sync.Once
var customerGeoBackfillRunning atomic.Bool
var customerGeoLastRunUnix atomic.Int64

const customerGeoCooldown = 10 * time.Minute

var countryMetaMap = map[string]CountryCentroidMeta{
	"TR": {Code: "TR", Name: "Türkiye", Lat: 39.00, Lon: 35.24},
	"DE": {Code: "DE", Name: "Almanya", Lat: 51.17, Lon: 10.45},
	"GB": {Code: "GB", Name: "Birleşik Krallık", Lat: 54.00, Lon: -2.50},
	"FR": {Code: "FR", Name: "Fransa", Lat: 46.23, Lon: 2.21},
	"IT": {Code: "IT", Name: "İtalya", Lat: 41.87, Lon: 12.57},
	"ES": {Code: "ES", Name: "İspanya", Lat: 40.46, Lon: -3.75},
	"NL": {Code: "NL", Name: "Hollanda", Lat: 52.13, Lon: 5.29},
	"BE": {Code: "BE", Name: "Belçika", Lat: 50.50, Lon: 4.47},
	"AT": {Code: "AT", Name: "Avusturya", Lat: 47.52, Lon: 14.55},
	"CH": {Code: "CH", Name: "İsviçre", Lat: 46.82, Lon: 8.23},
	"PL": {Code: "PL", Name: "Polonya", Lat: 51.92, Lon: 19.15},
	"RO": {Code: "RO", Name: "Romanya", Lat: 45.94, Lon: 24.97},
	"BG": {Code: "BG", Name: "Bulgaristan", Lat: 42.73, Lon: 25.49},
	"GR": {Code: "GR", Name: "Yunanistan", Lat: 39.07, Lon: 21.82},
	"RS": {Code: "RS", Name: "Sırbistan", Lat: 44.02, Lon: 21.01},
	"BA": {Code: "BA", Name: "Bosna-Hersek", Lat: 43.92, Lon: 17.68},
	"ME": {Code: "ME", Name: "Karadağ", Lat: 42.71, Lon: 19.37},
	"AL": {Code: "AL", Name: "Arnavutluk", Lat: 41.15, Lon: 20.17},
	"MK": {Code: "MK", Name: "Kuzey Makedonya", Lat: 41.61, Lon: 21.75},
	"XK": {Code: "XK", Name: "Kosova", Lat: 42.60, Lon: 20.90},
	"HR": {Code: "HR", Name: "Hırvatistan", Lat: 45.10, Lon: 15.20},
	"SI": {Code: "SI", Name: "Slovenya", Lat: 46.15, Lon: 15.00},
	"CZ": {Code: "CZ", Name: "Çekya", Lat: 49.82, Lon: 15.47},
	"SK": {Code: "SK", Name: "Slovakya", Lat: 48.67, Lon: 19.70},
	"HU": {Code: "HU", Name: "Macaristan", Lat: 47.16, Lon: 19.50},
	"UA": {Code: "UA", Name: "Ukrayna", Lat: 48.38, Lon: 31.17},
	"RU": {Code: "RU", Name: "Rusya", Lat: 55.75, Lon: 37.62},
	"BY": {Code: "BY", Name: "Belarus", Lat: 53.71, Lon: 27.95},
	"MD": {Code: "MD", Name: "Moldova", Lat: 47.41, Lon: 28.37},
	"LT": {Code: "LT", Name: "Litvanya", Lat: 55.17, Lon: 23.88},
	"LV": {Code: "LV", Name: "Letonya", Lat: 56.88, Lon: 24.60},
	"EE": {Code: "EE", Name: "Estonya", Lat: 58.60, Lon: 25.01},
	"FI": {Code: "FI", Name: "Finlandiya", Lat: 61.92, Lon: 25.75},
	"SE": {Code: "SE", Name: "İsveç", Lat: 60.13, Lon: 18.64},
	"NO": {Code: "NO", Name: "Norveç", Lat: 60.47, Lon: 8.47},
	"DK": {Code: "DK", Name: "Danimarka", Lat: 56.26, Lon: 9.50},
	"IE": {Code: "IE", Name: "İrlanda", Lat: 53.14, Lon: -7.69},
	"PT": {Code: "PT", Name: "Portekiz", Lat: 39.40, Lon: -8.22},
	"US": {Code: "US", Name: "ABD", Lat: 37.09, Lon: -95.71},
	"CA": {Code: "CA", Name: "Kanada", Lat: 56.13, Lon: -106.35},
	"BR": {Code: "BR", Name: "Brezilya", Lat: -14.24, Lon: -51.93},
	"MX": {Code: "MX", Name: "Meksika", Lat: 23.63, Lon: -102.55},
	"AR": {Code: "AR", Name: "Arjantin", Lat: -38.42, Lon: -63.62},
	"CO": {Code: "CO", Name: "Kolombiya", Lat: 4.57, Lon: -74.30},
	"CL": {Code: "CL", Name: "Şili", Lat: -35.68, Lon: -71.54},
	"PE": {Code: "PE", Name: "Peru", Lat: -9.19, Lon: -75.02},
	"AE": {Code: "AE", Name: "Birleşik Arap Emirlikleri", Lat: 23.42, Lon: 53.85},
	"SA": {Code: "SA", Name: "Suudi Arabistan", Lat: 23.89, Lon: 45.08},
	"KW": {Code: "KW", Name: "Kuveyt", Lat: 29.31, Lon: 47.48},
	"QA": {Code: "QA", Name: "Katar", Lat: 25.35, Lon: 51.18},
	"BH": {Code: "BH", Name: "Bahreyn", Lat: 26.07, Lon: 50.56},
	"OM": {Code: "OM", Name: "Umman", Lat: 21.47, Lon: 55.98},
	"JO": {Code: "JO", Name: "Ürdün", Lat: 30.59, Lon: 36.24},
	"LB": {Code: "LB", Name: "Lübnan", Lat: 33.85, Lon: 35.86},
	"IQ": {Code: "IQ", Name: "Irak", Lat: 33.22, Lon: 43.68},
	"IL": {Code: "IL", Name: "İsrail", Lat: 31.05, Lon: 34.85},
	"PS": {Code: "PS", Name: "Filistin", Lat: 31.95, Lon: 35.23},
	"YE": {Code: "YE", Name: "Yemen", Lat: 15.55, Lon: 48.52},
	"SY": {Code: "SY", Name: "Suriye", Lat: 34.80, Lon: 39.00},
	"EG": {Code: "EG", Name: "Mısır", Lat: 26.82, Lon: 30.80},
	"MA": {Code: "MA", Name: "Fas", Lat: 31.79, Lon: -7.09},
	"DZ": {Code: "DZ", Name: "Cezayir", Lat: 28.03, Lon: 1.66},
	"TN": {Code: "TN", Name: "Tunus", Lat: 33.89, Lon: 9.54},
	"LY": {Code: "LY", Name: "Libya", Lat: 26.34, Lon: 17.23},
	"NG": {Code: "NG", Name: "Nijerya", Lat: 9.08, Lon: 8.68},
	"GH": {Code: "GH", Name: "Gana", Lat: 7.95, Lon: -1.02},
	"KE": {Code: "KE", Name: "Kenya", Lat: -0.02, Lon: 37.91},
	"ZA": {Code: "ZA", Name: "Güney Afrika", Lat: -30.56, Lon: 22.94},
	"ET": {Code: "ET", Name: "Etiyopya", Lat: 9.15, Lon: 40.49},
	"SN": {Code: "SN", Name: "Senegal", Lat: 14.50, Lon: -14.45},
	"CI": {Code: "CI", Name: "Fildişi Sahili", Lat: 7.54, Lon: -5.55},
	"CM": {Code: "CM", Name: "Kamerun", Lat: 7.37, Lon: 12.35},
	"TZ": {Code: "TZ", Name: "Tanzanya", Lat: -6.37, Lon: 34.89},
	"UG": {Code: "UG", Name: "Uganda", Lat: 1.37, Lon: 32.29},
	"CD": {Code: "CD", Name: "Kongo DC", Lat: -4.04, Lon: 21.76},
	"SD": {Code: "SD", Name: "Sudan", Lat: 12.86, Lon: 30.22},
	"AO": {Code: "AO", Name: "Angola", Lat: -11.20, Lon: 17.87},
	"UZ": {Code: "UZ", Name: "Özbekistan", Lat: 41.38, Lon: 64.59},
	"KZ": {Code: "KZ", Name: "Kazakistan", Lat: 48.02, Lon: 66.92},
	"KG": {Code: "KG", Name: "Kırgızistan", Lat: 41.20, Lon: 74.77},
	"AZ": {Code: "AZ", Name: "Azerbaycan", Lat: 40.14, Lon: 47.58},
	"GE": {Code: "GE", Name: "Gürcistan", Lat: 42.32, Lon: 43.36},
	"AM": {Code: "AM", Name: "Ermenistan", Lat: 40.07, Lon: 45.04},
	"TM": {Code: "TM", Name: "Türkmenistan", Lat: 38.97, Lon: 59.56},
	"TJ": {Code: "TJ", Name: "Tacikistan", Lat: 38.86, Lon: 71.28},
	"IN": {Code: "IN", Name: "Hindistan", Lat: 20.59, Lon: 78.96},
	"PK": {Code: "PK", Name: "Pakistan", Lat: 30.38, Lon: 69.35},
	"BD": {Code: "BD", Name: "Bangladeş", Lat: 23.68, Lon: 90.36},
	"CN": {Code: "CN", Name: "Çin", Lat: 35.86, Lon: 104.20},
	"JP": {Code: "JP", Name: "Japonya", Lat: 36.20, Lon: 138.25},
	"KR": {Code: "KR", Name: "Güney Kore", Lat: 35.91, Lon: 127.77},
	"ID": {Code: "ID", Name: "Endonezya", Lat: -0.79, Lon: 113.92},
	"MY": {Code: "MY", Name: "Malezya", Lat: 4.21, Lon: 101.98},
	"SG": {Code: "SG", Name: "Singapur", Lat: 1.35, Lon: 103.82},
	"TH": {Code: "TH", Name: "Tayland", Lat: 15.87, Lon: 100.99},
	"AU": {Code: "AU", Name: "Avustralya", Lat: -25.27, Lon: 133.78},
	"NZ": {Code: "NZ", Name: "Yeni Zelanda", Lat: -40.90, Lon: 174.89},
}

var phoneCallingCode3 = map[string]string{
	"212": "MA", "213": "DZ", "216": "TN", "218": "LY",
	"221": "SN", "225": "CI", "233": "GH", "234": "NG",
	"237": "CM", "243": "CD", "244": "AO", "249": "SD",
	"251": "ET", "254": "KE", "255": "TZ", "256": "UG",
	"351": "PT", "353": "IE", "358": "FI", "359": "BG",
	"370": "LT", "371": "LV", "372": "EE", "373": "MD",
	"374": "AM", "375": "BY", "380": "UA", "381": "RS",
	"382": "ME", "383": "XK", "385": "HR", "386": "SI",
	"387": "BA", "389": "MK", "420": "CZ", "421": "SK",
	"880": "BD", "961": "LB", "962": "JO", "963": "SY",
	"964": "IQ", "965": "KW", "966": "SA", "967": "YE",
	"968": "OM", "970": "PS", "971": "AE", "972": "IL",
	"973": "BH", "974": "QA", "992": "TJ", "993": "TM",
	"994": "AZ", "995": "GE", "996": "KG", "998": "UZ",
}

var phoneCallingCode2 = map[string]string{
	"20": "EG", "27": "ZA", "30": "GR", "31": "NL",
	"32": "BE", "33": "FR", "34": "ES", "36": "HU",
	"39": "IT", "40": "RO", "41": "CH", "43": "AT",
	"44": "GB", "45": "DK", "46": "SE", "47": "NO",
	"48": "PL", "49": "DE", "51": "PE", "52": "MX",
	"54": "AR", "55": "BR", "56": "CL", "57": "CO",
	"60": "MY", "61": "AU", "62": "ID", "64": "NZ",
	"65": "SG", "66": "TH", "76": "KZ", "77": "KZ",
	"81": "JP", "82": "KR", "86": "CN", "90": "TR",
	"91": "IN", "92": "PK",
}

var phoneCallingCode1 = map[string]string{
	"1": "US",
	"7": "RU",
}

// NormalizeISO2 converts a raw country code to uppercase ISO-2 when valid.
func NormalizeISO2(raw string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(raw))
	if len(cleaned) != 2 || cleaned == "XX" || cleaned == "T1" || cleaned == "--" {
		return ""
	}
	for _, r := range cleaned {
		if r < 'A' || r > 'Z' {
			return ""
		}
	}
	return cleaned
}

// LookupCountryMeta resolves Turkish country display name and centroid coordinates by ISO-2 code.
func LookupCountryMeta(code string) (CountryCentroidMeta, bool) {
	iso := NormalizeISO2(code)
	if iso == "" {
		return CountryCentroidMeta{}, false
	}
	meta, ok := countryMetaMap[iso]
	return meta, ok
}

// ResolveCountryFromPhone infers the likely country from an E.164 international phone number.
func ResolveCountryFromPhone(phone string) (CountryCentroidMeta, bool) {
	trimmed := strings.TrimSpace(phone)
	if trimmed == "" {
		return CountryCentroidMeta{}, false
	}

	hasPlus := strings.HasPrefix(trimmed, "+")
	digitsOnly := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, trimmed)

	if len(digitsOnly) < 7 {
		return CountryCentroidMeta{}, false
	}

	if !hasPlus {
		switch {
		case strings.HasPrefix(digitsOnly, "00") && len(digitsOnly) > 4:
			digitsOnly = digitsOnly[2:]
		case strings.HasPrefix(digitsOnly, "05") && len(digitsOnly) == 11:
			return LookupCountryMeta("TR")
		case strings.HasPrefix(digitsOnly, "5") && len(digitsOnly) == 10:
			return LookupCountryMeta("TR")
		}
	}

	if len(digitsOnly) >= 3 {
		if iso, ok := phoneCallingCode3[digitsOnly[:3]]; ok {
			return LookupCountryMeta(iso)
		}
	}
	if len(digitsOnly) >= 2 {
		if iso, ok := phoneCallingCode2[digitsOnly[:2]]; ok {
			return LookupCountryMeta(iso)
		}
	}
	if len(digitsOnly) >= 1 {
		if iso, ok := phoneCallingCode1[digitsOnly[:1]]; ok {
			return LookupCountryMeta(iso)
		}
	}
	return CountryCentroidMeta{}, false
}

type resolvedCustomerGeo struct {
	CountryCode string
	CountryName string
	City        string
	RegionName  string
	Lat         *float64
	Lon         *float64
	Source      string
}

func cleanGeoLabel(v string) string {
	trimmed := strings.TrimSpace(v)
	if strings.EqualFold(trimmed, "Bilinmiyor") || strings.EqualFold(trimmed, "Unknown") || trimmed == "-" {
		return ""
	}
	return trimmed
}

// CanonicalCountryNameTr returns the Turkish country name from countryMetaMap when known, or falls back cleanly.
func CanonicalCountryNameTr(cc, fallback string) string {
	if cmeta, ok := LookupCountryMeta(cc); ok && cmeta.Name != "" {
		return cmeta.Name
	}
	if cleaned := cleanGeoLabel(fallback); cleaned != "" {
		return cleaned
	}
	return NormalizeISO2(cc)
}

func buildCustomerGeoFromMeta(phone string, meta mailer.ClientMeta) (resolvedCustomerGeo, bool) {
	cc := NormalizeISO2(meta.CountryCode)
	city := cleanGeoLabel(meta.City)
	region := cleanGeoLabel(meta.RegionName)
	countryName := cleanGeoLabel(meta.Country)

	var latPtr, lonPtr *float64
	if meta.Lat != 0 || meta.Lon != 0 {
		lat, lon := meta.Lat, meta.Lon
		latPtr = &lat
		lonPtr = &lon
	}

	source := ""
	if cc != "" {
		if latPtr != nil && lonPtr != nil {
			source = "ip_api"
		} else {
			source = "cf_header"
		}
	} else if cmeta, ok := ResolveCountryFromPhone(phone); ok {
		cc = cmeta.Code
		countryName = cmeta.Name
		lat, lon := cmeta.Lat, cmeta.Lon
		latPtr = &lat
		lonPtr = &lon
		source = "phone_prefix"
	}

	if cc == "" {
		return resolvedCustomerGeo{}, false
	}

	countryName = CanonicalCountryNameTr(cc, countryName)
	if cmeta, ok := LookupCountryMeta(cc); ok && (latPtr == nil || lonPtr == nil) {
		lat, lon := cmeta.Lat, cmeta.Lon
		latPtr = &lat
		lonPtr = &lon
	}

	return resolvedCustomerGeo{
		CountryCode: cc,
		CountryName: countryName,
		City:        city,
		RegionName:  region,
		Lat:         latPtr,
		Lon:         lonPtr,
		Source:      source,
	}, true
}

func ensureCustomerGeoColumns(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	customerGeoSchemaOnce.Do(func() {
		ddl := []string{
			`ALTER TABLE identity.users
				ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
				ADD COLUMN IF NOT EXISTS country_name VARCHAR(120),
				ADD COLUMN IF NOT EXISTS city VARCHAR(120),
				ADD COLUMN IF NOT EXISTS region_name VARCHAR(120),
				ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
				ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
				ADD COLUMN IF NOT EXISTS geo_source VARCHAR(40),
				ADD COLUMN IF NOT EXISTS geo_resolved_at TIMESTAMPTZ`,
			`CREATE INDEX IF NOT EXISTS idx_users_customer_created_at ON identity.users (created_at DESC) WHERE user_role = 'customer'`,
			`CREATE INDEX IF NOT EXISTS idx_users_customer_country ON identity.users (country_code) WHERE user_role = 'customer'`,
			`CREATE INDEX IF NOT EXISTS idx_users_customer_geo_unresolved ON identity.users (created_at DESC) WHERE user_role = 'customer' AND country_code IS NULL`,
		}
		for _, stmt := range ddl {
			if _, err := db.Pool.Exec(ctx, stmt); err != nil {
				log.Printf("[CUSTOMER GEO SCHEMA WARNING] Failed DDL statement: %v", err)
			}
		}
		codes := make([]string, 0, len(countryMetaMap))
		names := make([]string, 0, len(countryMetaMap))
		for code, meta := range countryMetaMap {
			codes = append(codes, code)
			names = append(names, meta.Name)
		}
		if _, err := db.Pool.Exec(ctx, `
			UPDATE identity.users AS u
			SET country_name = m.name
			FROM UNNEST($1::text[], $2::text[]) AS m(code, name)
			WHERE u.user_role = 'customer'
			  AND UPPER(COALESCE(u.country_code, '')) = m.code
			  AND COALESCE(u.country_name, '') <> m.name
		`, codes, names); err != nil {
			log.Printf("[CUSTOMER GEO SCHEMA WARNING] Failed country_name normalization: %v", err)
		}
	})
}

func updateCustomerGeoRecord(ctx context.Context, userID string, geo resolvedCustomerGeo) error {
	if db.Pool == nil || userID == "" || geo.CountryCode == "" {
		return nil
	}
	ensureCustomerGeoColumns(ctx)

	var cityPtr, regionPtr *string
	if geo.City != "" {
		c := geo.City
		cityPtr = &c
	}
	if geo.RegionName != "" {
		reg := geo.RegionName
		regionPtr = &reg
	}

	_, err := db.Pool.Exec(ctx, `
		UPDATE identity.users
		SET country_code = $2,
		    country_name = $3,
		    city = COALESCE($4, city),
		    region_name = COALESCE($5, region_name),
		    latitude = COALESCE($6, latitude),
		    longitude = COALESCE($7, longitude),
		    geo_source = $8,
		    geo_resolved_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, userID, geo.CountryCode, geo.CountryName, cityPtr, regionPtr, geo.Lat, geo.Lon, geo.Source)
	return err
}

// PersistCustomerGeoFromMeta saves resolved GeoIP or phone-derived customer location during registration.
func PersistCustomerGeoFromMeta(ctx context.Context, userID, phone string, meta mailer.ClientMeta) {
	if db.Pool == nil || userID == "" {
		return
	}
	geo, ok := buildCustomerGeoFromMeta(phone, meta)
	if !ok {
		return
	}
	if err := updateCustomerGeoRecord(ctx, userID, geo); err != nil {
		log.Printf("[CUSTOMER GEO WARNING] Failed to persist geo for user %s: %v", userID, err)
	}
}

// ResolveAndPersistCustomerGeoByIP lazily enriches unresolved customer geo on authenticated logins.
func ResolveAndPersistCustomerGeoByIP(ctx context.Context, userID, ipAddress string) {
	if db.Pool == nil || userID == "" || !mailer.IsPublicIP(ipAddress) {
		return
	}
	ensureCustomerGeoColumns(ctx)

	var existingCC, existingCity, existingPhone string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(country_code, ''), COALESCE(city, ''), COALESCE(phone, '')
		FROM identity.users
		WHERE id = $1 AND user_role = 'customer'
	`, userID).Scan(&existingCC, &existingCity, &existingPhone)
	if err != nil {
		return
	}
	if existingCC != "" && existingCity != "" {
		return
	}

	batchMap := lookupBatchGeoIP(ctx, []string{strings.TrimSpace(ipAddress)})
	if hit, ok := batchMap[strings.TrimSpace(ipAddress)]; ok {
		cc := NormalizeISO2(hit.CountryCode)
		if cc != "" {
			countryName := CanonicalCountryNameTr(cc, hit.Country)
			lat, lon := hit.Lat, hit.Lon
			geo := resolvedCustomerGeo{
				CountryCode: cc,
				CountryName: countryName,
				City:        cleanGeoLabel(hit.City),
				RegionName:  cleanGeoLabel(hit.RegionName),
				Lat:         &lat,
				Lon:         &lon,
				Source:      "ip_api",
			}
			if err := updateCustomerGeoRecord(ctx, userID, geo); err != nil {
				log.Printf("[CUSTOMER GEO WARNING] Failed login geo update for %s: %v", userID, err)
			}
			return
		}
	}

	if existingCC == "" {
		if cmeta, ok := ResolveCountryFromPhone(existingPhone); ok {
			lat, lon := cmeta.Lat, cmeta.Lon
			_ = updateCustomerGeoRecord(ctx, userID, resolvedCustomerGeo{
				CountryCode: cmeta.Code,
				CountryName: cmeta.Name,
				Lat:         &lat,
				Lon:         &lon,
				Source:      "phone_prefix",
			})
		}
	}
}

type ipAPIBatchResult struct {
	Status      string  `json:"status"`
	Query       string  `json:"query"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	RegionName  string  `json:"regionName"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
}

func lookupBatchGeoIP(ctx context.Context, ips []string) map[string]ipAPIBatchResult {
	results := make(map[string]ipAPIBatchResult)
	if len(ips) == 0 {
		return results
	}

	const maxBatch = 90
	for start := 0; start < len(ips); start += maxBatch {
		end := start + maxBatch
		if end > len(ips) {
			end = len(ips)
		}
		chunk := ips[start:end]

		payload, err := json.Marshal(chunk)
		if err != nil {
			continue
		}

		reqCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
		req, err := http.NewRequestWithContext(
			reqCtx,
			http.MethodPost,
			"http://ip-api.com/batch?lang=tr&fields=status,query,country,countryCode,regionName,city,lat,lon",
			bytes.NewReader(payload),
		)
		if err != nil {
			cancel()
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "MerterVitrini-Geo/1.0")

		resp, err := httpclient.FastClient.Do(req)
		if err != nil {
			cancel()
			continue
		}

		var items []ipAPIBatchResult
		decodeErr := json.NewDecoder(resp.Body).Decode(&items)
		resp.Body.Close()
		cancel()
		if decodeErr != nil {
			continue
		}

		for _, item := range items {
			if item.Status == "success" && NormalizeISO2(item.CountryCode) != "" {
				results[strings.TrimSpace(item.Query)] = item
			}
		}
	}

	return results
}

type unresolvedCustomerRow struct {
	ID          string
	Phone       string
	CountryCode string
	CountryName string
	City        string
	HasCoords   bool
	BestIP      string
	EventCC     string
}

// BackfillUnresolvedCustomerGeo enriches customer records lacking country, city, or map coordinates.
func BackfillUnresolvedCustomerGeo(ctx context.Context) (int, error) {
	if db.Pool == nil {
		return 0, nil
	}
	ensureCustomerGeoColumns(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			u.id,
			COALESCE(u.phone, ''),
			COALESCE(u.country_code, ''),
			COALESCE(u.country_name, ''),
			COALESCE(u.city, ''),
			(u.latitude IS NOT NULL AND u.longitude IS NOT NULL) AS has_coords,
			COALESCE(
				NULLIF(TRIM(u.registration_ip), ''),
				(
					SELECT lh.ip_address
					FROM identity.user_login_history lh
					WHERE lh.user_id = u.id AND NULLIF(TRIM(lh.ip_address), '') IS NOT NULL
					ORDER BY lh.login_at DESC
					LIMIT 1
				),
				(
					SELECT me.ip_address
					FROM analytics.member_events me
					WHERE (me.user_id = u.id OR me.visitor_id IN (SELECT uvl.visitor_id FROM analytics.user_visitor_links uvl WHERE uvl.user_id = u.id))
					  AND NULLIF(TRIM(me.ip_address), '') IS NOT NULL
					ORDER BY me.created_at DESC
					LIMIT 1
				),
				''
			) AS best_ip,
			COALESCE((
				SELECT me2.country_code
				FROM analytics.member_events me2
				WHERE (me2.user_id = u.id OR me2.visitor_id IN (SELECT uvl2.visitor_id FROM analytics.user_visitor_links uvl2 WHERE uvl2.user_id = u.id))
				  AND NULLIF(TRIM(me2.country_code), '') IS NOT NULL
				ORDER BY me2.created_at DESC
				LIMIT 1
			), '') AS event_cc
		FROM identity.users u
		WHERE u.user_role = 'customer'
		  AND (
			u.country_code IS NULL OR TRIM(u.country_code) = ''
			OR u.city IS NULL OR TRIM(u.city) = ''
			OR u.latitude IS NULL OR u.longitude IS NULL
		  )
		ORDER BY u.created_at DESC
		LIMIT 500
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	candidates := make([]unresolvedCustomerRow, 0, 64)
	uniqueIPSet := make(map[string]struct{})
	uniqueIPs := make([]string, 0, 64)

	for rows.Next() {
		var row unresolvedCustomerRow
		if scanErr := rows.Scan(
			&row.ID, &row.Phone, &row.CountryCode, &row.CountryName, &row.City,
			&row.HasCoords, &row.BestIP, &row.EventCC,
		); scanErr != nil {
			continue
		}
		row.BestIP = strings.TrimSpace(row.BestIP)
		candidates = append(candidates, row)
		if mailer.IsPublicIP(row.BestIP) {
			if _, seen := uniqueIPSet[row.BestIP]; !seen {
				uniqueIPSet[row.BestIP] = struct{}{}
				uniqueIPs = append(uniqueIPs, row.BestIP)
			}
		}
	}

	if len(candidates) == 0 {
		return 0, nil
	}

	ipResults := lookupBatchGeoIP(ctx, uniqueIPs)
	updatedCount := 0

	for _, c := range candidates {
		geo, ok := resolveCandidateGeo(c, ipResults)
		if !ok {
			continue
		}
		if updateErr := updateCustomerGeoRecord(ctx, c.ID, geo); updateErr != nil {
			log.Printf("[CUSTOMER GEO WARNING] Failed backfill update for user %s: %v", c.ID, updateErr)
			continue
		}
		updatedCount++
	}

	if updatedCount > 0 {
		log.Printf("[CUSTOMER GEO] Enriched geo coordinates/country for %d customer accounts.", updatedCount)
	}
	return updatedCount, nil
}

func resolveCandidateGeo(c unresolvedCustomerRow, ipResults map[string]ipAPIBatchResult) (resolvedCustomerGeo, bool) {
	if hit, ok := ipResults[c.BestIP]; ok {
		cc := NormalizeISO2(hit.CountryCode)
		if cc != "" {
			countryName := CanonicalCountryNameTr(cc, hit.Country)
			lat, lon := hit.Lat, hit.Lon
			return resolvedCustomerGeo{
				CountryCode: cc,
				CountryName: countryName,
				City:        cleanGeoLabel(hit.City),
				RegionName:  cleanGeoLabel(hit.RegionName),
				Lat:         &lat,
				Lon:         &lon,
				Source:      "ip_api",
			}, true
		}
	}

	if existingCC := NormalizeISO2(c.CountryCode); existingCC != "" {
		cmeta, ok := LookupCountryMeta(existingCC)
		name := CanonicalCountryNameTr(existingCC, c.CountryName)
		if c.HasCoords && cleanGeoLabel(c.CountryName) == name {
			return resolvedCustomerGeo{}, false
		}
		var latPtr, lonPtr *float64
		if !c.HasCoords && ok {
			lat, lon := cmeta.Lat, cmeta.Lon
			latPtr = &lat
			lonPtr = &lon
		}
		return resolvedCustomerGeo{
			CountryCode: existingCC,
			CountryName: name,
			Lat:         latPtr,
			Lon:         lonPtr,
			Source:      "country_centroid",
		}, true
	}

	if eventCC := NormalizeISO2(c.EventCC); eventCC != "" {
		cmeta, ok := LookupCountryMeta(eventCC)
		name := eventCC
		var latPtr, lonPtr *float64
		if ok {
			name = cmeta.Name
			lat, lon := cmeta.Lat, cmeta.Lon
			latPtr = &lat
			lonPtr = &lon
		}
		return resolvedCustomerGeo{
			CountryCode: eventCC,
			CountryName: name,
			Lat:         latPtr,
			Lon:         lonPtr,
			Source:      "analytics_event",
		}, true
	}

	if pmeta, ok := ResolveCountryFromPhone(c.Phone); ok {
		lat, lon := pmeta.Lat, pmeta.Lon
		return resolvedCustomerGeo{
			CountryCode: pmeta.Code,
			CountryName: pmeta.Name,
			Lat:         &lat,
			Lon:         &lon,
			Source:      "phone_prefix",
		}, true
	}

	return resolvedCustomerGeo{}, false
}

// TriggerCustomerGeoBackfillAsync launches a rate-limited background geo enrichment pass.
func TriggerCustomerGeoBackfillAsync() {
	if db.Pool == nil {
		return
	}
	nowUnix := time.Now().Unix()
	lastUnix := customerGeoLastRunUnix.Load()
	if lastUnix > 0 && time.Since(time.Unix(lastUnix, 0)) < customerGeoCooldown {
		return
	}
	if !customerGeoBackfillRunning.CompareAndSwap(false, true) {
		return
	}

	customerGeoLastRunUnix.Store(nowUnix)
	safe.Go("Customer Geo Backfill", func() {
		defer customerGeoBackfillRunning.Store(false)
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if _, err := BackfillUnresolvedCustomerGeo(ctx); err != nil {
			log.Printf("[CUSTOMER GEO WARNING] Background backfill failed: %v", err)
		}
	})
}
