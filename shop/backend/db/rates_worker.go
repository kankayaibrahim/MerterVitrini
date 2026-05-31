package db

import (
	"context"
	"encoding/xml"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// XML Struct mappings for TCMB today.xml
type TarihDate struct {
	XMLName    xml.Name       `xml:"Tarih_Date"`
	Tarih      string         `xml:"Tarih,attr"`
	Date       string         `xml:"Date,attr"`
	Currencies []CurrencyNode `xml:"Currency"`
}

type CurrencyNode struct {
	CurrencyCode string `xml:"CurrencyCode,attr"`
	ForexBuying  string `xml:"ForexBuying"`
	ForexSelling string `xml:"ForexSelling"`
}

// StartRatesWorker starts the automated TCMB rate fetcher background routine
func StartRatesWorker(ctx context.Context) {
	log.Println("[TCMB WORKER] Starting TCMB Daily Exchange Rate Fetcher Goroutine...")

	// Perform an immediate initial sync check on boot to populate database if missing today's rate
	go func() {
		// Wait 5 seconds for app startup stability
		time.Sleep(5 * time.Second)
		log.Println("[TCMB WORKER] Running boot-time exchange rates sync check...")
		SyncTCMBRates()
	}()

	// Start daily scheduler loop
	go func() {
		for {
			now := time.Now()
			
			// Calculate the next target run time: 15:45 in Turkey Time
			loc, err := time.LoadLocation("Europe/Istanbul")
			if err != nil {
				// Fallback to UTC+3 if location package is missing on target OS
				loc = time.FixedZone("UTC+3", 3*60*60)
			}
			
			nowInTR := now.In(loc)
			targetRun := time.Date(nowInTR.Year(), nowInTR.Month(), nowInTR.Day(), 15, 45, 0, 0, loc)
			
			// If we are already past 15:45 today, schedule for 15:45 tomorrow
			if nowInTR.After(targetRun) {
				targetRun = targetRun.Add(24 * time.Hour)
			}
			
			durationToSleep := targetRun.Sub(nowInTR)
			log.Printf("[TCMB WORKER] Next scheduled daily TCMB sync in: %v (Target: %v)\n", durationToSleep.Round(time.Second), targetRun.Format("2006-01-02 15:04:05 MST"))
			
			select {
			case <-ctx.Done():
				log.Println("[TCMB WORKER] Background worker stopped.")
				return
			case <-time.After(durationToSleep):
				log.Println("[TCMB WORKER] Triggering scheduled daily TCMB sync...")
				SyncTCMBRates()
			}
		}
	}()
}

// SyncTCMBRates fetches, parses, and upserts TCMB today.xml exchange rates
func SyncTCMBRates() {
	url := "https://www.tcmb.gov.tr/kurlar/today.xml"
	log.Printf("[TCMB WORKER] Querying today XML from: %s\n", url)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Printf("[TCMB WORKER ERROR] Failed to create HTTP request: %v\n", err)
		return
	}
	
	// Add user agent to avoid TCMB blocking
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[TCMB WORKER ERROR] HTTP request failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[TCMB WORKER ERROR] TCMB returned non-200 status: %d\n", resp.StatusCode)
		return
	}

	xmlData, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[TCMB WORKER ERROR] Failed to read body: %v\n", err)
		return
	}

	var td TarihDate
	if err := xml.Unmarshal(xmlData, &td); err != nil {
		log.Printf("[TCMB WORKER ERROR] Failed to parse XML: %v\n", err)
		return
	}

	// Parse date
	tarihStr := strings.TrimSpace(td.Tarih)
	if tarihStr == "" {
		tarihStr = strings.TrimSpace(td.Date)
	}
	if tarihStr == "" {
		log.Println("[TCMB WORKER ERROR] Missing date attribute in XML.")
		return
	}

	// Date parsing logic (supports DD.MM.YYYY or MM/DD/YYYY)
	var pubDate time.Time
	if strings.Contains(tarihStr, ".") {
		pubDate, err = time.Parse("02.01.2006", tarihStr)
	} else if strings.Contains(tarihStr, "/") {
		pubDate, err = time.Parse("01/02/2006", tarihStr)
	} else {
		log.Printf("[TCMB WORKER ERROR] Unknown date format: %s\n", tarihStr)
		return
	}

	log.Printf("[TCMB WORKER] Parse succeeded. Official publication date: %s\n", pubDate.Format("2006-01-02"))

	targetCurrencies := map[string]bool{
		"USD": true,
		"EUR": true,
		"GBP": true,
		"CHF": true,
		"RUB": true,
		"PLN": true,
		"BGN": true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	upsertCount := 0
	for _, c := range td.Currencies {
		if targetCurrencies[c.CurrencyCode] {
			buyingStr := strings.TrimSpace(c.ForexBuying)
			sellingStr := strings.TrimSpace(c.ForexSelling)
			if buyingStr == "" || sellingStr == "" {
				continue
			}

			buyingRate, err1 := strconv.ParseFloat(buyingStr, 64)
			sellingRate, err2 := strconv.ParseFloat(sellingStr, 64)
			if err1 != nil || err2 != nil {
				continue
			}

			_, err = Pool.Exec(ctx, `
				INSERT INTO catalog.exchange_rates (currency_code, buying_rate, selling_rate, publication_date)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (currency_code, publication_date)
				DO UPDATE SET
					buying_rate = EXCLUDED.buying_rate,
					selling_rate = EXCLUDED.selling_rate,
					updated_at = CURRENT_TIMESTAMP
			`, c.CurrencyCode, buyingRate, sellingRate, pubDate)
			if err != nil {
				log.Printf("[TCMB WORKER ERROR] Failed to upsert %s to DB: %v\n", c.CurrencyCode, err)
			} else {
				upsertCount++
				log.Printf("[TCMB WORKER] Synced %s -> Buying: %.4f, Selling: %.4f\n", c.CurrencyCode, buyingRate, sellingRate)
			}
		}
	}

	log.Printf("[TCMB WORKER SUCCESS] TCMB exchange rates sync complete! Upserted %d currencies.\n", upsertCount)
}
