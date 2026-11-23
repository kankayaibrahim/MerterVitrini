package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/services"
)

const supplierImpersonationTTL = 2 * time.Hour

// ActorType constants for supplier sessions and product audit records.
const (
	AuditActorAdminImpersonation = "admin_impersonation"
	AuditActorSupplierOwner      = "supplier_owner"
	AuditActorSupplierSubUser    = "supplier_sub_user"
	AuditActorAdminPanel         = "admin_panel"
	AuditActorXMLFeed            = "xml_feed"
)

var (
	supplierAuditSchemaMu   sync.Mutex
	supplierAuditSchemaDone bool
)

// EnsureSupplierAuditSchema idempotently adds product audit columns and audit log tables.
func EnsureSupplierAuditSchema(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	supplierAuditSchemaMu.Lock()
	defer supplierAuditSchemaMu.Unlock()
	if supplierAuditSchemaDone {
		return nil
	}

	const ddl = `
	CREATE SCHEMA IF NOT EXISTS identity;
	CREATE SCHEMA IF NOT EXISTS catalog;

	ALTER TABLE catalog.products
		ADD COLUMN IF NOT EXISTS created_by_actor_type VARCHAR(32) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(150) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(150) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(80) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_impersonated_by_id VARCHAR(255) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_impersonated_by_email VARCHAR(150) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS created_by_impersonation_log_id UUID NULL,
		ADD COLUMN IF NOT EXISTS updated_by_actor_type VARCHAR(32) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS updated_by_email VARCHAR(150) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(150) NOT NULL DEFAULT '',
		ADD COLUMN IF NOT EXISTS updated_by_impersonated_by_email VARCHAR(150) NOT NULL DEFAULT '';

	CREATE INDEX IF NOT EXISTS idx_products_created_actor_created_at
		ON catalog.products (brand_id, created_by_actor_type, created_at DESC);

	CREATE TABLE IF NOT EXISTS identity.supplier_session_logs (
		id UUID PRIMARY KEY DEFAULT uuidv7(),
		session_type VARCHAR(32) NOT NULL,
		brand_id UUID NOT NULL,
		brand_name VARCHAR(200) NOT NULL DEFAULT '',
		supplier_user_id VARCHAR(255) NOT NULL DEFAULT '',
		supplier_email VARCHAR(150) NOT NULL DEFAULT '',
		supplier_contact_name VARCHAR(150) NOT NULL DEFAULT '',
		supplier_is_owner BOOLEAN NOT NULL DEFAULT false,
		supplier_job_title VARCHAR(100) NOT NULL DEFAULT '',
		admin_user_id VARCHAR(255) NOT NULL DEFAULT '',
		admin_email VARCHAR(150) NOT NULL DEFAULT '',
		admin_name VARCHAR(150) NOT NULL DEFAULT '',
		admin_role VARCHAR(60) NOT NULL DEFAULT '',
		ip_address VARCHAR(64) NOT NULL DEFAULT '',
		user_agent TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_supplier_session_logs_created_at
		ON identity.supplier_session_logs (created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_supplier_session_logs_brand_created_at
		ON identity.supplier_session_logs (brand_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_supplier_session_logs_type_created_at
		ON identity.supplier_session_logs (session_type, created_at DESC);

	CREATE TABLE IF NOT EXISTS catalog.product_audit_logs (
		id UUID PRIMARY KEY DEFAULT uuidv7(),
		product_id UUID NULL,
		product_title VARCHAR(300) NOT NULL DEFAULT '',
		custom_sku VARCHAR(120) NOT NULL DEFAULT '',
		brand_id UUID NOT NULL,
		brand_name VARCHAR(200) NOT NULL DEFAULT '',
		action VARCHAR(40) NOT NULL,
		actor_type VARCHAR(32) NOT NULL,
		actor_user_id VARCHAR(255) NOT NULL DEFAULT '',
		actor_email VARCHAR(150) NOT NULL DEFAULT '',
		actor_name VARCHAR(150) NOT NULL DEFAULT '',
		actor_role VARCHAR(80) NOT NULL DEFAULT '',
		impersonated_by_id VARCHAR(255) NOT NULL DEFAULT '',
		impersonated_by_email VARCHAR(150) NOT NULL DEFAULT '',
		impersonated_by_role VARCHAR(60) NOT NULL DEFAULT '',
		impersonation_log_id UUID NULL,
		ip_address VARCHAR(64) NOT NULL DEFAULT '',
		user_agent TEXT NOT NULL DEFAULT '',
		metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_product_audit_logs_created_at
		ON catalog.product_audit_logs (created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_product_audit_logs_brand_created_at
		ON catalog.product_audit_logs (brand_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_product_audit_logs_actor_created_at
		ON catalog.product_audit_logs (actor_type, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_product_audit_logs_product_id
		ON catalog.product_audit_logs (product_id);`

	if _, err := db.Pool.Exec(ctx, ddl); err != nil {
		log.Printf("[SUPPLIER AUDIT] Schema provisioning failed: %v", err)
		return err
	}
	supplierAuditSchemaDone = true
	return nil
}

// ProductAuditActor describes the resolved session/actor metadata behind a product upload or edit.
type ProductAuditActor struct {
	ActorType          string
	ActorUserID        string
	ActorEmail         string
	ActorName          string
	ActorRole          string
	ImpersonatedByID   string
	ImpersonatedBy     string
	ImpersonatedByRole string
	ImpersonationLogID string
}

type productAuditItemRef struct {
	ProductID string
	Title     string
	CustomSKU string
}

type supplierSessionLogInput struct {
	SessionType         string
	BrandID             string
	BrandName           string
	SupplierUserID      string
	SupplierEmail       string
	SupplierContactName string
	SupplierIsOwner     bool
	SupplierJobTitle    string
	AdminUserID         string
	AdminEmail          string
	AdminName           string
	AdminRole           string
	IPAddress           string
	UserAgent           string
}

func firstNonEmptyAuditStr(values ...string) string {
	for _, v := range values {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func resolveSupplierAuditActor(claims *middleware.SupplierClaims) ProductAuditActor {
	if claims == nil {
		return ProductAuditActor{ActorType: AuditActorSupplierSubUser, ActorRole: "Bilinmiyor"}
	}
	actorName := firstNonEmptyAuditStr(claims.ContactName, claims.Email, claims.BrandName)
	if claims.Impersonated {
		roleLabel := "Admin Tedarikçi Oturumu"
		if claims.UserID != "" && !claims.IsOwner {
			roleLabel = "Admin → Alt Kullanıcı"
		}
		return ProductAuditActor{
			ActorType:          AuditActorAdminImpersonation,
			ActorUserID:        claims.UserID,
			ActorEmail:         claims.Email,
			ActorName:          actorName,
			ActorRole:          roleLabel,
			ImpersonatedByID:   claims.ImpersonatedByID,
			ImpersonatedBy:     claims.ImpersonatedBy,
			ImpersonatedByRole: claims.ImpersonatedByRole,
			ImpersonationLogID: claims.ImpersonationLogID,
		}
	}
	if claims.IsOwner {
		return ProductAuditActor{
			ActorType:   AuditActorSupplierOwner,
			ActorUserID: claims.UserID,
			ActorEmail:  claims.Email,
			ActorName:   actorName,
			ActorRole:   firstNonEmptyAuditStr(claims.JobTitle, "Firma Sahibi"),
		}
	}
	return ProductAuditActor{
		ActorType:   AuditActorSupplierSubUser,
		ActorUserID: claims.UserID,
		ActorEmail:  claims.Email,
		ActorName:   actorName,
		ActorRole:   firstNonEmptyAuditStr(claims.JobTitle, "Alt Kullanıcı"),
	}
}

func stampProductsCreatedAuditTx(ctx context.Context, tx pgx.Tx, productIDs []string, actor ProductAuditActor) error {
	cleanIDs := cleanNonEmptyStrings(productIDs)
	if len(cleanIDs) == 0 {
		return nil
	}
	const q = `
		UPDATE catalog.products
		SET created_by_actor_type = $2,
		    created_by_user_id = $3,
		    created_by_email = $4,
		    created_by_name = $5,
		    created_by_role = $6,
		    created_by_impersonated_by_id = $7,
		    created_by_impersonated_by_email = $8,
		    created_by_impersonation_log_id = NULLIF($9, '')::uuid,
		    updated_by_actor_type = $2,
		    updated_by_email = $4,
		    updated_by_name = $5,
		    updated_by_impersonated_by_email = $8
		WHERE id = ANY($1::uuid[])`
	_, err := tx.Exec(
		ctx, q,
		cleanIDs,
		clampStringLen(actor.ActorType, 32),
		clampStringLen(actor.ActorUserID, 255),
		clampStringLen(actor.ActorEmail, 150),
		clampStringLen(actor.ActorName, 150),
		clampStringLen(actor.ActorRole, 80),
		clampStringLen(actor.ImpersonatedByID, 255),
		clampStringLen(actor.ImpersonatedBy, 150),
		strings.TrimSpace(actor.ImpersonationLogID),
	)
	return err
}

func stampProductUpdatedAuditTx(ctx context.Context, tx pgx.Tx, productID string, actor ProductAuditActor) error {
	cleanID := strings.TrimSpace(productID)
	if cleanID == "" {
		return nil
	}
	const q = `
		UPDATE catalog.products
		SET updated_by_actor_type = $2,
		    updated_by_email = $3,
		    updated_by_name = $4,
		    updated_by_impersonated_by_email = $5
		WHERE id = $1::uuid`
	_, err := tx.Exec(
		ctx, q,
		cleanID,
		clampStringLen(actor.ActorType, 32),
		clampStringLen(actor.ActorEmail, 150),
		clampStringLen(actor.ActorName, 150),
		clampStringLen(actor.ImpersonatedBy, 150),
	)
	return err
}

func extractRequestIPAndUA(r *http.Request) (string, string) {
	if r == nil {
		return "", ""
	}
	return clampStringLen(getClientIP(r), 64), clampStringLen(strings.TrimSpace(r.UserAgent()), 512)
}

func recordProductAuditLogsAsync(
	r *http.Request,
	brandID, brandName, action string,
	items []productAuditItemRef,
	actor ProductAuditActor,
	extraMeta map[string]any,
) {
	if db.Pool == nil || len(items) == 0 {
		return
	}
	ipAddr, userAgent := extractRequestIPAndUA(r)
	metaJSON, err := json.Marshal(extraMeta)
	if err != nil || len(extraMeta) == 0 {
		metaJSON = []byte("{}")
	}

	copied := make([]productAuditItemRef, len(items))
	copy(copied, items)

	safe.Go("Record Product Audit Logs", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()
		_ = EnsureSupplierAuditSchema(ctx)

		const insSQL = `
			INSERT INTO catalog.product_audit_logs (
				product_id, product_title, custom_sku, brand_id, brand_name,
				action, actor_type, actor_user_id, actor_email, actor_name, actor_role,
				impersonated_by_id, impersonated_by_email, impersonated_by_role, impersonation_log_id,
				ip_address, user_agent, metadata
			) VALUES (
				NULLIF($1, '')::uuid, $2, $3, $4::uuid, $5,
				$6, $7, $8, $9, $10, $11,
				$12, $13, $14, NULLIF($15, '')::uuid,
				$16, $17, $18::jsonb
			)`
		for _, item := range copied {
			if _, execErr := db.Pool.Exec(
				ctx, insSQL,
				strings.TrimSpace(item.ProductID),
				clampStringLen(strings.TrimSpace(item.Title), 300),
				clampStringLen(strings.TrimSpace(item.CustomSKU), 120),
				brandID,
				clampStringLen(strings.TrimSpace(brandName), 200),
				clampStringLen(action, 40),
				clampStringLen(actor.ActorType, 32),
				clampStringLen(actor.ActorUserID, 255),
				clampStringLen(actor.ActorEmail, 150),
				clampStringLen(actor.ActorName, 150),
				clampStringLen(actor.ActorRole, 80),
				clampStringLen(actor.ImpersonatedByID, 255),
				clampStringLen(actor.ImpersonatedBy, 150),
				clampStringLen(actor.ImpersonatedByRole, 60),
				strings.TrimSpace(actor.ImpersonationLogID),
				ipAddr,
				userAgent,
				string(metaJSON),
			); execErr != nil {
				log.Printf("[PRODUCT AUDIT WARNING] Failed to record product=%s action=%s: %v", item.ProductID, action, execErr)
			}
		}
	})
}

func recordSupplierSessionLogAsync(r *http.Request, entry supplierSessionLogInput) {
	if db.Pool == nil || strings.TrimSpace(entry.BrandID) == "" {
		return
	}
	if entry.IPAddress == "" && r != nil {
		entry.IPAddress, entry.UserAgent = extractRequestIPAndUA(r)
	}
	safe.Go("Record Supplier Session Log", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = EnsureSupplierAuditSchema(ctx)
		if _, err := insertSupplierSessionLogRow(ctx, entry); err != nil {
			log.Printf("[SUPPLIER SESSION AUDIT WARNING] Failed to insert session log: %v", err)
		}
	})
}

func insertSupplierSessionLogRow(ctx context.Context, entry supplierSessionLogInput) (string, error) {
	const insSQL = `
		INSERT INTO identity.supplier_session_logs (
			session_type, brand_id, brand_name, supplier_user_id, supplier_email,
			supplier_contact_name, supplier_is_owner, supplier_job_title,
			admin_user_id, admin_email, admin_name, admin_role,
			ip_address, user_agent
		) VALUES (
			$1, $2::uuid, $3, $4, $5,
			$6, $7, $8,
			$9, $10, $11, $12,
			$13, $14
		) RETURNING id::text`

	var logID string
	err := db.Pool.QueryRow(
		ctx, insSQL,
		clampStringLen(entry.SessionType, 32),
		strings.TrimSpace(entry.BrandID),
		clampStringLen(entry.BrandName, 200),
		clampStringLen(entry.SupplierUserID, 255),
		clampStringLen(entry.SupplierEmail, 150),
		clampStringLen(entry.SupplierContactName, 150),
		entry.SupplierIsOwner,
		clampStringLen(entry.SupplierJobTitle, 100),
		clampStringLen(entry.AdminUserID, 255),
		clampStringLen(entry.AdminEmail, 150),
		clampStringLen(entry.AdminName, 150),
		clampStringLen(entry.AdminRole, 60),
		clampStringLen(entry.IPAddress, 64),
		clampStringLen(entry.UserAgent, 512),
	).Scan(&logID)
	return logID, err
}

// SupplierImpersonationHandler manages admin supplier portal impersonation and audit log inspection.
type SupplierImpersonationHandler struct {
	Cfg *config.Config
}

// NewSupplierImpersonationHandler constructs a handler with injected configuration.
func NewSupplierImpersonationHandler(cfg *config.Config) *SupplierImpersonationHandler {
	return &SupplierImpersonationHandler{Cfg: cfg}
}

type impersonateSupplierRequest struct {
	SupplierUserID string `json:"supplier_user_id"`
}

type impersonationBrandRecord struct {
	ID        string
	Name      string
	AliasCode string
	IsActive  bool
}

type impersonationSupplierTarget struct {
	UserID      string
	Email       string
	ContactName string
	IsOwner     bool
	JobTitle    string
}

func fetchBrandForImpersonation(ctx context.Context, brandID string) (*impersonationBrandRecord, int, string) {
	var rec impersonationBrandRecord
	err := db.Pool.QueryRow(ctx, `
		SELECT id::text, brand_name, coalesce(alias_code, ''), coalesce(is_active, true)
		FROM catalog.brands
		WHERE id = $1::uuid
		LIMIT 1
	`, brandID).Scan(&rec.ID, &rec.Name, &rec.AliasCode, &rec.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, http.StatusNotFound, "Tedarikçi firma bulunamadı"
		}
		log.Printf("[SUPPLIER IMPERSONATION] Brand lookup error (%s): %v", brandID, err)
		return nil, http.StatusInternalServerError, "Tedarikçi bilgileri alınamadı"
	}
	if !rec.IsActive {
		return nil, http.StatusBadRequest, "Pasif durumdaki tedarikçi firma adına oturum açılamaz"
	}
	return &rec, 0, ""
}

func resolveImpersonationTargetUser(
	ctx context.Context,
	brandID, requestedUserID string,
	staff *models.UserInfo,
) (*impersonationSupplierTarget, int, string) {
	trimmedUserID := strings.TrimSpace(requestedUserID)
	var rec impersonationSupplierTarget
	var isActive bool

	if trimmedUserID != "" {
		err := db.Pool.QueryRow(ctx, `
			SELECT id::text, email, contact_name, coalesce(is_owner, false), coalesce(job_title, ''), coalesce(is_active, true)
			FROM catalog.supplier_users
			WHERE id = $1::uuid AND brand_id = $2::uuid
			LIMIT 1
		`, trimmedUserID, brandID).Scan(&rec.UserID, &rec.Email, &rec.ContactName, &rec.IsOwner, &rec.JobTitle, &isActive)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, http.StatusNotFound, "Seçilen tedarikçi kullanıcısı bulunamadı"
			}
			return nil, http.StatusInternalServerError, "Tedarikçi kullanıcısı sorgulanamadı"
		}
		if !isActive {
			return nil, http.StatusBadRequest, "Pasif durumdaki tedarikçi kullanıcısı adına oturum açılamaz"
		}
		return &rec, 0, ""
	}

	err := db.Pool.QueryRow(ctx, `
		SELECT id::text, email, contact_name, coalesce(is_owner, false), coalesce(job_title, '')
		FROM catalog.supplier_users
		WHERE brand_id = $1::uuid AND coalesce(is_active, true) = true
		ORDER BY coalesce(is_owner, false) DESC, created_at ASC
		LIMIT 1
	`, brandID).Scan(&rec.UserID, &rec.Email, &rec.ContactName, &rec.IsOwner, &rec.JobTitle)
	if err == nil {
		return &rec, 0, ""
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, http.StatusInternalServerError, "Tedarikçi hesabı sorgulanamadı"
	}

	// Brand without any supplier_users row (e.g. XML-only or newly created brand): issue brand-level admin session.
	staffName := strings.TrimSpace(fmt.Sprintf("%s %s", staff.FirstName, staff.LastName))
	if staffName == "" {
		staffName = staff.Email
	}
	return &impersonationSupplierTarget{
		UserID:      "",
		Email:       staff.Email,
		ContactName: staffName + " (Admin)",
		IsOwner:     true,
		JobTitle:    "Admin Oturumu",
	}, 0, ""
}

func decodeOptionalImpersonateSupplierBody(r *http.Request) impersonateSupplierRequest {
	var req impersonateSupplierRequest
	if r.Body == nil {
		return req
	}
	err := httpx.DecodeJSON(r, &req, 64<<10)
	if err != nil && !errors.Is(err, io.EOF) {
		return impersonateSupplierRequest{}
	}
	return req
}

// ImpersonateSupplier handles POST /api/v1/admin/suppliers/{id}/impersonate.
func (h *SupplierImpersonationHandler) ImpersonateSupplier(w http.ResponseWriter, r *http.Request) {
	brandID := strings.TrimSpace(r.PathValue("id"))
	if brandID == "" {
		httpx.Error(w, http.StatusBadRequest, "Tedarikçi firma ID gereklidir")
		return
	}

	staff, ok := middleware.GetUserFromContext(r.Context())
	if !ok || staff == nil {
		httpx.Error(w, http.StatusUnauthorized, "Yetkili yönetici doğrulanamadı")
		return
	}
	if staff.Role != models.RoleSuperAdmin && staff.Role != models.RoleAdmin {
		httpx.Error(w, http.StatusForbidden, "Yalnızca yöneticiler tedarikçi adına oturum açabilir")
		return
	}
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı bağlantısı hazır değil")
		return
	}

	req := decodeOptionalImpersonateSupplierBody(r)
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	_ = EnsureSupplierAuditSchema(ctx)

	brand, errCode, errMsg := fetchBrandForImpersonation(ctx, brandID)
	if brand == nil {
		httpx.Error(w, errCode, errMsg)
		return
	}

	target, targetCode, targetMsg := resolveImpersonationTargetUser(ctx, brand.ID, req.SupplierUserID, staff)
	if target == nil {
		httpx.Error(w, targetCode, targetMsg)
		return
	}

	ipAddr, userAgent := extractRequestIPAndUA(r)
	staffName := strings.TrimSpace(fmt.Sprintf("%s %s", staff.FirstName, staff.LastName))
	logID, logErr := insertSupplierSessionLogRow(ctx, supplierSessionLogInput{
		SessionType:         AuditActorAdminImpersonation,
		BrandID:             brand.ID,
		BrandName:           brand.Name,
		SupplierUserID:      target.UserID,
		SupplierEmail:       target.Email,
		SupplierContactName: target.ContactName,
		SupplierIsOwner:     target.IsOwner,
		SupplierJobTitle:    target.JobTitle,
		AdminUserID:         staff.ID,
		AdminEmail:          staff.Email,
		AdminName:           firstNonEmptyAuditStr(staffName, staff.Email),
		AdminRole:           string(staff.Role),
		IPAddress:           ipAddr,
		UserAgent:           userAgent,
	})
	if logErr != nil {
		log.Printf("[SUPPLIER IMPERSONATION WARNING] Failed to insert session log: %v", logErr)
	}

	secret := resolveCustomerTokenSecret(h.Cfg)
	tokenSvc := services.NewUnifiedTokenService(secret, "", db.Pool)
	token, expiresIn, tokErr := tokenSvc.IssueSupplierImpersonationJWT(services.SupplierImpersonationInput{
		SupplierUserID:     target.UserID,
		BrandID:            brand.ID,
		BrandName:          brand.Name,
		AliasCode:          brand.AliasCode,
		Email:              target.Email,
		ContactName:        target.ContactName,
		IsOwner:            target.IsOwner,
		JobTitle:           target.JobTitle,
		ImpersonatedBy:     staff.Email,
		ImpersonatedByID:   staff.ID,
		ImpersonatedByRole: string(staff.Role),
		ImpersonationLogID: logID,
		TTL:                supplierImpersonationTTL,
	})
	if tokErr != nil {
		httpx.Error(w, http.StatusInternalServerError, tokErr.Error())
		return
	}

	log.Printf("[SUPPLIER IMPERSONATION] Admin=%s (%s) opened session for brand=%s (%s) user=%s",
		staff.Email, staff.Role, brand.Name, brand.ID, target.Email)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"token":      token,
		"expires_in": expiresIn,
		"user": map[string]any{
			"id":           target.UserID,
			"brand_id":     brand.ID,
			"brand_name":   brand.Name,
			"alias_code":   brand.AliasCode,
			"email":        target.Email,
			"contact_name": target.ContactName,
			"is_owner":     target.IsOwner,
			"job_title":    target.JobTitle,
			"role":         "supplier",
		},
		"impersonation": map[string]any{
			"impersonated":         true,
			"impersonated_by":      staff.Email,
			"impersonated_by_id":   staff.ID,
			"impersonated_by_role": string(staff.Role),
			"impersonation_log_id": logID,
			"brand_name":           brand.Name,
		},
	})
}

type supplierAuditSummaryDTO struct {
	TotalProductEvents         int `json:"total_product_events"`
	AdminImpersonationCreates  int `json:"admin_impersonation_creates"`
	OwnerCreates               int `json:"owner_creates"`
	SubUserCreates             int `json:"sub_user_creates"`
	TotalSessions              int `json:"total_sessions"`
	AdminImpersonationSessions int `json:"admin_impersonation_sessions"`
}

type productAuditLogDTO struct {
	ID                 string         `json:"id"`
	ProductID          *string        `json:"product_id,omitempty"`
	ProductTitle       string         `json:"product_title"`
	CustomSKU          string         `json:"custom_sku"`
	BrandID            string         `json:"brand_id"`
	BrandName          string         `json:"brand_name"`
	Action             string         `json:"action"`
	ActorType          string         `json:"actor_type"`
	ActorUserID        string         `json:"actor_user_id"`
	ActorEmail         string         `json:"actor_email"`
	ActorName          string         `json:"actor_name"`
	ActorRole          string         `json:"actor_role"`
	ImpersonatedByID   string         `json:"impersonated_by_id,omitempty"`
	ImpersonatedBy     string         `json:"impersonated_by_email,omitempty"`
	ImpersonatedByRole string         `json:"impersonated_by_role,omitempty"`
	ImpersonationLogID *string        `json:"impersonation_log_id,omitempty"`
	IPAddress          string         `json:"ip_address"`
	UserAgent          string         `json:"user_agent"`
	Metadata           map[string]any `json:"metadata,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
}

type supplierSessionLogDTO struct {
	ID                  string    `json:"id"`
	SessionType         string    `json:"session_type"`
	BrandID             string    `json:"brand_id"`
	BrandName           string    `json:"brand_name"`
	SupplierUserID      string    `json:"supplier_user_id"`
	SupplierEmail       string    `json:"supplier_email"`
	SupplierContactName string    `json:"supplier_contact_name"`
	SupplierIsOwner     bool      `json:"supplier_is_owner"`
	SupplierJobTitle    string    `json:"supplier_job_title"`
	AdminUserID         string    `json:"admin_user_id,omitempty"`
	AdminEmail          string    `json:"admin_email,omitempty"`
	AdminName           string    `json:"admin_name,omitempty"`
	AdminRole           string    `json:"admin_role,omitempty"`
	IPAddress           string    `json:"ip_address"`
	UserAgent           string    `json:"user_agent"`
	CreatedAt           time.Time `json:"created_at"`
}

type auditLogFilterParams struct {
	Tab       string
	BrandID   string
	ActorType string
	Action    string
	Query     string
	Limit     int
	Offset    int
}

func parseSupplierAuditLogQuery(r *http.Request) auditLogFilterParams {
	q := r.URL.Query()
	tab := strings.ToLower(strings.TrimSpace(q.Get("type")))
	if tab != "sessions" {
		tab = "products"
	}
	limit := 50
	if parsed, err := strconv.Atoi(q.Get("limit")); err == nil && parsed > 0 && parsed <= 200 {
		limit = parsed
	}
	offset := 0
	if parsed, err := strconv.Atoi(q.Get("offset")); err == nil && parsed >= 0 {
		offset = parsed
	}
	return auditLogFilterParams{
		Tab:       tab,
		BrandID:   strings.TrimSpace(q.Get("brand_id")),
		ActorType: strings.TrimSpace(q.Get("actor_type")),
		Action:    strings.TrimSpace(q.Get("action")),
		Query:     strings.TrimSpace(q.Get("q")),
		Limit:     limit,
		Offset:    offset,
	}
}

func fetchSupplierAuditSummary(ctx context.Context, brandID string) supplierAuditSummaryDTO {
	var summary supplierAuditSummaryDTO
	whereBrand := ""
	var args []any
	if brandID != "" {
		whereBrand = " WHERE brand_id = $1::uuid"
		args = append(args, brandID)
	}

	const prodStatsQ = `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE actor_type = 'admin_impersonation' AND action IN ('create', 'batch_create', 'excel_import')),
		       COUNT(*) FILTER (WHERE actor_type = 'supplier_owner' AND action IN ('create', 'batch_create', 'excel_import')),
		       COUNT(*) FILTER (WHERE actor_type = 'supplier_sub_user' AND action IN ('create', 'batch_create', 'excel_import'))
		FROM catalog.product_audit_logs`
	_ = db.Pool.QueryRow(ctx, prodStatsQ+whereBrand, args...).Scan(
		&summary.TotalProductEvents,
		&summary.AdminImpersonationCreates,
		&summary.OwnerCreates,
		&summary.SubUserCreates,
	)

	const sessStatsQ = `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE session_type = 'admin_impersonation')
		FROM identity.supplier_session_logs`
	_ = db.Pool.QueryRow(ctx, sessStatsQ+whereBrand, args...).Scan(
		&summary.TotalSessions,
		&summary.AdminImpersonationSessions,
	)
	return summary
}

func buildProductAuditWhereSQL(p auditLogFilterParams) (string, []any) {
	var sb strings.Builder
	var args []any
	idx := 1
	if p.BrandID != "" {
		sb.WriteString(fmt.Sprintf(" AND l.brand_id = $%d::uuid", idx))
		args = append(args, p.BrandID)
		idx++
	}
	if p.ActorType != "" && p.ActorType != "all" {
		sb.WriteString(fmt.Sprintf(" AND l.actor_type = $%d", idx))
		args = append(args, p.ActorType)
		idx++
	}
	if p.Action != "" && p.Action != "all" {
		sb.WriteString(fmt.Sprintf(" AND l.action = $%d", idx))
		args = append(args, p.Action)
		idx++
	}
	if p.Query != "" {
		sb.WriteString(fmt.Sprintf(` AND (
			l.product_title ILIKE $%[1]d OR l.custom_sku ILIKE $%[1]d OR l.brand_name ILIKE $%[1]d
			OR l.actor_email ILIKE $%[1]d OR l.actor_name ILIKE $%[1]d OR l.impersonated_by_email ILIKE $%[1]d
		)`, idx))
		args = append(args, "%"+p.Query+"%")
	}
	return sb.String(), args
}

func queryProductAuditLogs(ctx context.Context, p auditLogFilterParams) ([]productAuditLogDTO, int, error) {
	whereSQL, args := buildProductAuditWhereSQL(p)

	var total int
	countQ := `SELECT COUNT(*) FROM catalog.product_audit_logs l WHERE 1=1` + whereSQL
	if err := db.Pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append(args, p.Limit, p.Offset)
	listQ := fmt.Sprintf(`
		SELECT l.id::text, l.product_id::text, l.product_title, l.custom_sku, l.brand_id::text, l.brand_name,
		       l.action, l.actor_type, l.actor_user_id, l.actor_email, l.actor_name, l.actor_role,
		       l.impersonated_by_id, l.impersonated_by_email, l.impersonated_by_role, l.impersonation_log_id::text,
		       l.ip_address, l.user_agent, l.metadata, l.created_at
		FROM catalog.product_audit_logs l
		WHERE 1=1%s
		ORDER BY l.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, len(args)+1, len(args)+2)

	rows, err := db.Pool.Query(ctx, listQ, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]productAuditLogDTO, 0)
	for rows.Next() {
		var item productAuditLogDTO
		var metaBytes []byte
		if scanErr := rows.Scan(
			&item.ID, &item.ProductID, &item.ProductTitle, &item.CustomSKU, &item.BrandID, &item.BrandName,
			&item.Action, &item.ActorType, &item.ActorUserID, &item.ActorEmail, &item.ActorName, &item.ActorRole,
			&item.ImpersonatedByID, &item.ImpersonatedBy, &item.ImpersonatedByRole, &item.ImpersonationLogID,
			&item.IPAddress, &item.UserAgent, &metaBytes, &item.CreatedAt,
		); scanErr != nil {
			continue
		}
		if len(metaBytes) > 0 {
			_ = json.Unmarshal(metaBytes, &item.Metadata)
		}
		items = append(items, item)
	}
	return items, total, nil
}

func buildSupplierSessionWhereSQL(p auditLogFilterParams) (string, []any) {
	var sb strings.Builder
	var args []any
	idx := 1
	if p.BrandID != "" {
		sb.WriteString(fmt.Sprintf(" AND s.brand_id = $%d::uuid", idx))
		args = append(args, p.BrandID)
		idx++
	}
	if p.ActorType != "" && p.ActorType != "all" {
		sb.WriteString(fmt.Sprintf(" AND s.session_type = $%d", idx))
		args = append(args, p.ActorType)
		idx++
	}
	if p.Query != "" {
		sb.WriteString(fmt.Sprintf(` AND (
			s.brand_name ILIKE $%[1]d OR s.supplier_email ILIKE $%[1]d OR s.supplier_contact_name ILIKE $%[1]d
			OR s.admin_email ILIKE $%[1]d OR s.admin_name ILIKE $%[1]d
		)`, idx))
		args = append(args, "%"+p.Query+"%")
	}
	return sb.String(), args
}

func querySupplierSessionLogs(ctx context.Context, p auditLogFilterParams) ([]supplierSessionLogDTO, int, error) {
	whereSQL, args := buildSupplierSessionWhereSQL(p)

	var total int
	countQ := `SELECT COUNT(*) FROM identity.supplier_session_logs s WHERE 1=1` + whereSQL
	if err := db.Pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append(args, p.Limit, p.Offset)
	listQ := fmt.Sprintf(`
		SELECT s.id::text, s.session_type, s.brand_id::text, s.brand_name, s.supplier_user_id,
		       s.supplier_email, s.supplier_contact_name, s.supplier_is_owner, s.supplier_job_title,
		       s.admin_user_id, s.admin_email, s.admin_name, s.admin_role,
		       s.ip_address, s.user_agent, s.created_at
		FROM identity.supplier_session_logs s
		WHERE 1=1%s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, len(args)+1, len(args)+2)

	rows, err := db.Pool.Query(ctx, listQ, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]supplierSessionLogDTO, 0)
	for rows.Next() {
		var item supplierSessionLogDTO
		if scanErr := rows.Scan(
			&item.ID, &item.SessionType, &item.BrandID, &item.BrandName, &item.SupplierUserID,
			&item.SupplierEmail, &item.SupplierContactName, &item.SupplierIsOwner, &item.SupplierJobTitle,
			&item.AdminUserID, &item.AdminEmail, &item.AdminName, &item.AdminRole,
			&item.IPAddress, &item.UserAgent, &item.CreatedAt,
		); scanErr != nil {
			continue
		}
		items = append(items, item)
	}
	return items, total, nil
}

// ListSupplierAuditLogs handles GET /api/v1/admin/supplier-audit-logs.
func (h *SupplierImpersonationHandler) ListSupplierAuditLogs(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı bağlantısı hazır değil")
		return
	}

	params := parseSupplierAuditLogQuery(r)
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	_ = EnsureSupplierAuditSchema(ctx)

	summary := fetchSupplierAuditSummary(ctx, params.BrandID)

	var (
		items any
		total int
		err   error
	)
	if params.Tab == "sessions" {
		items, total, err = querySupplierSessionLogs(ctx, params)
	} else {
		items, total, err = queryProductAuditLogs(ctx, params)
	}
	if err != nil {
		log.Printf("[SUPPLIER AUDIT] Query failed (tab=%s): %v", params.Tab, err)
		httpx.Error(w, http.StatusInternalServerError, "Denetim logları yüklenemedi")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"type":    params.Tab,
		"items":   items,
		"total":   total,
		"limit":   params.Limit,
		"offset":  params.Offset,
		"summary": summary,
	})
}
