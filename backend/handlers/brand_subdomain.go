package handlers

import (
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

var brandSubdomainLabelRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$`)
var brandSubdomainCollapseDashRegex = regexp.MustCompile(`-{2,}`)
var brandSubdomainNonASCIIStripRegex = regexp.MustCompile(`[^a-z0-9-]+`)

var brandTurkishReplacer = strings.NewReplacer(
	"ı", "i",
	"İ", "i",
	"I", "i",
	"ğ", "g",
	"Ğ", "g",
	"ü", "u",
	"Ü", "u",
	"ş", "s",
	"Ş", "s",
	"ö", "o",
	"Ö", "o",
	"ç", "c",
	"Ç", "c",
	"_", "-",
	" ", "-",
)

// ReservedBrandSubdomains lists system, infrastructure, and platform hostnames
// that suppliers cannot claim as custom storefront subdomains.
var ReservedBrandSubdomains = map[string]struct{}{
	"www":           {},
	"api":           {},
	"admin":         {},
	"adminapi":      {},
	"auth":          {},
	"mail":          {},
	"translateapi":  {},
	"app":           {},
	"web":           {},
	"shop":          {},
	"store":         {},
	"storefront":    {},
	"static":        {},
	"cdn":           {},
	"media":         {},
	"uploads":       {},
	"img":           {},
	"images":        {},
	"assets":        {},
	"files":         {},
	"ftp":           {},
	"sftp":          {},
	"smtp":          {},
	"imap":          {},
	"pop":           {},
	"pop3":          {},
	"mx":            {},
	"ns":            {},
	"ns1":           {},
	"ns2":           {},
	"ns3":           {},
	"ns4":           {},
	"dns":           {},
	"vpn":           {},
	"ssh":           {},
	"proxy":         {},
	"gateway":       {},
	"edge":          {},
	"dev":           {},
	"staging":       {},
	"stage":         {},
	"test":          {},
	"beta":          {},
	"alpha":         {},
	"demo":          {},
	"sandbox":       {},
	"local":         {},
	"localhost":     {},
	"panel":         {},
	"dashboard":     {},
	"portal":        {},
	"supplier":      {},
	"suppliers":     {},
	"tedarikci":     {},
	"tedarikciler":  {},
	"uretici":       {},
	"ureticiler":    {},
	"vendor":        {},
	"seller":        {},
	"merchant":      {},
	"partner":       {},
	"blog":          {},
	"news":          {},
	"help":          {},
	"support":       {},
	"destek":        {},
	"status":        {},
	"health":        {},
	"metrics":       {},
	"docs":          {},
	"swagger":       {},
	"graphql":       {},
	"ws":            {},
	"wss":           {},
	"chat":          {},
	"billing":       {},
	"pay":           {},
	"payment":       {},
	"checkout":      {},
	"cart":          {},
	"order":         {},
	"orders":        {},
	"account":       {},
	"accounts":      {},
	"profile":       {},
	"login":         {},
	"register":      {},
	"signup":        {},
	"signin":        {},
	"oauth":         {},
	"sso":           {},
	"keycloak":      {},
	"iam":           {},
	"root":          {},
	"system":        {},
	"sys":           {},
	"ops":           {},
	"security":      {},
	"abuse":         {},
	"postmaster":    {},
	"webmaster":     {},
	"hostmaster":    {},
	"noreply":       {},
	"info":          {},
	"contact":       {},
	"iletisim":      {},
	"merter":        {},
	"mertervitrini": {},
	"vitrini":       {},
	"b2b":           {},
	"wholesale":     {},
	"toptan":        {},
	"rfq":           {},
	"mobile":        {},
	"android":       {},
	"ios":           {},
	"apk":           {},
	"sitemap":       {},
	"robots":        {},
}

// IsReservedBrandSubdomain reports whether a normalized DNS label is reserved by the platform.
func IsReservedBrandSubdomain(sub string) bool {
	_, ok := ReservedBrandSubdomains[strings.ToLower(strings.TrimSpace(sub))]
	return ok
}

func transliterateSubdomainCandidate(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimSuffix(s, ".mertervitrini.com.tr")
	s = brandTurkishReplacer.Replace(s)
	s = strings.ToLower(s)
	s = brandSubdomainCollapseDashRegex.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// NormalizeAndValidateBrandSubdomain validates an explicit supplier subdomain input.
// An empty input returns ("", nil) to allow clearing the subdomain.
func NormalizeAndValidateBrandSubdomain(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	if strings.Contains(trimmed, "--") {
		return "", errors.New("Subdomain ardışık tire (--) içeremez")
	}
	if strings.Contains(trimmed, ".") {
		trimmedWithoutSuffix := strings.TrimSuffix(strings.ToLower(trimmed), ".mertervitrini.com.tr")
		if strings.Contains(trimmedWithoutSuffix, ".") {
			return "", errors.New("Subdomain içinde nokta (.) bulunamaz, yalnızca mağaza adını yazın (örn: lustrin)")
		}
	}

	normalized := transliterateSubdomainCandidate(trimmed)
	if normalized == "" {
		return "", errors.New("Subdomain yalnızca İngilizce harfler (a-z), rakam (0-9) ve tire (-) içerebilir")
	}
	if len(normalized) < 3 {
		return "", errors.New("Subdomain en az 3 karakter olmalıdır")
	}
	if len(normalized) > 63 {
		return "", errors.New("Subdomain en fazla 63 karakter olabilir")
	}
	if strings.HasPrefix(normalized, "xn--") || strings.Contains(normalized, "--") {
		return "", errors.New("Subdomain ardışık tire (--) içeremez")
	}
	if !brandSubdomainLabelRegex.MatchString(normalized) {
		return "", errors.New("Subdomain yalnızca küçük İngilizce harf, rakam ve kelimeler arasında tire (-) içerebilir")
	}
	if IsReservedBrandSubdomain(normalized) {
		return "", errors.New("Bu alt alan adı sistem tarafından rezerve edilmiştir, başka bir ad seçin")
	}
	return normalized, nil
}

// SuggestBrandSubdomain derives a valid, non-reserved default subdomain from alias_code, slug, or brand name.
func SuggestBrandSubdomain(aliasCode, slug, brandName string) string {
	for _, src := range []string{aliasCode, slug, brandName} {
		s := strings.TrimSpace(src)
		if s == "" {
			continue
		}
		cand := brandTurkishReplacer.Replace(s)
		cand = strings.ToLower(cand)
		cand = brandSubdomainNonASCIIStripRegex.ReplaceAllString(cand, "-")
		cand = brandSubdomainCollapseDashRegex.ReplaceAllString(cand, "-")
		cand = strings.Trim(cand, "-")
		if len(cand) > 63 {
			cand = strings.Trim(cand[:63], "-")
		}
		validated, err := NormalizeAndValidateBrandSubdomain(cand)
		if err == nil && validated != "" {
			return validated
		}
	}
	return ""
}

func isSubdomainUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return strings.Contains(strings.ToLower(pgErr.ConstraintName), "subdomain") ||
		strings.Contains(strings.ToLower(pgErr.Detail), "subdomain")
}
