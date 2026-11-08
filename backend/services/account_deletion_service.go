package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"mertervitrini/backend/pkg/safe"
)

// AccountDeletionStrategy defines the OCP + LSP contract for role-specific account anonymization/deletion.
// Adding a new role (e.g., "sales_agent") requires only registering a new strategy without editing handler code.
type AccountDeletionStrategy interface {
	Role() string
	DeleteAccount(ctx context.Context, principal MobilePrincipal, reason string) error
}

// AccountDeletionRegistry coordinates cross-role audit/cleanup and dispatches to the matching AccountDeletionStrategy.
type AccountDeletionRegistry struct {
	mu         sync.RWMutex
	pool       *pgxpool.Pool
	strategies map[string]AccountDeletionStrategy
}

func NewAccountDeletionRegistry(pool *pgxpool.Pool, strategies ...AccountDeletionStrategy) *AccountDeletionRegistry {
	reg := &AccountDeletionRegistry{
		pool:       pool,
		strategies: make(map[string]AccountDeletionStrategy, len(strategies)),
	}
	for _, st := range strategies {
		reg.Register(st)
	}
	return reg
}

func (r *AccountDeletionRegistry) Register(strategy AccountDeletionStrategy) {
	if strategy == nil {
		return
	}
	role := strings.ToLower(strings.TrimSpace(strategy.Role()))
	if role == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.strategies[role] = strategy
}

func (r *AccountDeletionRegistry) Execute(ctx context.Context, principal MobilePrincipal, reason, clientIP string) error {
	role := strings.ToLower(strings.TrimSpace(principal.Role))
	r.mu.RLock()
	strategy, exists := r.strategies[role]
	r.mu.RUnlock()

	if !exists {
		return fmt.Errorf("bu kullanıcı rolü (%s) için hesap silme stratejisi tanımlı değil", role)
	}

	if r.pool != nil {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO identity.account_deletion_requests (user_id, user_role, email, reason, status, ip_address, processed_at)
			VALUES ($1, $2, $3, NULLIF($4, ''), 'completed', $5, CURRENT_TIMESTAMP)
		`, principal.UserID, role, principal.Email, strings.TrimSpace(reason), clientIP); err != nil {
			log.Printf("[ACCOUNT DELETION] Audit log insert warning: %v", err)
		}

		_, _ = r.pool.Exec(ctx, `DELETE FROM identity.mobile_devices WHERE user_id = $1`, principal.UserID)
		_, _ = r.pool.Exec(ctx, `DELETE FROM catalog.mobile_wishlist WHERE user_id = $1`, principal.UserID)
		_, _ = r.pool.Exec(ctx, `DELETE FROM catalog.mobile_notifications WHERE user_id = $1`, principal.UserID)
	}

	return strategy.DeleteAccount(ctx, principal, reason)
}

// SupplierDeletionStrategy anonymizes a supplier portal account while preserving B2B sub-order & ledger audit trails.
type SupplierDeletionStrategy struct {
	pool *pgxpool.Pool
}

func NewSupplierDeletionStrategy(pool *pgxpool.Pool) *SupplierDeletionStrategy {
	return &SupplierDeletionStrategy{pool: pool}
}

func (s *SupplierDeletionStrategy) Role() string {
	return "supplier"
}

func (s *SupplierDeletionStrategy) DeleteAccount(ctx context.Context, principal MobilePrincipal, _ string) error {
	if s.pool == nil {
		return nil
	}
	anonymizedEmail := fmt.Sprintf("deleted_sup_%d@deleted.mertervitrini.com.tr", time.Now().UnixNano())
	_, err := s.pool.Exec(ctx, `
		UPDATE catalog.supplier_users
		SET email = $1, contact_name = 'Silinmiş Tedarikçi Kullanıcısı', phone = NULL,
		    password_hash = NULL, is_active = false, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, anonymizedEmail, principal.UserID)
	return err
}

// KeycloakUserDeleter is an optional callback invoked asynchronously after local customer anonymization.
type KeycloakUserDeleter func(ctx context.Context, userID string) error

// CustomerDeletionStrategy anonymizes a customer identity, clears cart/addresses, and disables Keycloak SSO.
type CustomerDeletionStrategy struct {
	pool            *pgxpool.Pool
	keycloakDeleter KeycloakUserDeleter
}

func NewCustomerDeletionStrategy(pool *pgxpool.Pool, keycloakDeleter KeycloakUserDeleter) *CustomerDeletionStrategy {
	return &CustomerDeletionStrategy{
		pool:            pool,
		keycloakDeleter: keycloakDeleter,
	}
}

func (c *CustomerDeletionStrategy) Role() string {
	return "customer"
}

func (c *CustomerDeletionStrategy) DeleteAccount(ctx context.Context, principal MobilePrincipal, _ string) error {
	if c.pool != nil {
		anonymizedEmail := fmt.Sprintf("deleted_usr_%d@deleted.mertervitrini.com.tr", time.Now().UnixNano())
		if _, err := c.pool.Exec(ctx, `
			UPDATE identity.users
			SET email = $1, first_name = 'Silinmiş', last_name = 'Kullanıcı', phone = '',
			    is_active = false, is_blocked = true, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 OR lower(email) = lower($3)
		`, anonymizedEmail, principal.UserID, principal.Email); err != nil {
			return err
		}
		_, _ = c.pool.Exec(ctx, `DELETE FROM catalog.carts WHERE user_id = $1`, principal.UserID)
		_, _ = c.pool.Exec(ctx, `DELETE FROM identity.user_addresses WHERE user_id = $1`, principal.UserID)
	}

	if c.keycloakDeleter != nil && principal.UserID != "" {
		uidCopy := principal.UserID
		deleter := c.keycloakDeleter
		safe.Go("Keycloak Account Disable", func() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 8*time.Second)
			defer bgCancel()
			if err := deleter(bgCtx, uidCopy); err != nil {
				log.Printf("[ACCOUNT DELETION] Keycloak user delete skipped/failed for %s: %v", uidCopy, err)
			}
		})
	}
	return nil
}

