package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"mertervitrini/backend/pkg/safe"
)

// NotificationDispatcher defines the DIP contract for asynchronous customer & supplier notifications.
type NotificationDispatcher interface {
	NotifyUserAsync(userID, userRole, title, body, notifType string, metadata map[string]any)
	NotifySupplierBrandAsync(brandID, title, body, notifType string, metadata map[string]any)
	NotifySupplierChatAsync(brandID string, supplierUserID *string, customerName, preview, roomID string)
}

// PostgresNotificationDispatcher persists in-app notifications into catalog.mobile_notifications.
type PostgresNotificationDispatcher struct {
	pool *pgxpool.Pool
}

func NewPostgresNotificationDispatcher(pool *pgxpool.Pool) *PostgresNotificationDispatcher {
	return &PostgresNotificationDispatcher{pool: pool}
}

func (d *PostgresNotificationDispatcher) NotifyUserAsync(userID, userRole, title, body, notifType string, metadata map[string]any) {
	uid := strings.TrimSpace(userID)
	if uid == "" || uid == "guest" || uid == "anon" || d == nil || d.pool == nil {
		return
	}

	pool := d.pool
	safe.Go("Mobile Notification Insert", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		metaBytes := []byte("{}")
		if len(metadata) > 0 {
			if b, err := json.Marshal(metadata); err == nil {
				metaBytes = b
			}
		}

		if _, err := pool.Exec(ctx, `
			INSERT INTO catalog.mobile_notifications (user_id, user_role, title, body, notification_type, metadata)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		`, uid, userRole, title, body, notifType, string(metaBytes)); err != nil {
			log.Printf("[NOTIFICATION] Failed to insert notification for user=%s: %v", uid, err)
		}
	})
}

func (d *PostgresNotificationDispatcher) NotifySupplierBrandAsync(brandID, title, body, notifType string, metadata map[string]any) {
	bid := strings.TrimSpace(brandID)
	if bid == "" || d == nil || d.pool == nil {
		return
	}

	pool := d.pool
	safe.Go("Supplier Brand Notification", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		rows, err := pool.Query(ctx, `
			SELECT id::text FROM catalog.supplier_users WHERE brand_id = $1 AND is_active = true
		`, bid)
		if err != nil {
			log.Printf("[NOTIFICATION] Failed to query brand users (brand=%s): %v", bid, err)
			return
		}
		defer rows.Close()

		var ids []string
		for rows.Next() {
			var id string
			if scanErr := rows.Scan(&id); scanErr == nil && id != "" {
				ids = append(ids, id)
			}
		}
		for _, id := range ids {
			d.NotifyUserAsync(id, "supplier", title, body, notifType, metadata)
		}
	})
}

func (d *PostgresNotificationDispatcher) NotifySupplierChatAsync(brandID string, supplierUserID *string, customerName, preview, roomID string) {
	if d == nil {
		return
	}
	title := fmt.Sprintf("💬 %s mesaj gönderdi", customerName)
	meta := map[string]any{"room_id": roomID, "brand_id": brandID}
	if supplierUserID != nil && strings.TrimSpace(*supplierUserID) != "" {
		d.NotifyUserAsync(*supplierUserID, "supplier", title, preview, "chat_message", meta)
		return
	}
	d.NotifySupplierBrandAsync(brandID, title, preview, "chat_message", meta)
}

// NoopNotificationDispatcher is a safe Null-Object implementation (LSP) for unit tests or offline modes.
type NoopNotificationDispatcher struct{}

func (NoopNotificationDispatcher) NotifyUserAsync(string, string, string, string, string, map[string]any) {
	// Intentionally no-op: Null-Object pattern (LSP) used in unit tests and offline environments.
}

func (NoopNotificationDispatcher) NotifySupplierBrandAsync(string, string, string, string, map[string]any) {
	// Intentionally no-op: Null-Object pattern (LSP) used in unit tests and offline environments.
}

func (NoopNotificationDispatcher) NotifySupplierChatAsync(string, *string, string, string, string) {
	// Intentionally no-op: Null-Object pattern (LSP) used in unit tests and offline environments.
}

