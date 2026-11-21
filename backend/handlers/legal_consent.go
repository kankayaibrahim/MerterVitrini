package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"

	"github.com/jackc/pgx/v5"
)

const (
	supplierContentDeclarationMsg = "Telif hakkı, marka ve hukuki sorumluluk beyanını onaylamadan ürün yükleyemez veya yayınlayamazsınız."
	supplierLegalAgreementMsg     = "Tedarikçi Üyelik, İçerik Sağlayıcı ve Fikri Mülkiyet Sorumluluk Sözleşmesi'ni onaylamanız gerekmektedir."
	customerTermsAgreementMsg     = "Üyelik, Kullanım ve Yer Sağlayıcı Çerçeve Sözleşmesi'ni kabul etmelisiniz."
)

type legalConsentLogEntry struct {
	ConsentType  string
	PolicyType   string
	ActorRole    string
	ActorUserID  string
	BrandID      string
	EntityType   string
	EntityID     string
	Email        string
	IPAddress    string
	UserAgent    string
	AcceptedText string
	Metadata     map[string]any
}

func isValidPolicyType(policyType string) bool {
	switch strings.TrimSpace(policyType) {
	case "cancellation_and_return", "terms_of_service", "privacy_policy", "supplier_agreement", "copyright_and_takedown":
		return true
	default:
		return false
	}
}

func parseConsentBoolFlag(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true", "1", "on", "yes", "evet":
		return true
	default:
		return false
	}
}

func validateSupplierContentDeclaration(accepted *bool) error {
	if accepted != nil && !*accepted {
		return errors.New(supplierContentDeclarationMsg)
	}
	return nil
}

func isExplicitlyAccepted(accepted *bool) bool {
	return accepted != nil && *accepted
}

func validateSupplierMultipartContentDeclaration(r *http.Request) (bool, error) {
	raw := strings.TrimSpace(r.FormValue("content_responsibility_accepted"))
	if raw == "" {
		return false, nil
	}
	if !parseConsentBoolFlag(raw) {
		return false, errors.New(supplierContentDeclarationMsg)
	}
	return true, nil
}

func resolveActivePolicyVersion(ctx context.Context, policyType string) int {
	if db.Pool == nil {
		return 1
	}
	var version int
	err := db.Pool.QueryRow(ctx, `
		SELECT policy_version
		FROM catalog.legal_policies
		WHERE policy_type = $1 AND is_active = true
		ORDER BY policy_version DESC
		LIMIT 1
	`, policyType).Scan(&version)
	if err != nil || version <= 0 {
		return 1
	}
	return version
}

func nullableTrimmedPtr(val string) *string {
	trimmed := strings.TrimSpace(val)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func computeConsentTextHash(acceptedText string) *string {
	trimmed := strings.TrimSpace(acceptedText)
	if trimmed == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(trimmed))
	encoded := hex.EncodeToString(sum[:])
	return &encoded
}

func recordLegalConsent(ctx context.Context, entry legalConsentLogEntry) int {
	version := resolveActivePolicyVersion(ctx, entry.PolicyType)
	if db.Pool == nil {
		return version
	}

	metaJSON := []byte("{}")
	if len(entry.Metadata) > 0 {
		if b, err := json.Marshal(entry.Metadata); err == nil {
			metaJSON = b
		}
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO catalog.legal_consent_logs (
			consent_type, policy_type, policy_version, actor_role,
			actor_user_id, brand_id, entity_type, entity_id,
			email, ip_address, user_agent, accepted_text_hash, metadata
		) VALUES (
			$1, $2, $3, $4,
			$5, NULLIF($6, '')::uuid, $7, $8,
			$9, $10, $11, $12, $13::jsonb
		)
	`,
		strings.TrimSpace(entry.ConsentType),
		strings.TrimSpace(entry.PolicyType),
		version,
		strings.TrimSpace(entry.ActorRole),
		nullableTrimmedPtr(entry.ActorUserID),
		strings.TrimSpace(entry.BrandID),
		nullableTrimmedPtr(entry.EntityType),
		nullableTrimmedPtr(entry.EntityID),
		nullableTrimmedPtr(strings.ToLower(strings.TrimSpace(entry.Email))),
		nullableTrimmedPtr(entry.IPAddress),
		nullableTrimmedPtr(entry.UserAgent),
		computeConsentTextHash(entry.AcceptedText),
		string(metaJSON),
	)
	if err != nil {
		log.Printf("[LEGAL CONSENT WARNING] Failed to persist consent log (%s): %v", entry.ConsentType, err)
	}
	return version
}

func recordLegalConsentAsync(entry legalConsentLogEntry) {
	safe.Go("Record Legal Consent "+entry.ConsentType, func() {
		recordLegalConsent(context.Background(), entry)
	})
}

func stampProductsContentResponsibilityTx(ctx context.Context, tx pgx.Tx, productIDs []string, accepted bool, version int) error {
	if !accepted || len(productIDs) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		UPDATE catalog.products
		SET content_responsibility_accepted = true,
			content_responsibility_accepted_at = COALESCE(content_responsibility_accepted_at, CURRENT_TIMESTAMP),
			content_responsibility_version = COALESCE(content_responsibility_version, $2)
		WHERE id = ANY($1::uuid[])
	`, productIDs, version)
	return err
}

func formatConsentEntityIDs(ids []string) string {
	clean := make([]string, 0, len(ids))
	for _, id := range ids {
		if trimmed := strings.TrimSpace(id); trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) == 0 {
		return ""
	}
	if len(clean) == 1 {
		return clean[0]
	}
	return clean[0] + " (+" + strconv.Itoa(len(clean)-1) + ")"
}
