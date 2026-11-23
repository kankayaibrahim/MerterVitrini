package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// LogFileInfo describes a rotatable or active daily log file in activeLogDir.
type LogFileInfo struct {
	Name      string    `json:"name"`
	SizeBytes int64     `json:"size_bytes"`
	ModTime   time.Time `json:"mod_time"`
	IsActive  bool      `json:"is_active"`
}

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

// TruncateCurrent safely truncates today's active log file without breaking active descriptors.
func (w *DailyFileWriter) TruncateCurrent() (int64, error) {
	if w == nil {
		return 0, nil
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	dateStr := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("%s-%s.log", w.prefix, dateStr)
	filePath := filepath.Join(w.dir, filename)

	var prevSize int64
	if info, statErr := os.Stat(filePath); statErr == nil {
		prevSize = info.Size()
	}

	if w.currentFile != nil {
		_ = w.currentFile.Close()
		w.currentFile = nil
	}

	if _, err := os.Stat(filePath); err == nil {
		if truncErr := os.Truncate(filePath, 0); truncErr != nil {
			return 0, truncErr
		}
	}

	f, openErr := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if openErr != nil {
		return prevSize, openErr
	}
	w.currentFile = f
	w.currentDate = dateStr
	return prevSize, nil
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

func matchesLogPrefix(prefix, name string) bool {
	if !strings.HasSuffix(name, ".log") {
		return false
	}
	if prefix == "error" {
		return strings.HasPrefix(name, "error-")
	}
	if prefix == "backend" {
		if strings.HasPrefix(name, "backend-") {
			return true
		}
		// Legacy date-only daily filenames: YYYY-MM-DD.log
		return len(name) == 14 && strings.HasPrefix(name, "20") && name[4] == '-' && name[7] == '-'
	}
	return false
}

// ListLogFilesByPrefix returns log files in activeLogDir matching prefix ("error" or "backend") sorted newest first.
func ListLogFilesByPrefix(prefix string) []LogFileInfo {
	dir := activeLogDir
	if dir == "" {
		dir = ResolveLogDirectory("")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	activeName := fmt.Sprintf("%s-%s.log", prefix, time.Now().Format("2006-01-02"))
	out := make([]LogFileInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !matchesLogPrefix(prefix, entry.Name()) {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		out = append(out, LogFileInfo{
			Name:      entry.Name(),
			SizeBytes: info.Size(),
			ModTime:   info.ModTime(),
			IsActive:  entry.Name() == activeName,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].ModTime.Equal(out[j].ModTime) {
			return out[i].ModTime.After(out[j].ModTime)
		}
		return out[i].Name > out[j].Name
	})
	return out
}

// ClearLogFilesByPrefix safely truncates active files and optionally deletes rotated files for prefix.
func ClearLogFilesByPrefix(prefix string, specificFiles []string, includeArchived bool) (int, int64, error) {
	dir := activeLogDir
	if dir == "" {
		return 0, 0, fmt.Errorf("active log directory not initialized")
	}

	var writer *DailyFileWriter
	if prefix == "error" {
		writer = globalErrorWriter
	} else if prefix == "backend" {
		writer = globalMainWriter
	}

	available := ListLogFilesByPrefix(prefix)
	allowedSet := make(map[string]LogFileInfo, len(available))
	for _, item := range available {
		allowedSet[item.Name] = item
	}

	targets := make(map[string]LogFileInfo)
	if len(specificFiles) > 0 {
		for _, raw := range specificFiles {
			clean := filepath.Base(strings.TrimSpace(raw))
			if clean == "" || strings.Contains(raw, "..") || strings.ContainsAny(raw, "/\\") {
				continue
			}
			if info, ok := allowedSet[clean]; ok {
				targets[clean] = info
			}
		}
	} else {
		for _, item := range available {
			if item.IsActive || includeArchived {
				targets[item.Name] = item
			}
		}
	}

	clearedCount := 0
	var freedBytes int64
	activeName := fmt.Sprintf("%s-%s.log", prefix, time.Now().Format("2006-01-02"))
	for name, info := range targets {
		if name == activeName && writer != nil {
			sz, truncErr := writer.TruncateCurrent()
			if truncErr != nil {
				return clearedCount, freedBytes, truncErr
			}
			clearedCount++
			freedBytes += sz
			continue
		}
		fullPath := filepath.Join(dir, name)
		if remErr := os.Remove(fullPath); remErr == nil {
			clearedCount++
			freedBytes += info.SizeBytes
		}
	}
	return clearedCount, freedBytes, nil
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
