package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"

	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/safe"
)

const (
	indexNowHost        = "mertervitrini.com.tr"
	indexNowKey         = "638d6e3eb8a743ec900269823f24ffe6"
	indexNowKeyLocation = "https://mertervitrini.com.tr/638d6e3eb8a743ec900269823f24ffe6.txt"
	indexNowEndpoint    = "https://api.indexnow.org/IndexNow"
)

type IndexNowHandler struct{}

func NewIndexNowHandler() *IndexNowHandler {
	return &IndexNowHandler{}
}

type IndexNowRequest struct {
	Host        string   `json:"host"`
	Key         string   `json:"key"`
	KeyLocation string   `json:"keyLocation"`
	URLList     []string `json:"urlList"`
}

func isIndexNowLocalOrDev() bool {
	if strings.TrimSpace(os.Getenv("ENABLE_INDEXNOW")) == "1" {
		return false
	}
	if strings.TrimSpace(os.Getenv("DISABLE_INDEXNOW")) == "1" || runtime.GOOS == "windows" {
		return true
	}
	for _, envKey := range []string{"APP_ENV", "GO_ENV", "ENV"} {
		val := strings.ToLower(strings.TrimSpace(os.Getenv(envKey)))
		if val == "dev" || val == "development" || val == "local" || val == "test" {
			return true
		}
	}
	siteEnv := strings.ToLower(strings.TrimSpace(os.Getenv("SITE_URL")))
	return strings.Contains(siteEnv, "localhost") || strings.Contains(siteEnv, "127.0.0.1")
}

// NotifyIndexNowProductSlug proactively notifies Bing & Yandex IndexNow for a newly created/updated product slug and its primary localized URLs.
func NotifyIndexNowProductSlug(slug string) {
	cleanSlug := strings.Trim(strings.TrimSpace(slug), "/")
	if cleanSlug == "" || isIndexNowLocalOrDev() {
		return
	}
	escaped := url.PathEscape(cleanSlug)
	baseProductURL := fmt.Sprintf("%s/product/%s", siteBaseURL, escaped)
	urls := []string{
		baseProductURL,
		baseProductURL + "?lang=en",
		baseProductURL + "?lang=ru",
		baseProductURL + "?lang=ar",
	}
	NotifyIndexNow(urls)
}

// NotifyIndexNow sends a background POST request to IndexNow API.
func NotifyIndexNow(urls []string) {
	if len(urls) == 0 {
		return
	}

	var cleanUrls []string
	seen := make(map[string]bool, len(urls))
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" && (strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")) && !seen[u] {
			seen[u] = true
			cleanUrls = append(cleanUrls, u)
		}
	}

	if len(cleanUrls) == 0 {
		return
	}

	safe.Go("IndexNow URL Submission", func() {
		reqBody := IndexNowRequest{
			Host:        indexNowHost,
			Key:         indexNowKey,
			KeyLocation: indexNowKeyLocation,
			URLList:     cleanUrls,
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			log.Printf("[IndexNow Error] Failed to marshal payload: %v", err)
			return
		}

		resp, err := httpclient.DefaultPooledClient.Post(indexNowEndpoint, "application/json; charset=utf-8", bytes.NewBuffer(jsonData))
		if err != nil {
			log.Printf("[IndexNow Error] POST request failed: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
			log.Printf("[IndexNow Warning] API returned status code %d", resp.StatusCode)
		} else {
			log.Printf("[IndexNow Success] Successfully submitted %d URLs to IndexNow engine", len(cleanUrls))
		}
	})
}

// SubmitManual triggers IndexNow for custom paths submitted from Admin Panel.
func (h *IndexNowHandler) SubmitManual(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		URLs []string `json:"urls"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if len(req.URLs) == 0 {
		http.Error(w, `{"error":"Gönderilecek en az bir URL belirtmelisiniz."}`, http.StatusBadRequest)
		return
	}

	NotifyIndexNow(req.URLs)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_, _ = w.Write([]byte(`{"status":"success","message":"URL'ler IndexNow kuyruğuna alındı ve gönderiliyor."}`))
}
