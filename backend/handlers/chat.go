package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
)

const (
	chatRoomChannelPrefix = "chat:room#"
	errMsgUnauthorized    = "Yetkisiz erişim."
)

type ChatHandler struct {
	Cfg  *config.Config
	Node *centrifuge.Node
}

type SupplierAgentDTO struct {
	ID              string `json:"id"`
	BrandID         string `json:"brand_id"`
	ContactName     string `json:"contact_name"`
	Email           string `json:"email,omitempty"`
	Phone           string `json:"phone,omitempty"`
	JobTitle        string `json:"job_title"`
	SpokenLanguages string `json:"spoken_languages"`
	IsOwner         bool   `json:"is_owner"`
	IsActive        bool   `json:"is_active"`
}

type CreateTeamMemberRequest struct {
	ContactName     string `json:"contact_name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	Phone           string `json:"phone"`
	JobTitle        string `json:"job_title"`
	SpokenLanguages string `json:"spoken_languages"`
}

type ChatRoomDTO struct {
	ID                    string    `json:"id"`
	BrandID               string    `json:"brand_id"`
	SupplierName          string    `json:"supplier_name"`
	SupplierUserID        *string   `json:"supplier_user_id,omitempty"`
	SupplierUserName      string    `json:"supplier_user_name,omitempty"`
	SupplierUserTitle     string    `json:"supplier_user_title,omitempty"`
	SupplierUserLanguages string    `json:"supplier_user_languages,omitempty"`
	CustomerID            string    `json:"customer_id"`
	CustomerName          string    `json:"customer_name"`
	CustomerEmail         string    `json:"customer_email,omitempty"`
	CustomerPhone         string    `json:"customer_phone,omitempty"`
	InitialProductID      *string   `json:"initial_product_id,omitempty"`
	LastMessagePreview    string    `json:"last_message_preview"`
	LastMessageAt         time.Time `json:"last_message_at"`
	UnreadCustomerCount   int       `json:"unread_customer_count"`
	UnreadSupplierCount   int       `json:"unread_supplier_count"`
	CreatedAt             time.Time `json:"created_at"`
}

type ChatOfferMetadata struct {
	ProductID         string  `json:"product_id,omitempty"`
	Title             string  `json:"title,omitempty"`
	CustomSku         string  `json:"custom_sku,omitempty"`
	Color             string  `json:"color,omitempty"`
	ImageUrl          string  `json:"image_url,omitempty"`
	Slug              string  `json:"slug,omitempty"`
	SeriesRatio       string  `json:"series_ratio,omitempty"`
	UnitsPerPackage   int     `json:"units_per_package,omitempty"`
	PackagesQty       int     `json:"packages_qty,omitempty"`
	OriginalUnitPrice float64 `json:"original_unit_price,omitempty"`
	OfferedUnitPrice  float64 `json:"offered_unit_price,omitempty"`
	DiscountPercent   float64 `json:"discount_percent,omitempty"`
	WeightPerUnit     float64 `json:"weight_per_unit,omitempty"`
	Currency          string  `json:"currency,omitempty"`
	OfferStatus       string  `json:"offer_status,omitempty"` // "pending", "accepted", "rejected"
}

type ChatMessageDTO struct {
	ID          string            `json:"id"`
	RoomID      string            `json:"room_id"`
	SenderType  string            `json:"sender_type"`
	SenderID    string            `json:"sender_id"`
	SenderName  string            `json:"sender_name"`
	MessageType string            `json:"message_type"` // "text", "product_card", "custom_offer"
	Content     string            `json:"content"`
	Metadata    ChatOfferMetadata `json:"metadata"`
	IsRead      bool              `json:"is_read"`
	CreatedAt   time.Time         `json:"created_at"`
}

type InitChatRoomRequest struct {
	BrandID        string `json:"brand_id"`
	SupplierUserID string `json:"supplier_user_id"`
	ProductID      string `json:"product_id"`
	CustomerID     string `json:"customer_id"`
	CustomerName   string `json:"customer_name"`
	CustomerEmail  string `json:"customer_email"`
	CustomerPhone  string `json:"customer_phone"`
}

type SendCustomerMessageRequest struct {
	CustomerID   string `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	Content      string `json:"content"`
}

type SendSupplierMessageRequest struct {
	MessageType      string  `json:"message_type"` // "text" or "custom_offer"
	Content          string  `json:"content"`
	ProductID        string  `json:"product_id,omitempty"`
	PackagesQty      int     `json:"packages_qty,omitempty"`
	OfferedUnitPrice float64 `json:"offered_unit_price,omitempty"`
	DiscountPercent  float64 `json:"discount_percent,omitempty"`
}

func NewChatHandler(cfg *config.Config) *ChatHandler {
	node, err := centrifuge.New(centrifuge.Config{})
	if err != nil {
		log.Fatalf("CRITICAL: Failed to initialize Centrifuge node: %v", err)
	}

	node.OnConnecting(func(ctx context.Context, e centrifuge.ConnectEvent) (centrifuge.ConnectReply, error) {
		clientID := strings.TrimSpace(e.Token)
		if clientID == "" {
			clientID = "anon"
		}
		return centrifuge.ConnectReply{
			Credentials: &centrifuge.Credentials{
				UserID: clientID,
			},
		}, nil
	})

	node.OnConnect(func(client *centrifuge.Client) {
		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			if strings.HasPrefix(e.Channel, chatRoomChannelPrefix) ||
				strings.HasPrefix(e.Channel, "chat:supplier#") ||
				strings.HasPrefix(e.Channel, "chat:supplier_user#") ||
				strings.HasPrefix(e.Channel, "chat:customer#") {
				cb(centrifuge.SubscribeReply{}, nil)
				return
			}
			cb(centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied)
		})
	})

	if err := node.Run(); err != nil {
		log.Fatalf("CRITICAL: Failed to start Centrifuge node: %v", err)
	}

	log.Println("[CENTRIFUGE] Embedded real-time B2B multi-agent chat engine started successfully.")
	return &ChatHandler{
		Cfg:  cfg,
		Node: node,
	}
}

func (h *ChatHandler) WebsocketHandler() http.Handler {
	return centrifuge.NewWebsocketHandler(h.Node, centrifuge.WebsocketConfig{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	})
}

func (h *ChatHandler) publishEvent(channel string, eventType string, payload any) {
	if h.Node == nil || channel == "" {
		return
	}
	data, err := json.Marshal(map[string]any{
		"event": eventType,
		"data":  payload,
	})
	if err != nil {
		return
	}
	_, _ = h.Node.Publish(channel, data)
}

func (h *ChatHandler) publishToSupplierChannels(brandID string, supplierUserID *string, eventType string, payload any) {
	h.publishEvent("chat:supplier#"+brandID, eventType, payload)
	if supplierUserID != nil && *supplierUserID != "" {
		h.publishEvent("chat:supplier_user#"+*supplierUserID, eventType, payload)
	}
}

func resolveCustomerIdentity(r *http.Request, fallbackID, fallbackName, fallbackEmail, fallbackPhone string) (string, string, string, string) {
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if userID, err := verifyTokenAndGetUserID(authHeader); err == nil && userID != "" {
			var firstName, lastName, email, phone string
			errScan := db.Pool.QueryRow(r.Context(), `
				SELECT COALESCE(first_name, ''), COALESCE(last_name, ''), COALESCE(email, ''), COALESCE(phone_number, '')
				FROM identity.users WHERE id = $1
			`, userID).Scan(&firstName, &lastName, &email, &phone)
			if errScan == nil {
				fullName := strings.TrimSpace(firstName + " " + lastName)
				if fullName == "" {
					fullName = email
				}
				return userID, fullName, email, phone
			}
			return userID, fallbackName, fallbackEmail, fallbackPhone
		}
	}

	cid := strings.TrimSpace(fallbackID)
	if cid == "" {
		cid = strings.TrimSpace(r.Header.Get("X-Chat-Customer-Id"))
	}
	if cid == "" {
		cid = strings.TrimSpace(r.URL.Query().Get("customer_id"))
	}
	cname := strings.TrimSpace(fallbackName)
	if cname == "" {
		cname = strings.TrimSpace(r.Header.Get("X-Chat-Customer-Name"))
	}
	if cname == "" {
		cname = "B2B Müşteri"
	}
	return cid, cname, strings.TrimSpace(fallbackEmail), strings.TrimSpace(fallbackPhone)
}

func fetchProductCardMetadata(ctx context.Context, productID string) (ChatOfferMetadata, string, error) {
	var meta ChatOfferMetadata
	var brandID string
	var seriesRatio *string
	var price float64
	var discountedPrice *float64
	var weight *float64
	var slug *string

	err := db.Pool.QueryRow(ctx, `
		SELECT p.id, p.brand_id::text, p.title, COALESCE(p.custom_sku, ''),
		       COALESCE(col.color_name, 'Standart'),
		       p.series_ratio, p.price, p.discounted_price, COALESCE(p.currency, 'TRY'),
		       p.shipping_weight_kg, p.slug,
		       COALESCE(
		           (SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1),
		           '/placeholder.png'
		       )
		FROM catalog.products p
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		WHERE p.id = $1 AND p.deleted_at IS NULL
	`, productID).Scan(
		&meta.ProductID, &brandID, &meta.Title, &meta.CustomSku,
		&meta.Color, &seriesRatio, &price, &discountedPrice, &meta.Currency,
		&weight, &slug, &meta.ImageUrl,
	)
	if err != nil {
		return meta, "", err
	}

	ratioStr := ""
	if seriesRatio != nil {
		ratioStr = *seriesRatio
	}
	meta.SeriesRatio = ratioStr
	meta.UnitsPerPackage = getUnitsFromSeriesRatio(ratioStr)
	meta.PackagesQty = 1

	unitPrice := price
	if discountedPrice != nil && *discountedPrice > 0 && *discountedPrice < price {
		unitPrice = *discountedPrice
	}
	meta.OriginalUnitPrice = unitPrice
	meta.OfferedUnitPrice = unitPrice
	meta.WeightPerUnit = 0.35
	if weight != nil && *weight > 0 {
		meta.WeightPerUnit = *weight
	}
	if slug != nil {
		meta.Slug = *slug
	}
	return meta, brandID, nil
}

// ListBrandAgents returns all active sales representatives (sub-users) of a supplier brand for storefront customers
func (h *ChatHandler) ListBrandAgents(w http.ResponseWriter, r *http.Request) {
	brandID := strings.TrimSpace(r.PathValue("brand_id"))
	if brandID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Tedarikçi kimliği eksik."})
		return
	}

	rows, err := db.Pool.Query(r.Context(), `
		SELECT id::text, brand_id::text, contact_name, COALESCE(phone, ''),
		       COALESCE(job_title, 'Satış Temsilcisi'), COALESCE(spoken_languages, 'TR'), is_owner, is_active
		FROM catalog.supplier_users
		WHERE brand_id = $1 AND is_active = true
		ORDER BY is_owner DESC, created_at ASC
	`, brandID)
	if err != nil {
		writeSupplierJSON(w, http.StatusOK, []SupplierAgentDTO{})
		return
	}
	defer rows.Close()

	agents := []SupplierAgentDTO{}
	for rows.Next() {
		var a SupplierAgentDTO
		if err := rows.Scan(
			&a.ID, &a.BrandID, &a.ContactName, &a.Phone,
			&a.JobTitle, &a.SpokenLanguages, &a.IsOwner, &a.IsActive,
		); err == nil {
			agents = append(agents, a)
		}
	}

	writeSupplierJSON(w, http.StatusOK, agents)
}

func resolveTargetSupplierAgent(ctx context.Context, brandID, requestedSupplierUserID string) *string {
	reqID := strings.TrimSpace(requestedSupplierUserID)
	if reqID != "" {
		var validID string
		err := db.Pool.QueryRow(ctx, `
			SELECT id::text FROM catalog.supplier_users
			WHERE id = $1 AND brand_id = $2 AND is_active = true
		`, reqID, brandID).Scan(&validID)
		if err == nil && validID != "" {
			return &validID
		}
	}

	// Default to the primary/first active representative of this supplier if one exists
	var defaultAgentID string
	err := db.Pool.QueryRow(ctx, `
		SELECT id::text FROM catalog.supplier_users
		WHERE brand_id = $1 AND is_active = true
		ORDER BY is_owner DESC, created_at ASC
		LIMIT 1
	`, brandID).Scan(&defaultAgentID)
	if err == nil && defaultAgentID != "" {
		return &defaultAgentID
	}
	return nil
}

func enrichRoomDetails(ctx context.Context, room *ChatRoomDTO) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(alias_code, ''), brand_name) FROM catalog.brands WHERE id = $1
	`, room.BrandID).Scan(&room.SupplierName)

	if room.SupplierUserID != nil && *room.SupplierUserID != "" {
		_ = db.Pool.QueryRow(ctx, `
			SELECT contact_name, COALESCE(job_title, 'Satış Temsilcisi'), COALESCE(spoken_languages, 'TR')
			FROM catalog.supplier_users WHERE id = $1
		`, *room.SupplierUserID).Scan(&room.SupplierUserName, &room.SupplierUserTitle, &room.SupplierUserLanguages)
	}
}

type upsertChatRoomParams struct {
	brandID         string
	supplierUserPtr *string
	customerID      string
	customerName    string
	customerEmail   string
	customerPhone   string
	initProdPtr     *string
}

func upsertChatRoomRecord(ctx context.Context, p upsertChatRoomParams) (ChatRoomDTO, error) {
	var room ChatRoomDTO
	var existingID string

	errFind := db.Pool.QueryRow(ctx, `
		SELECT id::text FROM catalog.chat_rooms
		WHERE brand_id = $1
		  AND COALESCE(supplier_user_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		  AND customer_id = $3
		LIMIT 1
	`, p.brandID, p.supplierUserPtr, p.customerID).Scan(&existingID)

	if errFind == nil && existingID != "" {
		err := db.Pool.QueryRow(ctx, `
			UPDATE catalog.chat_rooms
			SET customer_name = COALESCE(NULLIF($1, 'B2B Müşteri'), customer_name),
			    customer_email = COALESCE(NULLIF($2, ''), customer_email),
			    customer_phone = COALESCE(NULLIF($3, ''), customer_phone),
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $4
			RETURNING id::text, brand_id::text, supplier_user_id::text, customer_id, customer_name,
			          COALESCE(customer_email, ''), COALESCE(customer_phone, ''),
			          initial_product_id::text, last_message_preview, last_message_at,
			          unread_customer_count, unread_supplier_count, created_at
		`, p.customerName, p.customerEmail, p.customerPhone, existingID).Scan(
			&room.ID, &room.BrandID, &room.SupplierUserID, &room.CustomerID, &room.CustomerName,
			&room.CustomerEmail, &room.CustomerPhone,
			&room.InitialProductID, &room.LastMessagePreview, &room.LastMessageAt,
			&room.UnreadCustomerCount, &room.UnreadSupplierCount, &room.CreatedAt,
		)
		return room, err
	}

	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.chat_rooms (
			brand_id, supplier_user_id, customer_id, customer_name, customer_email, customer_phone, initial_product_id
		) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7)
		RETURNING id::text, brand_id::text, supplier_user_id::text, customer_id, customer_name,
		          COALESCE(customer_email, ''), COALESCE(customer_phone, ''),
		          initial_product_id::text, last_message_preview, last_message_at,
		          unread_customer_count, unread_supplier_count, created_at
	`, p.brandID, p.supplierUserPtr, p.customerID, p.customerName, p.customerEmail, p.customerPhone, p.initProdPtr).Scan(
		&room.ID, &room.BrandID, &room.SupplierUserID, &room.CustomerID, &room.CustomerName,
		&room.CustomerEmail, &room.CustomerPhone,
		&room.InitialProductID, &room.LastMessagePreview, &room.LastMessageAt,
		&room.UnreadCustomerCount, &room.UnreadSupplierCount, &room.CreatedAt,
	)
	return room, err
}

func (h *ChatHandler) InitOrGetRoom(w http.ResponseWriter, r *http.Request) {
	var req InitChatRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek gövdesi."})
		return
	}

	ctx := r.Context()
	customerID, customerName, customerEmail, customerPhone := resolveCustomerIdentity(
		r, req.CustomerID, req.CustomerName, req.CustomerEmail, req.CustomerPhone,
	)
	if customerID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Müşteri kimliği (customer_id) gereklidir."})
		return
	}

	brandID := strings.TrimSpace(req.BrandID)
	var productMeta ChatOfferMetadata
	hasProduct := false

	if strings.TrimSpace(req.ProductID) != "" {
		meta, resolvedBrandID, err := fetchProductCardMetadata(ctx, req.ProductID)
		if err == nil {
			productMeta = meta
			hasProduct = true
			if brandID == "" {
				brandID = resolvedBrandID
			}
		}
	}

	if brandID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Tedarikçi (brand_id) veya geçerli ürün (product_id) belirtilmelidir."})
		return
	}

	supplierUserPtr := resolveTargetSupplierAgent(ctx, brandID, req.SupplierUserID)

	var initProdPtr *string
	if hasProduct {
		initProdPtr = &productMeta.ProductID
	}

	room, err := upsertChatRoomRecord(ctx, upsertChatRoomParams{
		brandID:         brandID,
		supplierUserPtr: supplierUserPtr,
		customerID:      customerID,
		customerName:    customerName,
		customerEmail:   customerEmail,
		customerPhone:   customerPhone,
		initProdPtr:     initProdPtr,
	})
	if err != nil {
		log.Printf("[CHAT ERROR] Failed to upsert room: %v", err)
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sohbet odası başlatılamadı."})
		return
	}

	enrichRoomDetails(ctx, &room)

	// Automatically insert product context card if a product was specified and not yet posted in this room
	if hasProduct {
		var existingProductCardCount int
		_ = db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM catalog.chat_messages
			WHERE room_id = $1 AND message_type = 'product_card' AND metadata->>'product_id' = $2
		`, room.ID, productMeta.ProductID).Scan(&existingProductCardCount)

		if existingProductCardCount == 0 {
			metaBytes, _ := json.Marshal(productMeta)
			previewText := fmt.Sprintf("📦 Ürün: %s (%s)", productMeta.Title, productMeta.CustomSku)
			msg, errMsg := insertChatMessage(ctx, insertChatMessageParams{
				roomID:                  room.ID,
				senderType:              "customer",
				senderID:                customerID,
				senderName:              customerName,
				messageType:             "product_card",
				content:                 previewText,
				metaBytes:               metaBytes,
				incrementSupplierUnread: true,
			})
			if errMsg == nil {
				room.LastMessagePreview = previewText
				h.publishEvent(chatRoomChannelPrefix+room.ID, "new_message", msg)
				h.publishToSupplierChannels(room.BrandID, room.SupplierUserID, "room_updated", room)
			}
		}
	}

	writeSupplierJSON(w, http.StatusOK, room)
}

type insertChatMessageParams struct {
	roomID                  string
	senderType              string
	senderID                string
	senderName              string
	messageType             string
	content                 string
	metaBytes               []byte
	incrementSupplierUnread bool
}

func insertChatMessage(ctx context.Context, p insertChatMessageParams) (ChatMessageDTO, error) {
	var msg ChatMessageDTO
	if len(p.metaBytes) == 0 {
		p.metaBytes = []byte("{}")
	}

	var rawMeta []byte
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.chat_messages (
			room_id, sender_type, sender_id, sender_name, message_type, content, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
		RETURNING id, room_id::text, sender_type, sender_id, sender_name, message_type, content, metadata, is_read, created_at
	`, p.roomID, p.senderType, p.senderID, p.senderName, p.messageType, p.content, string(p.metaBytes)).Scan(
		&msg.ID, &msg.RoomID, &msg.SenderType, &msg.SenderID, &msg.SenderName,
		&msg.MessageType, &msg.Content, &rawMeta, &msg.IsRead, &msg.CreatedAt,
	)
	if err != nil {
		return msg, err
	}
	_ = json.Unmarshal(rawMeta, &msg.Metadata)

	unreadCol := "unread_customer_count"
	if p.incrementSupplierUnread {
		unreadCol = "unread_supplier_count"
	}

	_, _ = db.Pool.Exec(ctx, fmt.Sprintf(`
		UPDATE catalog.chat_rooms
		SET last_message_preview = $1,
		    last_message_at = CURRENT_TIMESTAMP,
		    updated_at = CURRENT_TIMESTAMP,
		    %s = %s + 1
		WHERE id = $2
	`, unreadCol, unreadCol), p.content, p.roomID)

	return msg, nil
}

func queryRoomMessages(ctx context.Context, roomID string) ([]ChatMessageDTO, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, room_id::text, sender_type, sender_id, sender_name,
		       message_type, content, metadata, is_read, created_at
		FROM catalog.chat_messages
		WHERE room_id = $1
		ORDER BY created_at ASC
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []ChatMessageDTO{}
	for rows.Next() {
		var m ChatMessageDTO
		var rawMeta []byte
		if err := rows.Scan(
			&m.ID, &m.RoomID, &m.SenderType, &m.SenderID, &m.SenderName,
			&m.MessageType, &m.Content, &rawMeta, &m.IsRead, &m.CreatedAt,
		); err != nil {
			continue
		}
		_ = json.Unmarshal(rawMeta, &m.Metadata)
		messages = append(messages, m)
	}
	return messages, nil
}

func scanRoomRows(rows pgx.Rows) []ChatRoomDTO {
	rooms := []ChatRoomDTO{}
	for rows.Next() {
		var rm ChatRoomDTO
		if err := rows.Scan(
			&rm.ID, &rm.BrandID, &rm.SupplierName,
			&rm.SupplierUserID, &rm.SupplierUserName, &rm.SupplierUserTitle, &rm.SupplierUserLanguages,
			&rm.CustomerID, &rm.CustomerName,
			&rm.CustomerEmail, &rm.CustomerPhone, &rm.InitialProductID,
			&rm.LastMessagePreview, &rm.LastMessageAt,
			&rm.UnreadCustomerCount, &rm.UnreadSupplierCount, &rm.CreatedAt,
		); err == nil {
			rooms = append(rooms, rm)
		}
	}
	return rooms
}

const baseSelectRoomsSQL = `
	SELECT r.id::text, r.brand_id::text, COALESCE(NULLIF(b.alias_code, ''), b.brand_name) AS supplier_name,
	       r.supplier_user_id::text,
	       COALESCE(su.contact_name, ''), COALESCE(su.job_title, ''), COALESCE(su.spoken_languages, ''),
	       r.customer_id, r.customer_name, COALESCE(r.customer_email, ''), COALESCE(r.customer_phone, ''),
	       r.initial_product_id::text, r.last_message_preview, r.last_message_at,
	       r.unread_customer_count, r.unread_supplier_count, r.created_at
	FROM catalog.chat_rooms r
	JOIN catalog.brands b ON r.brand_id = b.id
	LEFT JOIN catalog.supplier_users su ON r.supplier_user_id = su.id
`

func (h *ChatHandler) ListCustomerRooms(w http.ResponseWriter, r *http.Request) {
	customerID, _, _, _ := resolveCustomerIdentity(r, "", "", "", "")
	if customerID == "" {
		writeSupplierJSON(w, http.StatusOK, []ChatRoomDTO{})
		return
	}

	rows, err := db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
		WHERE r.customer_id = $1
		ORDER BY r.last_message_at DESC
	`, customerID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sohbet odaları yüklenemedi."})
		return
	}
	defer rows.Close()

	writeSupplierJSON(w, http.StatusOK, scanRoomRows(rows))
}

func (h *ChatHandler) ListCustomerMessages(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("room_id")
	if roomID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Oda kimliği eksik."})
		return
	}

	ctx := r.Context()
	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.chat_rooms SET unread_customer_count = 0 WHERE id = $1
	`, roomID)

	messages, err := queryRoomMessages(ctx, roomID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Mesajlar yüklenemedi."})
		return
	}

	writeSupplierJSON(w, http.StatusOK, messages)
}

func (h *ChatHandler) SendCustomerMessage(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("room_id")
	if roomID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Oda kimliği eksik."})
		return
	}

	var req SendCustomerMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz mesaj verisi."})
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Mesaj içeriği boş olamaz."})
		return
	}

	customerID, customerName, _, _ := resolveCustomerIdentity(r, req.CustomerID, req.CustomerName, "", "")
	if customerID == "" {
		customerID = "guest"
	}

	ctx := r.Context()
	var brandID string
	var supplierUserID *string
	err := db.Pool.QueryRow(ctx, `
		SELECT brand_id::text, supplier_user_id::text FROM catalog.chat_rooms WHERE id = $1
	`, roomID).Scan(&brandID, &supplierUserID)
	if err != nil {
		writeSupplierJSON(w, http.StatusNotFound, map[string]string{"error": "Sohbet odası bulunamadı."})
		return
	}

	msg, err := insertChatMessage(ctx, insertChatMessageParams{
		roomID:                  roomID,
		senderType:              "customer",
		senderID:                customerID,
		senderName:              customerName,
		messageType:             "text",
		content:                 content,
		metaBytes:               nil,
		incrementSupplierUnread: true,
	})
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Mesaj gönderilemedi."})
		return
	}

	h.publishEvent(chatRoomChannelPrefix+roomID, "new_message", msg)
	h.publishToSupplierChannels(brandID, supplierUserID, "new_message", msg)

	writeSupplierJSON(w, http.StatusCreated, msg)
}

func (h *ChatHandler) AcceptCustomOffer(w http.ResponseWriter, r *http.Request) {
	messageID := r.PathValue("message_id")
	if messageID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Mesaj kimliği eksik."})
		return
	}

	ctx := r.Context()
	var msg ChatMessageDTO
	var rawMeta []byte
	var brandID, customerID, customerName string
	var supplierUserID *string

	err := db.Pool.QueryRow(ctx, `
		SELECT m.id, m.room_id::text, m.sender_type, m.sender_id, m.sender_name,
		       m.message_type, m.content, m.metadata, m.is_read, m.created_at,
		       r.brand_id::text, r.supplier_user_id::text, r.customer_id, r.customer_name
		FROM catalog.chat_messages m
		JOIN catalog.chat_rooms r ON m.room_id = r.id
		WHERE m.id = $1 AND m.message_type = 'custom_offer'
	`, messageID).Scan(
		&msg.ID, &msg.RoomID, &msg.SenderType, &msg.SenderID, &msg.SenderName,
		&msg.MessageType, &msg.Content, &rawMeta, &msg.IsRead, &msg.CreatedAt,
		&brandID, &supplierUserID, &customerID, &customerName,
	)
	if err != nil {
		writeSupplierJSON(w, http.StatusNotFound, map[string]string{"error": "Özel fiyat teklifi bulunamadı."})
		return
	}

	_ = json.Unmarshal(rawMeta, &msg.Metadata)
	msg.Metadata.OfferStatus = "accepted"
	updatedMetaBytes, _ := json.Marshal(msg.Metadata)

	_, err = db.Pool.Exec(ctx, `
		UPDATE catalog.chat_messages SET metadata = $1::jsonb WHERE id = $2
	`, string(updatedMetaBytes), messageID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Teklif durumu güncellenemedi."})
		return
	}

	if authUserID, errAuth := verifyTokenAndGetUserID(r.Header.Get("Authorization")); errAuth == nil && authUserID != "" {
		upsertAcceptedOfferToServerCart(ctx, authUserID, messageID, msg.Metadata)
	}

	confirmText := fmt.Sprintf("✅ Özel Teklif Kabul Edildi: %s (%d Paket - Birim: %.2f %s)",
		msg.Metadata.Title, msg.Metadata.PackagesQty, msg.Metadata.OfferedUnitPrice, msg.Metadata.Currency)
	confirmMsg, errConfirm := insertChatMessage(ctx, insertChatMessageParams{
		roomID:                  msg.RoomID,
		senderType:              "customer",
		senderID:                customerID,
		senderName:              customerName,
		messageType:             "text",
		content:                 confirmText,
		metaBytes:               nil,
		incrementSupplierUnread: true,
	})

	h.publishEvent(chatRoomChannelPrefix+msg.RoomID, "offer_updated", msg)
	h.publishToSupplierChannels(brandID, supplierUserID, "offer_updated", msg)
	if errConfirm == nil {
		h.publishEvent(chatRoomChannelPrefix+msg.RoomID, "new_message", confirmMsg)
		h.publishToSupplierChannels(brandID, supplierUserID, "new_message", confirmMsg)
	}

	writeSupplierJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": msg,
	})
}

func upsertAcceptedOfferToServerCart(ctx context.Context, userID, messageID string, meta ChatOfferMetadata) {
	if meta.ProductID == "" {
		return
	}
	units := meta.UnitsPerPackage
	if units <= 0 {
		units = 1
	}
	pkgs := meta.PackagesQty
	if pkgs <= 0 {
		pkgs = 1
	}
	totalPieces := pkgs * units

	var cartID string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, userID).Scan(&cartID)
	if err != nil {
		var existingCartID string
		if errFind := db.Pool.QueryRow(ctx, `SELECT id FROM catalog.carts WHERE user_id = $1 LIMIT 1`, userID).Scan(&existingCartID); errFind == nil {
			cartID = existingCartID
		} else {
			return
		}
	}

	var existingItemID string
	errFindItem := db.Pool.QueryRow(ctx, `
		SELECT id FROM catalog.cart_items WHERE cart_id = $1 AND product_id = $2 LIMIT 1
	`, cartID, meta.ProductID).Scan(&existingItemID)

	switch errFindItem {
	case pgx.ErrNoRows:
		_, _ = db.Pool.Exec(ctx, `
			INSERT INTO catalog.cart_items (cart_id, product_id, quantity, custom_unit_price, offer_message_id)
			VALUES ($1, $2, $3, $4, $5)
		`, cartID, meta.ProductID, totalPieces, meta.OfferedUnitPrice, messageID)
	case nil:
		_, _ = db.Pool.Exec(ctx, `
			UPDATE catalog.cart_items
			SET quantity = $1, custom_unit_price = $2, offer_message_id = $3
			WHERE id = $4
		`, totalPieces, meta.OfferedUnitPrice, messageID, existingItemID)
	}
}

// ==========================================
// SUPPLIER PORTAL CHAT & SUB-USER TEAM HANDLERS (/api/v1/supplier/...)
// ==========================================

func (h *ChatHandler) ListSupplierRooms(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	scope := strings.TrimSpace(r.URL.Query().Get("scope"))
	var rows pgx.Rows
	var err error

	if scope == "mine" && claims.UserID != "" {
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			WHERE r.brand_id = $1 AND (r.supplier_user_id = $2 OR r.supplier_user_id IS NULL)
			ORDER BY r.last_message_at DESC
		`, claims.BrandID, claims.UserID)
	} else {
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			WHERE r.brand_id = $1
			ORDER BY r.last_message_at DESC
		`, claims.BrandID)
	}

	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sohbet odaları yüklenemedi."})
		return
	}
	defer rows.Close()

	writeSupplierJSON(w, http.StatusOK, scanRoomRows(rows))
}

func (h *ChatHandler) ListSupplierMessages(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	roomID := r.PathValue("room_id")
	ctx := r.Context()

	var roomBrandID string
	err := db.Pool.QueryRow(ctx, `SELECT brand_id::text FROM catalog.chat_rooms WHERE id = $1`, roomID).Scan(&roomBrandID)
	if err != nil || roomBrandID != claims.BrandID {
		writeSupplierJSON(w, http.StatusForbidden, map[string]string{"error": "Bu sohbet odasına erişim yetkiniz yok."})
		return
	}

	_, _ = db.Pool.Exec(ctx, `UPDATE catalog.chat_rooms SET unread_supplier_count = 0 WHERE id = $1`, roomID)

	messages, err := queryRoomMessages(ctx, roomID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Mesajlar yüklenemedi."})
		return
	}

	writeSupplierJSON(w, http.StatusOK, messages)
}

func (h *ChatHandler) SendSupplierMessage(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	roomID := r.PathValue("room_id")
	ctx := r.Context()

	var roomBrandID, customerID string
	err := db.Pool.QueryRow(ctx, `
		SELECT brand_id::text, customer_id FROM catalog.chat_rooms WHERE id = $1
	`, roomID).Scan(&roomBrandID, &customerID)
	if err != nil || roomBrandID != claims.BrandID {
		writeSupplierJSON(w, http.StatusForbidden, map[string]string{"error": "Bu sohbet odasına erişim yetkiniz yok."})
		return
	}

	var req SendSupplierMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz istek verisi."})
		return
	}

	brandLabel := claims.AliasCode
	if brandLabel == "" {
		brandLabel = claims.BrandName
	}
	senderName := brandLabel
	if claims.ContactName != "" {
		senderName = fmt.Sprintf("%s (%s)", claims.ContactName, brandLabel)
	}

	senderID := claims.UserID
	if senderID == "" {
		senderID = claims.BrandID
	}

	msgType := strings.TrimSpace(req.MessageType)
	if msgType == "" {
		msgType = "text"
	}

	var metaBytes []byte
	content := strings.TrimSpace(req.Content)

	if msgType == "custom_offer" {
		offerMeta, offerPreview, errOffer := buildCustomOfferMeta(ctx, claims.BrandID, req)
		if errOffer != nil {
			writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": errOffer.Error()})
			return
		}
		metaBytes, _ = json.Marshal(offerMeta)
		if content == "" {
			content = offerPreview
		}
	} else if content == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Mesaj metni boş olamaz."})
		return
	}

	msg, err := insertChatMessage(ctx, insertChatMessageParams{
		roomID:                  roomID,
		senderType:              "supplier",
		senderID:                senderID,
		senderName:              senderName,
		messageType:             msgType,
		content:                 content,
		metaBytes:               metaBytes,
		incrementSupplierUnread: false,
	})
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Mesaj kaydedilemedi."})
		return
	}

	h.publishEvent(chatRoomChannelPrefix+roomID, "new_message", msg)
	h.publishEvent("chat:customer#"+customerID, "new_message", msg)

	writeSupplierJSON(w, http.StatusCreated, msg)
}

func (h *ChatHandler) ListSupplierTeam(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	rows, err := db.Pool.Query(r.Context(), `
		SELECT id::text, brand_id::text, contact_name, email, COALESCE(phone, ''),
		       COALESCE(job_title, 'Satış Temsilcisi'), COALESCE(spoken_languages, 'TR'), is_owner, is_active
		FROM catalog.supplier_users
		WHERE brand_id = $1
		ORDER BY is_owner DESC, created_at ASC
	`, claims.BrandID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Temsilci listesi alınamadı."})
		return
	}
	defer rows.Close()

	members := []SupplierAgentDTO{}
	for rows.Next() {
		var m SupplierAgentDTO
		if err := rows.Scan(
			&m.ID, &m.BrandID, &m.ContactName, &m.Email, &m.Phone,
			&m.JobTitle, &m.SpokenLanguages, &m.IsOwner, &m.IsActive,
		); err == nil {
			members = append(members, m)
		}
	}

	writeSupplierJSON(w, http.StatusOK, members)
}

func (h *ChatHandler) CreateSupplierTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	var req CreateTeamMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz veri formatı."})
		return
	}

	req.ContactName = strings.TrimSpace(req.ContactName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.JobTitle = strings.TrimSpace(req.JobTitle)
	req.SpokenLanguages = strings.TrimSpace(req.SpokenLanguages)

	if req.ContactName == "" || req.Email == "" || len(req.Password) < 6 {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Temsilci adı, e-posta ve en az 6 karakterli şifre zorunludur."})
		return
	}
	if req.JobTitle == "" {
		req.JobTitle = "Satış Temsilcisi"
	}
	if req.SpokenLanguages == "" {
		req.SpokenLanguages = "TR"
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Şifre oluşturulamadı."})
		return
	}

	ctx := r.Context()
	var member SupplierAgentDTO
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.supplier_users (
			brand_id, email, password_hash, contact_name, phone, job_title, spoken_languages, is_active, is_owner
		) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, true, false)
		RETURNING id::text, brand_id::text, contact_name, email, COALESCE(phone, ''), job_title, spoken_languages, is_owner, is_active
	`, claims.BrandID, req.Email, string(hashed), req.ContactName, strings.TrimSpace(req.Phone), req.JobTitle, req.SpokenLanguages).Scan(
		&member.ID, &member.BrandID, &member.ContactName, &member.Email, &member.Phone,
		&member.JobTitle, &member.SpokenLanguages, &member.IsOwner, &member.IsActive,
	)
	if err != nil {
		writeSupplierJSON(w, http.StatusConflict, map[string]string{"error": "Bu e-posta adresi zaten kullanımda."})
		return
	}

	writeSupplierJSON(w, http.StatusCreated, member)
}

func (h *ChatHandler) DeleteSupplierTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok {
		writeSupplierJSON(w, http.StatusUnauthorized, map[string]string{"error": errMsgUnauthorized})
		return
	}

	memberID := strings.TrimSpace(r.PathValue("id"))
	if memberID == "" || memberID == claims.UserID {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Kendi aktif hesabınızı silemezsiniz."})
		return
	}

	_, err := db.Pool.Exec(r.Context(), `
		DELETE FROM catalog.supplier_users WHERE id = $1 AND brand_id = $2
	`, memberID, claims.BrandID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Alt kullanıcı silinemedi."})
		return
	}

	writeSupplierJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func buildCustomOfferMeta(ctx context.Context, supplierBrandID string, req SendSupplierMessageRequest) (ChatOfferMetadata, string, error) {
	if strings.TrimSpace(req.ProductID) == "" {
		return ChatOfferMetadata{}, "", fmt.Errorf("Teklif için ürün seçilmelidir.")
	}

	meta, prodBrandID, err := fetchProductCardMetadata(ctx, req.ProductID)
	if err != nil {
		return ChatOfferMetadata{}, "", fmt.Errorf("Seçilen ürün bulunamadı.")
	}
	if prodBrandID != supplierBrandID {
		return ChatOfferMetadata{}, "", fmt.Errorf("Yalnızca kendi markanıza ait ürünler için teklif verebilirsiniz.")
	}

	pkgs := req.PackagesQty
	if pkgs <= 0 {
		pkgs = 1
	}
	meta.PackagesQty = pkgs

	offeredPrice := req.OfferedUnitPrice
	discountPct := req.DiscountPercent

	if offeredPrice <= 0 && discountPct > 0 && discountPct < 95 {
		offeredPrice = math.Round(meta.OriginalUnitPrice*(1.0-discountPct/100.0)*100) / 100
	} else if offeredPrice > 0 && meta.OriginalUnitPrice > 0 {
		discountPct = math.Round(((meta.OriginalUnitPrice-offeredPrice)/meta.OriginalUnitPrice)*1000) / 10
		if discountPct < 0 {
			discountPct = 0
		}
	}

	if offeredPrice <= 0 {
		return ChatOfferMetadata{}, "", fmt.Errorf("Geçerli bir teklif birim fiyatı veya indirim oranı giriniz.")
	}

	meta.OfferedUnitPrice = offeredPrice
	meta.DiscountPercent = discountPct
	meta.OfferStatus = "pending"

	preview := fmt.Sprintf("🎁 Özel Fiyat Teklifi: %s (%d Paket - Birim: %.2f %s)", meta.Title, meta.PackagesQty, meta.OfferedUnitPrice, meta.Currency)
	return meta, preview, nil
}

// ==========================================
// ADMIN CHAT & SUB-USER MONITOR ENDPOINTS
// ==========================================

func (h *ChatHandler) ListAdminRooms(w http.ResponseWriter, r *http.Request) {
	brandID := strings.TrimSpace(r.URL.Query().Get("brand_id"))
	supplierUserID := strings.TrimSpace(r.URL.Query().Get("supplier_user_id"))

	var rows pgx.Rows
	var err error

	switch {
	case brandID != "" && supplierUserID != "":
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			WHERE r.brand_id = $1 AND r.supplier_user_id = $2
			ORDER BY r.last_message_at DESC
			LIMIT 200
		`, brandID, supplierUserID)
	case brandID != "":
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			WHERE r.brand_id = $1
			ORDER BY r.last_message_at DESC
			LIMIT 200
		`, brandID)
	case supplierUserID != "":
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			WHERE r.supplier_user_id = $1
			ORDER BY r.last_message_at DESC
			LIMIT 200
		`, supplierUserID)
	default:
		rows, err = db.Pool.Query(r.Context(), baseSelectRoomsSQL+`
			ORDER BY r.last_message_at DESC
			LIMIT 200
		`)
	}

	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Sohbet odaları listelenemedi."})
		return
	}
	defer rows.Close()

	writeSupplierJSON(w, http.StatusOK, scanRoomRows(rows))
}

func (h *ChatHandler) ListAdminMessages(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("room_id"))
	if roomID == "" {
		writeSupplierJSON(w, http.StatusBadRequest, map[string]string{"error": "Oda ID zorunludur."})
		return
	}

	messages, err := queryRoomMessages(r.Context(), roomID)
	if err != nil {
		writeSupplierJSON(w, http.StatusInternalServerError, map[string]string{"error": "Mesaj geçmişi yüklenemedi."})
		return
	}

	writeSupplierJSON(w, http.StatusOK, messages)
}
