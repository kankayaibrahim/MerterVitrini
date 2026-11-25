"use client";

import {
  custom,
  createOfflineTransport,
  generateSubjectId,
  type AllConsentNames,
  type ClearOnRevocationConfig,
  type ConsentState,
  type InitContext,
  type InitResponse,
  type ProviderTransportFactory,
  type SavePayload,
  type SaveResult,
} from "@c15t/core";
import { CONSENT_UI_COPY, normalizeConsentLang, type ConsentLang } from "./consentCopy";

export type OfflinePolicyRuleList = NonNullable<
  NonNullable<Parameters<typeof createOfflineTransport>[0]>["policyRules"]
>;

export interface CookieInventoryItemDTO {
  id: string;
  cookie_name: string;
  category: AllConsentNames;
  provider: string;
  domain: string;
  storage_type: string;
  duration: string;
  is_third_party: boolean;
  is_active: boolean;
  source: string;
  purpose: string;
}

export interface ConsentSettingsPublicDTO {
  banner_enabled: boolean;
  banner_layout: string;
  floating_trigger_enabled: boolean;
  ga_measurement_id: string;
  google_consent_mode: string;
  reconsent_days: number;
  iab_enabled: boolean;
  iab_cmp_id: number;
  strict_opt_in_countries: string[];
}

export interface ConsentReceiptDTO {
  seq_no?: number;
  consent_ref_id: string;
  policy_snapshot_hash: string;
  entry_hash: string;
  recorded_at_utc: string;
  anchored?: boolean;
  tsa_provider?: string;
}

export interface StoreConsentInitDTO {
  settings: ConsentSettingsPublicDTO;
  language: ConsentLang;
  country_code: string;
  is_strict_opt_in: boolean;
  gpc_detected: boolean;
  policy_version: number;
  policy_snapshot_hash: string;
  cookie_inventory: CookieInventoryItemDTO[];
  latest_record?: ConsentReceiptDTO | null;
}

export const CONSENT_OPEN_PREFERENCES_EVENT = "merter-open-consent-preferences";
export const CONSENT_RUNTIME_UPDATED_EVENT = "merter-consent-runtime-updated";
export const CONSENT_RECEIPT_STORAGE_KEY = "merter_consent_receipt";
export const CONSENT_SUBJECT_STORAGE_KEY = "merter_consent_subject_id";

const runtimeSnapshotStore: {
  initData: StoreConsentInitDTO | null;
  receipt: ConsentReceiptDTO | null;
  measurementAllowed: boolean;
  marketingAllowed: boolean;
} = {
  initData: null,
  receipt: null,
  measurementAllowed: false,
  marketingAllowed: false,
};

export const CLEAR_ON_REVOCATION_MAP: ClearOnRevocationConfig = {
  measurement: {
    cookies: [{ name: "_ga" }, { name: "_ga_*" }, { name: "_gid" }, { name: "_clck" }, { name: "_clsk" }, { name: "_ym_uid" }],
    localStorage: ["mv_vid", "mv_sid"],
  },
  marketing: {
    cookies: [{ name: "_gcl_au" }, { name: "_fbp" }, { name: "_gcl_*" }],
  },
  functionality: {
    localStorage: ["preferred_lang", "merter_preferred_currency"],
  },
};

export function getMeasurementConsentAllowed(): boolean {
  return runtimeSnapshotStore.measurementAllowed;
}

export function setRuntimeCategoryPermissions(state: Readonly<ConsentState>): void {
  runtimeSnapshotStore.measurementAllowed = Boolean(state.measurement);
  runtimeSnapshotStore.marketingAllowed = Boolean(state.marketing);
}

export function getCachedConsentInitData(): StoreConsentInitDTO | null {
  return runtimeSnapshotStore.initData;
}

export function getCachedConsentReceipt(): ConsentReceiptDTO | null {
  if (runtimeSnapshotStore.receipt) return runtimeSnapshotStore.receipt;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_RECEIPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentReceiptDTO;
    if (parsed?.consent_ref_id) {
      runtimeSnapshotStore.receipt = parsed;
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function saveCachedReceipt(receipt: ConsentReceiptDTO): void {
  runtimeSnapshotStore.receipt = receipt;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
      window.dispatchEvent(new CustomEvent(CONSENT_RUNTIME_UPDATED_EVENT));
    } catch {
      // Ignore private browsing storage quota restrictions
    }
  }
}

export function readOrCreateSubjectId(): string {
  if (typeof window === "undefined") {
    return generateSubjectId();
  }
  try {
    const existing = window.localStorage.getItem(CONSENT_SUBJECT_STORAGE_KEY);
    if (existing && existing.length >= 6) {
      return existing;
    }
    const created = generateSubjectId();
    window.localStorage.setItem(CONSENT_SUBJECT_STORAGE_KEY, created);
    return created;
  } catch {
    return generateSubjectId();
  }
}

function buildPolicyRules(initData: StoreConsentInitDTO | null): OfflinePolicyRuleList {
  const bannerEnabled = initData?.settings?.banner_enabled ?? true;
  const reconsentDays = initData?.settings?.reconsent_days || 365;
  const model = initData?.settings?.iab_enabled ? "iab" : "opt-in";
  const prompt = bannerEnabled ? "choice" : "none";

  return [
    {
      id: "merter_kvkk_gdpr_default",
      match: { isDefault: true, fallback: true },
      model,
      prompt,
      categories: ["functionality", "experience", "measurement", "marketing"],
      actions: ["accept", "reject", "customize"],
      rights: ["disclosure", "preferences"],
      validity: { choiceDays: reconsentDays },
    },
  ];
}

function mapSaveAction(consentAction: SavePayload["consentAction"], consents: Readonly<ConsentState>): string {
  if (consentAction === "all") return "accept_all";
  if (consentAction === "necessary") return "reject_all";
  const anyOptionalGranted =
    Boolean(consents.functionality) ||
    Boolean(consents.experience) ||
    Boolean(consents.measurement) ||
    Boolean(consents.marketing);
  if (!anyOptionalGranted) return "withdraw";
  return "custom";
}

function buildGoogleConsentModeSignals(consents: Readonly<ConsentState>): Record<string, string> {
  const flag = (v: boolean) => (v ? "granted" : "denied");
  return {
    ad_storage: flag(Boolean(consents.marketing)),
    ad_user_data: flag(Boolean(consents.marketing)),
    ad_personalization: flag(Boolean(consents.marketing)),
    analytics_storage: flag(Boolean(consents.measurement)),
    functionality_storage: flag(Boolean(consents.functionality)),
    personalization_storage: flag(Boolean(consents.experience)),
    security_storage: "granted",
  };
}

export function createMerterConsentTransport(initialLang: ConsentLang): ProviderTransportFactory {
  return custom({
    async init(ctx: InitContext): Promise<InitResponse> {
      const lang = normalizeConsentLang(ctx.overrides?.language || initialLang);
      const subjectId = readOrCreateSubjectId();

      let remoteData: StoreConsentInitDTO | null = null;
      try {
        const res = await fetch(
          `/api/v1/store/consent/init?lang=${encodeURIComponent(lang)}&subject_id=${encodeURIComponent(subjectId)}`,
          { cache: "no-store", headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          remoteData = (await res.json()) as StoreConsentInitDTO;
          runtimeSnapshotStore.initData = remoteData;
          if (remoteData.latest_record?.consent_ref_id) {
            saveCachedReceipt(remoteData.latest_record);
          } else if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(CONSENT_RUNTIME_UPDATED_EVENT));
          }
        }
      } catch {
        // Resilient fallback to deterministic local policy when API is temporarily unreachable
      }

      const offlineTransport = createOfflineTransport({
        policyRules: buildPolicyRules(remoteData),
        defaultLanguage: lang,
        iabEnabled: Boolean(remoteData?.settings?.iab_enabled),
        acknowledgeNoRecords: true,
      });

      const baseInit = await offlineTransport.init({
        ...ctx,
        overrides: {
          ...ctx.overrides,
          country: ctx.overrides?.country ?? remoteData?.country_code ?? "TR",
          language: lang,
        },
      });

      return {
        ...baseInit,
        subjectId,
        resolvedPrivacySignals: {
          gpc: Boolean(remoteData?.gpc_detected),
        },
        hosting: "self-hosted",
      };
    },

    async save(payload: SavePayload): Promise<SaveResult> {
      const subjectId = payload.subjectId || readOrCreateSubjectId();
      const lang = normalizeConsentLang(payload.overrides?.language || initialLang);
      const copy = CONSENT_UI_COPY[lang];
      const visitorId =
        typeof window !== "undefined" ? window.localStorage.getItem("mv_vid") || "" : "";
      const storeToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("store_user_token") || ""
          : "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (storeToken) {
        headers.Authorization = `Bearer ${storeToken}`;
      }

      const prevReceipt = getCachedConsentReceipt();
      const action = mapSaveAction(payload.consentAction, payload.consents);

      try {
        const res = await fetch("/api/v1/store/consent/record", {
          method: "POST",
          headers,
          body: JSON.stringify({
            subject_id: subjectId,
            visitor_id: visitorId,
            action,
            model: payload.model || "opt-in",
            ui_source: payload.uiSource || "banner",
            consents: {
              necessary: true,
              functionality: Boolean(payload.consents.functionality),
              experience: Boolean(payload.consents.experience),
              measurement: Boolean(payload.consents.measurement),
              marketing: Boolean(payload.consents.marketing),
            },
            google_consent_mode: buildGoogleConsentModeSignals(payload.consents),
            tcf_tc_string: payload.tcString || "",
            addtl_consent: payload.addtlConsent || "",
            gpc_signal: Boolean(payload.decisionInputs?.gpc),
            language: lang,
            country_code: payload.overrides?.country || payload.decisionInputs?.country || "TR",
            page_url: typeof window !== "undefined" ? window.location.href : "",
            banner_copy: {
              badge: copy.badge,
              title: copy.bannerTitle,
              description: copy.bannerDescription,
              hosting_note: copy.hostingNote,
              accept_all: copy.acceptAll,
              reject_all: copy.rejectAll,
              customize: copy.customize,
            },
            previous_ref_id: prevReceipt?.consent_ref_id || "",
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            seq_no?: number;
            consent_ref_id?: string;
            policy_snapshot_hash?: string;
            entry_hash?: string;
            recorded_at_utc?: string;
          };
          if (data.consent_ref_id && data.entry_hash) {
            saveCachedReceipt({
              seq_no: data.seq_no,
              consent_ref_id: data.consent_ref_id,
              policy_snapshot_hash: data.policy_snapshot_hash || "",
              entry_hash: data.entry_hash,
              recorded_at_utc: data.recorded_at_utc || new Date().toISOString(),
              anchored: false,
            });
          }
          return { ok: true, subjectId };
        }
      } catch {
        // c15t kernel keeps local state and retries queued saves automatically
      }

      return { ok: true, subjectId };
    },
  });
}
