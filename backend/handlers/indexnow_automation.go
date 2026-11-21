package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpx"
	"mertervitrini/backend/pkg/safe"
)

const (
	indexNowProductsPerChunk    = 1250 // 1,250 products * 8 locales = 10,000 URLs (IndexNow chunk max)
	indexNowSweepInterval       = 10 * time.Minute
	indexNowStartupDelay        = 20 * time.Second
	indexNowSweepTranslateLimit = 100
	indexNowChunkPause          = 1500 * time.Millisecond
)

const indexNowProductReadyClause = `
	p.is_active = true
	AND COALESCE(p.is_archived, false) = false
	AND p.slug IS NOT NULL
	AND p.slug != ''
	AND NOT EXISTS (
		SELECT 1
		FROM catalog.languages l
		LEFT JOIN catalog.product_translations pt
		  ON pt.product_id = p.id
		 AND (pt.language_code = l.code OR pt.language_code = LEFT(l.code, 2))
		WHERE l.is_active = true
		  AND l.code NOT IN ('tr', 'tr_TR')
		  AND (
			  pt.product_id IS NULL
			  OR COALESCE(pt.title, '') = ''
			  OR (COALESCE(p.description, '') != '' AND COALESCE(pt.description, '') = '')
		  )
	)`

var (
	indexNowAllLangs = []string{"tr", "en", "ru", "ar", "de", "fr", "pl", "bg"}

	indexNowStaticSubRoutes = []string{
		"",
		"tum-urunler",
		"b2b",
		"faq",
		"contact",
		"tedarikci-basvuru",
		"site-haritasi",
		"blog",
	}

	indexNowStandalonePaths = []string{
		"/ureticiler",
		"/alim-talepleri",
		"/hizmet-saglayicilar",
		"/mobil-uygulama",
	}

	indexNowDefaultCMSSlugs = []string{
		"hakkimizda",
		"gizlilik-politikasi",
		"mesafeli-satis-sozlesmesi",
		"iptal-iade-kosullari",
	}

	mvRefreshMu sync.Mutex

	indexNowFlushMu      sync.Mutex
	indexNowFlushRunning bool

	indexNowBackfillMu      sync.Mutex
	indexNowBackfillRunning bool
)

type indexNowProductRef struct {
	ID   string
	Slug string
}

type indexNowCategoryNode struct {
	ID       string
	ParentID string
	Slug     string
}

type indexNowBlogRow struct {
	ID         string
	BaseSlug   string
	SlugsByLng map[string]string
}

// IndexNowFlushResult summarizes a batched IndexNow flush of unnotified translation-ready products.
type IndexNowFlushResult struct {
	ProductsSubmitted int
	URLsSubmitted     int
	ChunksSucceeded   int
	ChunksFailed      int
	SkippedDev        bool
	LastError         string
}

type indexNowAutomationStateRow struct {
	AutoEnabled                 bool
	InitialBackfillCompletedAt  *time.Time
	InitialBackfillStatus       string
	LastSweepAt                 *time.Time
}

func refreshCatalogMV(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	mvRefreshMu.Lock()
	defer mvRefreshMu.Unlock()

	refreshCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(refreshCtx, "REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products")
	return err
}

func isIndexNowBackfillOrFlushRunning() bool {
	indexNowBackfillMu.Lock()
	bRunning := indexNowBackfillRunning
	indexNowBackfillMu.Unlock()

	indexNowFlushMu.Lock()
	fRunning := indexNowFlushRunning
	indexNowFlushMu.Unlock()
	return bRunning || fRunning
}

func acquireFlushLock() bool {
	indexNowFlushMu.Lock()
	defer indexNowFlushMu.Unlock()
	if indexNowFlushRunning {
		return false
	}
	indexNowFlushRunning = true
	return true
}

func releaseFlushLock() {
	indexNowFlushMu.Lock()
	indexNowFlushRunning = false
	indexNowFlushMu.Unlock()
}

func acquireBackfillLock() bool {
	indexNowBackfillMu.Lock()
	defer indexNowBackfillMu.Unlock()
	if indexNowBackfillRunning {
		return false
	}
	indexNowBackfillRunning = true
	return true
}

func releaseBackfillLock() {
	indexNowBackfillMu.Lock()
	indexNowBackfillRunning = false
	indexNowBackfillMu.Unlock()
}

func chunkProductRefs(items []indexNowProductRef, maxPerChunk int) [][]indexNowProductRef {
	if len(items) == 0 {
		return nil
	}
	if maxPerChunk <= 0 {
		maxPerChunk = indexNowProductsPerChunk
	}
	chunks := make([][]indexNowProductRef, 0, (len(items)+maxPerChunk-1)/maxPerChunk)
	for start := 0; start < len(items); start += maxPerChunk {
		end := start + maxPerChunk
		if end > len(items) {
			end = len(items)
		}
		chunks = append(chunks, items[start:end])
	}
	return chunks
}

func extractProductRefIDsAndSlugs(refs []indexNowProductRef) ([]string, []string) {
	ids := make([]string, 0, len(refs))
	slugs := make([]string, 0, len(refs))
	for _, item := range refs {
		if strings.TrimSpace(item.ID) != "" {
			ids = append(ids, item.ID)
		}
		if strings.TrimSpace(item.Slug) != "" {
			slugs = append(slugs, item.Slug)
		}
	}
	return ids, slugs
}

func markProductsIndexNowNotified(ctx context.Context, productIDs []string) error {
	if db.Pool == nil {
		return nil
	}
	cleanIDs := dedupeNonEmptyStrings(productIDs)
	if len(cleanIDs) == 0 {
		return nil
	}
	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.products
		SET indexnow_notified_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1::uuid[])`, cleanIDs)
	return err
}

func filterTranslationCompleteProductRefs(ctx context.Context, productIDs []string) ([]indexNowProductRef, error) {
	if db.Pool == nil {
		return nil, nil
	}
	cleanIDs := dedupeNonEmptyStrings(productIDs)
	if len(cleanIDs) == 0 {
		return nil, nil
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT p.id::text, p.slug
		FROM catalog.products p
		WHERE p.id = ANY($1::uuid[])
		  AND `+indexNowProductReadyClause+`
		ORDER BY p.created_at DESC`, cleanIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var refs []indexNowProductRef
	for rows.Next() {
		var r indexNowProductRef
		if scanErr := rows.Scan(&r.ID, &r.Slug); scanErr == nil {
			refs = append(refs, r)
		}
	}
	return refs, rows.Err()
}

func loadReadyUnnotifiedProductRefs(ctx context.Context) ([]indexNowProductRef, error) {
	if db.Pool == nil {
		return nil, nil
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id::text, p.slug
		FROM catalog.products p
		WHERE p.indexnow_notified_at IS NULL
		  AND `+indexNowProductReadyClause+`
		ORDER BY p.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var refs []indexNowProductRef
	for rows.Next() {
		var r indexNowProductRef
		if scanErr := rows.Scan(&r.ID, &r.Slug); scanErr == nil {
			refs = append(refs, r)
		}
	}
	return refs, rows.Err()
}

func loadWaitingTranslationProductIDs(ctx context.Context, limit int) ([]string, error) {
	if db.Pool == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = indexNowSweepTranslateLimit
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id::text
		FROM catalog.products p
		WHERE p.indexnow_notified_at IS NULL
		  AND p.is_active = true
		  AND COALESCE(p.is_archived, false) = false
		  AND p.slug IS NOT NULL
		  AND p.slug != ''
		  AND NOT (`+indexNowProductReadyClause+`)
		ORDER BY p.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if scanErr := rows.Scan(&id); scanErr == nil && strings.TrimSpace(id) != "" {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

func buildCategorySlugTrail(startID string, nodeMap map[string]indexNowCategoryNode) string {
	visited := make(map[string]bool)
	var parts []string
	currID := strings.TrimSpace(startID)
	for currID != "" && !visited[currID] {
		visited[currID] = true
		node, ok := nodeMap[currID]
		if !ok || strings.TrimSpace(node.Slug) == "" {
			break
		}
		parts = append(parts, strings.Trim(strings.TrimSpace(node.Slug), "/"))
		currID = strings.TrimSpace(node.ParentID)
	}
	if len(parts) == 0 {
		return ""
	}
	for left, right := 0, len(parts)-1; left < right; left, right = left+1, right-1 {
		parts[left], parts[right] = parts[right], parts[left]
	}
	return strings.Join(parts, "/")
}

// BuildCategoryTrailURLs builds 8-language storefront URLs for active category hierarchies.
func BuildCategoryTrailURLs(categories []indexNowCategoryNode) []string {
	if len(categories) == 0 {
		return nil
	}
	nodeMap := make(map[string]indexNowCategoryNode, len(categories))
	for _, cat := range categories {
		if strings.TrimSpace(cat.ID) != "" {
			nodeMap[cat.ID] = cat
		}
	}

	urls := make([]string, 0, len(categories)*len(indexNowAllLangs))
	for _, cat := range categories {
		trail := buildCategorySlugTrail(cat.ID, nodeMap)
		if trail == "" {
			continue
		}
		for _, lang := range indexNowAllLangs {
			urls = append(urls, fmt.Sprintf("%s/%s/%s", siteBaseURL, lang, trail))
		}
	}
	return urls
}

// BuildBrandIndexNowURLs builds showcase and editorial profile URLs across all 8 SEO languages.
func BuildBrandIndexNowURLs(brandSlugs []string) []string {
	cleanSlugs := dedupeNonEmptyStrings(brandSlugs)
	if len(cleanSlugs) == 0 {
		return nil
	}
	urls := make([]string, 0, len(cleanSlugs)*2*len(indexNowAllLangs))
	for _, slug := range cleanSlugs {
		escaped := url.PathEscape(strings.Trim(slug, "/"))
		for _, suffix := range []string{"", "/tanitim"} {
			base := fmt.Sprintf("%s/ureticiler/%s%s", siteBaseURL, escaped, suffix)
			urls = append(urls, base)
			for _, lang := range indexNowSEOLangs {
				urls = append(urls, base+"?lang="+lang)
			}
		}
	}
	return urls
}

// BuildBlogIndexNowURLs builds 8-language blog URLs respecting localized slugs where available.
func BuildBlogIndexNowURLs(posts []indexNowBlogRow) []string {
	if len(posts) == 0 {
		return nil
	}
	urls := make([]string, 0, len(posts)*len(indexNowAllLangs))
	for _, post := range posts {
		for _, lang := range indexNowAllLangs {
			localizedSlug := strings.TrimSpace(post.SlugsByLng[lang])
			if localizedSlug == "" {
				localizedSlug = strings.TrimSpace(post.SlugsByLng["en"])
			}
			if localizedSlug == "" {
				localizedSlug = strings.TrimSpace(post.SlugsByLng["tr"])
			}
			if localizedSlug == "" {
				localizedSlug = strings.TrimSpace(post.BaseSlug)
			}
			if localizedSlug == "" {
				continue
			}
			urls = append(urls, fmt.Sprintf("%s/%s/blog/%s", siteBaseURL, lang, url.PathEscape(strings.Trim(localizedSlug, "/"))))
		}
	}
	return urls
}

// BuildStaticAndCMSIndexNowURLs builds root, directory, and CMS page URLs across all 8 SEO languages.
func BuildStaticAndCMSIndexNowURLs(cmsSlugs []string) []string {
	urls := []string{siteBaseURL}

	for _, sub := range indexNowStaticSubRoutes {
		for _, lang := range indexNowAllLangs {
			if sub == "" {
				urls = append(urls, fmt.Sprintf("%s/%s", siteBaseURL, lang))
			} else {
				urls = append(urls, fmt.Sprintf("%s/%s/%s", siteBaseURL, lang, sub))
			}
		}
	}

	for _, p := range indexNowStandalonePaths {
		base := siteBaseURL + p
		urls = append(urls, base)
		for _, lang := range indexNowSEOLangs {
			urls = append(urls, base+"?lang="+lang)
		}
	}

	allCMSSlugs := append([]string(nil), indexNowDefaultCMSSlugs...)
	allCMSSlugs = append(allCMSSlugs, cmsSlugs...)
	for _, slug := range dedupeNonEmptyStrings(allCMSSlugs) {
		escaped := url.PathEscape(strings.Trim(slug, "/"))
		for _, lang := range indexNowAllLangs {
			urls = append(urls, fmt.Sprintf("%s/%s/pages/%s", siteBaseURL, lang, escaped))
		}
	}
	return urls
}

func queryActiveCategoryNodes(ctx context.Context) ([]indexNowCategoryNode, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, COALESCE(parent_id::text, ''), COALESCE(slug, '')
		FROM catalog.categories
		WHERE is_active = true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []indexNowCategoryNode
	for rows.Next() {
		var n indexNowCategoryNode
		if scanErr := rows.Scan(&n.ID, &n.ParentID, &n.Slug); scanErr == nil && strings.TrimSpace(n.Slug) != "" {
			nodes = append(nodes, n)
		}
	}
	return nodes, rows.Err()
}

func queryActiveBrandSlugs(ctx context.Context) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT slug
		FROM catalog.brands
		WHERE is_active = true AND slug IS NOT NULL AND slug != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var s string
		if scanErr := rows.Scan(&s); scanErr == nil && strings.TrimSpace(s) != "" {
			slugs = append(slugs, s)
		}
	}
	return slugs, rows.Err()
}

func queryActiveBlogRows(ctx context.Context) ([]indexNowBlogRow, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT b.id::text, COALESCE(b.slug, ''), COALESCE(t.language_code, ''), COALESCE(t.slug, b.slug)
		FROM catalog.blog_posts b
		LEFT JOIN catalog.blog_post_translations t ON t.post_id = b.id
		WHERE b.is_active = true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[string]*indexNowBlogRow)
	var list []indexNowBlogRow
	for rows.Next() {
		var id, baseSlug, langCode, transSlug string
		if scanErr := rows.Scan(&id, &baseSlug, &langCode, &transSlug); scanErr != nil {
			continue
		}
		item, exists := byID[id]
		if !exists {
			item = &indexNowBlogRow{
				ID:         id,
				BaseSlug:   baseSlug,
				SlugsByLng: make(map[string]string),
			}
			byID[id] = item
		}
		if lang2 := normalizeLangCode2(langCode); lang2 != "" && strings.TrimSpace(transSlug) != "" {
			item.SlugsByLng[lang2] = strings.TrimSpace(transSlug)
		}
	}
	for _, item := range byID {
		list = append(list, *item)
	}
	return list, rows.Err()
}

func queryActiveCMSSlugs(ctx context.Context) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT slug
		FROM catalog.pages
		WHERE is_active = true AND slug IS NOT NULL AND slug != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var s string
		if scanErr := rows.Scan(&s); scanErr == nil && strings.TrimSpace(s) != "" {
			slugs = append(slugs, s)
		}
	}
	return slugs, rows.Err()
}

func collectSiteStructureIndexNowURLs(ctx context.Context) ([]string, error) {
	if db.Pool == nil {
		return BuildStaticAndCMSIndexNowURLs(nil), nil
	}

	cats, err := queryActiveCategoryNodes(ctx)
	if err != nil {
		return nil, err
	}
	brandSlugs, err := queryActiveBrandSlugs(ctx)
	if err != nil {
		return nil, err
	}
	blogPosts, err := queryActiveBlogRows(ctx)
	if err != nil {
		return nil, err
	}
	cmsSlugs, err := queryActiveCMSSlugs(ctx)
	if err != nil {
		return nil, err
	}

	var urls []string
	urls = append(urls, BuildStaticAndCMSIndexNowURLs(cmsSlugs)...)
	urls = append(urls, BuildCategoryTrailURLs(cats)...)
	urls = append(urls, BuildBrandIndexNowURLs(brandSlugs)...)
	urls = append(urls, BuildBlogIndexNowURLs(blogPosts)...)
	return urls, nil
}

// BuildSingleCategoryIndexNowURLs builds the 8-language storefront URLs for one category ID.
func BuildSingleCategoryIndexNowURLs(ctx context.Context, categoryID string) []string {
	if db.Pool == nil || strings.TrimSpace(categoryID) == "" {
		return nil
	}
	cats, err := queryActiveCategoryNodes(ctx)
	if err != nil {
		return nil
	}
	nodeMap := make(map[string]indexNowCategoryNode, len(cats))
	for _, cat := range cats {
		nodeMap[cat.ID] = cat
	}
	trail := buildCategorySlugTrail(categoryID, nodeMap)
	if trail == "" {
		return nil
	}
	urls := make([]string, 0, len(indexNowAllLangs))
	for _, lang := range indexNowAllLangs {
		urls = append(urls, fmt.Sprintf("%s/%s/%s", siteBaseURL, lang, trail))
	}
	return urls
}

func submitProductChunkAndMark(
	ctx context.Context,
	triggerSource, sourceLabel string,
	chunkIdx, totalChunks int,
	chunk []indexNowProductRef,
) (int, int, string, error) {
	ids, slugs := extractProductRefIDsAndSlugs(chunk)
	urls, productCount := BuildProductIndexNowURLs(slugs)
	if len(urls) == 0 {
		return 0, 0, "", nil
	}

	label := sourceLabel
	if totalChunks > 1 {
		label = fmt.Sprintf("%s (Bölüm %d/%d — %d ürün)", sourceLabel, chunkIdx+1, totalChunks, productCount)
	}

	chunkCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	entry, submitErr := SubmitIndexNowSync(chunkCtx, IndexNowSubmissionMeta{
		TriggerSource: triggerSource,
		SourceLabel:   label,
		ProductCount:  productCount,
	}, urls)
	if submitErr != nil {
		return 0, 0, submitErr.Error(), submitErr
	}
	if entry == nil {
		return 0, 0, "", nil
	}
	if entry.Status == "skipped_dev" {
		return 0, 0, "skipped_dev", nil
	}
	if entry.Status != "success" {
		return 0, 0, entry.ResponseMessage, fmt.Errorf("indexnow chunk status=%s: %s", entry.Status, entry.ResponseMessage)
	}

	if markErr := markProductsIndexNowNotified(ctx, ids); markErr != nil {
		log.Printf("[IndexNow Auto] Failed to mark chunk products notified: %v", markErr)
	}
	return productCount, entry.URLCount, "", nil
}

// FlushReadyUnnotifiedProductsToIndexNow submits all translation-complete unnotified active products in 1,250-product chunks.
func FlushReadyUnnotifiedProductsToIndexNow(ctx context.Context, triggerSource, sourceLabel string) (IndexNowFlushResult, error) {
	var res IndexNowFlushResult
	if db.Pool == nil {
		return res, nil
	}
	if !acquireFlushLock() {
		return res, errors.New("başka bir IndexNow gönderimi zaten çalışıyor")
	}
	defer releaseFlushLock()

	if err := EnsureIndexNowSchema(ctx); err != nil {
		return res, err
	}

	refs, err := loadReadyUnnotifiedProductRefs(ctx)
	if err != nil {
		return res, err
	}
	if len(refs) == 0 {
		return res, nil
	}

	chunks := chunkProductRefs(refs, indexNowProductsPerChunk)
	for idx, chunk := range chunks {
		if ctx.Err() != nil {
			res.LastError = ctx.Err().Error()
			break
		}
		if idx > 0 {
			timer := time.NewTimer(indexNowChunkPause)
			select {
			case <-ctx.Done():
				timer.Stop()
				res.LastError = ctx.Err().Error()
				return res, ctx.Err()
			case <-timer.C:
			}
		}

		pCount, uCount, msg, chunkErr := submitProductChunkAndMark(ctx, triggerSource, sourceLabel, idx, len(chunks), chunk)
		if chunkErr != nil {
			res.ChunksFailed++
			res.LastError = msg
			continue
		}
		if msg == "skipped_dev" {
			res.SkippedDev = true
			continue
		}
		if pCount > 0 {
			res.ChunksSucceeded++
			res.ProductsSubmitted += pCount
			res.URLsSubmitted += uCount
		}
	}
	return res, nil
}

func updateBackfillStateRecord(ctx context.Context, status, lastErr string, markCompleted bool) {
	if db.Pool == nil {
		return
	}
	query := `
		UPDATE catalog.indexnow_automation_state
		SET initial_backfill_status = $1,
		    initial_backfill_last_error = $2,
		    initial_backfill_completed_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE initial_backfill_completed_at END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE singleton_guard = true`
	if _, err := db.Pool.Exec(ctx, query, status, truncateIndexNowRunes(lastErr, 1000), markCompleted); err != nil {
		log.Printf("[IndexNow Auto] Failed to update backfill state: %v", err)
	}
}

func submitSitePagesBackfill(ctx context.Context) (string, bool, error) {
	urls, err := collectSiteStructureIndexNowURLs(ctx)
	if err != nil {
		return "", false, err
	}
	if len(urls) == 0 {
		return "", false, nil
	}
	entry, submitErr := SubmitIndexNowSync(ctx, IndexNowSubmissionMeta{
		TriggerSource: "initial_backfill",
		SourceLabel:   "İlk Tam Katalog Bildirimi — Kategoriler, Bloglar, Üreticiler ve Sayfalar",
		ProductCount:  0,
	}, urls)
	if submitErr != nil {
		return submitErr.Error(), false, submitErr
	}
	if entry != nil && entry.Status == "skipped_dev" {
		return "", true, nil
	}
	if entry != nil && entry.Status != "success" {
		return entry.ResponseMessage, false, errors.New(entry.ResponseMessage)
	}
	return "", false, nil
}

// RunOneTimeFullCatalogBackfill refreshes catalog.mv_products and notifies IndexNow for all site pages and unnotified products.
func RunOneTimeFullCatalogBackfill(ctx context.Context, includeSitePages bool) (IndexNowFlushResult, error) {
	var res IndexNowFlushResult
	if db.Pool == nil {
		return res, nil
	}
	if !acquireBackfillLock() {
		return res, errors.New("tam katalog IndexNow bildirimi zaten çalışıyor")
	}
	defer releaseBackfillLock()

	if err := EnsureIndexNowSchema(ctx); err != nil {
		return res, err
	}
	updateBackfillStateRecord(ctx, "running", "", false)

	if mvErr := refreshCatalogMV(ctx); mvErr != nil {
		log.Printf("[IndexNow Backfill] MV refresh warning: %v", mvErr)
	}

	var siteErrMsg string
	siteSkippedDev := false
	if includeSitePages {
		var siteErr error
		siteErrMsg, siteSkippedDev, siteErr = submitSitePagesBackfill(ctx)
		if siteErr != nil {
			log.Printf("[IndexNow Backfill] Site pages submission warning: %v", siteErr)
		}
	}

	res, flushErr := FlushReadyUnnotifiedProductsToIndexNow(ctx, "initial_backfill", "İlk Tam Katalog Bildirimi — Ürünler")
	if flushErr != nil && res.LastError == "" {
		res.LastError = flushErr.Error()
	}

	if isIndexNowLocalOrDev() || res.SkippedDev || siteSkippedDev {
		updateBackfillStateRecord(ctx, "pending", "", false)
		return res, flushErr
	}

	combinedErr := strings.TrimSpace(strings.Trim(siteErrMsg+" ; "+res.LastError, " ;"))
	if res.ChunksFailed == 0 && siteErrMsg == "" && flushErr == nil {
		updateBackfillStateRecord(ctx, "completed", "", true)
		log.Printf("[IndexNow Backfill] One-time backfill completed! products=%d urls=%d", res.ProductsSubmitted, res.URLsSubmitted)
	} else {
		updateBackfillStateRecord(ctx, "partial", combinedErr, false)
		log.Printf("[IndexNow Backfill] Finished partially: products=%d failedChunks=%d err=%s", res.ProductsSubmitted, res.ChunksFailed, combinedErr)
	}
	return res, flushErr
}

func loadAutomationState(ctx context.Context) (indexNowAutomationStateRow, error) {
	var state indexNowAutomationStateRow
	if db.Pool == nil {
		return state, nil
	}
	err := db.Pool.QueryRow(ctx, `
		SELECT auto_enabled, initial_backfill_completed_at, initial_backfill_status, last_sweep_at
		FROM catalog.indexnow_automation_state
		WHERE singleton_guard = true`).Scan(
		&state.AutoEnabled,
		&state.InitialBackfillCompletedAt,
		&state.InitialBackfillStatus,
		&state.LastSweepAt,
	)
	return state, err
}

func saveSweepSummary(ctx context.Context, summary map[string]any) {
	if db.Pool == nil {
		return
	}
	raw, _ := json.Marshal(summary)
	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.indexnow_automation_state
		SET last_sweep_at = CURRENT_TIMESTAMP,
		    last_sweep_summary = $1::jsonb,
		    updated_at = CURRENT_TIMESTAMP
		WHERE singleton_guard = true`, string(raw))
}

func runIndexNowPeriodicSweep(ctx context.Context) {
	if isCronPipelineRunning() || isTranslationManagerRunning() || isIndexNowBackfillOrFlushRunning() {
		return
	}

	sweepCtx, cancel := context.WithTimeout(ctx, 8*time.Minute)
	defer cancel()

	state, err := loadAutomationState(sweepCtx)
	if err != nil || !state.AutoEnabled {
		return
	}

	if state.InitialBackfillCompletedAt == nil && state.InitialBackfillStatus != "running" {
		waitingIDs, waitErr := loadWaitingTranslationProductIDs(sweepCtx, indexNowSweepTranslateLimit)
		if waitErr == nil && len(waitingIDs) > 0 {
			_, _ = AutoTranslateProductsByIDs(sweepCtx, waitingIDs)
		}
		_, _ = RunOneTimeFullCatalogBackfill(sweepCtx, true)
		return
	}

	translatedCount := 0
	waitingIDs, waitErr := loadWaitingTranslationProductIDs(sweepCtx, indexNowSweepTranslateLimit)
	if waitErr == nil && len(waitingIDs) > 0 {
		translatedCount, _ = AutoTranslateProductsByIDs(sweepCtx, waitingIDs)
		if translatedCount > 0 {
			if mvErr := refreshCatalogMV(sweepCtx); mvErr != nil {
				log.Printf("[IndexNow Sweep] MV refresh warning: %v", mvErr)
			}
		}
	}

	flushRes, flushErr := FlushReadyUnnotifiedProductsToIndexNow(sweepCtx, "auto_sweep", "Otomatik Periyodik Çeviri-Sonrası Bildirim")
	summary := map[string]any{
		"waiting_checked":   len(waitingIDs),
		"translated_count":  translatedCount,
		"products_notified": flushRes.ProductsSubmitted,
		"urls_submitted":    flushRes.URLsSubmitted,
		"chunks_failed":     flushRes.ChunksFailed,
	}
	if flushErr != nil {
		summary["error"] = flushErr.Error()
	}
	saveSweepSummary(sweepCtx, summary)
}

// StartIndexNowAutomationWorker launches the one-time full catalog backfill and 10-minute translation-ready safety sweep.
func StartIndexNowAutomationWorker(ctx context.Context) {
	if isIndexNowLocalOrDev() {
		log.Println("[IndexNow Auto] Local/dev environment detected — automation worker disabled.")
		return
	}

	safe.Go("IndexNow Automation Worker", func() {
		log.Println("[IndexNow Auto] Automation worker scheduled.")
		startupTimer := time.NewTimer(indexNowStartupDelay)
		select {
		case <-ctx.Done():
			startupTimer.Stop()
			return
		case <-startupTimer.C:
		}

		initCtx, initCancel := context.WithTimeout(ctx, 10*time.Minute)
		if state, err := loadAutomationState(initCtx); err == nil && state.AutoEnabled && state.InitialBackfillCompletedAt == nil {
			log.Println("[IndexNow Auto] Starting one-time full catalog IndexNow backfill...")
			_, _ = RunOneTimeFullCatalogBackfill(initCtx, true)
		}
		initCancel()

		ticker := time.NewTicker(indexNowSweepInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[IndexNow Auto] Automation worker gracefully stopped.")
				return
			case <-ticker.C:
				runIndexNowPeriodicSweep(ctx)
			}
		}
	})
}

func fetchIndexNowCoverageStats(ctx context.Context, kpi *IndexNowKpiSummary) {
	if db.Pool == nil || kpi == nil {
		return
	}
	err := db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(COUNT(*) FILTER (WHERE p.is_active = true AND COALESCE(p.is_archived, false) = false AND p.slug IS NOT NULL AND p.slug != ''), 0),
			COALESCE(COUNT(*) FILTER (WHERE p.is_active = true AND COALESCE(p.is_archived, false) = false AND p.slug IS NOT NULL AND p.slug != '' AND p.indexnow_notified_at IS NOT NULL), 0),
			COALESCE(COUNT(*) FILTER (WHERE p.indexnow_notified_at IS NULL AND `+indexNowProductReadyClause+`), 0),
			COALESCE(COUNT(*) FILTER (WHERE p.is_active = true AND COALESCE(p.is_archived, false) = false AND p.slug IS NOT NULL AND p.slug != '' AND p.indexnow_notified_at IS NULL AND NOT (`+indexNowProductReadyClause+`)), 0)
		FROM catalog.products p`).Scan(
		&kpi.ActiveProductsCount,
		&kpi.NotifiedProductsCount,
		&kpi.PendingReadyProductsCount,
		&kpi.WaitingTranslationProductsCount,
	)
	if err != nil {
		log.Printf("[IndexNow] Coverage stats query warning: %v", err)
	}

	if state, stateErr := loadAutomationState(ctx); stateErr == nil {
		kpi.AutoEnabled = state.AutoEnabled
		kpi.InitialBackfillCompletedAt = state.InitialBackfillCompletedAt
		kpi.InitialBackfillStatus = state.InitialBackfillStatus
		kpi.LastSweepAt = state.LastSweepAt
	}
	kpi.BackfillRunning = isIndexNowBackfillOrFlushRunning()
}

// SubmitUnnotifiedCatalog triggers a background translation-first + one-time/backfill IndexNow run for all unnotified products and site pages.
func (h *IndexNowHandler) SubmitUnnotifiedCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IncludeSitePages *bool `json:"include_site_pages"`
		TranslateFirst   *bool `json:"translate_first"`
	}
	_ = httpx.DecodeJSON(r, &req, 4096)

	includeSitePages := true
	if req.IncludeSitePages != nil {
		includeSitePages = *req.IncludeSitePages
	}
	translateFirst := true
	if req.TranslateFirst != nil {
		translateFirst = *req.TranslateFirst
	}

	if isIndexNowBackfillOrFlushRunning() {
		httpx.Error(w, http.StatusConflict, "IndexNow toplu katalog gönderimi şu anda zaten çalışıyor.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := EnsureIndexNowSchema(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, errIndexNowSchemaPrep)
		return
	}

	var summary IndexNowKpiSummary
	fetchIndexNowCoverageStats(ctx, &summary)

	safe.Go("Admin Manual Full Unnotified IndexNow Backfill", func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer bgCancel()

		if translateFirst && summary.WaitingTranslationProductsCount > 0 {
			waitingIDs, waitErr := loadWaitingTranslationProductIDs(bgCtx, 500)
			if waitErr == nil && len(waitingIDs) > 0 {
				if translated, _ := AutoTranslateProductsByIDs(bgCtx, waitingIDs); translated > 0 {
					_ = refreshCatalogMV(bgCtx)
				}
			}
		}
		_, _ = RunOneTimeFullCatalogBackfill(bgCtx, includeSitePages)
	})

	httpx.JSON(w, http.StatusAccepted, map[string]any{
		"status":                       "started",
		"message":                      "Bildirilmemiş tüm katalog için çeviri kontrolü + IndexNow toplu gönderimi arka planda başlatıldı.",
		"pending_ready_products":       summary.PendingReadyProductsCount,
		"waiting_translation_products": summary.WaitingTranslationProductsCount,
	})
}
