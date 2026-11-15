"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, LogIn, PackageCheck, ShoppingCart } from "lucide-react";
import type { CartItem } from "@/types/store";
import type { Customer } from "./customerTypes";

interface CustomerUnfinishedCartSectionProps {
  readonly customer: Customer;
  readonly apiUrl: string;
  readonly token: string | null;
  readonly impersonating: boolean;
  readonly onImpersonateWithCart: () => void;
}

export function CustomerUnfinishedCartSection({
  customer,
  apiUrl,
  token,
  impersonating,
  onImpersonateWithCart,
}: CustomerUnfinishedCartSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!token || !customer.id) return;
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setCartError(null);
      }
    });

    fetch(`${apiUrl}/api/v1/customers/${customer.id}/cart`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as { items?: CartItem[] };
      })
      .then((data) => {
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!active) return;
        setCartError("Müşterinin sepet içeriği yüklenemedi.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiUrl, customer.id, token]);

  const totalPackages = items.reduce((sum, it) => sum + (it.packages_qty || 0), 0);

  const renderCartContent = () => {
    if (loading) {
      return (
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
          Sepet yükleniyor...
        </div>
      );
    }

    if (cartError) {
      return (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700">
          {cartError}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-500 text-center">
          Müşterinin bekleyen sepet ürünü bulunmuyor.
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 overflow-hidden">
        <div className="divide-y divide-amber-200/50 max-h-56 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={`${item.product_id}-${idx}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs bg-white/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src={item.image_url || "/placeholder.png"}
                  alt={item.title}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-lg object-cover border border-zinc-200 shrink-0 bg-zinc-100"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    SKU: {item.custom_sku || "-"} • Renk: {item.color || "Standart"}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-zinc-900 tabular-nums flex items-center justify-end gap-1">
                  <PackageCheck className="w-3.5 h-3.5 text-amber-600" />
                  {item.packages_qty} paket ({item.packages_qty * item.units_per_package} adet)
                </div>
                <div className="text-[11px] text-zinc-600 tabular-nums">
                  {Number(item.price_per_unit || 0).toFixed(2)} {item.currency || "TRY"} / adet
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-amber-900">
            Toplam {items.length} kalem • {totalPackages} seri paket sepette bekliyor
          </span>
          <button
            type="button"
            disabled={customer.is_blocked || impersonating}
            onClick={onImpersonateWithCart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {impersonating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            Sepetiyle Giriş Yap &amp; Tamamla
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-xs font-bold text-zinc-900 mb-2.5 flex items-center gap-1.5">
        <ShoppingCart className="w-4 h-4 text-amber-600" />
        Bekleyen Sepet İçeriği ({items.length > 0 ? items.length : customer.cart_items_count} kalem)
      </h3>
      {renderCartContent()}
    </div>
  );
}
