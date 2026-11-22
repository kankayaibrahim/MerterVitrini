package handlers

import (
	"context"
	"crypto/hmac"
	"encoding/base64"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
	"mertervitrini/backend/pkg/tsa"
)

// AnchorSummary describes a single RFC 3161 sealed Merkle batch anchor.
type AnchorSummary struct {
	AnchorSeq       int64               `json:"anchor_seq"`
	ID              string              `json:"id"`
	SeqFrom         int64               `json:"seq_from"`
	SeqTo           int64               `json:"seq_to"`
	RecordCount     int                 `json:"record_count"`
	MerkleRoot      string              `json:"merkle_root"`
	PrevAnchorHash  string              `json:"prev_anchor_hash"`
	AnchorChainHash string              `json:"anchor_chain_hash"`
	TSAProvider     string              `json:"tsa_provider"`
	TSAURL          string              `json:"tsa_url"`
	TSAStatus       string              `json:"tsa_status"`
	TSAGenTimeUTC   string              `json:"tsa_gen_time_utc"`
	TSASerialHex    string              `json:"tsa_serial_hex"`
	TSAPolicyOID    string              `json:"tsa_policy_oid"`
	MerkleProof     []tsa.MerkleProofStep `json:"merkle_proof,omitempty"`
	ProofVerified   bool                `json:"proof_verified,omitempty"`
}

// LedgerIntegrityReport details full WORM chain, HMAC, snapshot, Merkle & RFC 3161 verification results.
type LedgerIntegrityReport struct {
	OverallValid     bool     `json:"overall_valid"`
	ChainValid       bool     `json:"chain_valid"`
	HMACValid        bool     `json:"hmac_valid"`
	SnapshotsValid   bool     `json:"snapshots_valid"`
	MerkleValid      bool     `json:"merkle_valid"`
	TSATokensValid   bool     `json:"tsa_tokens_valid"`
	WORMTriggersActive bool   `json:"worm_triggers_active"`
	TotalRecords     int64    `json:"total_records"`
	AnchoredRecords  int64    `json:"anchored_records"`
	UnanchoredRecords int64   `json:"unanchored_records"`
	TotalAnchors     int64    `json:"total_anchors"`
	HeadEntryHash    string   `json:"head_entry_hash"`
	Violations       []string `json:"violations"`
	VerifiedAtUTC    string   `json:"verified_at_utc"`
}

// StartConsentAnchorWorker runs periodic Merkle + RFC 3161 TSA timestamp sealing for unanchored consent records.
func StartConsentAnchorWorker(ctx context.Context, cfg *config.Config) {
	safe.Go("Consent RFC3161 Anchor Worker", func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		// Initial warmup delay so startup HTTP handling is immediate
		select {
		case <-ctx.Done():
			return
		case <-time.After(45 * time.Second):
		}
		runAnchorTickIfDue(ctx, cfg)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runAnchorTickIfDue(ctx, cfg)
			}
		}
	})
}

func runAnchorTickIfDue(parentCtx context.Context, cfg *config.Config) {
	if db.Pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(parentCtx, 25*time.Second)
	defer cancel()

	settings, err := loadConsentSettingsRow(ctx)
	if err != nil {
		return
	}
	intervalMin := settings.AutoAnchorIntervalMin
	if intervalMin < 1 {
		intervalMin = 15
	}

	var maxAnchoredSeq int64
	var lastAnchorAt *time.Time
	_ = db.Pool.QueryRow(ctx, `
		SELECT coalesce(max(seq_to), 0), max(created_at)
		FROM compliance.consent_merkle_anchors
	`).Scan(&maxAnchoredSeq, &lastAnchorAt)

	var unanchoredCount int64
	_ = db.Pool.QueryRow(ctx, `
		SELECT count(*)
		FROM compliance.consent_ledger
		WHERE seq_no > $1
	`, maxAnchoredSeq).Scan(&unanchoredCount)
	if unanchoredCount == 0 {
		return
	}

	if lastAnchorAt != nil && time.Since(*lastAnchorAt) < time.Duration(intervalMin)*time.Minute {
		return
	}

	res, anchorErr := anchorPendingRecords(ctx, cfg)
	if anchorErr != nil {
		log.Printf("[COMPLIANCE TSA WORKER WARNING] Failed to anchor pending consent records: %v", anchorErr)
		return
	}
	if res != nil && res.Anchored {
		log.Printf("[COMPLIANCE TSA] Anchored %d consent record(s) [seq %d..%d] via %s (root=%s)",
			res.RecordCount, res.SeqFrom, res.SeqTo, res.TSAProvider, res.MerkleRoot)
	}
}

type anchorRunResult struct {
	Anchored    bool   `json:"anchored"`
	Message     string `json:"message,omitempty"`
	AnchorSeq   int64  `json:"anchor_seq,omitempty"`
	SeqFrom     int64  `json:"seq_from,omitempty"`
	SeqTo       int64  `json:"seq_to,omitempty"`
	RecordCount int    `json:"record_count,omitempty"`
	MerkleRoot  string `json:"merkle_root,omitempty"`
	TSAProvider string `json:"tsa_provider,omitempty"`
	TSAURL      string `json:"tsa_url,omitempty"`
	TSAGenTime  string `json:"tsa_gen_time_utc,omitempty"`
	TSASerial   string `json:"tsa_serial_hex,omitempty"`
}

func anchorPendingRecords(ctx context.Context, _ *config.Config) (*anchorRunResult, error) {
	settings, err := loadConsentSettingsRow(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, consentAnchorLockKey); err != nil {
		return nil, err
	}

	prevAnchorHash := consentGenesisHash
	var maxAnchoredSeq int64
	err = tx.QueryRow(ctx, `
		SELECT coalesce(seq_to, 0), coalesce(anchor_chain_hash, $1)
		FROM compliance.consent_merkle_anchors
		ORDER BY anchor_seq DESC
		LIMIT 1
	`, consentGenesisHash).Scan(&maxAnchoredSeq, &prevAnchorHash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		SELECT seq_no, entry_hash
		FROM compliance.consent_ledger
		WHERE seq_no > $1
		ORDER BY seq_no ASC
		LIMIT 5000
	`, maxAnchoredSeq)
	if err != nil {
		return nil, err
	}

	var seqs []int64
	var hashes []string
	for rows.Next() {
		var s int64
		var h string
		if scanErr := rows.Scan(&s, &h); scanErr == nil {
			seqs = append(seqs, s)
			hashes = append(hashes, h)
		}
	}
	rows.Close()

	if len(hashes) == 0 {
		return &anchorRunResult{
			Anchored: false,
			Message:  "Tüm rıza kayıtları halihazırda RFC 3161 TSA ile mühürlenmiş durumda.",
		}, nil
	}

	merkleRoot, err := tsa.ComputeMerkleRoot(hashes)
	if err != nil {
		return nil, err
	}
	digestBytes, err := hex.DecodeString(merkleRoot)
	if err != nil {
		return nil, fmt.Errorf("invalid merkle root hex: %w", err)
	}

	endpoints := tsa.DefaultFreeTSAEndpoints(settings.TSAPrimaryURL, settings.TSAFallbackURLs)
	receipt, err := tsa.RequestTimestampWithFallback(ctx, digestBytes, endpoints)
	if err != nil {
		return nil, err
	}

	seqFrom := seqs[0]
	seqTo := seqs[len(seqs)-1]
	chainInput := fmt.Sprintf("%s|%s|%d|%d|%d|%s",
		prevAnchorHash, merkleRoot, seqFrom, seqTo, len(hashes), receipt.GenTimeUTC.UTC().Format(time.RFC3339Nano))
	anchorChainHash := sha256HexString(chainInput)

	var anchorSeq int64
	err = tx.QueryRow(ctx, `
		INSERT INTO compliance.consent_merkle_anchors (
			seq_from, seq_to, record_count, merkle_root, prev_anchor_hash, anchor_chain_hash,
			tsa_provider, tsa_url, tsa_status, tsa_gen_time_utc, tsa_serial_hex, tsa_policy_oid, tsa_token_base64
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12, $13
		)
		RETURNING anchor_seq
	`,
		seqFrom, seqTo, len(hashes), merkleRoot, prevAnchorHash, anchorChainHash,
		receipt.Provider, receipt.URL, receipt.StatusLabel, receipt.GenTimeUTC.UTC(),
		receipt.SerialHex, receipt.PolicyOID, receipt.TokenBase64,
	).Scan(&anchorSeq)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &anchorRunResult{
		Anchored:    true,
		AnchorSeq:   anchorSeq,
		SeqFrom:     seqFrom,
		SeqTo:       seqTo,
		RecordCount: len(hashes),
		MerkleRoot:  merkleRoot,
		TSAProvider: receipt.Provider,
		TSAURL:      receipt.URL,
		TSAGenTime:  receipt.GenTimeUTC.UTC().Format(time.RFC3339),
		TSASerial:   receipt.SerialHex,
	}, nil
}

func findAnchorForSeq(ctx context.Context, seqNo int64, leafHash string) (*AnchorSummary, error) {
	var (
		a         AnchorSummary
		genTime   *time.Time
		tokenB64  string
	)
	err := db.Pool.QueryRow(ctx, `
		SELECT anchor_seq, id::text, seq_from, seq_to, record_count, merkle_root,
		       prev_anchor_hash, anchor_chain_hash, tsa_provider, tsa_url, tsa_status,
		       tsa_gen_time_utc, coalesce(tsa_serial_hex, ''), coalesce(tsa_policy_oid, ''), tsa_token_base64
		FROM compliance.consent_merkle_anchors
		WHERE seq_from <= $1 AND seq_to >= $1
		LIMIT 1
	`, seqNo).Scan(
		&a.AnchorSeq, &a.ID, &a.SeqFrom, &a.SeqTo, &a.RecordCount, &a.MerkleRoot,
		&a.PrevAnchorHash, &a.AnchorChainHash, &a.TSAProvider, &a.TSAURL, &a.TSAStatus,
		&genTime, &a.TSASerialHex, &a.TSAPolicyOID, &tokenB64,
	)
	if err != nil {
		return nil, err
	}
	if genTime != nil {
		a.TSAGenTimeUTC = genTime.UTC().Format(time.RFC3339)
	}

	rows, qErr := db.Pool.Query(ctx, `
		SELECT seq_no, entry_hash
		FROM compliance.consent_ledger
		WHERE seq_no >= $1 AND seq_no <= $2
		ORDER BY seq_no ASC
	`, a.SeqFrom, a.SeqTo)
	if qErr == nil {
		defer rows.Close()
		var leaves []string
		targetIdx := -1
		idx := 0
		for rows.Next() {
			var s int64
			var h string
			if rows.Scan(&s, &h) == nil {
				leaves = append(leaves, h)
				if s == seqNo {
					targetIdx = idx
				}
				idx++
			}
		}
		if targetIdx >= 0 {
			if proof, pErr := tsa.BuildMerkleInclusionProof(leaves, targetIdx); pErr == nil {
				a.MerkleProof = proof
				a.ProofVerified = tsa.VerifyMerkleInclusionProof(leafHash, proof, a.MerkleRoot)
			}
		}
	}
	return &a, nil
}

// VerifyFullLedgerIntegrity validates every record hash link, HMAC, snapshot digest, WORM trigger, Merkle root & RFC 3161 TSA token.
func VerifyFullLedgerIntegrity(ctx context.Context, cfg *config.Config) (*LedgerIntegrityReport, error) {
	report := &LedgerIntegrityReport{
		OverallValid:   true,
		ChainValid:     true,
		HMACValid:      true,
		SnapshotsValid: true,
		MerkleValid:    true,
		TSATokensValid: true,
		Violations:     []string{},
		VerifiedAtUTC:  time.Now().UTC().Format(time.RFC3339),
	}

	hmacKey := deriveConsentHMACKey(cfg)

	var triggerCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.triggers
		WHERE event_object_schema = 'compliance'
		  AND event_object_table IN ('consent_ledger', 'consent_policy_snapshots', 'consent_merkle_anchors')
	`).Scan(&triggerCount)
	report.WORMTriggersActive = triggerCount >= 3

	rows, err := db.Pool.Query(ctx, `
		SELECT seq_no, consent_ref_id, canonical_payload, payload_sha256,
		       prev_hash, entry_hash, server_hmac_sha256, policy_snapshot_hash
		FROM compliance.consent_ledger
		ORDER BY seq_no ASC
	`)
	if err != nil {
		return nil, err
	}

	expectedPrevHash := consentGenesisHash
	seqHashes := make(map[int64]string)
	var seqList []int64

	for rows.Next() {
		var seqNo int64
		var refID, canonical, payloadSHA, prevHash, entryHash, serverHMAC, snapHash string
		if scanErr := rows.Scan(&seqNo, &refID, &canonical, &payloadSHA, &prevHash, &entryHash, &serverHMAC, &snapHash); scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		report.TotalRecords++
		seqHashes[seqNo] = entryHash
		seqList = append(seqList, seqNo)
		report.HeadEntryHash = entryHash

		actualPayloadSHA := sha256HexString(canonical)
		if !strings.EqualFold(actualPayloadSHA, payloadSHA) {
			report.ChainValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("seq=%d (%s): payload SHA-256 uyuşmazlığı", seqNo, refID))
		}
		if !strings.EqualFold(prevHash, expectedPrevHash) {
			report.ChainValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("seq=%d (%s): prev_hash kırılması", seqNo, refID))
		}
		actualEntryHash := computeChainEntryHash(prevHash, payloadSHA)
		if !strings.EqualFold(actualEntryHash, entryHash) {
			report.ChainValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("seq=%d (%s): entry_hash uyuşmazlığı", seqNo, refID))
		}
		expectedHMAC := computeConsentHMAC(hmacKey, entryHash)
		if !hmac.Equal([]byte(strings.ToLower(expectedHMAC)), []byte(strings.ToLower(serverHMAC))) {
			report.HMACValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("seq=%d (%s): server HMAC-SHA256 doğrulanamadı", seqNo, refID))
		}
		expectedPrevHash = entryHash
	}
	rows.Close()

	var missingSnapLinks int64
	_ = db.Pool.QueryRow(ctx, `
		SELECT count(*)
		FROM compliance.consent_ledger l
		LEFT JOIN compliance.consent_policy_snapshots s ON s.id = l.policy_snapshot_id
		WHERE s.id IS NULL OR s.content_sha256 <> l.policy_snapshot_hash
	`).Scan(&missingSnapLinks)
	if missingSnapLinks > 0 {
		report.SnapshotsValid = false
		report.Violations = append(report.Violations, fmt.Sprintf("%d kaydın politika anlık görüntü SHA-256 özeti uyuşmuyor", missingSnapLinks))
	}

	verifyAnchors(ctx, report, seqList, seqHashes)

	if !report.ChainValid || !report.HMACValid || !report.SnapshotsValid || !report.MerkleValid || !report.TSATokensValid || !report.WORMTriggersActive {
		report.OverallValid = false
		if !report.WORMTriggersActive {
			report.Violations = append(report.Violations, "WORM veritabanı tetikleyicileri eksik veya pasif")
		}
	}
	return report, nil
}

func verifyAnchors(ctx context.Context, report *LedgerIntegrityReport, seqList []int64, seqHashes map[int64]string) {
	anchorRows, err := db.Pool.Query(ctx, `
		SELECT anchor_seq, seq_from, seq_to, merkle_root, prev_anchor_hash, anchor_chain_hash, tsa_token_base64
		FROM compliance.consent_merkle_anchors
		ORDER BY anchor_seq ASC
	`)
	if err != nil {
		report.MerkleValid = false
		report.Violations = append(report.Violations, "TSA mühür tablosu okunamadı")
		return
	}
	defer anchorRows.Close()

	var maxAnchoredSeq int64
	expectedPrevAnchor := consentGenesisHash
	for anchorRows.Next() {
		var anchorSeq, seqFrom, seqTo int64
		var merkleRoot, prevAnchorHash, anchorChainHash, tokenB64 string
		if scanErr := anchorRows.Scan(&anchorSeq, &seqFrom, &seqTo, &merkleRoot, &prevAnchorHash, &anchorChainHash, &tokenB64); scanErr != nil {
			continue
		}
		report.TotalAnchors++
		if !strings.EqualFold(prevAnchorHash, expectedPrevAnchor) {
			report.MerkleValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("anchor=%d: prev_anchor_hash zincir hatası", anchorSeq))
		}
		expectedPrevAnchor = anchorChainHash

		var batchLeaves []string
		for _, s := range seqList {
			if s >= seqFrom && s <= seqTo {
				batchLeaves = append(batchLeaves, seqHashes[s])
			}
		}
		recomputedRoot, rootErr := tsa.ComputeMerkleRoot(batchLeaves)
		if rootErr != nil || !strings.EqualFold(recomputedRoot, merkleRoot) {
			report.MerkleValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("anchor=%d: Merkle kökü uyuşmuyor", anchorSeq))
		}

		tokenDER, b64Err := base64.StdEncoding.DecodeString(strings.TrimSpace(tokenB64))
		rootBytes, hexErr := hex.DecodeString(strings.TrimSpace(merkleRoot))
		if b64Err != nil || hexErr != nil {
			report.TSATokensValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("anchor=%d: TSA token base64 çözümlenemedi", anchorSeq))
		} else if _, parseErr := tsa.ParseAndVerifyTimeStampResponse(tokenDER, rootBytes, nil); parseErr != nil {
			report.TSATokensValid = false
			report.Violations = append(report.Violations, fmt.Sprintf("anchor=%d: RFC 3161 TSA mühür doğrulaması başarısız (%v)", anchorSeq, parseErr))
		}

		if seqTo > maxAnchoredSeq {
			maxAnchoredSeq = seqTo
		}
	}

	var anchoredCount int64
	for _, s := range seqList {
		if s <= maxAnchoredSeq {
			anchoredCount++
		}
	}
	report.AnchoredRecords = anchoredCount
	report.UnanchoredRecords = report.TotalRecords - anchoredCount
}

// GetAdminOverview returns dashboard KPIs, anchor summaries and recent action breakdown.
func (h *ConsentComplianceHandler) GetAdminOverview(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	settings, _ := loadConsentSettingsRow(ctx)

	var totalRecords, totalAnchors, maxAnchoredSeq, cookieCount int64
	_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM compliance.consent_ledger`).Scan(&totalRecords)
	_ = db.Pool.QueryRow(ctx, `SELECT count(*), coalesce(max(seq_to), 0) FROM compliance.consent_merkle_anchors`).Scan(&totalAnchors, &maxAnchoredSeq)
	_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM compliance.cookie_inventory WHERE is_active = true`).Scan(&cookieCount)

	var unanchoredRecords int64
	_ = db.Pool.QueryRow(ctx, `SELECT count(*) FROM compliance.consent_ledger WHERE seq_no > $1`, maxAnchoredSeq).Scan(&unanchoredRecords)

	var acceptAllCount, rejectAllCount, customCount, withdrawCount int64
	actionRows, err := db.Pool.Query(ctx, `SELECT action, count(*) FROM compliance.consent_ledger GROUP BY action`)
	if err == nil {
		for actionRows.Next() {
			var act string
			var cnt int64
			if actionRows.Scan(&act, &cnt) == nil {
				switch act {
				case "accept_all":
					acceptAllCount = cnt
				case "reject_all":
					rejectAllCount = cnt
				case "custom":
					customCount = cnt
				case "withdraw":
					withdrawCount = cnt
				}
			}
		}
		actionRows.Close()
	}

	recentAnchors := queryRecentAnchors(ctx, 10)
	latestIntegrity, _ := VerifyFullLedgerIntegrity(ctx, h.Cfg)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"settings": settings,
		"stats": map[string]any{
			"total_records":      totalRecords,
			"anchored_records":   totalRecords - unanchoredRecords,
			"unanchored_records": unanchoredRecords,
			"total_anchors":      totalAnchors,
			"active_cookies":     cookieCount,
			"accept_all_count":   acceptAllCount,
			"reject_all_count":   rejectAllCount,
			"custom_count":       customCount,
			"withdraw_count":     withdrawCount,
		},
		"integrity":      latestIntegrity,
		"recent_anchors": recentAnchors,
	})
}

func queryRecentAnchors(ctx context.Context, limit int) []AnchorSummary {
	rows, err := db.Pool.Query(ctx, `
		SELECT anchor_seq, id::text, seq_from, seq_to, record_count, merkle_root,
		       prev_anchor_hash, anchor_chain_hash, tsa_provider, tsa_url, tsa_status,
		       tsa_gen_time_utc, coalesce(tsa_serial_hex, ''), coalesce(tsa_policy_oid, '')
		FROM compliance.consent_merkle_anchors
		ORDER BY anchor_seq DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return []AnchorSummary{}
	}
	defer rows.Close()

	var anchors []AnchorSummary
	for rows.Next() {
		var a AnchorSummary
		var genTime *time.Time
		if rows.Scan(
			&a.AnchorSeq, &a.ID, &a.SeqFrom, &a.SeqTo, &a.RecordCount, &a.MerkleRoot,
			&a.PrevAnchorHash, &a.AnchorChainHash, &a.TSAProvider, &a.TSAURL, &a.TSAStatus,
			&genTime, &a.TSASerialHex, &a.TSAPolicyOID,
		) == nil {
			if genTime != nil {
				a.TSAGenTimeUTC = genTime.UTC().Format(time.RFC3339)
			}
			anchors = append(anchors, a)
		}
	}
	if anchors == nil {
		anchors = []AnchorSummary{}
	}
	return anchors
}

// ListAdminRecords paginates and filters immutable consent ledger entries for admin review.
func (h *ConsentComplianceHandler) ListAdminRecords(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	search := strings.TrimSpace(q.Get("search"))
	action := strings.TrimSpace(q.Get("action"))
	lang := strings.TrimSpace(q.Get("language"))

	var clauses []string
	var args []any
	argIdx := 1

	if search != "" {
		clauses = append(clauses, fmt.Sprintf("(consent_ref_id ILIKE $%d OR subject_id ILIKE $%d OR coalesce(ip_masked,'') ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if action != "" {
		clauses = append(clauses, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, action)
		argIdx++
	}
	if lang != "" {
		clauses = append(clauses, fmt.Sprintf("language = $%d", argIdx))
		args = append(args, lang)
		argIdx++
	}

	whereSQL := ""
	if len(clauses) > 0 {
		whereSQL = " WHERE " + strings.Join(clauses, " AND ")
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var total int64
	countQuery := "SELECT count(*) FROM compliance.consent_ledger" + whereSQL
	if err := db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kayıt sayısı alınamadı")
		return
	}

	var maxAnchoredSeq int64
	_ = db.Pool.QueryRow(ctx, `SELECT coalesce(max(seq_to), 0) FROM compliance.consent_merkle_anchors`).Scan(&maxAnchoredSeq)

	listQuery := fmt.Sprintf(`
		SELECT seq_no, id::text, consent_ref_id, subject_id, action, model, ui_source,
		       given_consents, policy_snapshot_hash, language, coalesce(country_code, ''),
		       coalesce(ip_masked, ''), entry_hash, prev_hash, gpc_signal,
		       to_char(recorded_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM compliance.consent_ledger %s
		ORDER BY seq_no DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, listQuery, args...)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza kayıtları yüklenemedi")
		return
	}
	defer rows.Close()

	var items []map[string]any
	for rows.Next() {
		var (
			seqNo                                                                     int64
			id, refID, subjectID, actionStr, model, uiSource, snapHash, l, cc, ipM, eH, pH, recAt string
			gpc                                                                       bool
			givenRaw                                                                  []byte
		)
		if rows.Scan(&seqNo, &id, &refID, &subjectID, &actionStr, &model, &uiSource, &givenRaw, &snapHash, &l, &cc, &ipM, &eH, &pH, &gpc, &recAt) == nil {
			var choices ConsentChoices
			_ = json.Unmarshal(givenRaw, &choices)
			items = append(items, map[string]any{
				"seq_no":               seqNo,
				"id":                   id,
				"consent_ref_id":       refID,
				"subject_id":           subjectID,
				"action":               actionStr,
				"model":                model,
				"ui_source":            uiSource,
				"consents":             choices,
				"policy_snapshot_hash": snapHash,
				"language":             l,
				"country_code":         cc,
				"ip_masked":            ipM,
				"entry_hash":           eH,
				"prev_hash":            pH,
				"gpc_signal":           gpc,
				"anchored":             seqNo <= maxAnchoredSeq,
				"recorded_at_utc":      recAt,
			})
		}
	}
	if items == nil {
		items = []map[string]any{}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"records": items,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

// GetEvidencePack returns the complete court/bilirkişi offline-verifiable forensic evidence JSON for one record.
func (h *ConsentComplianceHandler) GetEvidencePack(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	idOrRef := strings.TrimSpace(r.PathValue("id"))
	if idOrRef == "" {
		httpx.Error(w, http.StatusBadRequest, "Kayıt kimliği gerekli")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	var (
		seqNo, policyVer                                                       int64
		id, refID, subjectID, visitorID, userID, userEmailHash, supersedesID   string
		action, model, uiSource, snapID, snapHash, lang, cc, ipM, ipH, uaH     string
		pageURL, tcf, addtl, canonical, payloadSHA, prevHash, entryHash, sHMAC string
		gpc                                                                    bool
		recordedAt                                                             time.Time
		givenRaw, cmRaw, bannerCopyRaw, invSnapRaw                             []byte
		legalPolicyText                                                        string
	)
	err := db.Pool.QueryRow(ctx, `
		SELECT l.seq_no, l.id::text, l.consent_ref_id, l.subject_id, coalesce(l.visitor_id,''),
		       coalesce(l.user_id,''), coalesce(l.user_email_hash,''), coalesce(l.supersedes_consent_id::text,''),
		       l.action, l.model, l.ui_source, l.given_consents, l.google_consent_mode,
		       coalesce(l.tcf_tc_string,''), coalesce(l.addtl_consent,''), l.gpc_signal,
		       l.policy_snapshot_id::text, l.policy_snapshot_hash, l.language, coalesce(l.country_code,''),
		       coalesce(l.ip_masked,''), coalesce(l.ip_hash_sha256,''), coalesce(l.user_agent_hash,''),
		       coalesce(l.page_url,''), l.canonical_payload, l.payload_sha256, l.prev_hash, l.entry_hash,
		       l.server_hmac_sha256, l.recorded_at_utc,
		       s.policy_version, s.banner_copy, s.cookie_inventory_snapshot, s.legal_policy_text
		FROM compliance.consent_ledger l
		JOIN compliance.consent_policy_snapshots s ON s.id = l.policy_snapshot_id
		WHERE l.id::text = $1 OR l.consent_ref_id = $1
		LIMIT 1
	`, idOrRef).Scan(
		&seqNo, &id, &refID, &subjectID, &visitorID,
		&userID, &userEmailHash, &supersedesID,
		&action, &model, &uiSource, &givenRaw, &cmRaw,
		&tcf, &addtl, &gpc,
		&snapID, &snapHash, &lang, &cc,
		&ipM, &ipH, &uaH,
		&pageURL, &canonical, &payloadSHA, &prevHash, &entryHash,
		&sHMAC, &recordedAt,
		&policyVer, &bannerCopyRaw, &invSnapRaw, &legalPolicyText,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Kanıt kaydı bulunamadı")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Kanıt paketi okunamadı")
		return
	}

	var choices ConsentChoices
	var cm GoogleConsentModeState
	var bannerCopy any
	var invSnap any
	_ = json.Unmarshal(givenRaw, &choices)
	_ = json.Unmarshal(cmRaw, &cm)
	_ = json.Unmarshal(bannerCopyRaw, &bannerCopy)
	_ = json.Unmarshal(invSnapRaw, &invSnap)

	recomputedPayloadSHA := sha256HexString(canonical)
	recomputedEntryHash := computeChainEntryHash(prevHash, recomputedPayloadSHA)
	hmacValid := hmac.Equal([]byte(strings.ToLower(computeConsentHMAC(deriveConsentHMACKey(h.Cfg), entryHash))), []byte(strings.ToLower(sHMAC)))

	anchorSummary, _ := findAnchorForSeq(ctx, seqNo, entryHash)
	var tokenB64 string
	var opensslVerifyCmd, opensslInspectCmd string
	if anchorSummary != nil {
		_ = db.Pool.QueryRow(ctx, `SELECT tsa_token_base64 FROM compliance.consent_merkle_anchors WHERE anchor_seq = $1`, anchorSummary.AnchorSeq).Scan(&tokenB64)
		opensslInspectCmd = fmt.Sprintf("base64 -d anchor_%d.b64 > anchor_%d.tsr && openssl ts -reply -in anchor_%d.tsr -text", anchorSummary.AnchorSeq, anchorSummary.AnchorSeq, anchorSummary.AnchorSeq)
		opensslVerifyCmd = fmt.Sprintf("openssl ts -verify -in anchor_%d.tsr -digest %s -CAfile <TSA_ROOT_CA.pem>", anchorSummary.AnchorSeq, anchorSummary.MerkleRoot)
	}

	pack := map[string]any{
		"package_format":  "mertervitrini-kvkk-forensic-evidence-v1",
		"generated_at_utc": time.Now().UTC().Format(time.RFC3339),
		"legal_notice":    "Bu dosya 5070 sayılı kanun kapsamında e-imza taşımadan dahi değiştirilemezlik (WORM DB + SHA-256 hash zinciri + bağımsız RFC 3161 TSA Merkle mührü) ispatı sunan teknik bilirkişi inceleme paketidir.",
		"record": map[string]any{
			"seq_no":                seqNo,
			"id":                    id,
			"consent_ref_id":        refID,
			"subject_id":            subjectID,
			"visitor_id":            visitorID,
			"user_id":               userID,
			"user_email_hash":       userEmailHash,
			"supersedes_consent_id": supersedesID,
			"action":                action,
			"model":                 model,
			"ui_source":             uiSource,
			"consents":              choices,
			"google_consent_mode":   cm,
			"tcf_tc_string":         tcf,
			"addtl_consent":         addtl,
			"gpc_signal":            gpc,
			"language":              lang,
			"country_code":          cc,
			"ip_masked":             ipM,
			"ip_hash_sha256":        ipH,
			"user_agent_hash":       uaH,
			"page_url":              pageURL,
			"recorded_at_utc":       recordedAt.UTC().Format(time.RFC3339Nano),
			"canonical_payload":     canonical,
			"payload_sha256":        payloadSHA,
			"prev_hash":             prevHash,
			"entry_hash":            entryHash,
			"server_hmac_sha256":    sHMAC,
		},
		"cryptographic_self_check": map[string]any{
			"payload_sha256_match": strings.EqualFold(recomputedPayloadSHA, payloadSHA),
			"entry_hash_match":     strings.EqualFold(recomputedEntryHash, entryHash),
			"server_hmac_valid":    hmacValid,
			"entry_hash_formula":   "SHA256(prev_hash + '|' + payload_sha256)",
		},
		"policy_snapshot": map[string]any{
			"id":                        snapID,
			"content_sha256":            snapHash,
			"policy_version":            policyVer,
			"language":                  lang,
			"banner_copy":               bannerCopy,
			"cookie_inventory_snapshot": invSnap,
			"legal_policy_text":         legalPolicyText,
		},
		"merkle_anchor": anchorSummary,
		"tsa_token_base64": tokenB64,
		"offline_verification_commands": map[string]string{
			"step_1_payload_hash":  "printf '%s' '<canonical_payload>' | sha256sum  # payload_sha256 ile birebir eşleşmelidir",
			"step_2_entry_hash":    fmt.Sprintf("printf '%%s|%%s' '%s' '%s' | sha256sum  # entry_hash=%s olmalıdır", prevHash, payloadSHA, entryHash),
			"step_3_tsa_inspect":   opensslInspectCmd,
			"step_4_tsa_verify":    opensslVerifyCmd,
			"merkle_pair_formula":  "SHA256(left_hex + '|' + right_hex)",
		},
	}

	if r.URL.Query().Get("download") == "1" {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="kanit-paketi-%s.json"`, refID))
	}
	httpx.JSON(w, http.StatusOK, pack)
}

// ExportRecords downloads consent ledger entries as JSON or formula-injection-safe CSV.
func (h *ConsentComplianceHandler) ExportRecords(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format == "" {
		format = "csv"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT seq_no, consent_ref_id, subject_id, action, model, ui_source, language,
		       coalesce(country_code,''), coalesce(ip_masked,''), given_consents,
		       policy_snapshot_hash, prev_hash, entry_hash,
		       to_char(recorded_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM compliance.consent_ledger
		ORDER BY seq_no ASC
		LIMIT 10000
	`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Dışa aktarım verisi okunamadı")
		return
	}
	defer rows.Close()

	if format == "json" {
		var list []map[string]any
		for rows.Next() {
			var (
				seqNo                                                              int64
				refID, subID, act, mdl, src, l, cc, ipM, snapH, prevH, entryH, rec string
				given                                                              []byte
			)
			if rows.Scan(&seqNo, &refID, &subID, &act, &mdl, &src, &l, &cc, &ipM, &given, &snapH, &prevH, &entryH, &rec) == nil {
				var ch ConsentChoices
				_ = json.Unmarshal(given, &ch)
				list = append(list, map[string]any{
					"seq_no": seqNo, "consent_ref_id": refID, "subject_id": subID, "action": act,
					"model": mdl, "ui_source": src, "language": l, "country_code": cc, "ip_masked": ipM,
					"consents": ch, "policy_snapshot_hash": snapH, "prev_hash": prevH, "entry_hash": entryH,
					"recorded_at_utc": rec,
				})
			}
		}
		w.Header().Set("Content-Disposition", `attachment; filename="consent-ledger-export.json"`)
		httpx.JSON(w, http.StatusOK, list)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="consent-ledger-export.csv"`)
	_, _ = w.Write([]byte("\xEF\xBB\xBF"))
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{
		"seq_no", "consent_ref_id", "subject_id", "action", "model", "ui_source",
		"language", "country_code", "ip_masked", "necessary", "functionality",
		"experience", "measurement", "marketing", "policy_snapshot_hash", "prev_hash", "entry_hash", "recorded_at_utc",
	})
	for rows.Next() {
		var (
			seqNo                                                              int64
			refID, subID, act, mdl, src, l, cc, ipM, snapH, prevH, entryH, rec string
			given                                                              []byte
		)
		if rows.Scan(&seqNo, &refID, &subID, &act, &mdl, &src, &l, &cc, &ipM, &given, &snapH, &prevH, &entryH, &rec) == nil {
			var ch ConsentChoices
			_ = json.Unmarshal(given, &ch)
			_ = cw.Write([]string{
				strconv.FormatInt(seqNo, 10),
				sanitizeCSVCell(refID), sanitizeCSVCell(subID), sanitizeCSVCell(act), sanitizeCSVCell(mdl),
				sanitizeCSVCell(src), sanitizeCSVCell(l), sanitizeCSVCell(cc), sanitizeCSVCell(ipM),
				strconv.FormatBool(ch.Necessary), strconv.FormatBool(ch.Functionality), strconv.FormatBool(ch.Experience),
				strconv.FormatBool(ch.Measurement), strconv.FormatBool(ch.Marketing),
				snapH, prevH, entryHashOrDefault(entryH), rec,
			})
		}
	}
	cw.Flush()
}

func entryHashOrDefault(h string) string {
	return h
}

func sanitizeCSVCell(val string) string {
	if val == "" {
		return ""
	}
	first := val[0]
	if first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r' {
		return "'" + val
	}
	return val
}

// HandleAdminAnchorNow manually seals all currently unanchored records via Merkle tree + RFC 3161 TSA.
func (h *ConsentComplianceHandler) HandleAdminAnchorNow(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	res, err := anchorPendingRecords(ctx, h.Cfg)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, fmt.Sprintf("RFC 3161 TSA mühürleme başarısız: %v", err))
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// HandleAdminVerifyIntegrity runs a complete cryptographic audit across all ledger rows, snapshots & TSA tokens.
func (h *ConsentComplianceHandler) HandleAdminVerifyIntegrity(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	report, err := VerifyFullLedgerIntegrity(ctx, h.Cfg)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Bütünlük denetimi çalıştırılamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, report)
}

// ListAdminAnchors lists all sealed RFC 3161 Merkle anchors.
func (h *ConsentComplianceHandler) ListAdminAnchors(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"anchors": queryRecentAnchors(ctx, 100),
	})
}

// DownloadAnchorTSR serves the raw ASN.1 DER RFC 3161 .tsr file for independent offline OpenSSL verification.
func (h *ConsentComplianceHandler) DownloadAnchorTSR(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	idOrSeq := strings.TrimSpace(r.PathValue("id"))
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var anchorSeq int64
	var tokenB64 string
	err := db.Pool.QueryRow(ctx, `
		SELECT anchor_seq, tsa_token_base64
		FROM compliance.consent_merkle_anchors
		WHERE id::text = $1 OR anchor_seq::text = $1
		LIMIT 1
	`, idOrSeq).Scan(&anchorSeq, &tokenB64)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "TSA mühür dosyası bulunamadı")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "TSA mühür dosyası okunamadı")
		return
	}

	rawDER, decErr := base64.StdEncoding.DecodeString(strings.TrimSpace(tokenB64))
	if decErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "TSA token çözümlenemedi")
		return
	}

	w.Header().Set("Content-Type", "application/timestamp-reply")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="consent-anchor-%d.tsr"`, anchorSeq))
	_, _ = w.Write(rawDER)
}
