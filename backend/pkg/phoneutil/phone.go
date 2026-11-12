package phoneutil

import (
	"errors"
	"strings"
)

const (
	errMsgRequired = "Cep telefonu numarası zorunludur."
	errMsgInvalid  = "Lütfen ülke kodu ile birlikte geçerli ve gerçek bir cep telefonu numarası giriniz (Örn: +90 532 481 92 64)."
)

var (
	pairedTestTails6 = map[string]struct{}{
		"112233": {},
		"223344": {},
		"334455": {},
		"445566": {},
		"556677": {},
		"667788": {},
		"778899": {},
		"001122": {},
		"998877": {},
		"654321": {},
		"123123": {},
		"321321": {},
		"000111": {},
		"111000": {},
	}
	pairedTestTails7 = map[string]struct{}{
		"1112233": {},
		"1234123": {},
		"1231231": {},
		"0000111": {},
		"1111000": {},
	}
)

// NormalizeAndValidatePhone validates structure, Turkish/E.164 rules, and realism
// heuristics on a customer or supplier phone number, returning a normalized representation.
func NormalizeAndValidatePhone(raw string) (string, error) {
	digits, hasPlus, err := extractCleanPhoneParts(raw)
	if err != nil {
		return "", err
	}

	normalized, checkDigits, err := normalizeStructuralPhone(digits, hasPlus)
	if err != nil {
		return "", err
	}

	if err := validatePhoneRealism(checkDigits); err != nil {
		return "", err
	}

	return normalized, nil
}

// IsRealisticPhone reports whether raw passes NormalizeAndValidatePhone.
func IsRealisticPhone(raw string) bool {
	_, err := NormalizeAndValidatePhone(raw)
	return err == nil
}

func isAllowedSeparator(r rune) bool {
	return r == ' ' || r == '-' || r == '(' || r == ')' || r == '.'
}

func extractCleanPhoneParts(raw string) (string, bool, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false, errors.New(errMsgRequired)
	}

	var b strings.Builder
	b.Grow(len(trimmed))
	hasPlus := false

	for i, r := range trimmed {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
			continue
		}
		if r == '+' && i == 0 {
			hasPlus = true
			continue
		}
		if isAllowedSeparator(r) {
			continue
		}
		return "", false, errors.New(errMsgInvalid)
	}

	digits := b.String()
	if !hasPlus && strings.HasPrefix(digits, "00") {
		if len(digits) < 11 || strings.HasPrefix(digits, "000") {
			return "", false, errors.New(errMsgInvalid)
		}
		digits = digits[2:]
		hasPlus = true
	}

	if hasPlus && (len(digits) == 0 || digits[0] == '0') {
		return "", false, errors.New(errMsgInvalid)
	}

	return digits, hasPlus, nil
}

func isTurkishPhonePattern(digits string, hasPlus bool) bool {
	if hasPlus && strings.HasPrefix(digits, "90") {
		return true
	}
	if !hasPlus && len(digits) == 12 && strings.HasPrefix(digits, "905") {
		return true
	}
	return !hasPlus && len(digits) == 11 && strings.HasPrefix(digits, "05")
}

func extractTurkishNationalDigits(digits string, hasPlus bool) string {
	if (hasPlus && strings.HasPrefix(digits, "90")) || (!hasPlus && strings.HasPrefix(digits, "905")) {
		nat := digits[2:]
		if len(nat) == 11 && nat[0] == '0' {
			return nat[1:]
		}
		return nat
	}
	return digits[1:]
}

func validateTurkishNational(nat string) error {
	if len(nat) != 10 {
		return errors.New(errMsgInvalid)
	}
	if nat[0] == '5' {
		switch nat[1] {
		case '0', '1', '3', '4', '5', '6':
		default:
			return errors.New(errMsgInvalid)
		}
		prefix3 := nat[:3]
		if prefix3 == "500" || prefix3 == "550" {
			return errors.New(errMsgInvalid)
		}
		return nil
	}
	switch nat[0] {
	case '2', '3', '4', '8':
		if nat[:3] == "800" {
			return errors.New(errMsgInvalid)
		}
		return nil
	default:
		return errors.New(errMsgInvalid)
	}
}

func normalizeStructuralPhone(digits string, hasPlus bool) (string, string, error) {
	if isTurkishPhonePattern(digits, hasPlus) {
		nat := extractTurkishNationalDigits(digits, hasPlus)
		if err := validateTurkishNational(nat); err != nil {
			return "", "", err
		}
		return "+90" + nat, "90" + nat, nil
	}

	if hasPlus {
		if len(digits) < 10 || len(digits) > 15 || digits[0] < '1' || digits[0] > '9' {
			return "", "", errors.New(errMsgInvalid)
		}
		return "+" + digits, digits, nil
	}

	if len(digits) < 9 || len(digits) > 13 {
		return "", "", errors.New(errMsgInvalid)
	}
	if len(digits) == 9 && (digits[0] < '4' || digits[0] > '9') {
		return "", "", errors.New(errMsgInvalid)
	}
	if digits[0] == '0' && (len(digits) < 10 || len(digits) > 12 || digits[1] == '0') {
		return "", "", errors.New(errMsgInvalid)
	}

	return digits, digits, nil
}

func countDistinctDigits(s string) int {
	var seen [10]bool
	count := 0
	for i := 0; i < len(s); i++ {
		d := s[i] - '0'
		if !seen[d] {
			seen[d] = true
			count++
		}
	}
	return count
}

func hasExcessiveConsecutiveRepeat(s string, maxAllowed int) bool {
	if len(s) == 0 {
		return false
	}
	run := 1
	for i := 1; i < len(s); i++ {
		if s[i] == s[i-1] {
			run++
			if run > maxAllowed {
				return true
			}
		} else {
			run = 1
		}
	}
	return false
}

func hasSequentialRun(s string, minRun int) bool {
	if len(s) < minRun {
		return false
	}
	ascRun := 1
	descRun := 1
	for i := 1; i < len(s); i++ {
		diff := int(s[i]) - int(s[i-1])
		if diff == 1 {
			ascRun++
			descRun = 1
		} else if diff == -1 {
			descRun++
			ascRun = 1
		} else {
			ascRun = 1
			descRun = 1
		}
		if ascRun >= minRun || descRun >= minRun {
			return true
		}
	}
	return false
}

func validatePhoneRealism(digits string) error {
	if len(digits) < 9 {
		return errors.New(errMsgInvalid)
	}
	if hasExcessiveConsecutiveRepeat(digits, 4) {
		return errors.New(errMsgInvalid)
	}
	if countDistinctDigits(digits) < 3 {
		return errors.New(errMsgInvalid)
	}
	last7 := digits[len(digits)-7:]
	if countDistinctDigits(last7) < 3 {
		return errors.New(errMsgInvalid)
	}

	tail8 := digits
	if len(tail8) > 8 {
		tail8 = tail8[len(tail8)-8:]
	}
	if hasSequentialRun(tail8, 6) {
		return errors.New(errMsgInvalid)
	}

	last6 := digits[len(digits)-6:]
	if _, bad6 := pairedTestTails6[last6]; bad6 {
		return errors.New(errMsgInvalid)
	}
	if _, bad7 := pairedTestTails7[last7]; bad7 {
		return errors.New(errMsgInvalid)
	}

	return nil
}

