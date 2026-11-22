import type { Metadata } from "next";
import { Suspense } from "react";
import SupplierLoginClient from "./SupplierLoginClient";
import { SUPPLIER_LOGIN_COPY } from "./translations";
import { normalizeSeoLang } from "@/utils/seoHelpers";

interface SupplierLoginPageProps {
  readonly searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SupplierLoginPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const copy = SUPPLIER_LOGIN_COPY[lang];

  return {
    title: copy.metaTitle,
    description: copy.metaDesc,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SupplierLoginPage({
  searchParams,
}: SupplierLoginPageProps) {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SupplierLoginClient key={lang} initialLang={lang} />
    </Suspense>
  );
}
