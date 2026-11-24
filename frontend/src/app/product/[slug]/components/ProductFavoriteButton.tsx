"use client";

import React, { useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/useWishlistStore";
import { trackMemberEvent } from "@/components/analytics/AnalyticsTracker";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

interface ProductFavoriteButtonProps {
  readonly productId: string;
  readonly title: string;
  readonly lang: string;
  readonly imageUrl?: string;
  readonly variant?: "button" | "icon";
}

const FAVORITE_COPY: Record<SupportedSeoLang, { readonly add: string; readonly saved: string }> = {
  tr: { add: "Favorilere Ekle", saved: "Favorilerimde" },
  en: { add: "Add to Favorites", saved: "In Favorites" },
  ru: { add: "В избранное", saved: "В избранном" },
  ar: { add: "أضف إلى المفضلة", saved: "في المفضلة" },
  de: { add: "Zu Favoriten hinzufügen", saved: "In Favoriten" },
  fr: { add: "Ajouter aux favoris", saved: "Dans les favoris" },
  pl: { add: "Dodaj do ulubionych", saved: "W ulubionych" },
  bg: { add: "Добави в любими", saved: "В любими" },
};

function subscribeNoop(): () => void {
  return () => {};
}

function getClientSnapshotTrue(): boolean {
  return true;
}

function getServerSnapshotFalse(): boolean {
  return false;
}

export default function ProductFavoriteButton({
  productId,
  title,
  lang,
  imageUrl,
  variant = "button",
}: Readonly<ProductFavoriteButtonProps>) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const labels = FAVORITE_COPY[safeLang];
  const wishlistIds = useWishlistStore((state) => state.wishlistIds);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const isClient = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshotTrue,
    getServerSnapshotFalse
  );

  const isFavorite = isClient && Boolean(productId) && wishlistIds.includes(productId);
  const label = isFavorite ? labels.saved : labels.add;

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    const added = toggleWishlist(productId, title, safeLang);
    if (added) {
      trackMemberEvent({
        event_type: "wishlist_add",
        event_category: "commerce",
        title,
        entity_type: "product",
        entity_id: productId,
        image_url: imageUrl,
      });
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={isFavorite}
        aria-label={label}
        title={label}
        className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-sm transition-all cursor-pointer active:scale-95 ${
          isFavorite
            ? "bg-[#FFF1F2] border-[#FECDD3] text-[#E61730]"
            : "bg-white/95 hover:bg-white border-[#E5E0D8] text-[#1C1C1C] hover:border-[#1C1C1C]"
        }`}
      >
        <Heart className={`w-4 h-4 ${isFavorite ? "fill-[#E61730] text-[#E61730]" : ""}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isFavorite}
      className={`w-full py-3 px-4 rounded-md font-extrabold text-xs tracking-[0.5px] uppercase transition-colors border flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99] ${
        isFavorite
          ? "bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#BE123C] border-[#FECDD3]"
          : "bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] border-[#D6D1C7] hover:border-[#1C1C1C]"
      }`}
    >
      <Heart className={`w-4 h-4 shrink-0 ${isFavorite ? "fill-[#E61730] text-[#E61730]" : "text-[#8C6D3F]"}`} />
      <span>{label}</span>
    </button>
  );
}
