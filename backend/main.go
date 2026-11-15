package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/handlers"
	"mertervitrini/backend/pkg/logger"
	"mertervitrini/backend/pkg/safe"
)

//go:embed docs/swagger.yaml
var swaggerYAML []byte

//go:embed docs/swagger.html
var swaggerHTML []byte

const headerContentType = "Content-Type"

func main() {
	logDir, err := logger.Init("")
	if err != nil {
		log.Printf("Warning: Failed to initialize file logger: %v\n", err)
	}
	defer logger.Close()

	log.Println("==================================================")
	log.Println("Merter Vitrini Unified Backend Service Starting...")
	log.Printf("Active File Log Directory: %s\n", logDir)
	log.Println("==================================================")

	cfg := config.LoadConfig()

	dbPool, err := db.ConnectDB(cfg)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to connect to PostgreSQL database: %v", err)
	}
	defer db.CloseDB()
	log.Println("Database connection pool established successfully!")

	if cfg.RedisURL != "" {
		if _, err = db.ConnectRedis(cfg); err != nil {
			log.Printf("[WARNING] Redis connection failed: %v. Synchronization progress tracking will fall back to Go processes.", err)
		} else {
			defer db.CloseRedis()
		}
	}

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	initBackgroundWorkers(appCtx, cfg)
	releaseStuckSyncRuns(dbPool.Exec)

	appHandlers := NewAppHandlers(cfg)
	rootHandler := BuildRouter(cfg, appHandlers)

	server := &http.Server{
		Addr:              ":" + cfg.ServerPort,
		Handler:           withStreamingWriteDeadlines(rootHandler),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	safe.Go("HTTP Server Listener", func() {
		log.Printf("[SERVER] Unified Backend API successfully listening on port :%s\n", cfg.ServerPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	})

	<-stopChan
	log.Println("Shutting down unified backend service gracefully...")
	appCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped. Good bye!")
}

func withStreamingWriteDeadlines(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/ws") || strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
			_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
		} else if strings.Contains(path, "/mobile/apk") || strings.Contains(path, "/export") || strings.HasSuffix(path, "/images") {
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(10 * time.Minute))
		}
		next.ServeHTTP(w, r)
	})
}

func initBackgroundWorkers(appCtx context.Context, cfg *config.Config) {
	cronInitCtx, cronInitCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cronInitCancel()

	if err := handlers.ProvisionCronTables(cronInitCtx); err != nil {
		log.Printf("[WARNING] Failed to provision cron tables: %v\n", err)
	} else {
		log.Println("Cron scheduler database tables successfully provisioned/verified!")
		handlers.StartCronScheduler(appCtx)
	}

	if err := handlers.EnsureIndexNowSchema(cronInitCtx); err != nil {
		log.Printf("[WARNING] Failed to provision IndexNow logs schema: %v\n", err)
	}
	if err := handlers.EnsureCustomerImpersonationSchema(cronInitCtx); err != nil {
		log.Printf("[WARNING] Failed to provision impersonation logs schema: %v\n", err)
	}
	if err := handlers.EnsureNotificationSettingsSchema(cronInitCtx); err != nil {
		log.Printf("[WARNING] Failed to provision notification settings schema: %v\n", err)
	} else {
		handlers.StartDailyDigestScheduler(appCtx, cfg)
	}

	db.StartRatesWorker(appCtx)
	handlers.StartUnverifiedApplicationsCleaner()
	handlers.TriggerCustomerGeoBackfillAsync()
}

type sqlExecFunc[R interface{ RowsAffected() int64 }] func(ctx context.Context, sql string, arguments ...any) (R, error)

func releaseStuckSyncRuns[R interface{ RowsAffected() int64 }](execFn sqlExecFunc[R]) {
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cleanupCancel()

	summaryBytes, err := json.Marshal(map[string]any{"error": "Sunucu yeniden başlatıldığı için işlem kesintiye uğradı."})
	if err != nil {
		return
	}
	cleanupRes, cleanupErr := execFn(cleanupCtx, "UPDATE integration.sync_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP, summary = $1 WHERE status = 'running'", summaryBytes)
	if cleanupErr == nil && cleanupRes.RowsAffected() > 0 {
		log.Printf("[CLEANUP] Automatically released %d stuck running sync runs to failed status.\n", cleanupRes.RowsAffected())
	}
}
