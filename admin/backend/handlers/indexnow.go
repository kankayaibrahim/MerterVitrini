package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
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

// NotifyIndexNow sends a background POST request to IndexNow API
func NotifyIndexNow(urls []string) {
	if len(urls) == 0 {
		return
	}

	// Clean and validate urls list
	var cleanUrls []string
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" && (strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")) {
			cleanUrls = append(cleanUrls, u)
		}
	}

	if len(cleanUrls) == 0 {
		return
	}

	go func() {
		reqBody := IndexNowRequest{
			Host:        "mertervitrini.com.tr",
			Key:         "638d6e3eb8a743ec900269823f24ffe6",
			KeyLocation: "https://mertervitrini.com.tr/638d6e3eb8a743ec900269823f24ffe6.txt",
			URLList:     cleanUrls,
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			log.Printf("[IndexNow Error] Failed to marshal payload: %v", err)
			return
		}

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Post("https://api.indexnow.org/IndexNow", "application/json; charset=utf-8", bytes.NewBuffer(jsonData))
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
	}()
}

// SubmitManual URLs triggers IndexNow for custom paths submitted from Admin Panel
func (h *IndexNowHandler) SubmitManual(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
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

	// Trigger notifications
	NotifyIndexNow(req.URLs)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success","message":"URL'ler IndexNow kuyruğuna alındı ve gönderiliyor."}`))
}
