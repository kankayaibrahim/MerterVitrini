package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/httpx"
)

type MobileNotificationDTO struct {
	ID               string         `json:"id"`
	Title            string         `json:"title"`
	Body             string         `json:"body"`
	NotificationType string         `json:"notification_type"`
	Metadata         map[string]any `json:"metadata"`
	IsRead           bool           `json:"is_read"`
	CreatedAt        time.Time      `json:"created_at"`
}

func (h *MobileHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	principal, err := h.Tokens.ResolvePrincipal(ctx, r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	var unreadCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM catalog.mobile_notifications
		WHERE user_id = $1 AND user_role = $2 AND is_read = false
	`, principal.UserID, principal.Role).Scan(&unreadCount)

	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, title, body, notification_type, metadata, is_read, created_at
		FROM catalog.mobile_notifications
		WHERE user_id = $1 AND user_role = $2
		ORDER BY created_at DESC
		LIMIT 50
	`, principal.UserID, principal.Role)
	if err != nil {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"notifications": []MobileNotificationDTO{},
			"unread_count":  0,
		})
		return
	}
	defer rows.Close()

	list := make([]MobileNotificationDTO, 0, 16)
	for rows.Next() {
		var item MobileNotificationDTO
		var rawMeta []byte
		if err := rows.Scan(&item.ID, &item.Title, &item.Body, &item.NotificationType, &rawMeta, &item.IsRead, &item.CreatedAt); err == nil {
			item.Metadata = make(map[string]any)
			if len(rawMeta) > 0 {
				_ = json.Unmarshal(rawMeta, &item.Metadata)
			}
			list = append(list, item)
		}
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"notifications": list,
		"unread_count":  unreadCount,
	})
}

func (h *MobileHandler) MarkNotificationsReadAll(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	principal, err := h.Tokens.ResolvePrincipal(ctx, r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	_, _ = db.Pool.Exec(ctx, `
		UPDATE catalog.mobile_notifications
		SET is_read = true
		WHERE user_id = $1 AND user_role = $2 AND is_read = false
	`, principal.UserID, principal.Role)

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *MobileHandler) ListWishlist(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errMsgLoginRequired)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, mobileCatalogSelectPrefix+`
		AND p.id IN (SELECT product_id FROM catalog.mobile_wishlist WHERE user_id = $1)
		ORDER BY p.created_at DESC
	`, userID)
	if err != nil {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"products":    []*models.Product{},
			"product_ids": []string{},
		})
		return
	}
	defer rows.Close()

	prods, _ := scanCatalogProducts(rows)
	if prods == nil {
		prods = []*models.Product{}
	}
	ids := make([]string, 0, len(prods))
	for _, p := range prods {
		ids = append(ids, p.ID)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"products":    prods,
		"product_ids": ids,
	})
}

func (h *MobileHandler) AddWishlistItem(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errMsgLoginRequired)
		return
	}

	productID := strings.TrimSpace(r.PathValue("product_id"))
	if productID == "" {
		httpx.Error(w, http.StatusBadRequest, "Ürün kimliği zorunludur.")
		return
	}

	_, err = db.Pool.Exec(r.Context(), `
		INSERT INTO catalog.mobile_wishlist (user_id, product_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, product_id) DO NOTHING
	`, userID, productID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Ürün favorilere eklenemedi.")
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]bool{"success": true})
}

func (h *MobileHandler) RemoveWishlistItem(w http.ResponseWriter, r *http.Request) {
	userID, err := verifyTokenAndGetUserID(r.Header.Get("Authorization"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, errMsgLoginRequired)
		return
	}

	productID := strings.TrimSpace(r.PathValue("product_id"))
	_, _ = db.Pool.Exec(r.Context(), `
		DELETE FROM catalog.mobile_wishlist WHERE user_id = $1 AND product_id = $2
	`, userID, productID)

	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

