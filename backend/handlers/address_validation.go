package handlers

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"mertervitrini/backend/db"

	"github.com/jackc/pgx/v5"
)

var (
	postalCodePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9\-\s]{0,18}[A-Za-z0-9]$`)
)

// ResolvedLocationNames holds validated hierarchical country, state/province, and city/district names.
type ResolvedLocationNames struct {
	CountryID   string
	CountryCode string
	CountryName string
	StateID     string
	StateName   string
	CityID      string
	CityName    string
}

// CanonicalAddressParts describes components used to format a readable billing or delivery address.
type CanonicalAddressParts struct {
	RecipientName string
	CompanyName   string
	AddressLine   string
	PostalCode    string
	CityName      string
	StateName     string
	CountryName   string
	Phone         string
	TaxOffice     string
	TaxNo         string
}

func trimOptionalIDPtr(val *string) *string {
	if val == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*val)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func derefTrimmed(val *string) string {
	if val == nil {
		return ""
	}
	return strings.TrimSpace(*val)
}

func isCJKRune(r rune) bool {
	return unicode.Is(unicode.Han, r) ||
		unicode.Is(unicode.Hiragana, r) ||
		unicode.Is(unicode.Katakana, r) ||
		unicode.Is(unicode.Hangul, r)
}

func isASCIILatinConsonant(r rune) bool {
	if r < 'a' || r > 'z' {
		if r < 'A' || r > 'Z' {
			return false
		}
		r += 'a' - 'A'
	}
	switch r {
	case 'a', 'e', 'i', 'o', 'u', 'y':
		return false
	default:
		return true
	}
}

func hasRepeatedLetterRun(text string, limit int) bool {
	var prev rune
	run := 0
	for _, r := range text {
		if !unicode.IsLetter(r) {
			prev = 0
			run = 0
			continue
		}
		low := unicode.ToLower(r)
		if low == prev {
			run++
			if run >= limit {
				return true
			}
		} else {
			prev = low
			run = 1
		}
	}
	return false
}

func isGibberishAlphaToken(token string) bool {
	subTokens := strings.FieldsFunc(token, func(r rune) bool {
		return !unicode.IsLetter(r)
	})
	for _, sub := range subTokens {
		letterCount := utf8.RuneCountInString(sub)
		if letterCount == 0 {
			continue
		}
		if letterCount > 24 && !hasCJKRune(sub) {
			return true
		}

		uniqueLetters := make(map[rune]struct{}, letterCount)
		asciiConsonantRun := 0
		maxASCIIConsonantRun := 0
		for _, r := range sub {
			uniqueLetters[unicode.ToLower(r)] = struct{}{}
			if isASCIILatinConsonant(r) {
				asciiConsonantRun++
				if asciiConsonantRun > maxASCIIConsonantRun {
					maxASCIIConsonantRun = asciiConsonantRun
				}
			} else {
				asciiConsonantRun = 0
			}
		}

		if letterCount >= 12 && maxASCIIConsonantRun >= 7 {
			return true
		}
		if letterCount >= 14 {
			ratio := float64(len(uniqueLetters)) / float64(letterCount)
			if ratio < 0.38 {
				return true
			}
		}
	}
	return false
}

func hasCJKRune(s string) bool {
	for _, r := range s {
		if isCJKRune(r) {
			return true
		}
	}
	return false
}

// ValidateHumanPersonName ensures customer/recipient names are realistic and non-gibberish.
func ValidateHumanPersonName(raw string) error {
	clean := strings.TrimSpace(raw)
	runeLen := utf8.RuneCountInString(clean)
	if runeLen < 2 || runeLen > 120 {
		return errors.New("Ad soyad 2 ile 120 karakter arasında olmalıdır")
	}

	letterCount := 0
	for _, r := range clean {
		if unicode.IsLetter(r) {
			letterCount++
		}
	}
	if letterCount < 2 {
		return errors.New("Lütfen geçerli bir ad soyad girin")
	}
	if hasRepeatedLetterRun(clean, 5) || isGibberishAlphaToken(clean) {
		return errors.New("Lütfen anlamsız veya rastgele karakterler yerine gerçek ad soyad bilgisi girin")
	}
	return nil
}

// ValidateHumanAddressText rejects short, single-word, repeated-character, and keyboard-mash fake addresses.
func ValidateHumanAddressText(raw string) error {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return errors.New("Açık adres alanı zorunludur")
	}

	runeLen := utf8.RuneCountInString(clean)
	if runeLen < 10 {
		return errors.New("Lütfen mahalle, cadde/sokak ve bina/kapı no içeren en az 10 karakterlik geçerli bir açık adres girin")
	}
	if runeLen > 500 {
		return errors.New("Adres satırı en fazla 500 karakter olabilir")
	}

	if hasRepeatedLetterRun(clean, 5) {
		return errors.New("Adres alanında anlamsız tekrar eden karakterler kullanılamaz")
	}

	totalLetters := 0
	cjkLetters := 0
	uniqueLetters := make(map[rune]struct{}, 32)
	for _, r := range clean {
		if unicode.IsLetter(r) {
			totalLetters++
			uniqueLetters[unicode.ToLower(r)] = struct{}{}
			if isCJKRune(r) {
				cjkLetters++
			}
		}
	}

	if totalLetters < 4 {
		return errors.New("Lütfen yalnızca rakam veya sembol yerine anlaşılır bir açık adres girin")
	}
	if totalLetters >= 8 && len(uniqueLetters) < 4 && cjkLetters == 0 {
		return errors.New("Lütfen geçerli ve anlaşılır bir açık adres girin")
	}

	wsTokens := strings.Fields(clean)
	if cjkLetters == 0 && len(wsTokens) < 2 {
		return errors.New("Lütfen mahalle, cadde/sokak ve kapı numarasını boşluklarla ayrılmış şekilde açıkça yazın")
	}

	for _, tok := range wsTokens {
		if isGibberishAlphaToken(tok) {
			return errors.New("Adres içinde anlamsız veya rastgele karakter dizisi tespit edildi. Lütfen gerçek açık adresinizi girin")
		}
	}

	return nil
}

// ValidateStructuredLocationDB verifies that CountryID is valid and required State (İl) / City (İlçe) exist in the hierarchy.
func ValidateStructuredLocationDB(ctx context.Context, countryID string, stateIDPtr, cityIDPtr *string) (*ResolvedLocationNames, error) {
	if db.Pool == nil {
		return nil, errors.New("Konum doğrulaması için veritabanı bağlantısı hazır değil")
	}

	cleanCountryID := strings.TrimSpace(countryID)
	if cleanCountryID == "" {
		return nil, errors.New("Ülke seçimi zorunludur")
	}

	resolved := &ResolvedLocationNames{
		CountryID: cleanCountryID,
		StateID:   derefTrimmed(stateIDPtr),
		CityID:    derefTrimmed(cityIDPtr),
	}

	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(code, ''),
		       COALESCE(localized_names->>'tr_TR', localized_names->>'en_US', code, '')
		FROM catalog.countries
		WHERE id::text = $1
		LIMIT 1
	`, cleanCountryID).Scan(&resolved.CountryCode, &resolved.CountryName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("Seçilen ülke sistemde bulunamadı")
	} else if err != nil {
		return nil, errors.New("Geçersiz ülke seçimi")
	}

	var stateCount int
	if err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM catalog.country_states WHERE country_id::text = $1`, cleanCountryID).Scan(&stateCount); err != nil {
		return nil, fmt.Errorf("il listesi doğrulanamadı: %w", err)
	}

	if stateCount > 0 && resolved.StateID == "" {
		return nil, errors.New("Seçili ülke için il / eyalet seçimi zorunludur")
	}

	if resolved.StateID != "" {
		err = db.Pool.QueryRow(ctx, `
			SELECT COALESCE(state_name, '')
			FROM catalog.country_states
			WHERE id::text = $1 AND country_id::text = $2
			LIMIT 1
		`, resolved.StateID, cleanCountryID).Scan(&resolved.StateName)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("Seçilen il / eyalet seçili ülkeye ait değil")
		} else if err != nil {
			return nil, errors.New("Geçersiz il / eyalet seçimi")
		}

		var cityCount int
		if err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM catalog.country_cities WHERE state_id::text = $1`, resolved.StateID).Scan(&cityCount); err != nil {
			return nil, fmt.Errorf("ilçe listesi doğrulanamadı: %w", err)
		}

		if cityCount > 0 && resolved.CityID == "" {
			return nil, errors.New("Seçili il için ilçe seçimi zorunludur")
		}

		if resolved.CityID != "" {
			err = db.Pool.QueryRow(ctx, `
				SELECT COALESCE(name, '')
				FROM catalog.country_cities
				WHERE id::text = $1 AND state_id::text = $2
				LIMIT 1
			`, resolved.CityID, resolved.StateID).Scan(&resolved.CityName)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errors.New("Seçilen ilçe seçili ile ait değil")
			} else if err != nil {
				return nil, errors.New("Geçersiz ilçe seçimi")
			}
		}
	} else if resolved.CityID != "" {
		return nil, errors.New("İlçe seçimi için önce il / eyalet seçilmelidir")
	}

	return resolved, nil
}

// ValidateAddressRequestLocationAndText enforces strict person/title, anti-gibberish street text, postal code, and DB location validation.
func ValidateAddressRequestLocationAndText(ctx context.Context, req *AddressRequestPayload) (*ResolvedLocationNames, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.PostalCode = strings.TrimSpace(req.PostalCode)
	req.AddressLine = strings.TrimSpace(req.AddressLine)
	req.CountryID = strings.TrimSpace(req.CountryID)
	req.StateID = trimOptionalIDPtr(req.StateID)
	req.CityID = trimOptionalIDPtr(req.CityID)

	if hasRepeatedLetterRun(req.Title, 5) || isGibberishAlphaToken(req.Title) {
		return nil, errors.New("Lütfen geçerli ve anlamlı bir adres başlığı girin")
	}
	if err := ValidateHumanPersonName(req.FirstName); err != nil {
		return nil, err
	}
	if err := ValidateHumanPersonName(req.LastName); err != nil {
		return nil, err
	}
	if err := ValidateHumanAddressText(req.AddressLine); err != nil {
		return nil, err
	}
	if !postalCodePattern.MatchString(req.PostalCode) {
		return nil, errors.New("Lütfen geçerli bir posta kodu girin")
	}

	return ValidateStructuredLocationDB(ctx, req.CountryID, req.StateID, req.CityID)
}

// FormatCanonicalOrderAddress builds a consistent human-readable address string from verified structured components.
func FormatCanonicalOrderAddress(parts CanonicalAddressParts) string {
	var sections []string

	recipient := strings.TrimSpace(parts.RecipientName)
	company := strings.TrimSpace(parts.CompanyName)
	switch {
	case recipient != "" && company != "":
		sections = append(sections, fmt.Sprintf("%s (%s)", recipient, company))
	case recipient != "":
		sections = append(sections, recipient)
	case company != "":
		sections = append(sections, company)
	}

	if line := strings.TrimSpace(parts.AddressLine); line != "" {
		sections = append(sections, line)
	}

	var geo []string
	if city := strings.TrimSpace(parts.CityName); city != "" {
		geo = append(geo, city)
	}
	if state := strings.TrimSpace(parts.StateName); state != "" {
		geo = append(geo, state)
	}
	if country := strings.TrimSpace(parts.CountryName); country != "" {
		geo = append(geo, country)
	}
	if len(geo) > 0 {
		geoStr := strings.Join(geo, " / ")
		if pc := strings.TrimSpace(parts.PostalCode); pc != "" {
			geoStr += fmt.Sprintf(" (%s)", pc)
		}
		sections = append(sections, geoStr)
	}

	if phone := strings.TrimSpace(parts.Phone); phone != "" {
		sections = append(sections, "Tel: "+phone)
	}

	taxOffice := strings.TrimSpace(parts.TaxOffice)
	taxNo := strings.TrimSpace(parts.TaxNo)
	if taxOffice != "" && taxNo != "" {
		sections = append(sections, fmt.Sprintf("VD: %s / VKN-TCKN: %s", taxOffice, taxNo))
	} else if taxNo != "" {
		sections = append(sections, "VKN-TCKN: "+taxNo)
	}

	return strings.Join(sections, " — ")
}

// ResolveAndValidateSavedUserAddress loads an address owned by userID, enforces structured location
// and anti-gibberish text rules, and returns its canonical formatted string.
func ResolveAndValidateSavedUserAddress(ctx context.Context, userID, addressID, roleLabel string) (string, error) {
	trimmedID := strings.TrimSpace(addressID)
	if trimmedID == "" {
		return "", fmt.Errorf("Lütfen kayıtlı ve geçerli bir %s seçin", roleLabel)
	}

	var (
		firstName, lastName, companyName, phone string
		countryID, addressLine, postalCode      string
		taxNo, taxOffice                        string
		stateIDPtr, cityIDPtr                   *string
	)

	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(first_name, ''),
		       COALESCE(last_name, ''),
		       COALESCE(company_name, ''),
		       COALESCE(phone, ''),
		       COALESCE(country_id::text, ''),
		       NULLIF(COALESCE(state_id::text, ''), ''),
		       NULLIF(COALESCE(city_id::text, ''), ''),
		       COALESCE(address_line, ''),
		       COALESCE(postal_code, ''),
		       COALESCE(tax_no_tckn, ''),
		       COALESCE(tax_office, '')
		FROM identity.user_addresses
		WHERE id::text = $1 AND user_id::text = $2
		LIMIT 1
	`, trimmedID, userID).Scan(
		&firstName,
		&lastName,
		&companyName,
		&phone,
		&countryID,
		&stateIDPtr,
		&cityIDPtr,
		&addressLine,
		&postalCode,
		&taxNo,
		&taxOffice,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("Seçilen %s size ait değil veya bulunamadı", roleLabel)
	} else if err != nil {
		return "", fmt.Errorf("%s bilgisi doğrulanamadı", roleLabel)
	}

	if err := ValidateHumanAddressText(addressLine); err != nil {
		return "", fmt.Errorf("%s açık adresi yetersiz: %s. Lütfen adresinizi düzenleyin.", roleLabel, err.Error())
	}

	loc, err := ValidateStructuredLocationDB(ctx, countryID, stateIDPtr, cityIDPtr)
	if err != nil {
		return "", fmt.Errorf("%s için ülke / il / ilçe bilgisi eksik (%s). Lütfen adresinizi güncelleyin.", roleLabel, err.Error())
	}

	recipient := strings.TrimSpace(strings.TrimSpace(firstName) + " " + strings.TrimSpace(lastName))
	return FormatCanonicalOrderAddress(CanonicalAddressParts{
		RecipientName: recipient,
		CompanyName:   companyName,
		AddressLine:   addressLine,
		PostalCode:    postalCode,
		CityName:      loc.CityName,
		StateName:     loc.StateName,
		CountryName:   loc.CountryName,
		Phone:         phone,
		TaxOffice:     taxOffice,
		TaxNo:         taxNo,
	}), nil
}
