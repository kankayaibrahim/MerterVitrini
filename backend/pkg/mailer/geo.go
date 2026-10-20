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
	Country     string
	CountryCode string
	City        string
	RegionName  string
	ISP         string
	Org         string
	Device      string
	Browser     string
	UserAgent   string
}

// GetClientIP retrieves the real visitor IP from reverse proxy / Cloudflare headers
func GetClientIP(r *http.Request) string {
	if cf := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cf != "" {
		return cf
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// ExtractClientMeta extracts IP, Cloudflare geo headers, User-Agent, and queries IP-API for rich geo-lookup
func ExtractClientMeta(r *http.Request) ClientMeta {
	meta := ClientMeta{
		IP:        GetClientIP(r),
		UserAgent: r.Header.Get("User-Agent"),
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

	if isPublicIP(meta.IP) {
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

func isPublicIP(ipStr string) bool {
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
		Status      string `json:"status"`
		Country     string `json:"country"`
		CountryCode string `json:"countryCode"`
		RegionName  string `json:"regionName"`
		City        string `json:"city"`
		ISP         string `json:"isp"`
		Org         string `json:"org"`
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
