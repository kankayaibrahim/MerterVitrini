"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
            const newToast = {
              id: `toast-${Date.now()}-${productId}`,
              message: `${title} - ${lang === "tr" ? "Favorilerime Eklendi!" : "Added to Favorites!"}`,
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
