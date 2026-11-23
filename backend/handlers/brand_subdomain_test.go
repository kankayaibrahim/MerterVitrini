package handlers

import "testing"

func TestNormalizeAndValidateBrandSubdomain(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      string
		wantError bool
	}{
		{name: "empty clears subdomain", input: "   ", want: "", wantError: false},
		{name: "simple valid", input: "lustrin", want: "lustrin", wantError: false},
		{name: "uppercase alias and underscore", input: "BLACK_FASHION", want: "black-fashion", wantError: false},
		{name: "numeric hyphenated", input: "etika-2026", want: "etika-2026", wantError: false},
		{name: "Turkish transliteration", input: "Şık Giyim AŞ", want: "sik-giyim-as", wantError: false},
		{name: "strips root domain suffix", input: "Etika.mertervitrini.com.tr", want: "etika", wantError: false},
		{name: "rejects nested dots", input: "a.b.mertervitrini.com.tr", wantError: true},
		{name: "rejects too short", input: "ab", wantError: true},
		{name: "rejects invalid symbols", input: "lustrin@shop", wantError: true},
		{name: "rejects punycode style double dash", input: "xn--lustrin", wantError: true},
		{name: "rejects reserved api", input: "api", wantError: true},
		{name: "rejects reserved admin", input: "ADMIN", wantError: true},
		{name: "rejects reserved auth", input: "auth", wantError: true},
		{name: "rejects reserved www", input: "www", wantError: true},
		{name: "rejects reserved translateapi", input: "translateapi", wantError: true},
		{name: "rejects reserved mail", input: "mail", wantError: true},
		{name: "rejects reserved mertervitrini", input: "mertervitrini", wantError: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := NormalizeAndValidateBrandSubdomain(tc.input)
			if tc.wantError {
				if err == nil {
					t.Fatalf("expected error for input %q, got %q", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for input %q: %v", tc.input, err)
			}
			if got != tc.want {
				t.Fatalf("input %q: got %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestSuggestBrandSubdomain(t *testing.T) {
	if got := SuggestBrandSubdomain("BLACK_FASHION", "black-fashion", "Black Fashion"); got != "black-fashion" {
		t.Fatalf("got %q, want black-fashion", got)
	}
	if got := SuggestBrandSubdomain("API", "demo-tekstil", "Demo Tekstil"); got != "demo-tekstil" {
		t.Fatalf("expected fallback from reserved alias API to demo-tekstil, got %q", got)
	}
	if got := SuggestBrandSubdomain("", "", "Şehir Moda Tekstil"); got != "sehir-moda-tekstil" {
		t.Fatalf("got %q, want sehir-moda-tekstil", got)
	}
}
