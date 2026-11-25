package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsClientCanceledAndContextCanceled(t *testing.T) {
	pgCancelErr := errors.New("ERROR: canceling statement due to user request (SQLSTATE 57014)")

	// Canceled request context + wrapped/SQLSTATE 57014 error => true
	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	canceledReq := httptest.NewRequest(http.MethodGet, "/api/v1/store/products", nil).WithContext(canceledCtx)

	if !isClientCanceled(canceledReq, pgCancelErr) {
		t.Fatal("expected isClientCanceled to return true when request context is canceled")
	}
	if !isClientCanceled(canceledReq, fmt.Errorf("wrap: %w", context.Canceled)) {
		t.Fatal("expected isClientCanceled to return true for wrapped context.Canceled")
	}
	if !isContextCanceled(canceledCtx, pgCancelErr) {
		t.Fatal("expected isContextCanceled to return true when context is canceled")
	}

	// Nil error => false even if context is canceled
	if isClientCanceled(canceledReq, nil) || isContextCanceled(canceledCtx, nil) {
		t.Fatal("expected false when error is nil")
	}

	// Active request context + deadline exceeded / ordinary error => false
	activeReq := httptest.NewRequest(http.MethodGet, "/api/v1/store/products", nil)
	if isClientCanceled(activeReq, context.DeadlineExceeded) {
		t.Fatal("expected false for DeadlineExceeded on active request")
	}
	if isClientCanceled(activeReq, errors.New("db connection error")) {
		t.Fatal("expected false for ordinary DB error on active request")
	}
	if isContextCanceled(context.Background(), context.DeadlineExceeded) {
		t.Fatal("expected isContextCanceled false for DeadlineExceeded on active context")
	}
}
