package handlers

import (
	"net/url"
	"strings"
)

func normalizeBrandInstagramHandle(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	lower := strings.ToLower(trimmed)
	handle := extractInstagramSlug(trimmed, lower)
	handle = strings.TrimLeft(handle, "@")
	handle = strings.Trim(handle, "/")
	if idx := strings.IndexAny(handle, "?# \t\r\n"); idx >= 0 {
		handle = handle[:idx]
	}
	if handle == "" {
		return ""
	}
	return truncateStr("@"+handle, 100)
}

func extractInstagramSlug(trimmed, lower string) string {
	if !strings.Contains(lower, "instagram.com") && !strings.Contains(lower, "instagr.am") {
		return trimmed
	}
	candidate := trimmed
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		candidate = "https://" + trimmed
	}
	parsed, err := url.Parse(candidate)
	if err != nil {
		return trimmed
	}
	pathTrimmed := strings.Trim(parsed.Path, "/")
	if pathTrimmed == "" {
		return ""
	}
	if slash := strings.IndexByte(pathTrimmed, '/'); slash >= 0 {
		return pathTrimmed[:slash]
	}
	return pathTrimmed
}

func normalizeBrandWebsite(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	lower := strings.ToLower(trimmed)
	for _, blocked := range []string{"javascript:", "data:", "vbscript:"} {
		if strings.HasPrefix(lower, blocked) {
			return nil
		}
	}
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		trimmed = "https://" + trimmed
	}
	norm := truncateStr(trimmed, 255)
	return &norm
}

func normalizeOptionalStringPtr(ptr *string, maxLen int) *string {
	if ptr == nil {
		return nil
	}
	trimmed := truncateStr(strings.TrimSpace(*ptr), maxLen)
	return &trimmed
}

func extractPrimaryAddressFallback(addresses []any) (city, district, text string) {
	if len(addresses) == 0 {
		return "", "", ""
	}
	firstMap, ok := addresses[0].(map[string]any)
	if !ok || firstMap == nil {
		return "", "", ""
	}
	if v, ok := firstMap["city"].(string); ok {
		city = strings.TrimSpace(v)
	}
	if v, ok := firstMap["district"].(string); ok {
		district = strings.TrimSpace(v)
	}
	if v, ok := firstMap["text"].(string); ok {
		text = strings.TrimSpace(v)
	}
	return city, district, text
}
