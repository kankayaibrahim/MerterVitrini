"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { X, Heart, Eye, Lock } from "lucide-react";
import { Product } from "@/types/store";
import {
  buildLocalizedProductHref,
  getProductTitle,
  pickLangText,
  SupportedLangCode,
  t,
} from "@/app/i18n";
import { convertPrice, getResizedImageUrl, ExchangeRate } from "@/app/utils";
import { useIsStoreAuthenticated, openStoreAuthModal, getShortMemberPriceLabel } from "@/app/storeAuth";
import { useRouter } from "next/navigation";
import { formatAsciiSafeUpper } from "@/utils/formatters";

interface WishlistUiTexts {
  title: string;
  packLabel: string;
  viewBtn: string;
  removeTitle: string;
  loading: string;
  emptyTitle: string;
  emptyDesc: string;
  continueShopping: string;
}

const WISHLIST_UI_TEXTS: Record<SupportedLangCode, WishlistUiTexts> = {
  tr: {
    title: "Favorilerim",
    packLabel: "Seri",
    viewBtn: "İncele",
    removeTitle: "Favorilerden Çıkar",
    loading: "Favoriler yükleniyor...",
    emptyTitle: "Favori Sepetiniz Boş",
    emptyDesc: "Beğendiğiniz ürünlerin üzerindeki kalp simgesine tıklayarak favorilerinize ekleyebilirsiniz.",
    continueShopping: "Alışverişe Devam Et",
  },
  en: {
    title: "Favorites",
    packLabel: "Pack",
    viewBtn: "View",
    removeTitle: "Remove from Favorites",
    loading: "Loading favorites...",
    emptyTitle: "Your Favorites List is Empty",
    emptyDesc: "Click on the heart icon on any product to save it to your favorites.",
    continueShopping: "Continue Shopping",
  },
  ru: {
    title: "Избранное",
    packLabel: "Серия",
    viewBtn: "Смотреть",
    removeTitle: "Удалить из избранного",
    loading: "Загрузка избранного...",
    emptyTitle: "Список избранного пуст",
    emptyDesc: "Нажмите на значок сердечка на карточке товара, чтобы добавить его в избранное.",
    continueShopping: "Продолжить покупки",
  },
  ar: {
    title: "المفضلة",
    packLabel: "حزمة",
    viewBtn: "عرض",
    removeTitle: "إزالة من المفضلة",
    loading: "جاري تحميل المفضلة...",
    emptyTitle: "قائمة المفضلة فارغة",
    emptyDesc: "انقر على أيقونة القلب على أي منتج لحفظه في قائمة المفضلة.",
    continueShopping: "متابعة التسوق",
  },
  de: {
    title: "Favoriten",
    packLabel: "Serie",
    viewBtn: "Ansehen",
    removeTitle: "Aus Favoriten entfernen",
    loading: "Favoriten werden geladen...",
    emptyTitle: "Ihre Favoritenliste ist leer",
    emptyDesc: "Klicken Sie auf das Herzsymbol eines Produkts, um es in Ihren Favoriten zu speichern.",
    continueShopping: "Weiter einkaufen",
  },
  fr: {
    title: "Favoris",
    packLabel: "Lot",
    viewBtn: "Voir",
    removeTitle: "Retirer des favoris",
    loading: "Chargement des favoris...",
    emptyTitle: "Votre liste de favoris est vide",
    emptyDesc: "Cliquez sur l'icône en forme de cœur sur un produit pour l'enregistrer dans vos favoris.",
    continueShopping: "Continuer vos achats",
  },
  pl: {
    title: "Ulubione",
    packLabel: "Pakiet",
    viewBtn: "Zobacz",
    removeTitle: "Usuń z ulubionych",
    loading: "Ładowanie ulubionych...",
    emptyTitle: "Twoja lista ulubionych jest pusta",
    emptyDesc: "Kliknij ikonę serca na dowolnym produkcie, aby zapisać go w ulubionych.",
    continueShopping: "Kontynuuj zakupy",
  },
  bg: {
    title: "Любими",
    packLabel: "Серия",
    viewBtn: "Преглед",
    removeTitle: "Премахни от любими",
    loading: "Зареждане на любими...",
    emptyTitle: "Списъкът с любими е празен",
    emptyDesc: "Кликнете върху иконата със сърце върху избран продукт, за да го запазите в любими.",
    continueShopping: "Продължи пазаруването",
  },
};

function WishlistItemPriceBlock({
  isAuthenticated,
  hasDiscount,
  origPrice,
  discPrice,
  currency,
  lang,
  onClose,
}: Readonly<{
  isAuthenticated: boolean;
  hasDiscount: boolean;
  origPrice: number;
  discPrice: number;
  currency: string;
  lang: string;
  onClose: () => void;
}>) {
  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => {
          onClose();
          openStoreAuthModal("login");
        }}
        className="inline-flex items-center justify-end gap-1 text-[10px] font-extrabold text-salmon-pink hover:underline bg-transparent border-none p-0 cursor-pointer"
      >
        <Lock className="w-2.5 h-2.5 shrink-0" />
        <span>{getShortMemberPriceLabel(lang)}</span>
      </button>
    );
  }

  if (hasDiscount) {
    return (
      <>
        <span className="text-[10px] text-sonic-silver line-through font-medium">
          {origPrice.toFixed(2)} {currency}
        </span>
        <span className="text-xs font-extrabold text-salmon-pink">
          {discPrice.toFixed(2)} {currency}
        </span>
      </>
    );
  }

  return (
    <span className="text-xs font-extrabold text-eerie-black">
      {origPrice.toFixed(2)} {currency}
    </span>
  );
}

interface WishlistDrawerProps {
  readonly lang: string;
  readonly onClose: () => void;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
}

interface WishlistItemCardProps {
  readonly product: Product;
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onProductClick: (slugOrId: string) => void;
  readonly onRemoveFavorite: (e: React.MouseEvent, productId: string) => void;
}

function WishlistItemCard({
  product,
  lang,
  displayCurrency,
  exchangeRates,
  onProductClick,
  onRemoveFavorite,
  onClose,
}: Readonly<WishlistItemCardProps & { readonly onClose: () => void }>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const title = getProductTitle(product, lang);
  let coverImg = "/placeholder.png";
  if (product.images && product.images.length > 0) {
    const coverObj = product.images.find((img) => img.is_cover) || product.images[0];
    coverImg = getResizedImageUrl(coverObj.image_url, 80, 106);
  }

  // Pricing calculations
  const rawOrigPrice = product.price || 0.0;
  const rawDiscPrice = product.discounted_price || 0.0;
  const hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;

  let origPrice = rawOrigPrice;
  let discPrice = rawDiscPrice;
  let currency = product.currency || "TRY";

  if (displayCurrency && exchangeRates.length > 0) {
    origPrice = convertPrice(rawOrigPrice, product.currency, displayCurrency, exchangeRates as ExchangeRate[]);
    discPrice = convertPrice(rawDiscPrice, product.currency, displayCurrency, exchangeRates as ExchangeRate[]);
    currency = displayCurrency;
  }

  const uiTexts = pickLangText(lang, WISHLIST_UI_TEXTS);

  return (
    <div className="border border-cultured bg-[#fafafa] rounded-[5px] p-3 flex gap-3 relative shadow-inner hover:border-salmon-pink/20 transition-all group">
      <Image
        src={coverImg}
        alt={title}
        width={56}
        height={72}
        className="w-14 h-18 object-cover rounded-[5px] bg-white border border-cultured"
      />

      <div className="flex-grow flex flex-col gap-1 pr-6">
        <span className="text-[9px] font-extrabold text-[#8C6D3F] block tracking-wider">
          {formatAsciiSafeUpper(product.brand_name || t("merter_manufacturer", lang))}
        </span>
        <h4 className="text-xs font-bold text-eerie-black line-clamp-2 leading-relaxed">
          <button
            type="button"
            onClick={() => onProductClick(product.slug || product.id)}
            className="text-left bg-transparent border-none p-0 cursor-pointer hover:text-salmon-pink transition-colors font-bold text-xs"
          >
            {title}
          </button>
        </h4>
        <span className="text-[10px] font-semibold text-sonic-silver block">
          SKU: {product.custom_sku || product.sku}
        </span>
        <div className="flex items-center gap-1.5 mt-1 select-none">
          <span className="text-[9.5px] font-bold text-sonic-silver bg-cultured px-2 py-0.5 rounded border border-cultured uppercase">
            {uiTexts.packLabel}: {product.series_ratio}
          </span>
        </div>
      </div>

      <div className="shrink-0 self-center text-right pl-1 flex flex-col gap-0.5 justify-center">
        <WishlistItemPriceBlock
          isAuthenticated={isAuthenticated}
          hasDiscount={hasDiscount}
          origPrice={origPrice}
          discPrice={discPrice}
          currency={currency}
          lang={lang}
          onClose={onClose}
        />
        <button
          type="button"
          onClick={() => onProductClick(product.slug || product.id)}
          className="mt-2.5 px-3 py-1 bg-[#1C1C1C] text-white rounded-md font-bold text-[9px] uppercase tracking-[0.5px] border-none hover:bg-[#333333] transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
        >
          <Eye className="w-3 h-3" />
          <span>{uiTexts.viewBtn}</span>
        </button>
      </div>

      {/* Delete Icon */}
      <button
        type="button"
        onClick={(e) => onRemoveFavorite(e, product.id)}
        className="absolute top-2 right-2 border-none bg-transparent text-sonic-silver hover:text-salmon-pink cursor-pointer text-sm font-extrabold p-1 hover:bg-white rounded transition-all"
        title={uiTexts.removeTitle}
        aria-label={uiTexts.removeTitle}
      >
        &times;
      </button>
    </div>
  );
}

function WishlistLoading({ lang }: { readonly lang: string }) {
  const uiTexts = pickLangText(lang, WISHLIST_UI_TEXTS);
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <div className="spinner animate-spin w-6 h-6 border-3 border-salmon-pink border-t-transparent rounded-full" />
      <span className="text-xs font-bold text-sonic-silver">
        {uiTexts.loading}
      </span>
    </div>
  );
}

function WishlistEmpty({
  lang,
  onClose,
}: {
  readonly lang: string;
  readonly onClose: () => void;
}) {
  const uiTexts = pickLangText(lang, WISHLIST_UI_TEXTS);
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-sonic-silver select-none">
      <Heart className="w-12 h-12 text-spanish-gray/20 mb-3 text-salmon-pink/20" />
      <p className="text-sm font-bold text-eerie-black">
        {uiTexts.emptyTitle}
      </p>
      <p className="text-xs font-semibold mt-1 max-w-[280px] text-sonic-silver">
        {uiTexts.emptyDesc}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 px-6 py-2.5 bg-salmon-pink text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md hover:bg-eerie-black active:scale-[0.98] transition-all cursor-pointer"
      >
        {uiTexts.continueShopping}
      </button>
    </div>
  );
}

export default function WishlistDrawer({
  lang,
  onClose,
  displayCurrency = "TRY",
  exchangeRates = [],
}: Readonly<WishlistDrawerProps>) {
  const router = useRouter();
  const [favoritesList, setFavoritesList] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("merter_wishlist") || "[]") as string[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync favorites list on mount and update
  useEffect(() => {
    const handleWishlistUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFavoritesList(customEvent.detail);
      } else {
        try {
          const currentFavs = JSON.parse(localStorage.getItem("merter_wishlist") || "[]") as string[];
          setFavoritesList(currentFavs);
        } catch {
          setFavoritesList([]);
        }
      }
    };
    window.addEventListener("merter-wishlist-update", handleWishlistUpdate);
    return () => {
      window.removeEventListener("merter-wishlist-update", handleWishlistUpdate);
    };
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
              return data as Product;
            }
          } catch (e) {
            console.error(`Failed to fetch product ${id}:`, e);
          }
          return null;
        });

        const fetched = await Promise.all(promises);
        // Filter out nulls/failures
        setProducts(fetched.filter((p): p is Product => Boolean(p)));
      } catch (err) {
        console.error("Failed to load wishlist details:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchFavoriteProducts();
  }, [favoritesList]);

  // Remove a favorite product
  const handleRemoveFavorite = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = favoritesList.filter((id) => id !== productId);
    localStorage.setItem("merter_wishlist", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("merter-wishlist-update", { detail: updated }));
  };

  const uiTexts = pickLangText(lang, WISHLIST_UI_TEXTS);

  const handleProductClick = (slugOrId: string) => {
    onClose();
    router.push(buildLocalizedProductHref(slugOrId, lang));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      {/* Drawer overlay click catcher */}
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />

      {/* Sliding slide-over panel content */}
      <div className="bg-white border-l border-cultured w-full max-w-md h-full flex flex-col shadow-premium relative z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
        {/* Header */}
        <div className="p-4 border-b border-cultured flex items-center justify-between shrink-0">
          <h3 className="font-sans font-extrabold text-lg tracking-[0.5px] text-eerie-black flex items-center gap-2">
            <Heart className="w-5 h-5 text-salmon-pink fill-salmon-pink" />
            {uiTexts.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close_modal", lang)}
            className="w-8 h-8 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
          {loading && <WishlistLoading lang={lang} />}
          {!loading && products.length === 0 && (
            <WishlistEmpty lang={lang} onClose={onClose} />
          )}
          {!loading && products.length > 0 && (
            <div className="flex flex-col gap-3">
              {products.map((product) => (
                <WishlistItemCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  displayCurrency={displayCurrency}
                  exchangeRates={exchangeRates}
                  onProductClick={handleProductClick}
                  onRemoveFavorite={handleRemoveFavorite}
                  onClose={onClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
