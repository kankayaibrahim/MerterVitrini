package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/services"
)

func TestIssueAndVerifyCustomerImpersonationToken(t *testing.T) {
	const testSecret = "merter-test-impersonation-secret-2026"
	configureStoreVerifier(testSecret, "")

	tokenSvc := services.NewUnifiedTokenService(testSecret, "", nil)
	tok := tokenSvc.IssueCustomerImpersonationJWT(services.CustomerImpersonationInput{
		CustomerID:    "cust-123",
		CustomerEmail: "buyer@example.com",
		CustomerName:  "Ahmet Yilmaz",
		CompanyName:   "Moda Tekstil",
		Phone:         "+905551112233",
		AdminID:       "adm-999",
		AdminEmail:    "admin@mertervitrini.com.tr",
		TTL:           30 * time.Minute,
	})
	if tok == "" {
		t.Fatal("expected non-empty customer impersonation JWT")
	}

	authHdr := "Bearer " + tok
	uid, claims, err := verifyTokenAndGetClaims(authHdr)
	if err != nil {
		t.Fatalf("expected impersonation JWT to verify via store verifier: %v", err)
	}
	if uid != "cust-123" {
		t.Fatalf("expected sub 'cust-123', got %q", uid)
	}
	if isImp, _ := claims["impersonated"].(bool); !isImp {
		t.Fatal("expected claim impersonated=true")
	}
	if by, _ := claims["impersonated_by"].(string); by != "admin@mertervitrini.com.tr" {
		t.Fatalf("expected impersonated_by 'admin@mertervitrini.com.tr', got %q", by)
	}

	isImp, adminEmail := isImpersonatedToken(authHdr)
	if !isImp || adminEmail != "admin@mertervitrini.com.tr" {
		t.Fatalf("expected isImpersonatedToken=(true, admin@mertervitrini.com.tr), got (%v, %q)", isImp, adminEmail)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/store/analytics/pageview", nil)
	req.Header.Set("Authorization", authHdr)
	if resolved := resolveAuthenticatedMemberID(req, tok); resolved != "" {
		t.Fatalf("expected impersonated telemetry auth resolution to return empty string, got %q", resolved)
	}

	pvBody, _ := json.Marshal(TrackPageViewRequest{
		VisitorID: "vis-1",
		SessionID: "sess-1",
		AuthToken: tok,
		URL:       "/tr/elbiseler",
	})
	pvReq := httptest.NewRequest(http.MethodPost, "/api/v1/store/analytics/pageview", bytes.NewReader(pvBody))
	pvReq.Header.Set("Content-Type", "application/json")
	pvRec := httptest.NewRecorder()
	(&AnalyticsHandler{}).TrackPageView(pvRec, pvReq)
	if pvRec.Code != http.StatusOK {
		t.Fatalf("expected TrackPageView 200 ignored response, got %d", pvRec.Code)
	}
	var pvResp map[string]any
	if err := json.Unmarshal(pvRec.Body.Bytes(), &pvResp); err != nil {
		t.Fatalf("expected JSON ignored response, got %v", err)
	}
	if ignored, _ := pvResp["ignored"].(bool); !ignored {
		t.Fatalf("expected ignored=true in TrackPageView response, got %#v", pvResp)
	}
}

func TestAdminMiddlewareRejectsImpersonationToken(t *testing.T) {
	const testSecret = "merter-test-admin-reject-secret-2026"
	tokenSvc := services.NewUnifiedTokenService(testSecret, "", nil)
	tok := tokenSvc.IssueCustomerImpersonationJWT(services.CustomerImpersonationInput{
		CustomerID:    "cust-456",
		CustomerEmail: "buyer2@example.com",
		AdminID:       "adm-1",
		AdminEmail:    "sales@mertervitrini.com.tr",
		TTL:           time.Hour,
	})
	if tok == "" {
		t.Fatal("expected non-empty customer impersonation JWT")
	}

	adminHandlerCalled := false
	protected := middleware.AuthMiddleware(testSecret, "")(
		middleware.RequireRole(models.RoleAdmin, models.RoleSalesManager)(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				adminHandlerCalled = true
				w.WriteHeader(http.StatusOK)
			}),
		),
	)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/customers", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if adminHandlerCalled {
		t.Fatal("admin handler must NEVER execute for a customer impersonation token")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden from admin middleware for impersonation token, got %d (%s)", rec.Code, rec.Body.String())
	}
}
