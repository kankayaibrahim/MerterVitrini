package mailer

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"mertervitrini/backend/pkg/httpclient"
)

type ClientMeta struct {
	IP          string
	IPVersion   string
	PseudoIPv4  string
	Country     string
	CountryCode string
	City        string
	RegionName  string
	Lat         float64
	Lon         float64
	ISP         string
	Org         string
	Device      string
	Browser     string
	UserAgent   string
}

func normalizeIPString(raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", ""
	}
	trimmed = strings.TrimPrefix(strings.TrimSuffix(trimmed, "]"), "[")
	if zoneIdx := strings.Index(trimmed, "%"); zoneIdx > 0 {
		trimmed = trimmed[:zoneIdx]
	}
	parsed := net.ParseIP(trimmed)
	if parsed == nil {
		return trimmed, ""
	}
	if v4 := parsed.To4(); v4 != nil {
		return v4.String(), "IPv4"
	}
	return parsed.String(), "IPv6"
}

// GetClientIP retrieves the real visitor IP from reverse proxy / Cloudflare headers
func GetClientIP(r *http.Request) string {
	candidates := []string{
		r.Header.Get("CF-Connecting-IP"),
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first, _, _ := strings.Cut(xff, ","); strings.TrimSpace(first) != "" {
			candidates = append(candidates, first)
		}
	}
	candidates = append(candidates, r.Header.Get("X-Real-IP"))
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		candidates = append(candidates, host)
	} else {
		candidates = append(candidates, r.RemoteAddr)
	}

	for _, candidate := range candidates {
		if cleanIP, _ := normalizeIPString(candidate); cleanIP != "" {
			return cleanIP
		}
	}
	return ""
}

// ExtractClientMeta extracts IP, Cloudflare geo headers, User-Agent, and queries IP-API for rich geo-lookup
func ExtractClientMeta(r *http.Request) ClientMeta {
	rawIP := GetClientIP(r)
	cleanIP, ipVersion := normalizeIPString(rawIP)
	meta := ClientMeta{
		IP:        cleanIP,
		IPVersion: ipVersion,
		UserAgent: r.Header.Get("User-Agent"),
	}

	if ipVersion == "IPv6" {
		if pseudoRaw := strings.TrimSpace(r.Header.Get("CF-Pseudo-IPv4")); pseudoRaw != "" {
			if cleanPseudo, pseudoVer := normalizeIPString(pseudoRaw); pseudoVer == "IPv4" && IsPublicIP(cleanPseudo) {
				meta.PseudoIPv4 = cleanPseudo
			}
		}
	}

	// Cloudflare geo headers fallback
	cfCountry := strings.TrimSpace(r.Header.Get("CF-IPCountry"))
	cfCity := strings.TrimSpace(r.Header.Get("CF-IPCity"))
	if cfCountry != "" {
		meta.CountryCode = cfCountry
		meta.Country = cfCountry
	}
	if cfCity != "" {
		meta.City = cfCity
	}

	meta.Device, meta.Browser = parseUserAgent(meta.UserAgent)

	if IsPublicIP(meta.IP) {
		lookupGeo(&meta)
	}

	if meta.Country == "" {
		meta.Country = "Bilinmiyor"
	}
	if meta.City == "" {
		meta.City = "Bilinmiyor"
	}

	return meta
}

// IsPublicIP reports whether ipStr is a valid, routable public IP address.
func IsPublicIP(ipStr string) bool {
	parsed := net.ParseIP(strings.TrimSpace(ipStr))
	if parsed == nil {
		return false
	}
	return !parsed.IsLoopback() && !parsed.IsPrivate() && !parsed.IsUnspecified()
}

func lookupGeo(meta *ClientMeta) {
	apiURL := fmt.Sprintf("http://ip-api.com/json/%s?lang=tr", meta.IP)
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("User-Agent", "MerterVitrini-Geo/1.0")

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var result struct {
		Status      string  `json:"status"`
		Country     string  `json:"country"`
		CountryCode string  `json:"countryCode"`
		RegionName  string  `json:"regionName"`
		City        string  `json:"city"`
		Lat         float64 `json:"lat"`
		Lon         float64 `json:"lon"`
		ISP         string  `json:"isp"`
		Org         string  `json:"org"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && result.Status == "success" {
		if result.Country != "" {
			meta.Country = result.Country
		}
		if result.CountryCode != "" {
			meta.CountryCode = result.CountryCode
		}
		if result.City != "" {
			meta.City = result.City
		}
		if result.RegionName != "" {
			meta.RegionName = result.RegionName
		}
		if result.Lat != 0 || result.Lon != 0 {
			meta.Lat = result.Lat
			meta.Lon = result.Lon
		}
		meta.ISP = result.ISP
		meta.Org = result.Org
	}
}

func parseUserAgent(ua string) (device string, browser string) {
	if ua == "" {
		return "Bilinmiyor", "Bilinmiyor"
	}
	lower := strings.ToLower(ua)

	// Device / OS
	switch {
	case strings.Contains(lower, "iphone"):
		device = "Apple iPhone"
	case strings.Contains(lower, "ipad"):
		device = "Apple iPad"
	case strings.Contains(lower, "android"):
		device = "Android Cihaz"
	case strings.Contains(lower, "windows nt 10.0") || strings.Contains(lower, "windows nt 11.0"):
		device = "Windows 10/11 PC"
	case strings.Contains(lower, "macintosh") || strings.Contains(lower, "mac os"):
		device = "Macintosh (macOS)"
	case strings.Contains(lower, "linux"):
		device = "Linux PC"
	default:
		device = "Masaüstü / Mobil"
	}

	// Browser
	switch {
	case strings.Contains(lower, "edg/"):
		browser = "Microsoft Edge"
	case strings.Contains(lower, "chrome/") && !strings.Contains(lower, "edg/"):
		browser = "Google Chrome"
	case strings.Contains(lower, "safari/") && !strings.Contains(lower, "chrome/"):
		browser = "Apple Safari"
	case strings.Contains(lower, "firefox/"):
		browser = "Mozilla Firefox"
	case strings.Contains(lower, "opera") || strings.Contains(lower, "opr/"):
		browser = "Opera"
	default:
		browser = "Standart Tarayıcı"
	}

	return device, browser
}

// CountryCodeToFlag converts an ISO 2-letter country code into flag emoji
func CountryCodeToFlag(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 {
		return "🌐"
	}
	r1 := rune(code[0]) - 'A' + 0x1F1E6
	r2 := rune(code[1]) - 'A' + 0x1F1E6
	return string([]rune{r1, r2})
}
