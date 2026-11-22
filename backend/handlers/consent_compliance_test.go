package handlers

import (
	"strings"
	"testing"

	"mertervitrini/backend/config"
)

func TestBuildCanonicalConsentPayloadDeterminism(t *testing.T) {
	input := canonicalConsentPayloadV1{
		Version:            consentPayloadSchemaV1,
		ConsentRefID:       "MV-CMP-1234567890",
		RecordedAtUTC:      "2026-11-22T03:00:00.000000Z",
		SubjectID:          "sub_abc123",
		VisitorID:          "vis_xyz789",
		Action:             "accept_all",
		Model:              "opt-in",
		UISource:           "banner",
		Consents:           ConsentChoices{Necessary: true, Functionality: true, Experience: true, Measurement: true, Marketing: false},
		GoogleConsentMode:  buildGoogleConsentModeState(ConsentChoices{Necessary: true, Functionality: true, Experience: true, Measurement: true, Marketing: false}, nil),
		GPCSignal:          false,
		PolicySnapshotHash: strings.Repeat("a", 64),
		PolicyVersion:      1,
		Language:           "tr",
		CountryCode:        "TR",
		IPMasked:           "213.202.0.0/16",
		IPHashSHA256:       strings.Repeat("b", 64),
		UserAgentHash:      strings.Repeat("c", 64),
		PageURL:            "https://mertervitrini.com.tr/",
	}

	c1, h1, err1 := buildCanonicalConsentPayload(input)
	if err1 != nil {
		t.Fatalf("unexpected error building canonical payload: %v", err1)
	}
	c2, h2, err2 := buildCanonicalConsentPayload(input)
	if err2 != nil {
		t.Fatalf("unexpected error rebuilding canonical payload: %v", err2)
	}
	if c1 != c2 || h1 != h2 {
		t.Fatalf("canonical payload or SHA-256 is not deterministic:\n%s\nvs\n%s", c1, c2)
	}

	// Mutating even a single boolean must alter both entry hash and HMAC
	cfg := &config.Config{JWTSecret: "unit-test-secret"}
	hmacKey := deriveConsentHMACKey(cfg)
	entry1 := computeChainEntryHash(consentGenesisHash, h1)
	mac1 := computeConsentHMAC(hmacKey, entry1)

	input.Consents.Marketing = true
	_, hTampered, err3 := buildCanonicalConsentPayload(input)
	if err3 != nil {
		t.Fatalf("unexpected error building tampered payload: %v", err3)
	}
	entryTampered := computeChainEntryHash(consentGenesisHash, hTampered)
	macTampered := computeConsentHMAC(hmacKey, entryTampered)

	if entry1 == entryTampered {
		t.Fatalf("expected entry hash to change after consent mutation")
	}
	if mac1 == macTampered {
		t.Fatalf("expected HMAC-SHA256 to change after entry hash mutation")
	}
}

func TestMaskAndHashIP(t *testing.T) {
	masked4, hash4 := maskAndHashIP("193.140.22.18")
	if masked4 != "193.140.0.0/16" {
		t.Fatalf("unexpected IPv4 mask: %s", masked4)
	}
	if len(hash4) != 64 {
		t.Fatalf("expected 64-char SHA-256 hex digest, got len=%d", len(hash4))
	}

	masked6, hash6 := maskAndHashIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
	if !strings.HasSuffix(masked6, "::/48") {
		t.Fatalf("expected /48 IPv6 prefix mask, got %s", masked6)
	}
	if len(hash6) != 64 {
		t.Fatalf("expected 64-char SHA-256 hex digest, got len=%d", len(hash6))
	}
}

func TestSanitizeCSVCell(t *testing.T) {
	if got := sanitizeCSVCell("=HYPERLINK(\"http://evil\")"); !strings.HasPrefix(got, "'=") {
		t.Fatalf("expected formula prefix guard, got %q", got)
	}
	if got := sanitizeCSVCell("MV-CMP-ABC123"); got != "MV-CMP-ABC123" {
		t.Fatalf("expected safe ref ID unchanged, got %q", got)
	}
}
