package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// DailyFileWriter handles thread-safe daily rotating file writes
type DailyFileWriter struct {
	mu          sync.Mutex
	dir         string
	prefix      string
	currentDate string
	currentFile *os.File
}

func NewDailyFileWriter(dir, prefix string) (*DailyFileWriter, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &DailyFileWriter{
		dir:    dir,
		prefix: prefix,
	}, nil
}

func (w *DailyFileWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	dateStr := time.Now().Format("2006-01-02")
	if dateStr != w.currentDate {
		if w.currentFile != nil {
			_ = w.currentFile.Close()
		}

		filename := fmt.Sprintf("%s-%s.log", w.prefix, dateStr)
		filePath := filepath.Join(w.dir, filename)
		f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return 0, err
		}
		w.currentFile = f
		w.currentDate = dateStr
	}

	return w.currentFile.Write(p)
}

func (w *DailyFileWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.currentFile != nil {
		err := w.currentFile.Close()
		w.currentFile = nil
		return err
	}
	return nil
}

// ErrorHookFunc receives severe log, HTTP 5xx, and panic notifications without blocking callers.
type ErrorHookFunc func(severity, source, message, stack string)

var (
	globalMainWriter  *DailyFileWriter
	globalErrorWriter *DailyFileWriter
	initOnce          sync.Once
	activeLogDir      string
	errorHookMu       sync.RWMutex
	globalErrorHook   ErrorHookFunc
)

// RegisterErrorHook registers a centralized error monitor hook for panic & error-burst alerting.
func RegisterErrorHook(fn ErrorHookFunc) {
	errorHookMu.Lock()
	defer errorHookMu.Unlock()
	globalErrorHook = fn
}

// NotifyError dispatches an error or HTTP 5xx signal to the registered monitor hook asynchronously/non-blocking.
func NotifyError(severity, source, message, stack string) {
	errorHookMu.RLock()
	hook := globalErrorHook
	errorHookMu.RUnlock()
	if hook != nil {
		hook(severity, source, message, stack)
	}
}

// ResolveLogDirectory selects the best writable logs directory across environments
func ResolveLogDirectory(preferredDir string) string {
	candidates := []string{
		preferredDir,
		"logs",
		"./logs",
		filepath.Join(".", "logs"),
	}

	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "logs"))
	}

	// Server production path
	candidates = append(candidates, "/var/www/mertervitrini.com.tr/backend/logs")

	for _, cand := range candidates {
		if cand == "" {
			continue
		}
		if err := os.MkdirAll(cand, 0755); err == nil {
			testFile := filepath.Join(cand, ".test_write")
			if f, err := os.Create(testFile); err == nil {
				_ = f.Close()
				_ = os.Remove(testFile)
				return cand
			}
		}
	}

	return os.TempDir()
}

// Init initializes the centralized dual logging system (all logs + dedicated error logs)
func Init(preferredDir string) (string, error) {
	var initErr error
	initOnce.Do(func() {
		activeLogDir = ResolveLogDirectory(preferredDir)

		mainW, err := NewDailyFileWriter(activeLogDir, "backend")
		if err != nil {
			initErr = fmt.Errorf("failed to initialize main log file: %w", err)
			return
		}
		globalMainWriter = mainW

		errW, err := NewDailyFileWriter(activeLogDir, "error")
		if err != nil {
			initErr = fmt.Errorf("failed to initialize error log file: %w", err)
			return
		}
		globalErrorWriter = errW

		// Standard Go log output sends to both stdout and daily backend log file
		multiWriter := io.MultiWriter(os.Stdout, globalMainWriter)
		log.SetOutput(multiWriter)
		log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)
	})

	return activeLogDir, initErr
}

// GetLogDir returns the active log directory path
func GetLogDir() string {
	return activeLogDir
}

// Close gracefully closes open log file descriptors
func Close() {
	if globalMainWriter != nil {
		_ = globalMainWriter.Close()
	}
	if globalErrorWriter != nil {
		_ = globalErrorWriter.Close()
	}
}

func logMessage(level, prefix, msg string) {
	timestamp := time.Now().Format("2006/01/02 15:04:05.000000")
	line := fmt.Sprintf("%s [%s] %s%s\n", timestamp, level, prefix, msg)

	// Write to console and main log
	if globalMainWriter != nil {
		_, _ = globalMainWriter.Write([]byte(line))
	}
	_, _ = os.Stdout.WriteString(line)
}

func Info(v ...any) {
	logMessage("INFO", "", fmt.Sprint(v...))
}

func Infof(format string, v ...any) {
	logMessage("INFO", "", fmt.Sprintf(format, v...))
}

func Warn(v ...any) {
	logMessage("WARN", "", fmt.Sprint(v...))
}

func Warnf(format string, v ...any) {
	logMessage("WARN", "", fmt.Sprintf(format, v...))
}

func Error(v ...any) {
	msg := fmt.Sprint(v...)
	logMessage("ERROR", "", msg)
	logToErrorFile(msg, nil)
	if !strings.HasPrefix(msg, "[API]") {
		NotifyError("error", "logger", msg, "")
	}
}

func Errorf(format string, v ...any) {
	msg := fmt.Sprintf(format, v...)
	logMessage("ERROR", "", msg)
	logToErrorFile(msg, nil)
	if !strings.HasPrefix(msg, "[API]") {
		NotifyError("error", "logger", msg, "")
	}
}

func Fatal(v ...any) {
	msg := fmt.Sprint(v...)
	logMessage("FATAL", "", msg)
	logToErrorFile(msg, nil)
	NotifyError("panic", "fatal", msg, "")
	os.Exit(1)
}

func Fatalf(format string, v ...any) {
	msg := fmt.Sprintf(format, v...)
	logMessage("FATAL", "", msg)
	logToErrorFile(msg, nil)
	NotifyError("panic", "fatal", msg, "")
	os.Exit(1)
}

// LogPanic captures an unhandled panic and stack trace and commits it immediately to the error log file
func LogPanic(contextMsg string, r any, stack []byte) {
	errText := fmt.Sprintf("CRITICAL PANIC: %s: %v\nStack Trace:\n%s", contextMsg, r, string(stack))
	logMessage("PANIC", "[RECOVERED] ", errText)
	logToErrorFile(errText, stack)
	NotifyError("panic", contextMsg, fmt.Sprintf("%v", r), string(stack))
}

func logToErrorFile(msg string, stack []byte) {
	if globalErrorWriter == nil {
		return
	}
	timestamp := time.Now().Format("2006/01/02 15:04:05.000000")
	var entry string
	if len(stack) > 0 {
		entry = fmt.Sprintf("==================================================\n%s [ERROR/PANIC]\n%s\n==================================================\n\n", timestamp, msg)
	} else {
		entry = fmt.Sprintf("%s [ERROR] %s\n", timestamp, msg)
	}
	_, _ = globalErrorWriter.Write([]byte(entry))
}
