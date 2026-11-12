"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { pickLangText, SupportedLangCode } from "@/app/i18n";

const WISHLIST_ADDED_TOAST: Record<SupportedLangCode, string> = {
  tr: "Favorilerime Eklendi!",
  en: "Added to Favorites!",
  ru: "Добавлено в избранное!",
  ar: "تمت الإضافة إلى المفضلة!",
  de: "Zu Favoriten hinzugefügt!",
  fr: "Ajouté aux favoris !",
  pl: "Dodano do ulubionych!",
  bg: "Добавено в любими!",
};

interface WishlistStore {
  wishlistIds: string[];
  toggleWishlist: (productId: string, title?: string, lang?: string) => boolean;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  setWishlist: (ids: string[]) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      wishlistIds: [],
      toggleWishlist: (productId: string, title?: string, lang?: string) => {
        const current = get().wishlistIds;
        const exists = current.includes(productId);
        const updated = exists
          ? current.filter((id) => id !== productId)
          : [...current, productId];

        set({ wishlistIds: updated });

        // Backward compatibility for existing listeners & toasts
        if (typeof window !== "undefined") {
          if (!exists && title) {
            const effectiveLang = lang || localStorage.getItem("preferred_lang") || "tr";
            const newToast = {
              id: `toast-${Date.now()}-${productId}`,
              message: `${title} - ${pickLangText(effectiveLang, WISHLIST_ADDED_TOAST)}`,
            };
            window.dispatchEvent(new CustomEvent("merter-show-toast", { detail: newToast }));
          }
          window.dispatchEvent(new CustomEvent("merter-wishlist-update", { detail: updated }));
        }

        return !exists;
      },
      isInWishlist: (productId: string) => {
        return get().wishlistIds.includes(productId);
      },
      clearWishlist: () => {
        set({ wishlistIds: [] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("merter-wishlist-update", { detail: [] }));
        }
      },
      setWishlist: (ids: string[]) => {
        set({ wishlistIds: ids });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("merter-wishlist-update", { detail: ids }));
        }
      },
    }),
    {
      name: "merter_wishlist",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
