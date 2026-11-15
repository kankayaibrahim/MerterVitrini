import { isStoreSessionImpersonated } from "@/app/storeAuth";
import { fetchStoreSettingsCached } from "@/app/utils";

interface GrecaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

export interface ResolvedRecaptchaConfig {
  enabled: boolean;
  siteKey: string;
}

const RECAPTCHA_SCRIPT_ID = "recaptcha-v3-script";
const LOAD_TIMEOUT_MS = 8000;
let recaptchaLoadPromise: Promise<void> | null = null;
let loadedSiteKey = "";

function getWindowGrecaptcha(): GrecaptchaInstance | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as unknown as { grecaptcha?: GrecaptchaInstance }).grecaptcha;
}

/**
 * Resolves effective Google reCAPTCHA v3 visibility/key using public store settings
 * with environment variable fallback when the admin has not explicitly disabled it.
 */
export async function resolveRecaptchaSiteKey(): Promise<ResolvedRecaptchaConfig> {
  const envFallback = (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "").trim();
  const settings = await fetchStoreSettingsCached();
  if (settings && settings.recaptcha_enabled === false) {
    return { enabled: false, siteKey: "" };
  }
  const dbKey = typeof settings?.recaptcha_site_key === "string"
    ? settings.recaptcha_site_key.trim()
    : "";
  const effectiveKey = dbKey || envFallback;
  return {
    enabled: Boolean(effectiveKey),
    siteKey: effectiveKey,
  };
}

/**
 * Dynamically injects Google reCAPTCHA v3 script if needed and resolves once `grecaptcha.ready` fires.
 */
export async function ensureRecaptchaLoaded(siteKey: string, lang = "tr"): Promise<void> {
  if (typeof document === "undefined" || !siteKey) {
    return;
  }

  const existingApi = getWindowGrecaptcha();
  if (existingApi && loadedSiteKey === siteKey) {
    return;
  }

  if (recaptchaLoadPromise && loadedSiteKey === siteKey) {
    await recaptchaLoadPromise;
    return;
  }

  loadedSiteKey = siteKey;
  recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    const waitForReady = () => {
      const api = getWindowGrecaptcha();
      if (api) {
        api.ready(() => resolve());
        return;
      }
      reject(new Error("reCAPTCHA API unavailable after script load"));
    };

    const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.siteKey !== siteKey) {
        existingScript.remove();
      } else if (getWindowGrecaptcha()) {
        waitForReady();
        return;
      }
    }

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.dataset.siteKey = siteKey;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}&hl=${encodeURIComponent(lang)}`;
    script.async = true;
    script.defer = true;

    const timer = window.setTimeout(() => {
      recaptchaLoadPromise = null;
      reject(new Error("reCAPTCHA load timeout"));
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      window.clearTimeout(timer);
      waitForReady();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      recaptchaLoadPromise = null;
      reject(new Error("reCAPTCHA script blocked or failed to load"));
    };

    document.head.appendChild(script);
  });

  await recaptchaLoadPromise;
}

/**
 * Executes a named Google reCAPTCHA v3 action. Returns empty string only when reCAPTCHA is not
 * enabled/configured; throws a localized user error if enabled and blocked or failing.
 */
export async function executeRecaptchaAction(action: string, lang = "tr"): Promise<string> {
  if ((action === "create_order" || action === "submit_inquiry") && isStoreSessionImpersonated()) {
    return "";
  }
  const { enabled, siteKey } = await resolveRecaptchaSiteKey();
  if (!enabled || !siteKey) {
    return "";
  }

  const errorMessage = lang === "tr"
    ? "Güvenlik doğrulaması (Google reCAPTCHA) tamamlanamadı. Lütfen reklam engelleyiciyi kapatıp sayfayı yenileyerek tekrar deneyin."
    : "Security verification (Google reCAPTCHA) could not be completed. Please disable any ad blocker, refresh the page, and try again.";

  try {
    await ensureRecaptchaLoaded(siteKey, lang);
  } catch {
    throw new Error(errorMessage);
  }

  const grecaptcha = getWindowGrecaptcha();
  if (!grecaptcha) {
    throw new Error(errorMessage);
  }

  try {
    return await new Promise<string>((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action }).then(resolve).catch(reject);
      });
    });
  } catch {
    throw new Error(errorMessage);
  }
}

export function getRecaptchaLegalNotice(lang: string): string {
  if (lang === "tr") {
    return "Bu sipariş adımı Google reCAPTCHA v3 güvenlik doğrulaması ile korunmaktadır.";
  }
  return "Protected by Google reCAPTCHA v3 anti-bot verification.";
}
