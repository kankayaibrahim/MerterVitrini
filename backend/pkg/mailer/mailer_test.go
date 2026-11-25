package mailer

import (
	"net/url"
	"strings"
	"testing"
)

func assertCustomerWhatsAppURL(t *testing.T, phone string, meta ClientMeta, wantDigits, wantMsg string) {
	t.Helper()
	got := buildCustomerWelcomeWhatsAppURL(phone, meta)
	expectedPrefix := "https://wa.me/" + wantDigits + "?text="
	if !strings.HasPrefix(got, expectedPrefix) {
		t.Fatalf("buildCustomerWelcomeWhatsAppURL(%q, %+v) = %q, want prefix %q", phone, meta, got, expectedPrefix)
	}

	rawQuery := strings.TrimPrefix(got, expectedPrefix)
	if strings.Contains(rawQuery, "+") {
		t.Fatalf("encoded WhatsApp text query must not contain '+' signs: %q", rawQuery)
	}

	decoded, err := url.QueryUnescape(rawQuery)
	if err != nil {
		t.Fatalf("url.QueryUnescape(%q) failed: %v", rawQuery, err)
	}
	if decoded != wantMsg {
		t.Fatalf("decoded message mismatch:\ngot:\n%s\n\nwant:\n%s", decoded, wantMsg)
	}
}

func TestBuildCustomerWelcomeWhatsAppURL(t *testing.T) {
	assertCustomerWhatsAppURL(
		t,
		"+48793573295",
		ClientMeta{CountryCode: "PL", Country: "Poland"},
		"48793573295",
		customerWelcomeWhatsAppMsgEN,
	)

	assertCustomerWhatsAppURL(
		t,
		"+905321234567",
		ClientMeta{CountryCode: "TR", Country: "Turkey"},
		"905321234567",
		customerWelcomeWhatsAppMsgTR,
	)

	assertCustomerWhatsAppURL(
		t,
		"05321234567",
		ClientMeta{},
		"905321234567",
		customerWelcomeWhatsAppMsgTR,
	)

	assertCustomerWhatsAppURL(
		t,
		"+905321234567",
		ClientMeta{CountryCode: "DE", Country: "Germany"},
		"905321234567",
		customerWelcomeWhatsAppMsgTR,
	)

	assertCustomerWhatsAppURL(
		t,
		"+4915112345678",
		ClientMeta{CountryCode: "TR", Country: "Turkey"},
		"4915112345678",
		customerWelcomeWhatsAppMsgEN,
	)

	assertCustomerWhatsAppURL(
		t,
		"0048793573295",
		ClientMeta{},
		"48793573295",
		customerWelcomeWhatsAppMsgEN,
	)

	if empty := buildCustomerWelcomeWhatsAppURL("", ClientMeta{CountryCode: "TR"}); empty != "" {
		t.Fatalf("expected empty URL for empty phone, got %q", empty)
	}
}
