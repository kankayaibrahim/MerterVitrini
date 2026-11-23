"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Building2,
  ExternalLink,
  Heart,
  Mail,
  Package,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useFavoriteSuppliers } from "@/hooks/useFavoriteSuppliers";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import { getSupplierShowcaseHref } from "@/utils/subdomain";

interface PanelCopy {
  readonly heading: string;
  readonly subheading: string;
  readonly verifiedBadge: string;
  readonly productCountUnit: string;
  readonly notifyNewLabel: string;
  readonly notifyEmailLabel: string;
  readonly openShowcase: string;
  readonly removeLabel: string;
  readonly emptyTitle: string;
  readonly emptyDesc: string;
  readonly browseDirectory: string;
}

const PANEL_COPY: Record<SupportedSeoLang, PanelCopy> = {
  tr: {
    heading: "Favori Tedarikçilerim",
    subheading:
      "Favori olarak eklediğiniz üreticiler yeni ürün paylaştığında bildirim alıp almayacağınızı seçebilirsiniz.",
    verifiedBadge: "Doğrulanmış",
    productCountUnit: "aktif ürün",
    notifyNewLabel: "Yeni ürün paylaşınca bildirim gelsin",
    notifyEmailLabel: "E-posta ile de bildir",
    openShowcase: "Vitrini Aç",
    removeLabel: "Favorilerden Çıkar",
    emptyTitle: "Henüz favori tedarikçi eklemediniz",
    emptyDesc:
      "Doğrulanmış Merter üreticilerini favorilerinize ekleyerek yeni koleksiyonlar yayınlandığında anında haberdar olabilirsiniz.",
    browseDirectory: "Üretici Firmaları Keşfet",
  },
  en: {
    heading: "My Favorite Suppliers",
    subheading:
      "Choose which favorite manufacturers notify you whenever they publish new wholesale products.",
    verifiedBadge: "Verified",
    productCountUnit: "active products",
    notifyNewLabel: "Notify when supplier shares a new product",
    notifyEmailLabel: "Also send email alert",
    openShowcase: "Open Showroom",
    removeLabel: "Remove",
    emptyTitle: "No favorite suppliers yet",
    emptyDesc:
      "Add verified Merter manufacturers to your favorites to receive instant alerts whenever they launch new styles.",
    browseDirectory: "Browse Manufacturers",
  },
  ru: {
    heading: "Избранные поставщики",
    subheading:
      "Выберите, от каких избранных фабрик вы хотите получать уведомления о публикации новых моделей.",
    verifiedBadge: "Проверено",
    productCountUnit: "активных мод.",
    notifyNewLabel: "Уведомлять о новых товарах поставщика",
    notifyEmailLabel: "Также отправлять на e-mail",
    openShowcase: "Витрина фабрики",
    removeLabel: "Удалить",
    emptyTitle: "Список избранных поставщиков пуст",
    emptyDesc:
      "Добавьте проверенные фабрики Мертера в избранное, чтобы первыми узнавать о новых коллекциях.",
    browseDirectory: "Смотреть фабрики",
  },
  ar: {
    heading: "الموردون المفضلون لدي",
    subheading:
      "حدّد المصانع التي ترغب في تلقي إشعارات فورية منها عند نشر أي منتجات جديدة.",
    verifiedBadge: "موثّق",
    productCountUnit: "منتج متاح",
    notifyNewLabel: "إشعارني عند نشر منتجات جديدة من هذا المورد",
    notifyEmailLabel: "إرسال تنبيه عبر البريد الإلكتروني أيضاً",
    openShowcase: "فتح المعرض",
    removeLabel: "إزالة",
    emptyTitle: "لا يوجد موردون مفضلون بعد",
    emptyDesc:
      "أضف مصانع مارتر الموثوقة إلى المفضلة للحصول على تنبيهات فورية فور طرح الموديلات الجديدة.",
    browseDirectory: "تصفح المصانع",
  },
  de: {
    heading: "Meine Favorisierten Hersteller",
    subheading:
      "Steuern Sie pro Hersteller, ob Sie bei neu veröffentlichten Großhandelsmodellen benachrichtigt werden möchten.",
    verifiedBadge: "Geprüft",
    productCountUnit: "aktive Modelle",
    notifyNewLabel: "Bei neuen Produkten benachrichtigen",
    notifyEmailLabel: "Auch per E-Mail informieren",
    openShowcase: "Showroom öffnen",
    removeLabel: "Entfernen",
    emptyTitle: "Noch keine favorisierten Hersteller",
    emptyDesc:
      "Speichern Sie geprüfte Merter-Hersteller als Favorit, um bei neuen Kollektionen sofort informiert zu werden.",
    browseDirectory: "Hersteller entdecken",
  },
  fr: {
    heading: "Mes Fournisseurs Favoris",
    subheading:
      "Choisissez pour chaque fournisseur favori si vous souhaitez être averti lors de la publication d'un nouveau modèle.",
    verifiedBadge: "Vérifié",
    productCountUnit: "modèles actifs",
    notifyNewLabel: "Me prévenir lors d'un nouveau produit",
    notifyEmailLabel: "Alerter aussi par e-mail",
    openShowcase: "Ouvrir le showroom",
    removeLabel: "Retirer",
    emptyTitle: "Aucun fournisseur favori pour le moment",
    emptyDesc:
      "Ajoutez des fabricants vérifiés de Merter en favoris pour recevoir des alertes sur leurs nouveautés.",
    browseDirectory: "Explorer les fabricants",
  },
  pl: {
    heading: "Moi Ulubieni Dostawcy",
    subheading:
      "Wybierz, którzy ulubieni producenci mają wysyłać Ci powiadomienia o nowych produktach hurtowych.",
    verifiedBadge: "Zweryfikowany",
    productCountUnit: "aktywnych produktów",
    notifyNewLabel: "Powiadamiaj o nowych produktach dostawcy",
    notifyEmailLabel: "Powiadamiaj również e-mailem",
    openShowcase: "Otwórz showroom",
    removeLabel: "Usuń",
    emptyTitle: "Brak ulubionych dostawców",
    emptyDesc:
      "Dodaj zweryfikowanych producentów z Merter do ulubionych, aby otrzymywać alerty o nowych kolekcjach.",
    browseDirectory: "Przeglądaj producentów",
  },
  bg: {
    heading: "Любими доставчици",
    subheading:
      "Изберете от кои любими производители да получавате известия при публикуване на нови продукти.",
    verifiedBadge: "Проверен",
    productCountUnit: "активни продукта",
    notifyNewLabel: "Известие при нов продукт от доставчика",
    notifyEmailLabel: "Известявай и по имейл",
    openShowcase: "Отвори шоурума",
    removeLabel: "Премахни",
    emptyTitle: "Все още нямате любими доставчици",
    emptyDesc:
      "Добавете проверени производители от Мертер в любими, за да научавате веднага за нови модели.",
    browseDirectory: "Разгледай производителите",
  },
};

export default function FavoriteSuppliersPanel({ lang }: Readonly<{ lang: string }>) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = PANEL_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;
  const { items, loading, updateNotificationPrefs, removeFavorite } = useFavoriteSuppliers();
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-cultured p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3 border-b border-cultured pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Heart size={20} className="fill-rose-600 text-rose-600" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-eerie-black">
              {copy.heading} ({items.length})
            </h2>
            <p className="text-xs text-sonic-silver mt-0.5">{copy.subheading}</p>
          </div>
        </div>
      </div>

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center space-y-3">
          <Building2 size={32} className="mx-auto text-zinc-400" />
          <h3 className="text-sm font-extrabold text-eerie-black">{copy.emptyTitle}</h3>
          <p className="text-xs text-sonic-silver max-w-md mx-auto leading-relaxed">
            {copy.emptyDesc}
          </p>
          <Link
            href={`/ureticiler${langSuffix}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-eerie-black text-white text-xs font-extrabold no-underline"
          >
            <span>{copy.browseDirectory}</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((fav) => {
          const isBusy = busyId === fav.brand_id;
          const showcaseHref = getSupplierShowcaseHref(
            {
              id: fav.brand_id,
              slug: fav.brand_slug,
              subdomain: fav.brand_subdomain,
              subdomain_enabled: Boolean(fav.brand_subdomain),
            },
            safeLang
          );
          const isExternalShowcase = showcaseHref.startsWith("http");

          return (
            <div
              key={fav.brand_id}
              className="rounded-xl border border-zinc-200 p-4 flex flex-col justify-between gap-3.5 bg-zinc-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-white border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                    {fav.brand_cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fav.brand_cover_url}
                        alt={fav.brand_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 size={18} className="text-zinc-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isExternalShowcase ? (
                        <a
                          href={showcaseHref}
                          className="text-sm font-extrabold text-eerie-black hover:text-salmon-pink no-underline truncate"
                        >
                          {fav.brand_name}
                        </a>
                      ) : (
                        <Link
                          href={showcaseHref}
                          className="text-sm font-extrabold text-eerie-black hover:text-salmon-pink no-underline truncate"
                        >
                          {fav.brand_name}
                        </Link>
                      )}
                      {fav.is_verified && (
                        <ShieldCheck
                          size={13}
                          className="text-emerald-600 shrink-0"
                          aria-label={copy.verifiedBadge}
                        />
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-sonic-silver flex items-center gap-1 mt-0.5">
                      <Package size={11} />
                      <span>
                        {fav.active_product_count} {copy.productCountUnit}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setBusyId(fav.brand_id);
                    void removeFavorite(fav.brand_id).finally(() => setBusyId(null));
                  }}
                  title={copy.removeLabel}
                  className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-red-600 hover:border-red-200 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200/70">
                <label className="flex items-center justify-between gap-2 cursor-pointer text-xs font-bold text-eerie-black">
                  <span className="flex items-center gap-1.5">
                    {fav.notify_new_products ? (
                      <Bell size={14} className="text-amber-600 shrink-0" />
                    ) : (
                      <BellOff size={14} className="text-zinc-400 shrink-0" />
                    )}
                    <span>{copy.notifyNewLabel}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={fav.notify_new_products}
                    disabled={isBusy}
                    onChange={(e) => {
                      setBusyId(fav.brand_id);
                      void updateNotificationPrefs(fav.brand_id, {
                        notify_new_products: e.target.checked,
                      }).finally(() => setBusyId(null));
                    }}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                </label>

                {fav.notify_new_products && (
                  <label className="flex items-center justify-between gap-2 cursor-pointer text-[11px] font-semibold text-sonic-silver">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-zinc-500 shrink-0" />
                      <span>{copy.notifyEmailLabel}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={fav.notify_via_email}
                      disabled={isBusy}
                      onChange={(e) => {
                        setBusyId(fav.brand_id);
                        void updateNotificationPrefs(fav.brand_id, {
                          notify_via_email: e.target.checked,
                        }).finally(() => setBusyId(null));
                      }}
                      className="w-3.5 h-3.5 accent-eerie-black cursor-pointer"
                    />
                  </label>
                )}
              </div>

              {isExternalShowcase ? (
                <a
                  href={showcaseHref}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-eerie-black hover:bg-zinc-800 text-white text-xs font-extrabold no-underline transition-colors"
                >
                  <span>{copy.openShowcase}</span>
                  <ExternalLink size={12} />
                </a>
              ) : (
                <Link
                  href={showcaseHref}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-eerie-black hover:bg-zinc-800 text-white text-xs font-extrabold no-underline transition-colors"
                >
                  <span>{copy.openShowcase}</span>
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
