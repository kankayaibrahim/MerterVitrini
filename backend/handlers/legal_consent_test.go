package handlers

import (
	"mertervitrini/backend/models"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestIsValidPolicyType(t *testing.T) {
	valid := []string{
		"cancellation_and_return",
		"terms_of_service",
		"privacy_policy",
		"supplier_agreement",
		"copyright_and_takedown",
	}
	for _, pt := range valid {
		if !isValidPolicyType(pt) {
			t.Fatalf("expected %q to be a valid policy type", pt)
		}
	}

	invalid := []string{"", "unknown_policy", "terms_of_service; DROP TABLE"}
	for _, pt := range invalid {
		if isValidPolicyType(pt) {
			t.Fatalf("expected %q to be rejected as invalid policy type", pt)
		}
	}
}

func TestValidateSupplierContentDeclaration(t *testing.T) {
	yes := true
	no := false

	if err := validateSupplierContentDeclaration(nil); err != nil {
		t.Fatalf("expected nil (legacy mobile caller) to be tolerated, got %v", err)
	}
	if err := validateSupplierContentDeclaration(&yes); err != nil {
		t.Fatalf("expected true to pass, got %v", err)
	}
	if err := validateSupplierContentDeclaration(&no); err == nil {
		t.Fatalf("expected false to return validation error")
	}
}

func TestIsExplicitlyAccepted(t *testing.T) {
	yes := true
	no := false
	if isExplicitlyAccepted(nil) {
		t.Fatalf("expected nil pointer to return false")
	}
	if isExplicitlyAccepted(&no) {
		t.Fatalf("expected &false to return false")
	}
	if !isExplicitlyAccepted(&yes) {
		t.Fatalf("expected &true to return true")
	}
}

func TestValidateSupplierMultipartContentDeclaration(t *testing.T) {
	reqMissing, _ := http.NewRequest(http.MethodPost, "/api/v1/supplier/products/import-excel", strings.NewReader(""))
	acceptedMissing, errMissing := validateSupplierMultipartContentDeclaration(reqMissing)
	if errMissing != nil || acceptedMissing {
		t.Fatalf("expected missing multipart consent field to return (false, nil), got (%v, %v)", acceptedMissing, errMissing)
	}

	reqFalse, _ := http.NewRequest(http.MethodPost, "/api/v1/supplier/products/import-excel", strings.NewReader(""))
	reqFalse.Form = url.Values{"content_responsibility_accepted": {"false"}}
	if _, err := validateSupplierMultipartContentDeclaration(reqFalse); err == nil {
		t.Fatalf("expected multipart false to return error")
	}

	reqTrue, _ := http.NewRequest(http.MethodPost, "/api/v1/supplier/products/import-excel", strings.NewReader(""))
	reqTrue.Form = url.Values{"content_responsibility_accepted": {"true"}}
	accepted, err := validateSupplierMultipartContentDeclaration(reqTrue)
	if err != nil || !accepted {
		t.Fatalf("expected multipart true to succeed, got accepted=%v err=%v", accepted, err)
	}
}

func TestNormalizeAndValidateSupplierApplicationRequestLegalTerms(t *testing.T) {
	no := false
	req := models.CreateSupplierApplicationRequest{
		CompanyName:        "Test Tekstil Ltd.",
		ContactName:        "Ahmet Yılmaz",
		Email:              "test@example.com",
		Phone:              "+90 532 481 92 64",
		City:               "İstanbul",
		District:           "Güngören",
		LegalTermsAccepted: &no,
	}
	if msg := normalizeAndValidateSupplierApplicationRequest(&req); msg == "" {
		t.Fatalf("expected explicit legal_terms_accepted=false to fail validation")
	}

	yes := true
	req.LegalTermsAccepted = &yes
	if msg := normalizeAndValidateSupplierApplicationRequest(&req); msg != "" {
		t.Fatalf("expected legal_terms_accepted=true to pass validation, got %q", msg)
	}
}

func TestRegisterRequestExplicitTermsRejection(t *testing.T) {
	no := false
	req := RegisterRequest{
		FirstName:     "Mehmet",
		LastName:      "Demir",
		Email:         "buyer@example.com",
		Password:      "StrongPass123!",
		Phone:         "+90 532 481 92 64",
		TermsAccepted: &no,
	}
	if errJSON := normalizeAndValidateRegisterInput(&req); errJSON == "" {
		t.Fatalf("expected explicit terms_accepted=false to fail registration validation")
	}

	yes := true
	req.TermsAccepted = &yes
	if errJSON := normalizeAndValidateRegisterInput(&req); errJSON != "" {
		t.Fatalf("expected terms_accepted=true to pass registration validation, got %s", errJSON)
	}
}
