package mailer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/pkg/safe"
)

// Notification event keys persisted in identity.notification_settings.
const (
	EventNewCustomer        = "new_customer"
	EventNewOrder           = "new_order"
	EventDailyDigest        = "daily_digest"
	EventSupplierOnboarding = "supplier_onboarding"
)

// DefaultAdminRecipients is the fallback admin recipient list when DB settings are unavailable.
var DefaultAdminRecipients = []string{
	"kankayaibrahim@gmail.com",
	"carnavaltedarik@gmail.com",
}

// NotificationRoute defines delivery state and recipients for a single notification event.
type NotificationRoute struct {
	Enabled  bool
	ToEmails []string
	CCEmails []string
}

type NotificationResolverFunc func(ctx context.Context, eventKey string) (NotificationRoute, error)
type NotificationLoggerFunc func(ctx context.Context, eventKey, subject string, toList, ccList []string, status, errMsg string, metadata map[string]any)

var (
	notifyHooksMu        sync.RWMutex
	notificationResolver NotificationResolverFunc
	notificationLogger   NotificationLoggerFunc
)

// RegisterNotificationResolver wires a DB-backed route lookup function into the mailer package.
func RegisterNotificationResolver(fn NotificationResolverFunc) {
	notifyHooksMu.Lock()
	defer notifyHooksMu.Unlock()
	notificationResolver = fn
}

// RegisterNotificationLogger wires a DB-backed notification delivery logger into the mailer package.
func RegisterNotificationLogger(fn NotificationLoggerFunc) {
	notifyHooksMu.Lock()
	defer notifyHooksMu.Unlock()
	notificationLogger = fn
}

func getNotificationHooks() (NotificationResolverFunc, NotificationLoggerFunc) {
	notifyHooksMu.RLock()
	defer notifyHooksMu.RUnlock()
	return notificationResolver, notificationLogger
}

func defaultFallbackRecipients(cfg *config.Config) []string {
	raw := make([]string, 0, len(DefaultAdminRecipients)+1)
	raw = append(raw, DefaultAdminRecipients...)
	if cfg != nil && strings.TrimSpace(cfg.AdminEmail) != "" {
		raw = append(raw, cfg.AdminEmail)
	}
	clean, _ := NormalizeEmailList(raw)
	if len(clean) == 0 {
		return append([]string(nil), DefaultAdminRecipients...)
	}
	return clean
}

// ResolveAdminNotificationRoute fetches the configured To/CC lists and enabled flag for eventKey.
func ResolveAdminNotificationRoute(ctx context.Context, cfg *config.Config, eventKey string) NotificationRoute {
	resolver, _ := getNotificationHooks()
	if resolver != nil {
		if route, err := resolver(ctx, eventKey); err == nil {
			cleanTo, _ := NormalizeEmailList(route.ToEmails)
			cleanCC, _ := NormalizeEmailList(route.CCEmails)
			return NotificationRoute{
				Enabled:  route.Enabled,
				ToEmails: cleanTo,
				CCEmails: cleanCC,
			}
		}
	}
	return NotificationRoute{
		Enabled:  true,
		ToEmails: defaultFallbackRecipients(cfg),
		CCEmails: []string{},
	}
}

func logNotificationResult(ctx context.Context, eventKey, subject string, toList, ccList []string, status, errMsg string, metadata map[string]any) {
	_, loggerFn := getNotificationHooks()
	if loggerFn == nil {
		return
	}
	loggerFn(ctx, eventKey, subject, toList, ccList, status, errMsg, metadata)
}

func validateSingleEmailToken(token string) (string, error) {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return "", nil
	}
	if strings.ContainsAny(trimmed, "\r\n\x00") {
		return "", fmt.Errorf("geçersiz e-posta karakteri: %q", trimmed)
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", fmt.Errorf("geçersiz e-posta adresi (%s): %w", trimmed, err)
	}
	addr := strings.ToLower(strings.TrimSpace(parsed.Address))
	atIdx := strings.Index(addr, "@")
	if atIdx <= 0 || atIdx == len(addr)-1 {
		return "", fmt.Errorf("geçersiz e-posta formatı: %s", trimmed)
	}
	domain := addr[atIdx+1:]
	if !strings.Contains(domain, ".") || strings.ContainsAny(addr, " \t") {
		return "", fmt.Errorf("geçersiz e-posta alan adı: %s", trimmed)
	}
	return addr, nil
}

// NormalizeEmailList splits comma/semicolon entries, validates RFC-5322 email syntax, and deduplicates.
func NormalizeEmailList(inputs []string) ([]string, error) {
	seen := make(map[string]struct{})
	result := make([]string, 0, len(inputs))

	for _, entry := range inputs {
		fields := strings.FieldsFunc(entry, func(r rune) bool {
			return r == ',' || r == ';'
		})
		for _, token := range fields {
			if strings.TrimSpace(token) == "" {
				continue
			}
			addr, err := validateSingleEmailToken(token)
			if err != nil {
				return nil, err
			}
			if _, exists := seen[addr]; exists {
				continue
			}
			seen[addr] = struct{}{}
			result = append(result, addr)
		}
	}
	return result, nil
}

// BuildMimeEnvelopeMessage constructs multipart/alternative MIME bytes and returns deduplicated RCPT recipients.
func BuildMimeEnvelopeMessage(fromHeader string, toList, ccList []string, subject, htmlBody, textBody string) ([]byte, []string, error) {
	if strings.ContainsAny(subject, "\r\n\x00") {
		return nil, nil, errors.New("e-posta konu satırında geçersiz satır sonu karakteri")
	}

	cleanTo, err := NormalizeEmailList(toList)
	if err != nil {
		return nil, nil, err
	}
	cleanCCRaw, err := NormalizeEmailList(ccList)
	if err != nil {
		return nil, nil, err
	}

	toSet := make(map[string]struct{}, len(cleanTo))
	for _, addr := range cleanTo {
		toSet[addr] = struct{}{}
	}
	cleanCC := make([]string, 0, len(cleanCCRaw))
	for _, addr := range cleanCCRaw {
		if _, dup := toSet[addr]; !dup {
			cleanCC = append(cleanCC, addr)
		}
	}

	if len(cleanTo) == 0 {
		return nil, nil, errors.New("en az bir To (alıcı) e-posta adresi zorunludur")
	}

	randomBytes := make([]byte, 12)
	_, _ = rand.Read(randomBytes)
	boundary := "=_mv_" + hex.EncodeToString(randomBytes)
	msgID := fmt.Sprintf("<%d.%s@mertervitrini.com.tr>", time.Now().UnixNano(), hex.EncodeToString(randomBytes[:6]))
	encodedSubject := mime.BEncoding.Encode("utf-8", subject)

	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: %s\r\n", fromHeader))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(cleanTo, ", ")))
	if len(cleanCC) > 0 {
		msg.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(cleanCC, ", ")))
	}
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", encodedSubject))
	msg.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	msg.WriteString(fmt.Sprintf("Message-ID: %s\r\n", msgID))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", boundary))

	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	msg.WriteString(textBody)
	msg.WriteString("\r\n\r\n")

	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	msg.WriteString(htmlBody)
	msg.WriteString("\r\n\r\n")

	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	envelopeRecipients := make([]string, 0, len(cleanTo)+len(cleanCC))
	envelopeRecipients = append(envelopeRecipients, cleanTo...)
	envelopeRecipients = append(envelopeRecipients, cleanCC...)
	return msg.Bytes(), envelopeRecipients, nil
}

func resolveSMTPSettings(cfg *config.Config) (host, port, fromEmail string) {
	if cfg != nil {
		host = strings.TrimSpace(cfg.SMTPHost)
		port = strings.TrimSpace(cfg.SMTPPort)
		fromEmail = strings.TrimSpace(cfg.SMTPFrom)
	}
	if host == "" {
		host = "127.0.0.1"
	}
	if port == "" {
		port = "25"
	}
	if fromEmail == "" {
		fromEmail = "destek@mertervitrini.com.tr"
	}
	return host, port, fromEmail
}

// SendMailEnvelope delivers an email to multiple To and CC recipients over a single SMTP session.
func SendMailEnvelope(cfg *config.Config, toList, ccList []string, subject, htmlBody, textBody string) error {
	host, port, fromEmail := resolveSMTPSettings(cfg)
	fromHeader := fmt.Sprintf("Merter Vitrini <%s>", fromEmail)

	rawMsg, recipients, err := BuildMimeEnvelopeMessage(fromHeader, toList, ccList, subject, htmlBody, textBody)
	if err != nil {
		return err
	}

	addr := net.JoinHostPort(host, port)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[MAILER ERROR] Failed to connect to SMTP %s: %v", addr, err)
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(20 * time.Second))

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		log.Printf("[MAILER ERROR] Failed to create SMTP client: %v", err)
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName:         host,
			InsecureSkipVerify: true, // Local loopback Postfix certificate may not match 127.0.0.1
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			log.Printf("[MAILER ERROR] STARTTLS failed: %v", err)
			return err
		}
	}

	if err := client.Mail(fromEmail); err != nil {
		log.Printf("[MAILER ERROR] MAIL FROM failed for %s: %v", fromEmail, err)
		return err
	}

	for _, rcpt := range recipients {
		if err := client.Rcpt(rcpt); err != nil {
			log.Printf("[MAILER ERROR] RCPT TO failed for %s: %v", rcpt, err)
			return err
		}
	}

	w, err := client.Data()
	if err != nil {
		log.Printf("[MAILER ERROR] DATA command failed: %v", err)
		return err
	}
	if _, err := w.Write(rawMsg); err != nil {
		log.Printf("[MAILER ERROR] Write body failed: %v", err)
		return err
	}
	if err := w.Close(); err != nil {
		log.Printf("[MAILER ERROR] Close data writer failed: %v", err)
		return err
	}
	_ = client.Quit()

	log.Printf("[MAILER SUCCESS] Email queued for %s (CC: %s | subject: %s)", strings.Join(toList, ", "), strings.Join(ccList, ", "), subject)
	return nil
}

// DispatchAdminEventMail sends a DB-configured admin email event asynchronously and records delivery logs.
func DispatchAdminEventMail(cfg *config.Config, eventKey, subject, htmlBody, textBody string, metadata map[string]any) {
	safe.Go("DispatchAdminEventMail:"+eventKey, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		route := ResolveAdminNotificationRoute(ctx, cfg, eventKey)
		if !route.Enabled {
			logNotificationResult(ctx, eventKey, subject, route.ToEmails, route.CCEmails, "skipped_disabled", "Bildirim kuralı yönetici ayarlarından pasif edildi", metadata)
			return
		}
		if len(route.ToEmails) == 0 {
			logNotificationResult(ctx, eventKey, subject, route.ToEmails, route.CCEmails, "failed", "Tanımlı To alıcısı bulunamadı", metadata)
			return
		}

		err := SendMailEnvelope(cfg, route.ToEmails, route.CCEmails, subject, htmlBody, textBody)
		if err != nil {
			logNotificationResult(ctx, eventKey, subject, route.ToEmails, route.CCEmails, "failed", err.Error(), metadata)
			return
		}
		logNotificationResult(ctx, eventKey, subject, route.ToEmails, route.CCEmails, "sent", "", metadata)
	})
}
