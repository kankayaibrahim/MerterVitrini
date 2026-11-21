package handlers

import "testing"

func TestNormalizeBrandInstagramHandle(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"", ""},
		{"   ", ""},
		{"janestoptan", "@janestoptan"},
		{"@janestoptan", "@janestoptan"},
		{"https://www.instagram.com/janestoptan/?igsh=MWx123", "@janestoptan"},
		{"instagram.com/merter_tekstil/", "@merter_tekstil"},
		{"http://instagram.com/@etikafashion/reels", "@etikafashion"},
		{"https://instagram.com/", ""},
	}
	for _, tc := range cases {
		if got := normalizeBrandInstagramHandle(tc.input); got != tc.want {
			t.Fatalf("normalizeBrandInstagramHandle(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestNormalizeBrandWebsite(t *testing.T) {
	if got := normalizeBrandWebsite(""); got != nil {
		t.Fatalf("expected nil for empty website, got %q", *got)
	}
	if got := normalizeBrandWebsite("javascript:alert(1)"); got != nil {
		t.Fatalf("expected nil for javascript URI, got %q", *got)
	}
	if got := normalizeBrandWebsite("www.janestoptan.net"); got == nil || *got != "https://www.janestoptan.net" {
		t.Fatalf("expected https prefix, got %v", got)
	}
	if got := normalizeBrandWebsite("https://etika.com.tr"); got == nil || *got != "https://etika.com.tr" {
		t.Fatalf("expected unchanged https URL, got %v", got)
	}
}

func TestExtractPrimaryAddressFallback(t *testing.T) {
	addrs := []any{
		map[string]any{
			"title":    "Merkez Showroom",
			"city":     " İstanbul ",
			"district": " Güngören ",
			"text":     " Mehmet Nesih Özmen Mah. Fatih Cad. ",
		},
	}
	city, district, text := extractPrimaryAddressFallback(addrs)
	if city != "İstanbul" || district != "Güngören" || text != "Mehmet Nesih Özmen Mah. Fatih Cad." {
		t.Fatalf("unexpected fallback tuple: %q / %q / %q", city, district, text)
	}
	c2, d2, t2 := extractPrimaryAddressFallback(nil)
	if c2 != "" || d2 != "" || t2 != "" {
		t.Fatalf("expected empty tuple for nil addresses")
	}
}
