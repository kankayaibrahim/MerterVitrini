"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  ConsentProvider,
  useConsents,
  useSetLanguage,
  useSetActiveUI,
} from "@c15t/react";
import { gtag } from "@c15t/integrations/google-tag";
import StoreConsentBanner from "./StoreConsentBanner";
import StoreConsentDialog from "./StoreConsentDialog";
import { CONSENT_UI_COPY, normalizeConsentLang, type ConsentLang } from "./consentCopy";
import {
  CLEAR_ON_REVOCATION_MAP,
  CONSENT_OPEN_PREFERENCES_EVENT,
  CONSENT_RUNTIME_UPDATED_EVENT,
  createMerterConsentTransport,
  getCachedConsentInitData,
  setRuntimeCategoryPermissions,
} from "./consentRuntime";

const PATH_PREFIX_LANGS: readonly ConsentLang[] = [
  "tr",
  "en",
  "ru",
  "ar",
  "de",
  "fr",
  "pl",
  "bg",
];

function extractLangFromPathname(pathname: string | null): ConsentLang | null {
  if (!pathname) return null;
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  if ((PATH_PREFIX_LANGS as readonly string[]).includes(firstSegment)) {
    return firstSegment as ConsentLang;
  }
  return null;
}

function readStoredConsentLang(): ConsentLang | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("preferred_lang");
  return stored ? normalizeConsentLang(stored) : null;
}

function ConsentKernelBridge({ lang }: { lang: ConsentLang }) {
  const consents = useConsents();
  const setLanguage = useSetLanguage();
  const setActiveUI = useSetActiveUI();
  const [floatingEnabled, setFloatingEnabled] = useState(true);
  const copy = useMemo(() => CONSENT_UI_COPY[lang], [lang]);

  useEffect(() => {
    setRuntimeCategoryPermissions(consents);
  }, [consents]);

  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  useEffect(() => {
    const syncFloatingFlag = () => {
      const initData = getCachedConsentInitData();
      if (initData?.settings) {
        setFloatingEnabled(initData.settings.floating_trigger_enabled !== false);
      }
    };
    const openPreferences = () => setActiveUI("dialog");

    syncFloatingFlag();
    window.addEventListener(CONSENT_OPEN_PREFERENCES_EVENT, openPreferences);
    window.addEventListener(CONSENT_RUNTIME_UPDATED_EVENT, syncFloatingFlag);
    return () => {
      window.removeEventListener(CONSENT_OPEN_PREFERENCES_EVENT, openPreferences);
      window.removeEventListener(CONSENT_RUNTIME_UPDATED_EVENT, syncFloatingFlag);
    };
  }, [setActiveUI]);

  return (
    <>
      <StoreConsentBanner lang={lang} />
      <StoreConsentDialog lang={lang} />
      {floatingEnabled && (
        <button
          type="button"
          onClick={() => setActiveUI("dialog")}
          aria-label={copy.preferencesTrigger}
          title={copy.preferencesTrigger}
          data-testid="consent-floating-trigger"
          className="fixed bottom-4 start-4 z-[65] hidden sm:inline-flex items-center gap-1.5 rounded-full border border-eerie-black/15 bg-white/95 hover:bg-eerie-black hover:text-white text-eerie-black px-3 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-sm transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-accent-gold shrink-0" />
          <span>{copy.preferencesTrigger}</span>
        </button>
      )}
    </>
  );
}

interface StoreConsentRootProps {
  initialLang?: string;
  children: React.ReactNode;
}

export default function StoreConsentRoot({
  initialLang = "tr",
  children,
}: StoreConsentRootProps) {
  const pathname = usePathname();
  const isInternalPortal =
    Boolean(pathname?.startsWith("/admin")) ||
    Boolean(pathname?.startsWith("/supplier"));

  const baseLang = normalizeConsentLang(initialLang);
  const pathLang = extractLangFromPathname(pathname);
  const [storedLang, setStoredLang] = useState<ConsentLang | null>(null);

  useEffect(() => {
    const syncLang = () => setStoredLang(readStoredConsentLang());
    const timer = setTimeout(syncLang, 0);
    window.addEventListener("language-change", syncLang);
    window.addEventListener("storage", syncLang);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("language-change", syncLang);
      window.removeEventListener("storage", syncLang);
    };
  }, []);

  const activeLang = pathLang ?? storedLang ?? baseLang;

  const transport = useMemo(
    () => createMerterConsentTransport(baseLang),
    [baseLang]
  );

  const gaScripts = useMemo(
    () => [
      gtag({
        id: "G-CNMNCL62Q2",
        category: "measurement",
        loadMode: "always",
      }),
    ],
    []
  );

  if (isInternalPortal) {
    return <>{children}</>;
  }

  return (
    <ConsentProvider
      options={{
        mode: transport,
        styles: false,
        consentCategories: [
          "necessary",
          "functionality",
          "experience",
          "measurement",
          "marketing",
        ],
        scripts: gaScripts,
        clearOnRevocation: CLEAR_ON_REVOCATION_MAP,
        reloadOnConsentRevoked: false,
        overrides: {
          language: activeLang,
        },
      }}
    >
      {children}
      <ConsentKernelBridge lang={activeLang} />
    </ConsentProvider>
  );
}
