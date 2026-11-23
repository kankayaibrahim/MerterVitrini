"use client";

import React, { useState } from "react";
import { Bell, BellOff, Heart } from "lucide-react";
import { useFavoriteSuppliers } from "@/hooks/useFavoriteSuppliers";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

interface FavCopy {
  readonly addFavorite: string;
  readonly favorited: string;
  readonly notifyOnLabel: string;
  readonly notifyOffLabel: string;
  readonly notifyOnTooltip: string;
  readonly notifyOffTooltip: string;
  readonly shortNotifyOn: string;
  readonly shortNotifyOff: string;
}

const FAV_COPY: Record<SupportedSeoLang, FavCopy> = {
  tr: {
    addFavorite: "Tedarikçiyi Favorilere Ekle",
    favorited: "Favori Tedarikçi",
    notifyOnLabel: "Yeni Ürün Bildirimi Açık",
    notifyOffLabel: "Yeni Ürün Bildirimi Kapalı",
    notifyOnTooltip: "Bu tedarikçi yeni ürün paylaşınca bildirim alırsınız",
    notifyOffTooltip: "Yeni ürün bildirimi almak için tıklayın",
    shortNotifyOn: "Bildirim Açık",
    shortNotifyOff: "Bildirim Kapalı",
  },
  en: {
    addFavorite: "Add to Favorite Suppliers",
    favorited: "Favorite Supplier",
    notifyOnLabel: "New Product Alerts On",
    notifyOffLabel: "New Product Alerts Off",
    notifyOnTooltip: "You will be notified when this supplier publishes new products",
    notifyOffTooltip: "Click to receive new product alerts",
    shortNotifyOn: "Alerts On",
    shortNotifyOff: "Alerts Off",
  },
  ru: {
    addFavorite: "В избранные фабрики",
    favorited: "В избранном",
    notifyOnLabel: "Уведомления о новинках вкл.",
    notifyOffLabel: "Уведомления о новинках выкл.",
    notifyOnTooltip: "Вы получите уведомление о новых моделях этого поставщика",
    notifyOffTooltip: "Нажмите, чтобы включить уведомления о новинках",
    shortNotifyOn: "Увед. вкл",
    shortNotifyOff: "Увед. выкл",
  },
  ar: {
    addFavorite: "أضف للموردين المفضلين",
    favorited: "مورد مفضل",
    notifyOnLabel: "تنبيهات المنتجات الجديدة مفعّلة",
    notifyOffLabel: "تنبيهات المنتجات الجديدة متوقفة",
    notifyOnTooltip: "ستصلك إشعارات عند نشر منتجات جديدة من هذا المورد",
    notifyOffTooltip: "انقر لتفعيل تنبيهات المنتجات الجديدة",
    shortNotifyOn: "التنبيهات مفعّلة",
    shortNotifyOff: "التنبيهات متوقفة",
  },
  de: {
    addFavorite: "Zu Favoriten-Herstellern",
    favorited: "Favorisierter Hersteller",
    notifyOnLabel: "Neuheiten-Alarme Ein",
    notifyOffLabel: "Neuheiten-Alarme Aus",
    notifyOnTooltip: "Sie erhalten Benachrichtigungen bei neuen Modellen",
    notifyOffTooltip: "Klicken für Benachrichtigungen bei neuen Modellen",
    shortNotifyOn: "Alarme Ein",
    shortNotifyOff: "Alarme Aus",
  },
  fr: {
    addFavorite: "Ajouter aux fournisseurs favoris",
    favorited: "Fournisseur favori",
    notifyOnLabel: "Alertes nouveautés activées",
    notifyOffLabel: "Alertes nouveautés désactivées",
    notifyOnTooltip: "Recevez une alerte lorsque ce fournisseur publie un nouveau modèle",
    notifyOffTooltip: "Cliquez pour activer les alertes nouveautés",
    shortNotifyOn: "Alertes actives",
    shortNotifyOff: "Alertes coupées",
  },
  pl: {
    addFavorite: "Dodaj do ulubionych dostawców",
    favorited: "Ulubiony dostawca",
    notifyOnLabel: "Powiadomienia o nowościach wł.",
    notifyOffLabel: "Powiadomienia o nowościach wył.",
    notifyOnTooltip: "Otrzymasz powiadomienie o nowych produktach tego dostawcy",
    notifyOffTooltip: "Kliknij, aby włączyć powiadomienia o nowościach",
    shortNotifyOn: "Alerty wł.",
    shortNotifyOff: "Alerty wył.",
  },
  bg: {
    addFavorite: "Добави в любими доставчици",
    favorited: "Любим доставчик",
    notifyOnLabel: "Известия за нови продукти Вкл.",
    notifyOffLabel: "Известия за нови продукти Изкл.",
    notifyOnTooltip: "Ще получавате известие при нов продукт от този доставчик",
    notifyOffTooltip: "Кликнете за известия при нови продукти",
    shortNotifyOn: "Известия Вкл.",
    shortNotifyOff: "Известия Изкл.",
  },
};

interface FavoriteSupplierButtonProps {
  readonly brandId: string;
  readonly lang: string;
  readonly variant?: "full" | "compact";
}

export default function FavoriteSupplierButton({
  brandId,
  lang,
  variant = "full",
}: FavoriteSupplierButtonProps) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = FAV_COPY[safeLang];
  const { getFavoriteItem, toggleFavorite, updateNotificationPrefs } = useFavoriteSuppliers();
  const [busy, setBusy] = useState(false);

  const favItem = getFavoriteItem(brandId);
  const favorited = Boolean(favItem);
  const notifyNew = favItem?.notify_new_products ?? true;

  const handleToggleFav = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleFavorite(brandId);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotify = async () => {
    if (busy || !favorited) return;
    setBusy(true);
    try {
      await updateNotificationPrefs(brandId, { notify_new_products: !notifyNew });
    } finally {
      setBusy(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => void handleToggleFav()}
          disabled={busy}
          title={favorited ? copy.favorited : copy.addFavorite}
          aria-label={favorited ? copy.favorited : copy.addFavorite}
          className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
            favorited
              ? "bg-rose-50 border-rose-300 text-rose-600"
              : "bg-white border-[#E5E0D8] text-[#525252] hover:border-rose-300 hover:text-rose-600"
          }`}
        >
          <Heart size={15} className={favorited ? "fill-rose-600 text-rose-600" : ""} />
        </button>

        {favorited && (
          <button
            type="button"
            onClick={() => void handleToggleNotify()}
            disabled={busy}
            title={notifyNew ? copy.notifyOnTooltip : copy.notifyOffTooltip}
            aria-label={notifyNew ? copy.notifyOnLabel : copy.notifyOffLabel}
            className={`px-2 h-8 rounded-md border inline-flex items-center gap-1 text-[10px] font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
              notifyNew
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {notifyNew ? <Bell size={12} /> : <BellOff size={12} />}
            <span className="hidden xl:inline">
              {notifyNew ? copy.shortNotifyOn : copy.shortNotifyOff}
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleToggleFav()}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
          favorited
            ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300"
            : "bg-white hover:bg-[#EFECE6] text-[#1C1C1C] border-[#D6D1C7] hover:border-[#1C1C1C]"
        }`}
      >
        <Heart size={15} className={favorited ? "fill-rose-600 text-rose-600" : "text-rose-600"} />
        <span>{favorited ? copy.favorited : copy.addFavorite}</span>
      </button>

      {favorited && (
        <button
          type="button"
          onClick={() => void handleToggleNotify()}
          disabled={busy}
          title={notifyNew ? copy.notifyOnTooltip : copy.notifyOffTooltip}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md border text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
            notifyNew
              ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
              : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300"
          }`}
        >
          {notifyNew ? (
            <Bell size={14} className="text-amber-700" />
          ) : (
            <BellOff size={14} className="text-zinc-500" />
          )}
          <span>{notifyNew ? copy.notifyOnLabel : copy.notifyOffLabel}</span>
        </button>
      )}
    </div>
  );
}
