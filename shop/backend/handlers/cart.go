package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"mertervitrini/shop/backend/db"
)

type CartHandler struct{}

func NewCartHandler() *CartHandler {
	return &CartHandler{}
}

type AddToCartRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"` // total units/pieces
}

type UpdateCartItemRequest struct {
	Quantity int `json:"quantity"` // total units/pieces
}

type CartResponseItem struct {
	ID               string   `json:"id"`
	ProductID        string   `json:"product_id"`
	Title            string   `json:"title"`
	CustomSku        string   `json:"custom_sku"`
	Color            string   `json:"color"`
	PackagesQty      int      `json:"packages_qty"`
	UnitsPerPackage  int      `json:"units_per_package"`
	PricePerUnit     float64  `json:"price_per_unit"`
	WeightPerUnit    float64  `json:"weight_per_unit"`
	ImageUrl         string   `json:"image_url"`
	Currency         string   `json:"currency"`
	TitleTranslations map[string]string `json:"title_translations"`
}

func (h *CartHandler) GetCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	
	// Query user's cart items
	query := `
		SELECT ci.id, ci.product_id, p.title, p.custom_sku, COALESCE(col.color_name, 'Standart') as color,
		       p.series_ratio, p.price, p.discounted_price, p.currency, p.shipping_weight_kg,
		       ci.quantity,
		       COALESCE(
		           (SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1),
		           '/placeholder.png'
		       ) as image_url,
		       COALESCE(
		           (SELECT json_object_agg(t.language_code, t.title)
		            FROM catalog.product_translations t
		            WHERE t.product_id = p.id), '{}'::json
		       ) as translations_json
		FROM catalog.cart_items ci
		INNER JOIN catalog.carts c ON ci.cart_id = c.id
		INNER JOIN catalog.products p ON ci.product_id = p.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE c.user_id = $1 AND p.deleted_at IS NULL
		ORDER BY ci.created_at ASC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to query cart: %v", err)
		http.Error(w, `{"error":"Sepet yüklenemedi"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []CartResponseItem{}
	for rows.Next() {
		var item CartResponseItem
		var seriesRatio *string
		var price float64
		var discountedPrice *float64
		var shippingWeight *float64
		var quantity int
		var transBytes []byte

		err := rows.Scan(
			&item.ID, &item.ProductID, &item.Title, &item.CustomSku, &item.Color,
			&seriesRatio, &price, &discountedPrice, &item.Currency, &shippingWeight,
			&quantity, &item.ImageUrl, &transBytes,
		)
		if err != nil {
			log.Printf("[STORE CART ERROR] Failed to scan cart row: %v", err)
			continue
		}

		// Calculate units per package
		var ratioStr string
		if seriesRatio != nil {
			ratioStr = *seriesRatio
		}
		unitsPerPkg := getUnitsFromSeriesRatio(ratioStr)

		// Calculate packages quantity
		packagesQty := quantity / unitsPerPkg
		if packagesQty <= 0 {
			packagesQty = 1
		}

		item.UnitsPerPackage = unitsPerPkg
		item.PackagesQty = packagesQty
		
		item.PricePerUnit = price
		if discountedPrice != nil && *discountedPrice > 0 && *discountedPrice < price {
			item.PricePerUnit = *discountedPrice
		}

		item.WeightPerUnit = 0.35
		if shippingWeight != nil {
			item.WeightPerUnit = *shippingWeight
		}

		item.TitleTranslations = make(map[string]string)
		if len(transBytes) > 0 {
			json.Unmarshal(transBytes, &item.TitleTranslations)
		}

		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *CartHandler) AddToCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req AddToCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.ProductID == "" || req.Quantity <= 0 {
		http.Error(w, `{"error":"ProductID and valid quantity are required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Use transaction
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to start tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Ensure cart exists
	var cartID string
	err = tx.QueryRow(ctx, `
		INSERT INTO catalog.carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, userID).Scan(&cartID)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to get/create cart: %v", err)
		http.Error(w, `{"error":"Sepet oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	// Insert or update cart item
	_, err = tx.Exec(ctx, `
		INSERT INTO catalog.cart_items (cart_id, product_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = catalog.cart_items.quantity + EXCLUDED.quantity
	`, cartID, req.ProductID, req.Quantity)
	
	// Wait! We don't have a unique constraint on (cart_id, product_id) in the migration DDL.
	// Let's modify the self-provisioning script or add a check/delete/insert to be safe.
	// Actually, we can check if it exists:
	if err != nil {
		// If the constraint does not exist, ON CONFLICT will fail.
		// Let's do it manually instead of ON CONFLICT to avoid constraint assumptions!
		var existingID string
		var existingQty int
		findErr := tx.QueryRow(ctx, `
			SELECT id, quantity FROM catalog.cart_items WHERE cart_id = $1 AND product_id = $2
		`, cartID, req.ProductID).Scan(&existingID, &existingQty)
		
		if findErr == pgx.ErrNoRows {
			_, err = tx.Exec(ctx, `
				INSERT INTO catalog.cart_items (cart_id, product_id, quantity)
				VALUES ($1, $2, $3)
			`, cartID, req.ProductID, req.Quantity)
		} else if findErr == nil {
			_, err = tx.Exec(ctx, `
				UPDATE catalog.cart_items
				SET quantity = $1
				WHERE id = $2
			`, existingQty + req.Quantity, existingID)
		} else {
			err = findErr
		}
	}

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to add item to cart: %v", err)
		http.Error(w, `{"error":"Ürün sepete eklenemedi"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to commit tx: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) UpdateCartItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	itemID := r.PathValue("item_id")
	if itemID == "" {
		http.Error(w, `{"error":"Item ID is required"}`, http.StatusBadRequest)
		return
	}

	var req UpdateCartItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Quantity <= 0 {
		http.Error(w, `{"error":"Valid quantity is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Update item only if it belongs to user's cart
	res, err := db.Pool.Exec(ctx, `
		UPDATE catalog.cart_items
		SET quantity = $1
		WHERE id = $2 AND cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $3)
	`, req.Quantity, itemID, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to update item: %v", err)
		http.Error(w, `{"error":"Sepet güncellenemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Sepet kalemi bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) DeleteCartItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	itemID := r.PathValue("item_id")
	if itemID == "" {
		http.Error(w, `{"error":"Item ID is required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Delete item only if it belongs to user's cart
	res, err := db.Pool.Exec(ctx, `
		DELETE FROM catalog.cart_items
		WHERE id = $1 AND cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $2)
	`, itemID, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to delete item: %v", err)
		http.Error(w, `{"error":"Ürün sepetten silinemedi"}`, http.StatusInternalServerError)
		return
	}

	if res.RowsAffected() == 0 {
		http.Error(w, `{"error":"Sepet kalemi bulunamadı"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func (h *CartHandler) ClearCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	_, err = db.Pool.Exec(ctx, `
		DELETE FROM catalog.cart_items
		WHERE cart_id IN (SELECT id FROM catalog.carts WHERE user_id = $1)
	`, userID)

	if err != nil {
		log.Printf("[STORE CART ERROR] Failed to clear cart: %v", err)
		http.Error(w, `{"error":"Sepet temizlenemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

// getUnitsFromSeriesRatio sums the parts of series_ratio e.g. 1-2-2-1 -> 6
func getUnitsFromSeriesRatio(seriesRatio string) int {
	if seriesRatio == "" {
		return 1
	}
	parts := strings.FieldsFunc(seriesRatio, func(c rune) bool {
		return c == '-' || c == ',' || c == ' '
	})
	total := 0
	for _, p := range parts {
		var val int
		// simple string conversion manually to avoid strconv import cycle or complexity
		for i := 0; i < len(p); i++ {
			if p[i] >= '0' && p[i] <= '9' {
				val = val*10 + int(p[i]-'0')
			}
		}
		if val > 0 {
			total += val
		}
	}
	if total > 0 {
		return total
	}
	return 1
}

type SyncCartRequestItem struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type SyncCartRequest struct {
	Items []SyncCartRequestItem `json:"items"`
}

func (h *CartHandler) SyncCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req SyncCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Use database transaction to cleanly sync items
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail begin tx: %v", err)
		http.Error(w, `{"error":"İşlem başlatılamadı"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Ensure cart exists manually to avoid constraint assumptions
	var cartID string
	var existingCartID string
	errFind := tx.QueryRow(ctx, "SELECT id FROM catalog.carts WHERE user_id = $1", userID).Scan(&existingCartID)
	if errFind == pgx.ErrNoRows {
		err = tx.QueryRow(ctx, "INSERT INTO catalog.carts (user_id) VALUES ($1) RETURNING id", userID).Scan(&cartID)
	} else if errFind == nil {
		cartID = existingCartID
		_, err = tx.Exec(ctx, "UPDATE catalog.carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", cartID)
	} else {
		err = errFind
	}

	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail get/create cart: %v", err)
		http.Error(w, `{"error":"Sepet bulunamadı veya oluşturulamadı"}`, http.StatusInternalServerError)
		return
	}

	// Delete existing items in cart
	_, err = tx.Exec(ctx, "DELETE FROM catalog.cart_items WHERE cart_id = $1", cartID)
	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail delete items: %v", err)
		http.Error(w, `{"error":"Mevcut sepet temizlenemedi"}`, http.StatusInternalServerError)
		return
	}

	// Insert new items
	for _, item := range req.Items {
		if item.ProductID == "" || item.Quantity <= 0 {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO catalog.cart_items (cart_id, product_id, quantity)
			VALUES ($1, $2, $3)
		`, cartID, item.ProductID, item.Quantity)
		if err != nil {
			log.Printf("[STORE CART ERROR] Sync fail insert item: %v", err)
			http.Error(w, `{"error":"Sepet güncellenemedi"}`, http.StatusInternalServerError)
			return
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		log.Printf("[STORE CART ERROR] Sync fail commit tx: %v", err)
		http.Error(w, `{"error":"Değişiklikler kaydedilemedi"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}
