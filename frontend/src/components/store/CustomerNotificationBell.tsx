"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Package, Sparkles } from "lucide-react";
import { getValidStoreBearerToken } from "@/app/storeAuth";
import { CustomerNotificationItem } from "@/types/stories";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

interface BellCopy {
  readonly ariaLabel: string;
  readonly title: string;
  readonly markAllRead: string;
  readonly empty: string;
  readonly viewAll: string;
}

const BELL_COPY: Record<SupportedSeoLang, BellCopy> = {
  tr: {
    ariaLabel: "Bildirimlerim",
    title: "Tedarikçi & Sipariş Bildirimleri",
    markAllRead: "Tümünü Okundu İşaretle",
    empty: "Henüz yeni bildiriminiz bulunmuyor.",
    viewAll: "Tüm Bildirimleri Gör",
  },
  en: {
    ariaLabel: "Notifications",
    title: "Supplier & Order Alerts",
    markAllRead: "Mark all read",
    empty: "No notifications yet.",
    viewAll: "View all notifications",
  },
  ru: {
    ariaLabel: "Уведомления",
    title: "Уведомления о новинках и заказах",
    markAllRead: "Отметить все прочитанными",
    empty: "Уведомлений пока нет.",
    viewAll: "Все уведомления",
  },
  ar: {
    ariaLabel: "الإشعارات",
    title: "تنبيهات الموردين والطلبات",
    markAllRead: "تحديد الكل كمقروء",
    empty: "لا توجد إشعارات حالياً.",
    viewAll: "عرض كل الإشعارات",
  },
  de: {
    ariaLabel: "Benachrichtigungen",
    title: "Hersteller- & Bestellhinweise",
    markAllRead: "Alle gelesen",
    empty: "Noch keine Benachrichtigungen.",
    viewAll: "Alle Benachrichtigungen anzeigen",
  },
  fr: {
    ariaLabel: "Notifications",
    title: "Alertes fournisseurs & commandes",
    markAllRead: "Tout marquer lu",
    empty: "Aucune notification pour le moment.",
    viewAll: "Voir toutes les notifications",
  },
  pl: {
    ariaLabel: "Powiadomienia",
    title: "Alerty dostawców i zamówień",
    markAllRead: "Oznacz wszystko jako przeczytane",
    empty: "Brak powiadomień.",
    viewAll: "Zobacz wszystkie powiadomienia",
  },
  bg: {
    ariaLabel: "Известия",
    title: "Известия от доставчици и поръчки",
    markAllRead: "Маркирай всички прочетени",
    empty: "Все още нямате известия.",
    viewAll: "Виж всички известия",
  },
};

interface CustomerNotificationBellProps {
  readonly lang: string;
  readonly compact?: boolean;
}

export default function CustomerNotificationBell({
  lang,
  compact = false,
}: CustomerNotificationBellProps) {
  const router = useRouter();
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = BELL_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `&lang=${safeLang}`;

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    const token = getValidStoreBearerToken();
    if (!token) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch("/api/v1/store/notifications", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: CustomerNotificationItem[];
        unread_count?: number;
      };
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unread_count) || 0);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    const onRefresh = () => {
      void loadNotifications();
    };
    window.addEventListener("auth-change", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("auth-change", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    const token = getValidStoreBearerToken();
    if (!token) return;
    await fetch("/api/v1/store/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleItemClick = async (item: CustomerNotificationItem) => {
    const token = getValidStoreBearerToken();
    if (token && !item.is_read) {
      void fetch(`/api/v1/store/notifications/${encodeURIComponent(item.id)}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    const targetUrl = item.metadata?.target_url;
    if (typeof targetUrl === "string" && targetUrl.startsWith("/")) {
      const target =
        safeLang !== "tr" && !targetUrl.includes("?")
          ? `${targetUrl}?lang=${safeLang}`
          : targetUrl;
      router.push(target);
    } else {
      window.dispatchEvent(
        new CustomEvent("merter-profile-tab", { detail: { tab: "notifications" } })
      );
      router.push(`/profile?tab=notifications${langSuffix}`);
    }
  };

  return (
    <div className="relative flex items-center shrink-0">
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) void loadNotifications();
        }}
        className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent shrink-0"
        aria-label={copy.ariaLabel}
      >
        <Bell className={compact ? "w-[18px] h-[18px]" : "w-[20px] h-[20px]"} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -end-1 bg-salmon-pink text-white rounded-full flex items-center justify-center font-extrabold leading-none shadow-sm ${
              compact ? "w-[14px] h-[14px] text-[8px]" : "w-[15px] h-[15px] text-[8.5px]"
            }`}
          >
            {unreadCount > 99 ? "99" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute end-0 top-9 w-[310px] sm:w-[340px] bg-white border border-cultured shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
            <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-cultured flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-eerie-black flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-600" />
                <span>{copy.title}</span>
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="text-[10px] font-bold text-salmon-pink hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck size={12} />
                  <span>{copy.markAllRead}</span>
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100">
              {items.length === 0 ? (
                <div className="p-5 text-center text-xs font-semibold text-sonic-silver">
                  {copy.empty}
                </div>
              ) : (
                items.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleItemClick(item)}
                    className={`w-full text-start px-3.5 py-2.5 flex items-start gap-2.5 border-none cursor-pointer transition-colors ${
                      item.is_read
                        ? "bg-white hover:bg-zinc-50"
                        : "bg-amber-50/60 hover:bg-amber-50"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-100 text-eerie-black flex items-center justify-center shrink-0 mt-0.5">
                      <Package size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-extrabold text-eerie-black line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-sonic-silver line-clamp-2 mt-0.5 leading-snug">
                        {item.body}
                      </p>
                    </div>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-salmon-pink shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>

            <Link
              href={`/profile?tab=notifications${langSuffix}`}
              onClick={() => {
                setIsOpen(false);
                window.dispatchEvent(
                  new CustomEvent("merter-profile-tab", { detail: { tab: "notifications" } })
                );
              }}
              className="block text-center px-3 py-2.5 bg-zinc-50 hover:bg-cultured border-t border-cultured text-[11px] font-extrabold text-eerie-black no-underline"
            >
              {copy.viewAll}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
