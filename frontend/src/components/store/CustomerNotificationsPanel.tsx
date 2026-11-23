"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink, Package, RefreshCw } from "lucide-react";
import { getValidStoreBearerToken } from "@/app/storeAuth";
import { CustomerNotificationItem } from "@/types/stories";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

interface NotifPanelCopy {
  readonly heading: string;
  readonly subheading: string;
  readonly markAllRead: string;
  readonly refresh: string;
  readonly emptyTitle: string;
  readonly emptyDesc: string;
  readonly unreadBadge: string;
  readonly viewTarget: string;
}

const NOTIF_PANEL_COPY: Record<SupportedSeoLang, NotifPanelCopy> = {
  tr: {
    heading: "Bildirimlerim",
    subheading: "Favori tedarikçilerinizden gelen yeni ürün ve sipariş bildirimleri.",
    markAllRead: "Tümünü Okundu İşaretle",
    refresh: "Yenile",
    emptyTitle: "Henüz bildiriminiz yok",
    emptyDesc:
      "Favori tedarikçilerinizi seçip yeni ürün bildirimlerini açtığınızda burada görünecektir.",
    unreadBadge: "Yeni",
    viewTarget: "İncele",
  },
  en: {
    heading: "My Notifications",
    subheading: "New product launches from your favorite suppliers and order updates.",
    markAllRead: "Mark all as read",
    refresh: "Refresh",
    emptyTitle: "No notifications yet",
    emptyDesc:
      "When your favorite suppliers publish new products with alerts enabled, they will appear here.",
    unreadBadge: "New",
    viewTarget: "Open",
  },
  ru: {
    heading: "Мои уведомления",
    subheading: "Новинки от ваших избранных фабрик и обновления по заказам.",
    markAllRead: "Отметить все прочитанными",
    refresh: "Обновить",
    emptyTitle: "Уведомлений пока нет",
    emptyDesc:
      "Здесь появятся оповещения о новых моделях ваших избранных поставщиков.",
    unreadBadge: "Новое",
    viewTarget: "Открыть",
  },
  ar: {
    heading: "إشعاراتي",
    subheading: "تنبيهات المنتجات الجديدة من مورديك المفضلين وتحديثات الطلبات.",
    markAllRead: "تحديد الكل كمقروء",
    refresh: "تحديث",
    emptyTitle: "لا توجد إشعارات بعد",
    emptyDesc: "ستظهر هنا تنبيهات المنتجات الجديدة من الموردين المفضلين لديك.",
    unreadBadge: "جديد",
    viewTarget: "عرض",
  },
  de: {
    heading: "Meine Benachrichtigungen",
    subheading: "Neuheiten Ihrer favorisierten Hersteller und Bestellhinweise.",
    markAllRead: "Alle als gelesen markieren",
    refresh: "Aktualisieren",
    emptyTitle: "Noch keine Benachrichtigungen",
    emptyDesc:
      "Sobald favorisierte Hersteller neue Artikel veröffentlichen, sehen Sie dies hier.",
    unreadBadge: "Neu",
    viewTarget: "Öffnen",
  },
  fr: {
    heading: "Mes Notifications",
    subheading: "Nouveaux produits de vos fournisseurs favoris et suivi de commandes.",
    markAllRead: "Tout marquer comme lu",
    refresh: "Actualiser",
    emptyTitle: "Aucune notification pour le moment",
    emptyDesc:
      "Les alertes de nouveautés de vos fournisseurs favoris s'afficheront ici.",
    unreadBadge: "Nouveau",
    viewTarget: "Voir",
  },
  pl: {
    heading: "Moje Powiadomienia",
    subheading: "Nowe produkty ulubionych dostawców oraz statusy zamówień.",
    markAllRead: "Oznacz wszystkie jako przeczytane",
    refresh: "Odśwież",
    emptyTitle: "Brak powiadomień",
    emptyDesc:
      "Powiadomienia o nowościach od ulubionych producentów pojawią się w tym miejscu.",
    unreadBadge: "Nowe",
    viewTarget: "Otwórz",
  },
  bg: {
    heading: "Моите известия",
    subheading: "Нови продукти от любимите ви доставчици и статуси на поръчки.",
    markAllRead: "Маркирай всички като прочетени",
    refresh: "Обнови",
    emptyTitle: "Все още нямате известия",
    emptyDesc:
      "Тук ще виждате известия при публикуване на нови модели от любимите ви доставчици.",
    unreadBadge: "Ново",
    viewTarget: "Отвори",
  },
};

export default function CustomerNotificationsPanel({ lang }: Readonly<{ lang: string }>) {
  const router = useRouter();
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = NOTIF_PANEL_COPY[safeLang];
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const token = getValidStoreBearerToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/store/notifications", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          notifications?: CustomerNotificationItem[];
          unread_count?: number;
        };
        setItems(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unread_count) || 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadList]);

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

  const handleOpenItem = async (item: CustomerNotificationItem) => {
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
    const rawTarget = item.metadata?.target_url;
    if (typeof rawTarget === "string" && rawTarget.startsWith("/")) {
      const target =
        safeLang !== "tr" && !rawTarget.includes("?")
          ? `${rawTarget}?lang=${safeLang}`
          : rawTarget;
      router.push(target);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-cultured p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cultured pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-eerie-black">
              {copy.heading} {unreadCount > 0 ? `(${unreadCount})` : ""}
            </h2>
            <p className="text-xs text-sonic-silver mt-0.5">{copy.subheading}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold cursor-pointer"
            >
              <CheckCheck size={14} />
              <span>{copy.markAllRead}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-eerie-black cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>{copy.refresh}</span>
          </button>
        </div>
      </div>

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center space-y-2">
          <Bell size={30} className="mx-auto text-zinc-400" />
          <h3 className="text-sm font-extrabold text-eerie-black">{copy.emptyTitle}</h3>
          <p className="text-xs text-sonic-silver max-w-md mx-auto">{copy.emptyDesc}</p>
        </div>
      )}

      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
        {items.map((item) => {
          const targetUrl =
            typeof item.metadata?.target_url === "string" ? item.metadata.target_url : "";
          return (
            <div
              key={item.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.is_read ? "bg-white" : "bg-amber-50/55"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-zinc-100 text-eerie-black flex items-center justify-center shrink-0">
                  <Package size={16} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-eerie-black">
                      {item.title}
                    </span>
                    {!item.is_read && (
                      <span className="px-2 py-0.5 rounded-full bg-salmon-pink text-white text-[10px] font-extrabold">
                        {copy.unreadBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sonic-silver">{item.body}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {targetUrl && (
                <button
                  type="button"
                  onClick={() => void handleOpenItem(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-eerie-black text-white text-xs font-bold border-none cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <span>{copy.viewTarget}</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
