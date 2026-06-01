"use client";

import React, { useEffect, useState } from "react";
import { X, Heart, Eye } from "lucide-react";
import { Product } from "@/types/store";
import { t, getProductTitle } from "@/app/i18n";
import { convertPrice } from "@/app/utils";
import { useRouter } from "next/navigation";

interface WishlistDrawerProps {
  lang: string;
  onClose: () => void;
  displayCurrency?: string;
  exchangeRates?: any[];
}

export default function WishlistDrawer({
  lang,
  onClose,
  displayCurrency = "TRY",
  exchangeRates = [],
}: WishlistDrawerProps) {
  const router = useRouter();
  const [favoritesList, setFavoritesList] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync favorites list on mount and update
  useEffect(() => {
    if (typeof window !== "undefined") {
      const favs = JSON.parse(localStorage.getItem("merter_wishlist") || "[]");
      setFavoritesList(favs);

      const handleWishlistUpdate = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail && Array.isArray(customEvent.detail)) {
          setFavoritesList(customEvent.detail);
        } else {
          const currentFavs = JSON.parse(localStorage.getItem("merter_wishlist") || "[]");
          setFavoritesList(currentFavs);
        }
      };
      window.addEventListener("merter-wishlist-update", handleWishlistUpdate);
      return () => {
        window.removeEventListener("merter-wishlist-update", handleWishlistUpdate);
      };
    }
  }, []);

  // Fetch full details of each favorite product
  useEffect(() => {
    const fetchFavoriteProducts = async () => {
      if (favoritesList.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const promises = favoritesList.map(async (id) => {
          try {
            const response = await fetch(`/api/v1/store/products/${id}`);
            if (response.ok) {
              const data = await response.json();
              return data;
            }
          } catch (e) {
            console.error(`Failed to fetch product ${id}:`, e);
          }
          return null;
        });

        const fetched = await Promise.all(promises);
        // Filter out nulls/failures
        setProducts(fetched.filter((p) => p !== null && p !== undefined));
      } catch (err) {
        console.error("Failed to load wishlist details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteProducts();
  }, [favoritesList]);

  // Remove a favorite product
  const handleRemoveFavorite = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = favoritesList.filter((id) => id !== productId);
    localStorage.setItem("merter_wishlist", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("merter-wishlist-update", { detail: updated }));
  };

  const handleProductClick = (slugOrId: string) => {
    onClose();
    router.push(`/product/${slugOrId}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      {/* Drawer overlay click catcher */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Sliding slide-over panel content */}
      <div className="bg-white border-l border-cultured w-full max-w-md h-full flex flex-col shadow-premium relative z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
        {/* Header */}
        <div className="p-4 border-b border-cultured flex items-center justify-between shrink-0">
          <h3 className="font-sans font-extrabold text-lg tracking-[0.5px] text-eerie-black flex items-center gap-2">
            <Heart className="w-5 h-5 text-salmon-pink fill-salmon-pink" />
            {lang === "tr" ? "Favorilerim" : "Favorites"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <div className="spinner animate-spin w-6 h-6 border-3 border-salmon-pink border-t-transparent rounded-full" />
              <span className="text-xs font-bold text-sonic-silver">
                {lang === "tr" ? "Favoriler yükleniyor..." : "Loading favorites..."}
              </span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sonic-silver select-none">
              <Heart className="w-12 h-12 text-spanish-gray/20 mb-3 text-salmon-pink/20" />
              <p className="text-sm font-bold text-eerie-black">
                {lang === "tr" ? "Favori Sepetiniz Boş" : "Your Favorites List is Empty"}
              </p>
              <p className="text-xs font-semibold mt-1 max-w-[280px] text-sonic-silver">
                {lang === "tr" ? "Beğendiğiniz ürünlerin üzerindeki kalp simgesine tıklayarak favorilerinize ekleyebilirsiniz." : "Click on the heart icon on any product to save it to your favorites."}
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-salmon-pink text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md hover:bg-eerie-black active:scale-[0.98] transition-all cursor-pointer"
              >
                {lang === "tr" ? "Alışverişe Devam Et" : "Continue Shopping"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {products.map((product) => {
                const title = getProductTitle(product, lang);
                let coverImg = "/placeholder.png";
                if (product.images && product.images.length > 0) {
                  const coverObj = product.images.find((img: any) => img.is_cover) || product.images[0];
                  coverImg = coverObj.image_url;
                }

                // Pricing calculations
                const rawOrigPrice = product.price || 0.0;
                const rawDiscPrice = product.discounted_price || 0.0;
                const hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;
                
                let origPrice = rawOrigPrice;
                let discPrice = rawDiscPrice;
                let currency = product.currency || "TRY";

                if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
                  origPrice = convertPrice(rawOrigPrice, product.currency, displayCurrency, exchangeRates);
                  discPrice = convertPrice(rawDiscPrice, product.currency, displayCurrency, exchangeRates);
                  currency = displayCurrency;
                }

                return (
                  <div
                    key={product.id}
                    className="border border-cultured bg-[#fafafa] rounded-[5px] p-3 flex gap-3 relative shadow-inner hover:border-salmon-pink/20 transition-all group"
                  >
                    <img
                      src={coverImg}
                      alt={title}
                      className="w-14 h-18 object-cover rounded-[5px] bg-white border border-cultured"
                    />

                    <div className="flex-grow flex flex-col gap-1 pr-6">
                      <span className="text-[9px] uppercase font-extrabold text-salmon-pink block">
                        {product.brand_name || "Merter B2B"}
                      </span>
                      <h4
                        onClick={() => handleProductClick(product.slug || product.id)}
                        className="text-xs font-bold text-eerie-black line-clamp-2 leading-relaxed cursor-pointer hover:text-salmon-pink transition-colors"
                      >
                        {title}
                      </h4>
                      <span className="text-[10px] font-semibold text-sonic-silver block">
                        SKU: {product.custom_sku || product.sku}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 select-none">
                        <span className="text-[9.5px] font-bold text-sonic-silver bg-cultured px-2 py-0.5 rounded border border-cultured uppercase">
                          {lang === "tr" ? "Seri" : "Pack"}: {product.series_ratio}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 self-center text-right pl-1 flex flex-col gap-0.5 justify-center">
                      {hasDiscount ? (
                        <>
                          <span className="text-[10px] text-sonic-silver line-through font-medium">
                            {origPrice.toFixed(2)} {currency}
                          </span>
                          <span className="text-xs font-extrabold text-salmon-pink">
                            {discPrice.toFixed(2)} {currency}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-extrabold text-eerie-black">
                          {origPrice.toFixed(2)} {currency}
                        </span>
                      )}
                      <button
                        onClick={() => handleProductClick(product.slug || product.id)}
                        className="mt-2.5 px-3 py-1 bg-salmon-pink text-white rounded font-bold text-[9px] uppercase tracking-[0.5px] border-none shadow-sm hover:bg-eerie-black transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{lang === "tr" ? "İncele" : "View"}</span>
                      </button>
                    </div>

                    {/* Delete Icon */}
                    <button
                      onClick={(e) => handleRemoveFavorite(e, product.id)}
                      className="absolute top-2 right-2 border-none bg-transparent text-sonic-silver hover:text-salmon-pink cursor-pointer text-sm font-extrabold p-1 hover:bg-white rounded transition-all"
                      title={lang === "tr" ? "Favorilerden Çıkar" : "Remove from Favorites"}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
