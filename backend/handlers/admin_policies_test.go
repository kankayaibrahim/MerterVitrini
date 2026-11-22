package handlers

import "testing"

func TestNormalizePolicyLang(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"", "tr"},
		{"   ", "tr"},
		{"tr", "tr"},
		{"TR", "tr"},
		{"tr_TR", "tr"},
		{"en", "en"},
		{"en_US", "en"},
		{"en-GB", "en"},
		{"ru", "ru"},
		{"ru_RU", "ru"},
		{"ar", "ar"},
		{"ar-SA", "ar"},
		{"de", "de"},
		{"de-DE", "de"},
		{"fr", "fr"},
		{"pl", "pl"},
		{"bg", "bg"},
		{"es", "tr"},
		{"unknown", "tr"},
	}

	for _, tc := range cases {
		if got := normalizePolicyLang(tc.input); got != tc.want {
			t.Errorf("normalizePolicyLang(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestPolicyTypeToPageSlug(t *testing.T) {
	cases := []struct {
		policyType string
		wantSlug   string
	}{
		{"cancellation_and_return", "iptal-iade-kosullari"},
		{"terms_of_service", "kullanici-sozlesmesi"},
		{"privacy_policy", "gizlilik-politikasi"},
		{"supplier_agreement", "tedarikci-sozlesmesi"},
		{"copyright_and_takedown", "telif-hakki-ve-uyar-kaldir"},
		{"cookie_policy", "cerez-politikasi"},
		{" unknown_type ", ""},
		{"", ""},
	}

	for _, tc := range cases {
		if got := policyTypeToPageSlug(tc.policyType); got != tc.wantSlug {
			t.Errorf("policyTypeToPageSlug(%q) = %q, want %q", tc.policyType, got, tc.wantSlug)
		}
	}
}
