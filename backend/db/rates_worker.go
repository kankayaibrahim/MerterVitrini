package db

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mertervitrini/backend/pkg/httpclient"
	"mertervitrini/backend/pkg/safe"
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
	safe.Go("TCMB Initial Boot Sync", func() {
		time.Sleep(5 * time.Second)
		log.Println("[TCMB WORKER] Running boot-time exchange rates sync check...")
		SyncTCMBRates()
	})

	// Start daily scheduler loop
	safe.Go("TCMB Daily Scheduler Loop", func() {
		for {
			now := time.Now()
			
			loc, err := time.LoadLocation("Europe/Istanbul")
			if err != nil {
				loc = time.FixedZone("UTC+3", 3*60*60)
			}
			
			nowInTR := now.In(loc)
			targetRun := time.Date(nowInTR.Year(), nowInTR.Month(), nowInTR.Day(), 15, 45, 0, 0, loc)
			
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
	})
}

func fetchTCMBXml(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	resp, err := httpclient.FastClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TCMB returned non-200 status: %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func parseTCMBDate(tarih, date string) (time.Time, error) {
	tarihStr := strings.TrimSpace(tarih)
	if tarihStr == "" {
		tarihStr = strings.TrimSpace(date)
	}
	if tarihStr == "" {
		return time.Time{}, errors.New("missing date attribute in XML")
	}
	if strings.Contains(tarihStr, ".") {
		return time.Parse("02.01.2006", tarihStr)
	}
	if strings.Contains(tarihStr, "/") {
		return time.Parse("01/02/2006", tarihStr)
	}
	return time.Time{}, fmt.Errorf("unknown date format: %s", tarihStr)
}

func upsertSingleCurrency(ctx context.Context, c CurrencyNode, targetCurrencies map[string]bool, pubDate time.Time) bool {
	if !targetCurrencies[c.CurrencyCode] {
		return false
	}
	buyingStr := strings.TrimSpace(c.ForexBuying)
	sellingStr := strings.TrimSpace(c.ForexSelling)
	if buyingStr == "" || sellingStr == "" {
		return false
	}

	buyingRate, err1 := strconv.ParseFloat(buyingStr, 64)
	sellingRate, err2 := strconv.ParseFloat(sellingStr, 64)
	if err1 != nil || err2 != nil {
		return false
	}

	_, err := Pool.Exec(ctx, `
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
		return false
	}
	log.Printf("[TCMB WORKER] Synced %s -> Buying: %.4f, Selling: %.4f\n", c.CurrencyCode, buyingRate, sellingRate)
	return true
}

// SyncTCMBRates fetches, parses, and upserts TCMB today.xml exchange rates
func SyncTCMBRates() {
	url := "https://www.tcmb.gov.tr/kurlar/today.xml"
	log.Printf("[TCMB WORKER] Querying today XML from: %s\n", url)

	xmlData, err := fetchTCMBXml(url)
	if err != nil {
		log.Printf("[TCMB WORKER ERROR] %v\n", err)
		return
	}

	var td TarihDate
	if err := xml.Unmarshal(xmlData, &td); err != nil {
		log.Printf("[TCMB WORKER ERROR] Failed to parse XML: %v\n", err)
		return
	}

	pubDate, err := parseTCMBDate(td.Tarih, td.Date)
	if err != nil {
		log.Printf("[TCMB WORKER ERROR] %v\n", err)
		return
	}
	log.Printf("[TCMB WORKER] Parse succeeded. Official publication date: %s\n", pubDate.Format("2006-01-02"))

	targetCurrencies := map[string]bool{
		"USD": true, "EUR": true, "GBP": true, "CHF": true,
		"RUB": true, "PLN": true, "BGN": true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	upsertCount := 0
	for _, c := range td.Currencies {
		if upsertSingleCurrency(ctx, c, targetCurrencies, pubDate) {
			upsertCount++
		}
	}

	log.Printf("[TCMB WORKER SUCCESS] TCMB exchange rates sync complete! Upserted %d currencies.\n", upsertCount)
}
