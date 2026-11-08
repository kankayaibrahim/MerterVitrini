package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
)

const (
	HeaderContentType   = "Content-Type"
	MimeApplicationJSON = "application/json; charset=utf-8"
	DefaultMaxJSONBytes = 1 << 20 // 1 MB
)

// JSON writes a typed JSON HTTP response with explicit error logging instead of silent error suppression.
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set(HeaderContentType, MimeApplicationJSON)
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("[HTTPX] JSON encode failed (status=%d): %v", status, err)
	}
}

// Error writes a standardized {"error": "..."} JSON response.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

// DecodeJSON safely decodes a bounded JSON request body into dst.
func DecodeJSON(r *http.Request, dst any, maxBytes int64) error {
	if r == nil || r.Body == nil {
		return errors.New("istek gövdesi boş")
	}
	limit := maxBytes
	if limit <= 0 {
		limit = DefaultMaxJSONBytes
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, limit))
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

