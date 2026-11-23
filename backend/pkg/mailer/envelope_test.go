package mailer

import (
	"bytes"
	"strings"
	"testing"
)

func TestNormalizeIPString(t *testing.T) {
	tests := []struct {
		raw     string
		wantIP  string
		wantVer string
	}{
		{raw: "2a02:4e0:2d14:1234::1", wantIP: "2a02:4e0:2d14:1234::1", wantVer: "IPv6"},
		{raw: "[2a02:4e0:2d14::1]", wantIP: "2a02:4e0:2d14::1", wantVer: "IPv6"},
		{raw: "::ffff:88.230.12.34", wantIP: "88.230.12.34", wantVer: "IPv4"},
		{raw: "195.175.39.39", wantIP: "195.175.39.39", wantVer: "IPv4"},
		{raw: "", wantIP: "", wantVer: ""},
	}

	for _, tc := range tests {
		gotIP, gotVer := normalizeIPString(tc.raw)
		if gotIP != tc.wantIP || gotVer != tc.wantVer {
			t.Fatalf("normalizeIPString(%q) = (%q, %q), want (%q, %q)", tc.raw, gotIP, gotVer, tc.wantIP, tc.wantVer)
		}
	}
}

func TestNormalizeEmailList(t *testing.T) {
	got, err := NormalizeEmailList([]string{
		" KankayaIbrahim@gmail.com , carnavaltedarik@gmail.com ",
		"kankayaibrahim@gmail.com;ops@mertervitrini.com.tr",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"kankayaibrahim@gmail.com", "carnavaltedarik@gmail.com", "ops@mertervitrini.com.tr"}
	if len(got) != len(want) {
		t.Fatalf("len=%d want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("idx %d = %q want %q", i, got[i], want[i])
		}
	}

	if _, err := NormalizeEmailList([]string{"bad\r\nCc: attacker@evil.com"}); err == nil {
		t.Fatal("expected CRLF injection to fail validation")
	}
	if _, err := NormalizeEmailList([]string{"not-an-email"}); err == nil {
		t.Fatal("expected invalid email to fail validation")
	}
}

func TestBuildMimeEnvelopeMessageToAndCC(t *testing.T) {
	raw, recipients, err := BuildMimeEnvelopeMessage(
		"Merter Vitrini <destek@mertervitrini.com.tr>",
		[]string{"kankayaibrahim@gmail.com", "carnavaltedarik@gmail.com"},
		[]string{"carnavaltedarik@gmail.com", "cc1@example.com"},
		"Test Konu",
		"<p>Merhaba</p>",
		"Merhaba",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recipients) != 3 {
		t.Fatalf("expected 3 deduplicated envelope recipients, got %v", recipients)
	}
	content := string(raw)
	if !bytes.Contains(raw, []byte("To: kankayaibrahim@gmail.com, carnavaltedarik@gmail.com\r\n")) {
		t.Fatalf("missing To header in:\n%s", content)
	}
	if !bytes.Contains(raw, []byte("Cc: cc1@example.com\r\n")) {
		t.Fatalf("missing deduplicated Cc header in:\n%s", content)
	}
}

func TestBuildDailyDigestEmailBodies(t *testing.T) {
	subj, htmlBody, textBody := BuildDailyDigestEmailBodies(DailyDigestEmailData{
		ReportDate:               "2026-11-15",
		ReportDateFormatted:      "15.11.2026",
		GeneratedAt:              "21:00",
		NewCustomersToday:        12,
		TotalActiveCustomers:     340,
		NewOrdersToday:           4,
		OrdersRevenueTRYToday:    45000,
		OrdersRevenueFormatted:   "45.000,00 TL",
		ProductsAddedToday:       100,
		ProductsDeactivatedToday: 7,
		ProductsArchivedToday:    3,
		ProductsDeletedToday:     2,
		TotalActiveProducts:      2150,
	})
	if !strings.Contains(subj, "12 Yeni Üye") || !strings.Contains(subj, "+100") {
		t.Fatalf("unexpected digest subject: %s", subj)
	}
	if !strings.Contains(htmlBody, "Bugün Silinen Ürün") || !strings.Contains(textBody, "Bugün Kapatılan (Pasife Alınan) Ürün: 7") {
		t.Fatalf("digest body missing expected metric sections")
	}
}

func TestBuildTestEventEmailBodiesNoBayiWording(t *testing.T) {
	events := []string{EventNewCustomer, EventNewOrder, EventSupplierOnboarding}
	for _, ev := range events {
		subj, htmlBody, textBody := BuildTestEventEmailBodies(ev)
		combined := strings.ToLower(subj + "\n" + htmlBody + "\n" + textBody)
		if strings.Contains(combined, "bayi") {
			t.Fatalf("event %q test email still contains forbidden 'bayi' wording:\n%s", ev, combined)
		}
	}

	_, custHTML, _ := BuildTestEventEmailBodies(EventNewCustomer)
	if !strings.Contains(custHTML, "Hesap Türü: Müşteri") {
		t.Fatalf("expected customer test email HTML to explicitly contain 'Hesap Türü: Müşteri'")
	}

	_, supHTML, supText := BuildTestEventEmailBodies(EventSupplierOnboarding)
	if !strings.Contains(supHTML, "Tedarikçi") || !strings.Contains(supText, "Tedarikçi") {
		t.Fatalf("expected supplier test email to explicitly contain 'Tedarikçi'")
	}
}

func TestBuildExceptionAlertEmailBodiesIncludesDetailTimelineAndLogsLink(t *testing.T) {
	subj, htmlBody, textBody := BuildExceptionAlertEmailBodies(ExceptionAlertEmailData{
		Hostname:        "ozgursistemorg",
		Severity:        "http_5xx",
		TriggerReason:   "Son 5 dakikada 5 olay",
		WindowMinutes:   5,
		BurstThreshold:  5,
		WindowCount:     5,
		CooldownMinutes: 15,
		GeneratedAt:     "23.11.2026 20:14:36",
		PrimarySource:   "GET /api/v1/store/products",
		PrimaryMessage:  "HTTP 500 | Query: ?q=Una%20Tutt | Error: context deadline exceeded",
		StackTrace:      "Endpoint: GET /api/v1/store/products?q=Una%20Tutt\nInternal Error: context deadline exceeded",
		GroupedSamples: []ExceptionAlertSample{
			{Timestamp: "20:14:36", Severity: "http_5xx", Source: "GET /api/v1/store/products", Message: "HTTP 500 | Error: context deadline exceeded", Count: 5},
		},
		RecentTimeline: []ExceptionAlertSample{
			{Timestamp: "20:14:36", Severity: "http_5xx", Source: "GET /api/v1/store/products", Message: "Query: ?q=Una%20Tutt | Duration: 12001ms", Count: 1},
		},
	})
	if !strings.Contains(subj, "GET /api/v1/store/products") {
		t.Fatalf("unexpected alert subject: %s", subj)
	}
	for _, want := range []string{
		"Son Olay Zaman Çizelgesi",
		"Query: ?q=Una%20Tutt",
		"Internal Error: context deadline exceeded",
		"https://mertervitrini.com.tr/admin/system-logs",
		"https://mertervitrini.com.tr/admin/settings/notifications",
	} {
		if !strings.Contains(htmlBody, want) {
			t.Fatalf("htmlBody missing %q", want)
		}
		if !strings.Contains(textBody, want) {
			t.Fatalf("textBody missing %q", want)
		}
	}
}
