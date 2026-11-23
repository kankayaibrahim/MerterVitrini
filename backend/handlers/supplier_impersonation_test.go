package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mertervitrini/backend/middleware"
	"mertervitrini/backend/services"
)

func TestSupplierImpersonationJWTAndMiddlewareIsolation(t *testing.T) {
	const testSecret = "supplier-impersonation-test-secret-2026"
	tokenSvc := services.NewUnifiedTokenService(testSecret, "", nil)

	tok, expiresIn, err := tokenSvc.IssueSupplierImpersonationJWT(services.SupplierImpersonationInput{
		SupplierUserID:     "",
		BrandID:            "01950000-0000-7000-8000-000000000101",
		BrandName:          "Lustrin Tekstil",
		AliasCode:          "MIMOZA",
		Email:              "admin@mertervitrini.com.tr",
		ContactName:        "Sistem Yöneticisi (Admin)",
		IsOwner:            true,
		JobTitle:           "Admin Oturumu",
		ImpersonatedBy:     "admin@mertervitrini.com.tr",
		ImpersonatedByID:   "adm-1",
		ImpersonatedByRole: "super_admin",
		ImpersonationLogID: "01950000-0000-7000-8000-000000000999",
		TTL:                2 * time.Hour,
	})
	if err != nil || tok == "" {
		t.Fatalf("expected valid supplier impersonation token, err=%v", err)
	}
	if expiresIn != 7200 {
		t.Fatalf("expected expiresIn 7200, got %d", expiresIn)
	}

	// Verify SupplierAuthMiddleware parses impersonation and ownership claims properly.
	var captured *middleware.SupplierClaims
	supplierMW := middleware.SupplierAuthMiddleware(testSecret, "")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, ok := middleware.GetSupplierFromContext(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		captured = c
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/supplier/profile", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	supplierMW.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from SupplierAuthMiddleware, got %d (%s)", rec.Code, rec.Body.String())
	}
	if captured == nil || !captured.Impersonated {
		t.Fatalf("expected captured claims with Impersonated=true, got %+v", captured)
	}
	if captured.ImpersonatedBy != "admin@mertervitrini.com.tr" || captured.ImpersonatedByRole != "super_admin" {
		t.Fatalf("unexpected impersonated_by claims: %+v", captured)
	}
	if captured.ImpersonationLogID != "01950000-0000-7000-8000-000000000999" {
		t.Fatalf("unexpected impersonation_log_id: %s", captured.ImpersonationLogID)
	}

	// Verify Admin AuthMiddleware rejects supplier impersonation tokens with 403 Forbidden.
	adminMW := middleware.AuthMiddleware(testSecret, "")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	adminReq := httptest.NewRequest(http.MethodGet, "/api/v1/suppliers", nil)
	adminReq.Header.Set("Authorization", "Bearer "+tok)
	adminRec := httptest.NewRecorder()
	adminMW.ServeHTTP(adminRec, adminReq)

	if adminRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden from AuthMiddleware for impersonation JWT, got %d", adminRec.Code)
	}
}

func TestResolveSupplierAuditActorVariants(t *testing.T) {
	t.Run("admin impersonation", func(t *testing.T) {
		actor := resolveSupplierAuditActor(&middleware.SupplierClaims{
			UserID:             "u-1",
			Email:              "satis@etika.com",
			ContactName:        "Ayşe Demir",
			IsOwner:            false,
			Impersonated:       true,
			ImpersonatedBy:     "patron@mertervitrini.com.tr",
			ImpersonatedByID:   "adm-1",
			ImpersonatedByRole: "super_admin",
			ImpersonationLogID: "log-1",
		})
		if actor.ActorType != AuditActorAdminImpersonation {
			t.Fatalf("expected %s, got %s", AuditActorAdminImpersonation, actor.ActorType)
		}
		if actor.ImpersonatedBy != "patron@mertervitrini.com.tr" {
			t.Fatalf("expected acting admin email preserved, got %s", actor.ImpersonatedBy)
		}
	})

	t.Run("supplier owner", func(t *testing.T) {
		actor := resolveSupplierAuditActor(&middleware.SupplierClaims{
			UserID:      "u-2",
			Email:       "sahip@janes.com",
			ContactName: "Murat Bey",
			IsOwner:     true,
			JobTitle:    "Firma Sahibi",
		})
		if actor.ActorType != AuditActorSupplierOwner || actor.ActorRole != "Firma Sahibi" {
			t.Fatalf("unexpected owner actor: %+v", actor)
		}
	})

	t.Run("supplier sub user", func(t *testing.T) {
		actor := resolveSupplierAuditActor(&middleware.SupplierClaims{
			UserID:      "u-3",
			Email:       "editor@janes.com",
			ContactName: "Zeynep K.",
			IsOwner:     false,
			JobTitle:    "Katalog Editörü",
		})
		if actor.ActorType != AuditActorSupplierSubUser || actor.ActorRole != "Katalog Editörü" {
			t.Fatalf("unexpected sub-user actor: %+v", actor)
		}
	})
}
