package phoneutil

import "testing"

func TestNormalizeAndValidatePhone_AcceptsRealProductionPhones(t *testing.T) {
	realPhones := []struct {
		input string
		want  string
	}{
		{"05539220634", "+905539220634"},
		{"5300871644", "5300871644"},
		{"05347470537", "+905347470537"},
		{"+90 536 834 60 85", "+905368346085"},
		{"07436913693", "07436913693"},
		{"+254795065214", "+254795065214"},
		{"5072643526", "5072643526"},
		{"0623731644", "0623731644"},
		{"5380982830", "5380982830"},
		{"5374067628", "5374067628"},
		{"5345703302", "5345703302"},
		{"9871441187", "9871441187"},
		{"0771593426", "0771593426"},
		{"+989904089936", "+989904089936"},
		{"5350621391", "5350621391"},
		{"+37069549235", "+37069549235"},
		{"9006743982", "9006743982"},
		{"+37362135854", "+37362135854"},
		{"5514729369", "5514729369"},
		{"5436680106", "5436680106"},
		{"5310284815", "5310284815"},
		{"+998885459092", "+998885459092"},
		{"+2250758917742", "+2250758917742"},
		{"15226243800", "15226243800"},
		{"+905436680106", "+905436680106"},
		{"+90 0532 481 92 64", "+905324819264"},
		{"0049 170 482 91 53", "+491704829153"},
	}

	for _, tc := range realPhones {
		got, err := NormalizeAndValidatePhone(tc.input)
		if err != nil {
			t.Fatalf("expected real phone %q to succeed, got error: %v", tc.input, err)
		}
		if got != tc.want {
			t.Fatalf("phone %q normalized to %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestNormalizeAndValidatePhone_RejectsFakeAndInvalidPhones(t *testing.T) {
	fakePhones := []string{
		"",
		"   ",
		"-",
		"1234567",
		"1234567890",
		"9876543210",
		"0000000000",
		"5555555555",
		"5550000000",
		"+90 532 000 00 00",
		"+905551112233",
		"05321234567",
		"05994819264",
		"+905004819264",
		"+905504819264",
		"+9053212345",
		"abc05324819264",
		"+05324819264",
		"05321212121",
		"000905324819264",
		"+90 532 765 43 21",
	}

	for _, phone := range fakePhones {
		if got, err := NormalizeAndValidatePhone(phone); err == nil {
			t.Fatalf("expected fake/invalid phone %q to be rejected, but got %q", phone, got)
		}
	}
}

