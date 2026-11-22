export interface ConsentSettingsDTO {
  banner_enabled: boolean;
  banner_layout: string;
  floating_trigger_enabled: boolean;
  ga_measurement_id: string;
  google_consent_mode: string;
  reconsent_days: number;
  iab_enabled: boolean;
  iab_cmp_id: number;
  tsa_primary_url: string;
  tsa_fallback_urls: string[];
  auto_anchor_interval_min: number;
  strict_opt_in_countries: string[];
  updated_at?: string;
}

export interface AnchorSummaryDTO {
  anchor_seq: number;
  id: string;
  seq_from: number;
  seq_to: number;
  record_count: number;
  merkle_root: string;
  prev_anchor_hash: string;
  anchor_chain_hash: string;
  tsa_provider: string;
  tsa_url: string;
  tsa_status: string;
  tsa_gen_time_utc: string;
  tsa_serial_hex: string;
  tsa_policy_oid: string;
}

export interface LedgerIntegrityReport {
  overall_valid: boolean;
  chain_valid: boolean;
  hmac_valid: boolean;
  snapshots_valid: boolean;
  merkle_valid: boolean;
  tsa_tokens_valid: boolean;
  worm_triggers_active: boolean;
  total_records: number;
  anchored_records: number;
  unanchored_records: number;
  total_anchors: number;
  head_entry_hash: string;
  violations: string[];
  verified_at_utc: string;
}

export interface ConsentOverviewDTO {
  settings: ConsentSettingsDTO;
  stats: {
    total_records: number;
    anchored_records: number;
    unanchored_records: number;
    total_anchors: number;
    active_cookies: number;
    accept_all_count: number;
    reject_all_count: number;
    custom_count: number;
    withdraw_count: number;
  };
  integrity: LedgerIntegrityReport;
  recent_anchors: AnchorSummaryDTO[];
}

export interface ConsentRecordDTO {
  seq_no: number;
  id: string;
  consent_ref_id: string;
  subject_id: string;
  action: string;
  model: string;
  ui_source: string;
  consents: {
    necessary: boolean;
    functionality: boolean;
    experience: boolean;
    measurement: boolean;
    marketing: boolean;
  };
  policy_snapshot_hash: string;
  language: string;
  country_code: string;
  ip_masked: string;
  entry_hash: string;
  prev_hash: string;
  gpc_signal: boolean;
  anchored: boolean;
  recorded_at_utc: string;
}

export interface CookieInventoryItem {
  id: string;
  cookie_name: string;
  category: "necessary" | "functionality" | "experience" | "measurement" | "marketing";
  provider: string;
  domain: string;
  storage_type: "cookie" | "localStorage" | "sessionStorage" | "script";
  duration: string;
  is_third_party: boolean;
  is_active: boolean;
  source: string;
  purpose_translations: Record<string, string>;
  purpose?: string;
  last_seen_at?: string | null;
  updated_at?: string;
}

export interface CookieScanRunResult {
  scan_id: string;
  scanned_urls: string[];
  detected_count: number;
  new_cookies_count: number;
  auto_registered: boolean;
  findings: Array<{
    name: string;
    category: string;
    provider: string;
    domain: string;
    storage_type: string;
    duration: string;
    is_third_party: boolean;
    source_url: string;
    already_known: boolean;
  }>;
}
