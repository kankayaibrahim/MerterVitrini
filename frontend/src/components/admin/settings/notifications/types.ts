export type KnownNotificationEventKey =
  | "new_customer"
  | "new_order"
  | "daily_digest"
  | "supplier_onboarding"
  | "system_exception_alert";

export interface ExceptionAlertConfigDTO {
  alert_on_panic: boolean;
  alert_on_http_5xx: boolean;
  alert_on_error_logs: boolean;
  burst_threshold: number;
  window_minutes: number;
  cooldown_minutes: number;
  max_emails_per_hour: number;
  ignored_patterns: string[];
  updated_by?: string;
  updated_at?: string;
}

export interface ExceptionAlertEventDTO {
  readonly timestamp: string;
  readonly severity: string;
  readonly source: string;
  readonly message: string;
}

export interface ExceptionAlertStatusDTO {
  readonly window_error_count: number;
  readonly emails_sent_last_hour: number;
  readonly total_captured: number;
  readonly total_suppressed: number;
  readonly last_alert_sent_at: string;
  readonly recent_events: readonly ExceptionAlertEventDTO[];
}

export interface ExceptionAlertConfigResponse {
  readonly success?: boolean;
  readonly message?: string;
  readonly config: ExceptionAlertConfigDTO;
  readonly status: ExceptionAlertStatusDTO;
}

export interface NotificationRuleDTO {
  readonly event_key: string;
  readonly title: string;
  readonly description: string;
  enabled: boolean;
  to_emails: string[];
  cc_emails: string[];
  schedule_hour: number;
  schedule_minute: number;
  readonly last_sent_date: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface NotificationLogDTO {
  readonly id: string;
  readonly event_key: string;
  readonly subject: string;
  readonly to_emails: readonly string[];
  readonly cc_emails: readonly string[];
  readonly status: string;
  readonly error_message: string;
  readonly created_at: string;
}

export interface DigestMemberHighlightDTO {
  readonly full_name: string;
  readonly email: string;
  readonly country: string;
  readonly created_at: string;
}

export interface DigestOrderHighlightDTO {
  readonly order_number: string;
  readonly customer_name: string;
  readonly amount_text: string;
  readonly status: string;
  readonly created_at: string;
}

export interface DailyDigestPreviewDTO {
  readonly report_date: string;
  readonly report_date_formatted: string;
  readonly generated_at: string;
  readonly new_customers_today: number;
  readonly total_active_customers: number;
  readonly new_orders_today: number;
  readonly orders_revenue_try_today: number;
  readonly orders_revenue_formatted: string;
  readonly active_unfinished_carts: number;
  readonly inquiries_today: number;
  readonly products_added_today: number;
  readonly products_deactivated_today: number;
  readonly products_archived_today: number;
  readonly products_deleted_today: number;
  readonly total_active_products: number;
  readonly xml_syncs_completed_today: number;
  readonly xml_syncs_failed_today: number;
  readonly supplier_applications_today: number;
  readonly recent_members: readonly DigestMemberHighlightDTO[];
  readonly recent_orders: readonly DigestOrderHighlightDTO[];
}

export interface NotificationsSettingsResponse {
  readonly settings: NotificationRuleDTO[];
  readonly recent_logs: NotificationLogDTO[];
  readonly default_recipients: readonly string[];
  readonly server_time_istanbul: string;
  readonly today_date: string;
}

export interface NotificationFeedback {
  readonly type: "success" | "error";
  readonly text: string;
}

export function getNotificationEventLabel(eventKey: string): string {
  switch (eventKey) {
    case "new_customer":
      return "Yeni Müşteri Kaydı";
    case "new_order":
      return "Yeni Sipariş Bildirimi";
    case "daily_digest":
      return "Günlük Özet Raporu";
    case "supplier_onboarding":
      return "Tedarikçi & Başvuru";
    case "system_exception_alert":
      return "Kritik Sistem Hatası & 5xx";
    default:
      return eventKey;
  }
}
