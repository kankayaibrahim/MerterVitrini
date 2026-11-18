package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsValidUUIDStringAndOptionalPtr(t *testing.T) {
	validID := "019e620f-2ca6-774c-9450-6c69015045a4"
	if !isValidUUIDString(validID) {
		t.Fatalf("expected %q to be valid UUID", validID)
	}
	if ptr := optionalUUIDPtr(validID); ptr == nil || *ptr != validID {
		t.Fatalf("expected optionalUUIDPtr(%q) to return matching pointer", validID)
	}

	for _, bad := range []string{"", "platform", "jane-s-toptan-tekstil", "019e620f_2ca6_774c_9450_6c69015045a4", "xyz"} {
		if isValidUUIDString(bad) {
			t.Fatalf("expected %q to be rejected as UUID", bad)
		}
		if ptr := optionalUUIDPtr(bad); ptr != nil {
			t.Fatalf("expected nil pointer for invalid UUID %q", bad)
		}
	}
}

func TestParseWhatsappFilterParamsAndBuildSQL(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/admin/analytics/whatsapp-clicks?period=7d&brand_id=platform&actor_type=customer&search=janes&limit=999&offset=25",
		nil,
	)
	filters := parseWhatsappFilterParams(req)
	if filters.Period != "7d" || filters.Since == nil {
		t.Fatalf("expected 7d period with non-nil Since, got %+v", filters)
	}
	if filters.BrandID != whatsappBrandFilterPlatform || filters.ActorType != whatsappActorCustomer {
		t.Fatalf("unexpected brand/actor filters: %+v", filters)
	}
	if filters.Limit != 300 || filters.Offset != 25 || filters.Search != "janes" {
		t.Fatalf("unexpected pagination/search params: %+v", filters)
	}

	whereSQL, args := buildWhatsappFilterSQL(filters)
	if !strings.Contains(whereSQL, "wc.brand_id IS NULL") {
		t.Fatalf("expected platform null brand predicate in %q", whereSQL)
	}
	if !strings.Contains(whereSQL, "COALESCE(wc.user_id, '') <> ''") {
		t.Fatalf("expected customer predicate in %q", whereSQL)
	}
	if !strings.Contains(whereSQL, "ILIKE $2") || len(args) != 2 || args[1] != "%janes%" {
		t.Fatalf("expected search arg %q in %q (args=%v)", "%janes%", whereSQL, args)
	}
}

func TestGetAdminWhatsappClicksRejectsNonGetAndHandlesNilPool(t *testing.T) {
	h := &AnalyticsHandler{}

	postReq := httptest.NewRequest(http.MethodPost, "/api/v1/admin/analytics/whatsapp-clicks", nil)
	postRec := httptest.NewRecorder()
	h.GetAdminWhatsappClicks(postRec, postReq)
	if postRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 on POST, got %d", postRec.Code)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/analytics/whatsapp-clicks?period=all", nil)
	getRec := httptest.NewRecorder()
	h.GetAdminWhatsappClicks(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on GET with nil pool, got %d", getRec.Code)
	}
	if !strings.Contains(getRec.Body.String(), `"period":"all"`) {
		t.Fatalf("unexpected JSON body: %s", getRec.Body.String())
	}
}
