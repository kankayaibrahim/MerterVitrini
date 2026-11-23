"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { Product, Category, CartItem, SupplierDirectOrderSummary } from "@/types/store";
import {
  t,
  getProductTitle,
  getProductDescription,
  getProductAttributes,
  getCategoryTitle,
  getCategoryTrail,
  getCategoryUrl,
  getCategoryPrefix,
} from "@/app/i18n";
import {
  getUnitsFromSeriesRatio,
  parseProductSeriesBreakdown,
  apiFetch,
  convertPrice,
  ExchangeRate,
  normalizeWhatsappDigits,
  showToast as triggerToast,
  trackWhatsappClick,
} from "@/app/utils";
import {
  useIsStoreMemberLoggedIn,
  openStoreAuthModal,
  syncShowPricesToGuestsSetting,
} from "@/app/storeAuth";
import { trackMemberEvent } from "@/components/analytics/AnalyticsTracker";
import { persistStoreCart, syncLocalCartStateIfChanged } from "@/utils/cartSync";
import { extractBrandFieldsFromProduct } from "@/utils/cartSupplierGroups";
import { submitStoreCartInquiry } from "@/utils/cartInquiry";
import {
  isProductWhatsappOnly,
  buildProductWhatsappOrderLink,
  formatDualProductSku,
} from "@/utils/whatsappOrdering";
import {
  normalizeSeoLang,
  stripBrandTitleSuffix,
  SupportedSeoLang,
} from "@/utils/seoHelpers";
import { getSupplierShowcaseHref } from "@/utils/subdomain";

import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import ConfirmModal from "@/components/store/ConfirmModal";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { SafeHtml, PRODUCT_DESCRIPTION_HTML_CLASS } from "@/components/common/SafeHtml";

import ProductImageGallery from "./components/ProductImageGallery";
import ProductSpecs from "./components/ProductSpecs";
import ColorVariants from "./components/ColorVariants";
import OrderCalculator from "./components/OrderCalculator";
import SupplierDirectCard from "./components/SupplierDirectCard";
import SocialShare from "./components/SocialShare";
import ProductInquiryCart from "./components/ProductInquiryCart";
import { DrawerOrderCreatedResult, InquiryFormData } from "@/components/store/CartDrawer";
import StoreChatDrawer from "@/components/store/StoreChatDrawer";
import { ChatOfferMetadata } from "@/types/chat";

interface ProductDetailClientProps {
  readonly product: Product | null;
  readonly initialLang?: string;
  readonly initialCategories?: Category[];
  readonly initialShowPricesToGuests?: boolean;
}

type PolicyType = "cancellation_and_return" | "terms_of_service" | "privacy_policy" | "";

const EXCLUDED_ATTR_NAMES = new Set([
  "cinsiyet",
  "kumaş",
  "kumaş tipi",
  "kumas tipi",
  "renk",
  "gender",
  "fabric",
  "fabric type",
  "color",
  "colour",
  "geschlecht",
  "stoff",
  "stoffart",
  "farbe",
  "genre",
  "sexe",
  "tissu",
  "type de tissu",
  "couleur",
  "пол",
  "ткань",
  "тип ткани",
  "цвет",
  "płeć",
  "plec",
  "tkanina",
  "rodzaj tkaniny",
  "kolor",
  "тъкан",
  "тип тъкан",
  "тип материя",
  "цвят",
  "الجنس",
  "القماش",
  "نوع القماش",
  "اللون",
]);

interface ProductClientLocaleCopy {
  readonly defaultColor: string;
  readonly defaultBrand: string;
  readonly offerAcceptedToast: string;
  readonly inquiryErrorToast: string;
  readonly waOrderHeader: string;
  readonly waOrderNo: string;
  readonly waContact: string;
  readonly waCompany: string;
  readonly waPhone: string;
  readonly waLines: string;
  readonly waPieces: string;
  readonly waTotal: string;
  readonly waNote: string;
  readonly b2bTitleSuffix: string;
}

const CLIENT_LOCALE_COPY: Record<SupportedSeoLang, ProductClientLocaleCopy> = {
  tr: {
    defaultColor: "Standart",
    defaultBrand: "Merter Üreticisi",
    offerAcceptedToast: "Özel fiyat teklifi kabul edildi ve indirimli fiyattan sepete eklendi!",
    inquiryErrorToast: "Talep gönderimi sırasında bir hata oluştu.",
    waOrderHeader: "*MERTER VİTRİNİ DOĞRUDAN SİPARİŞ TALEBİ*",
    waOrderNo: "Sipariş No",
    waContact: "Yetkili",
    waCompany: "Firma",
    waPhone: "Telefon",
    waLines: "Toplam Kalem",
    waPieces: "Toplam Adet",
    waTotal: "Toplam Tutar",
    waNote: "Not",
    b2bTitleSuffix: "Merter Vitrini Toptan B2B",
  },
  en: {
    defaultColor: "Standard",
    defaultBrand: "Merter Manufacturer",
    offerAcceptedToast: "Custom price offer accepted and added to your cart!",
    inquiryErrorToast: "An error occurred while submitting your inquiry.",
    waOrderHeader: "*MERTER VITRINI DIRECT WHOLESALE ORDER*",
    waOrderNo: "Order Ref",
    waContact: "Contact",
    waCompany: "Company",
    waPhone: "Phone",
    waLines: "Total Styles",
    waPieces: "Total Pieces",
    waTotal: "Estimated Total",
    waNote: "Note",
    b2bTitleSuffix: "Merter Vitrini Wholesale B2B",
  },
  ru: {
    defaultColor: "Стандарт",
    defaultBrand: "Фабрика Мертер",
    offerAcceptedToast: "Специальное предложение принято и добавлено в корзину!",
    inquiryErrorToast: "Произошла ошибка при отправке заявки.",
    waOrderHeader: "*ПРЯМОЙ ОПТОВЫЙ ЗАКАЗ MERTER VITRINI*",
    waOrderNo: "Номер заказа",
    waContact: "Контактное лицо",
    waCompany: "Компания",
    waPhone: "Телефон",
    waLines: "Позиций",
    waPieces: "Всего единиц",
    waTotal: "Сумма",
    waNote: "Примечание",
    b2bTitleSuffix: "Merter Vitrini Оптом B2B",
  },
  ar: {
    defaultColor: "قياسي",
    defaultBrand: "مصنع مارتر",
    offerAcceptedToast: "تم قبول عرض السعر الخاص وإضافته إلى السلة!",
    inquiryErrorToast: "حدث خطأ أثناء إرسال الطلب.",
    waOrderHeader: "*طلب جملة مباشر — MERTER VITRINI*",
    waOrderNo: "رقم الطلب",
    waContact: "المسؤول",
    waCompany: "الشركة",
    waPhone: "الهاتف",
    waLines: "عدد الموديلات",
    waPieces: "إجمالي القطع",
    waTotal: "الإجمالي",
    waNote: "ملاحظة",
    b2bTitleSuffix: "Merter Vitrini بالجملة B2B",
  },
  de: {
    defaultColor: "Standard",
    defaultBrand: "Merter Hersteller",
    offerAcceptedToast: "Sonderpreisangebot akzeptiert und in den Warenkorb gelegt!",
    inquiryErrorToast: "Beim Senden Ihrer Anfrage ist ein Fehler aufgetreten.",
    waOrderHeader: "*MERTER VITRINI DIREKTE GROSSHANDELSBESTELLUNG*",
    waOrderNo: "Bestell-Nr.",
    waContact: "Ansprechpartner",
    waCompany: "Firma",
    waPhone: "Telefon",
    waLines: "Positionen",
    waPieces: "Gesamtstückzahl",
    waTotal: "Gesamtbetrag",
    waNote: "Notiz",
    b2bTitleSuffix: "Merter Vitrini Großhandel B2B",
  },
  fr: {
    defaultColor: "Standard",
    defaultBrand: "Fabricant Merter",
    offerAcceptedToast: "Offre tarifaire acceptée et ajoutée au panier !",
    inquiryErrorToast: "Une erreur est survenue lors de l'envoi de la demande.",
    waOrderHeader: "*COMMANDE EN GROS DIRECTE MERTER VITRINI*",
    waOrderNo: "Réf. Commande",
    waContact: "Contact",
    waCompany: "Société",
    waPhone: "Téléphone",
    waLines: "Articles",
    waPieces: "Total Pièces",
    waTotal: "Montant Total",
    waNote: "Note",
    b2bTitleSuffix: "Merter Vitrini Grossiste B2B",
  },
  pl: {
    defaultColor: "Standardowy",
    defaultBrand: "Producent Merter",
    offerAcceptedToast: "Oferta specjalna zaakceptowana i dodana do koszyka!",
    inquiryErrorToast: "Wystąpił błąd podczas wysyłania zapytania.",
    waOrderHeader: "*BEZPOŚREDNIE ZAMÓWIENIE HURTOWE MERTER VITRINI*",
    waOrderNo: "Nr zamówienia",
    waContact: "Osoba kontaktowa",
    waCompany: "Firma",
    waPhone: "Telefon",
    waLines: "Pozycje",
    waPieces: "Łącznie sztuk",
    waTotal: "Suma",
    waNote: "Uwagi",
    b2bTitleSuffix: "Merter Vitrini Hurt B2B",
  },
  bg: {
    defaultColor: "Стандартен",
    defaultBrand: "Производител Мертер",
    offerAcceptedToast: "Специалната оферта е приета и добавена в количката!",
    inquiryErrorToast: "Възникна грешка при изпращане на запитването.",
    waOrderHeader: "*ДИРЕКТНА ПОРЪЧКА НА ЕДРО MERTER VITRINI*",
    waOrderNo: "Поръчка №",
    waContact: "Лице за контакт",
    waCompany: "Фирма",
    waPhone: "Телефон",
    waLines: "Артикули",
    waPieces: "Общо бройки",
    waTotal: "Обща сума",
    waNote: "Бележка",
    b2bTitleSuffix: "Merter Vitrini На Едро B2B",
  },
};

function resolveActiveProduct(
  isAuthenticated: boolean,
  hydratedAuthProduct: Product | null,
  product: Product | null
): Product | null {
  const hydratedId = hydratedAuthProduct?.id;
  const productId = product?.id;
  if (isAuthenticated && hydratedId && hydratedId === productId) {
    return hydratedAuthProduct;
  }
  return product;
}

function needsAuthenticatedPriceFetch({
  isAuthenticated,
  product,
  isWhatsappOnly,
  hydratedAuthProductId,
  authFetchAttemptedForId,
}: Readonly<{
  isAuthenticated: boolean;
  product: Product | null;
  isWhatsappOnly: boolean;
  hydratedAuthProductId?: string;
  authFetchAttemptedForId: string | null;
}>): boolean {
  if (!isAuthenticated || !product || isWhatsappOnly) {
    return false;
  }
  return (
    Number(product.price || 0) <= 0 &&
    hydratedAuthProductId !== product.id &&
    authFetchAttemptedForId !== product.id
  );
}

function resolveDirectWhatsAppUrl(
  waOrderLinkUrl: string | undefined,
  supplierWaDigits: string,
  message: string
): string {
  if (waOrderLinkUrl) {
    return waOrderLinkUrl;
  }
  if (!supplierWaDigits) {
    return "";
  }
  return `https://wa.me/${supplierWaDigits}?text=${encodeURIComponent(message)}`;
}

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.codePointAt(end - 1) === 47) {
    end -= 1;
  }
  return url.slice(0, end);
}

export default function ProductDetailClient({
  product,
  initialLang = "tr",
  initialCategories = [],
  initialShowPricesToGuests,
}: Readonly<ProductDetailClientProps>) {
  const isAuthenticated = useIsStoreMemberLoggedIn();
  const [lang, setLang] = useState<string>(() => normalizeSeoLang(initialLang, "tr"));
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = CLIENT_LOCALE_COPY[safeLang];

  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [activePolicy, setActivePolicy] = useState<PolicyType>("");
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  const [selectedColor] = useState<string>(() => product?.color || copy.defaultColor);
  const [pkgQty, setPkgQty] = useState<number>(() => {
    if (!product) return 1;
    const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    return Math.max(minPkgs, 1);
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [lastOrderResult, setLastOrderResult] = useState<{
    readonly orderNumber: string;
    readonly supplierOrders: SupplierDirectOrderSummary[];
    readonly isFormalOrder: boolean;
  }>({ orderNumber: "", supplierOrders: [], isFormalOrder: false });
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
  const [pendingRemove, setPendingRemove] = useState<{
    index: number;
    change: number;
  } | null>(null);
  const [hydratedAuthProduct, setHydratedAuthProduct] = useState<Product | null>(null);
  const [authFetchAttemptedForId, setAuthFetchAttemptedForId] = useState<string | null>(null);

  const activeProduct = resolveActiveProduct(isAuthenticated, hydratedAuthProduct, product);

  const isWhatsappOnly = isProductWhatsappOnly(activeProduct);
  const isPriceLoading = needsAuthenticatedPriceFetch({
    isAuthenticated,
    product,
    isWhatsappOnly,
    hydratedAuthProductId: hydratedAuthProduct?.id,
    authFetchAttemptedForId,
  });

  useEffect(() => {
    if (!isAuthenticated || !product || isProductWhatsappOnly(product) || Number(product.price) > 0) {
      return;
    }
    if (hydratedAuthProduct?.id === product.id) {
      return;
    }
    const targetId = product.id;
    const slugOrId = product.slug || product.id;
    let cancelled = false;

    async function loadAuthenticatedProduct() {
      const fresh = await apiFetch<Product>(
        `/products/${encodeURIComponent(slugOrId)}`,
        { cache: "no-store" }
      );
      if (cancelled) return;
      if (fresh?.id) {
        setHydratedAuthProduct(fresh);
      }
      setAuthFetchAttemptedForId(targetId);
    }

    void loadAuthenticatedProduct();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, product, hydratedAuthProduct?.id]);

  useEffect(() => {
    if (typeof initialShowPricesToGuests === "boolean") {
      syncShowPricesToGuestsSetting(initialShowPricesToGuests);
    }

    async function hydrateClientStorage() {
      await Promise.resolve();
      const savedCurr = localStorage.getItem("merter_preferred_currency");
      if (savedCurr) {
        setDisplayCurrency(savedCurr);
      }
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart) as CartItem[]);
        } catch {
          // Ignore malformed cart JSON
        }
      }
    }

    void hydrateClientStorage();
  }, [initialShowPricesToGuests]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", safeLang);
    document.documentElement.setAttribute("dir", safeLang === "ar" ? "rtl" : "ltr");
  }, [safeLang]);

  useEffect(() => {
    const handleCartSync = () => {
      setCart((prev) => syncLocalCartStateIfChanged(prev));
    };
    window.addEventListener("merter-cart-update", handleCartSync);
    window.addEventListener("storage", handleCartSync);
    return () => {
      window.removeEventListener("merter-cart-update", handleCartSync);
      window.removeEventListener("storage", handleCartSync);
    };
  }, []);

  useEffect(() => {
    if (product) {
      const localizedTitle = getProductTitle(product, safeLang);
      const brandName = product.brand_name || copy.defaultBrand;
      const baseTitle = stripBrandTitleSuffix(`${localizedTitle} - ${brandName}`);
      document.title = `${baseTitle} | Merter Vitrini B2B`;
    }
  }, [safeLang, product, copy.defaultBrand]);

  useEffect(() => {
    const loadCategoriesIfEmpty = async () => {
      if (initialCategories.length > 0) return;
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };

    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };

    void loadRates();
    void loadCategoriesIfEmpty();
  }, [initialCategories.length]);

  const portalHref = `/${getCategoryPrefix(safeLang)}`;

  if (!activeProduct) {
    const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

    return (
      <div
        className="min-h-screen flex flex-col font-sans antialiased bg-[#fcfcfc] text-[#1c191f]"
        style={{ direction: safeLang === "ar" ? "rtl" : "ltr" }}
      >
        <Header
          lang={safeLang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => { }}
          setCurrentPage={() => { }}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={handleCurrencyChange}
        />
        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none py-24">
          <span className="text-5xl mb-4">🔍</span>
          <h1 className="text-2xl font-extrabold text-[#1c191f] mb-3">
            {t("product_not_found", safeLang)}
          </h1>
          <p className="text-sm font-semibold text-[#71717a] mb-8 max-w-md mx-auto leading-relaxed">
            {t("product_not_found_desc", safeLang)}
          </p>
          <Link
            href={portalHref}
            className="px-8 py-3 bg-[#1C1C1C] text-white rounded-md font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-[#333333] transition-colors cursor-pointer no-underline"
          >
            {t("back_to_homepage", safeLang)}
          </Link>
        </main>
        <Footer lang={safeLang} onOpenPolicy={(p) => setActivePolicy(p)} />
        <PolicyViewerModal
          isOpen={activePolicy !== ""}
          onClose={() => setActivePolicy("")}
          policyType={activePolicy}
          lang={safeLang}
        />
      </div>
    );
  }

  const title = getProductTitle(activeProduct, safeLang);
  const desc = getProductDescription(activeProduct, safeLang);
  const dynamicAttrs = getProductAttributes(activeProduct, safeLang).filter(
    (attr) => !EXCLUDED_ATTR_NAMES.has(attr.name.toLowerCase().trim())
  );

  const unitsPerPkg = getUnitsFromSeriesRatio(activeProduct.series_ratio);
  const hasSeries = Boolean(activeProduct.series_ratio && unitsPerPkg > 1);

  const { sizes, ratios } = parseProductSeriesBreakdown(
    activeProduct.packing_ratio,
    activeProduct.series_ratio,
    activeProduct.variants?.map((v) => v.size)
  );

  const minPkgs = Math.ceil((activeProduct.minimum_order_quantity || 1) / unitsPerPkg);
  const actualMinPkgs = Math.max(minPkgs, 1);

  const rawPrice = Number(activeProduct.price) || 0;
  const rawDiscountedPrice = Number(activeProduct.discounted_price) || 0;
  const unitPrice = convertPrice(
    rawPrice,
    activeProduct.currency || "USD",
    displayCurrency,
    exchangeRates
  );
  const hasDiscount = rawDiscountedPrice > 0 && rawDiscountedPrice < rawPrice;
  const discountedPrice = hasDiscount
    ? convertPrice(
      rawDiscountedPrice,
      activeProduct.currency || "USD",
      displayCurrency,
      exchangeRates
    )
    : unitPrice;

  const totalPieces = pkgQty * unitsPerPkg;
  const singleItemWeight = Number(activeProduct.shipping_weight_kg) || 0.25;
  const totalWeight = Number((totalPieces * singleItemWeight).toFixed(2));
  const finalPricePerUnit = hasDiscount ? discountedPrice : unitPrice;
  const totalPrice = finalPricePerUnit * totalPieces;
  const currency = displayCurrency;

  const handleAdjustPkgQty = (change: number) => {
    setPkgQty((prev) => Math.max(actualMinPkgs, prev + change));
  };

  const handleAddToCart = () => {
    if (isWhatsappOnly) {
      return;
    }
    if (!isAuthenticated) {
      openStoreAuthModal("login");
      return;
    }
    if (isPriceLoading) {
      return;
    }
    if (pkgQty < actualMinPkgs) {
      triggerToast(
        `${t("min_order_warning", safeLang)}: ${activeProduct.minimum_order_quantity} ${t("piece", safeLang)} (${actualMinPkgs} ${t("package", safeLang)})`
      );
      return;
    }

    const coverImg =
      activeProduct.images?.find((img) => img.is_cover)?.image_url ||
      activeProduct.images?.[0]?.image_url ||
      "/placeholder.png";

    const newItem: CartItem = {
      product_id: activeProduct.id,
      title,
      custom_sku: activeProduct.custom_sku || activeProduct.source_product_id || "",
      color: selectedColor,
      packages_qty: pkgQty,
      units_per_package: unitsPerPkg,
      price_per_unit: finalPricePerUnit,
      weight_per_unit: singleItemWeight,
      image_url: coverImg,
      currency,
      slug: activeProduct.slug,
      ...extractBrandFieldsFromProduct(activeProduct),
    };

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.product_id === newItem.product_id && item.color === newItem.color
      );
      let updated: CartItem[];
      if (existingIdx >= 0) {
        updated = [...prev];
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          packages_qty: existing.packages_qty + newItem.packages_qty,
        };
      } else {
        updated = [...prev, newItem];
      }

      persistStoreCart(updated);
      return updated;
    });

    trackMemberEvent({
      event_type: "cart_add",
      event_category: "commerce",
      title: `${title} (${pkgQty} pack)`,
      subtitle: `SKU: ${newItem.custom_sku || "-"} • ${pkgQty * unitsPerPkg} pcs`,
      entity_type: "product",
      entity_id: activeProduct.id,
      image_url: coverImg,
    });

    setIsCartOpen(true);
    triggerToast(t("product_added_to_cart", safeLang));
  };

  const handleAcceptOfferToCart = (offer: ChatOfferMetadata) => {
    const offeredUnitConv = convertPrice(
      offer.offered_unit_price || rawPrice,
      offer.currency || activeProduct.currency || "TRY",
      displayCurrency,
      exchangeRates
    );

    const newItem: CartItem = {
      product_id: offer.product_id || activeProduct.id,
      title: offer.title || title,
      custom_sku: offer.custom_sku || activeProduct.custom_sku || "",
      color: offer.color || selectedColor,
      packages_qty: offer.packages_qty || 1,
      units_per_package: offer.units_per_package || unitsPerPkg,
      price_per_unit: offeredUnitConv,
      weight_per_unit: offer.weight_per_unit || singleItemWeight,
      image_url:
        offer.image_url || activeProduct.images?.[0]?.image_url || "/placeholder.png",
      currency: displayCurrency,
      slug: offer.slug || activeProduct.slug,
      ...extractBrandFieldsFromProduct(activeProduct),
    };

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.product_id === newItem.product_id && item.color === newItem.color
      );
      let updated: CartItem[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          packages_qty: newItem.packages_qty,
          price_per_unit: newItem.price_per_unit,
        };
      } else {
        updated = [...prev, newItem];
      }

      persistStoreCart(updated);
      return updated;
    });

    setIsChatOpen(false);
    setIsCartOpen(true);
    triggerToast(`🎁 ${copy.offerAcceptedToast}`);
  };

  const applyCartItemQtyChange = (idx: number, change: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      if (!item) return prev;

      const nextPkgs = item.packages_qty + change;
      if (nextPkgs <= 0) {
        updated.splice(idx, 1);
      } else {
        updated[idx] = { ...item, packages_qty: nextPkgs };
      }

      persistStoreCart(updated);
      return updated;
    });
  };

  const handleAdjustCartItemQty = (idx: number, change: number) => {
    const item = cart[idx];
    if (!item) return;

    if (change < 0 && item.packages_qty <= 1) {
      setPendingRemove({ index: idx, change });
      return;
    }

    applyCartItemQtyChange(idx, change);
  };

  const confirmRemove = () => {
    if (pendingRemove) {
      applyCartItemQtyChange(pendingRemove.index, pendingRemove.change);
      setPendingRemove(null);
    }
  };

  const handleRemoveCartItem = (idx: number) => {
    setCart((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      persistStoreCart(updated);
      return updated;
    });
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce(
    (sum, item) => sum + item.packages_qty * item.units_per_package,
    0
  );
  const totalWeightCart = Number(
    cart
      .reduce(
        (sum, item) =>
          sum + item.packages_qty * item.units_per_package * item.weight_per_unit,
        0
      )
      .toFixed(2)
  );
  const totalPriceCart = Number(
    cart
      .reduce(
        (sum, item) =>
          sum + item.packages_qty * item.units_per_package * item.price_per_unit,
        0
      )
      .toFixed(2)
  );

  const handleSubmitInquiry = async (formData: InquiryFormData) => {
    if (cart.length === 0) return;

    setSubmittingInquiry(true);
    try {
      const result = await submitStoreCartInquiry({
        cart,
        fullName: formData.fullName,
        companyName: formData.companyName,
        phoneNumber: formData.phoneNumber,
        emailAddress: formData.emailAddress,
        customerMessage: formData.customerMessage,
        displayCurrency,
        lang: safeLang,
        location: {
          countryId: formData.countryId,
          stateId: formData.stateId,
          cityId: formData.cityId,
          postalCode: formData.postalCode,
          addressLine: formData.addressLine,
        },
        locationMeta: formData.locationMeta,
      });

      setWhatsappUrl(result.whatsapp_url || "#");
      setLastOrderResult({
        orderNumber: result.order_number || "",
        supplierOrders: result.supplier_orders || [],
        isFormalOrder: false,
      });
      setCart([]);
      persistStoreCart([], { immediate: true });
      setIsCartOpen(false);
      setShowSuccessOverlay(true);
    } catch (err: unknown) {
      triggerToast((err as Error).message || copy.inquiryErrorToast);
      throw err;
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const handleOrderCreatedFromDrawer = (created: DrawerOrderCreatedResult) => {
    setCart([]);
    persistStoreCart([], { immediate: true });
    setIsCartOpen(false);
    setWhatsappUrl(created.supplierOrders[0]?.whatsapp_url || "#");
    setLastOrderResult({
      orderNumber: created.orderNumber || "",
      supplierOrders: created.supplierOrders || [],
      isFormalOrder: true,
    });
    setShowSuccessOverlay(true);
  };

  const supplierHref = getSupplierShowcaseHref(
    activeProduct.brand_profile || {
      id: activeProduct.brand_id,
      slug: activeProduct.brand_id,
    },
    safeLang
  );
  const isExternalSupplierHref = supplierHref.startsWith("http");

  const supplierWaRaw =
    activeProduct.brand_profile?.whatsapp_phone ||
    activeProduct.brand_profile?.phone ||
    "";
  const supplierWaDigits = normalizeWhatsappDigits(supplierWaRaw);
  const calcWaSupplierName =
    activeProduct.brand_profile?.name || activeProduct.brand_name || copy.defaultBrand;
  const calcWaDisplaySku = formatDualProductSku(activeProduct.custom_sku, activeProduct.sku);
  const calcWaMessage = `${calcWaSupplierName} — *${title}* (SKU: ${calcWaDisplaySku}) • ${pkgQty} ${t("package", safeLang)} (${totalPieces} ${t("piece", safeLang)})`;
  const waOrderLink = isWhatsappOnly
    ? buildProductWhatsappOrderLink({
      product: activeProduct,
      lang: safeLang,
      title,
      color: selectedColor,
      pkgQty,
      totalPieces,
      fallbackPhone: supplierWaRaw,
    })
    : null;
  const calcWaUrl = resolveDirectWhatsAppUrl(
    waOrderLink?.url,
    supplierWaDigits,
    calcWaMessage
  );

  return (
    <div
      className="min-h-screen flex flex-col font-sans antialiased bg-bg-dark text-text-primary"
      style={{ direction: safeLang === "ar" ? "rtl" : "ltr" }}
    >
      <Header
        lang={safeLang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={() => { }}
        setCurrentPage={() => { }}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-sonic-silver mb-6 uppercase tracking-wider select-none"
        >
          <Link
            href={portalHref}
            className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", safeLang)}</span>
          </Link>
          {activeProduct.category_id &&
            getCategoryTrail(categories, activeProduct.category_id)?.map((cat) => (
              <React.Fragment key={cat.id}>
                <ChevronRight className="w-3 h-3 text-spanish-gray rtl:rotate-180" />
                <Link
                  href={stripTrailingSlashes(getCategoryUrl(categories, cat, safeLang))}
                  className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver font-bold"
                >
                  {getCategoryTitle(cat, safeLang)}
                </Link>
              </React.Fragment>
            ))}
          {activeProduct.brand_name && (
            <>
              <ChevronRight className="w-3 h-3 text-spanish-gray rtl:rotate-180" />
              {isExternalSupplierHref ? (
                <a
                  href={supplierHref}
                  className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver font-bold"
                >
                  {activeProduct.brand_name}
                </a>
              ) : (
                <Link
                  href={supplierHref}
                  className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver font-bold"
                >
                  {activeProduct.brand_name}
                </Link>
              )}
            </>
          )}
          <ChevronRight className="w-3 h-3 text-spanish-gray rtl:rotate-180" />
          <span className="text-salmon-pink font-extrabold truncate max-w-[240px]">
            {title}
          </span>
        </nav>

        <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 md:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="md:sticky md:top-24 lg:top-28 self-start">
              <ProductImageGallery
                images={activeProduct.images}
                title={title}
                lang={safeLang}
                t={t}
              />
            </div>

            <div className="flex flex-col gap-6">
              <ProductSpecs
                product={activeProduct}
                title={title}
                lang={safeLang}
                t={t}
                hasDiscount={hasDiscount}
                unitPrice={unitPrice}
                discountedPrice={discountedPrice}
                currency={currency}
                dynamicAttrs={dynamicAttrs}
                mode="header"
                isPriceLoading={isPriceLoading}
              />

              <ColorVariants product={activeProduct} lang={safeLang} t={t} />

              <OrderCalculator
                hasSeries={hasSeries}
                unitsPerPkg={unitsPerPkg}
                sizes={sizes}
                ratios={ratios}
                pkgQty={pkgQty}
                handleAdjustPkgQty={handleAdjustPkgQty}
                totalPieces={totalPieces}
                totalWeight={totalWeight}
                totalPrice={totalPrice}
                currency={currency}
                lang={safeLang}
                t={t}
                handleAddToCart={handleAddToCart}
                isPriceLoading={isPriceLoading}
                isWhatsappOnly={isWhatsappOnly}
                supplierWhatsappUrl={calcWaUrl}
                supplierWhatsappPhone={supplierWaRaw}
                onSupplierWhatsappClick={() =>
                  trackWhatsappClick({
                    brandId: activeProduct.brand_id,
                    productId: activeProduct.id,
                    sourceSurface: "product_calculator",
                    targetPhone: supplierWaRaw,
                  })
                }
                onOpenSupplierChat={() => {
                  if (!isAuthenticated) {
                    openStoreAuthModal("login");
                    return;
                  }
                  setIsChatOpen(true);
                }}
              />

              <ProductSpecs
                product={activeProduct}
                title={title}
                lang={safeLang}
                t={t}
                hasDiscount={hasDiscount}
                unitPrice={unitPrice}
                discountedPrice={discountedPrice}
                currency={currency}
                dynamicAttrs={dynamicAttrs}
                mode="specs"
              />

              <SupplierDirectCard
                product={activeProduct}
                pkgQty={pkgQty}
                totalPieces={totalPieces}
                totalPrice={totalPrice}
                currency={currency}
                lang={safeLang}
                onOpenChat={() => {
                  if (!isAuthenticated) {
                    openStoreAuthModal("login");
                    return;
                  }
                  setIsChatOpen(true);
                }}
              />

              <SocialShare
                title={title}
                lang={safeLang}
                t={t}
                productSlug={activeProduct.slug || activeProduct.id}
              />
            </div>
          </div>

          {desc.trim().length > 0 && (
            <div className="border-t border-cultured pt-6 mt-8">
              <h2 className="font-sans font-extrabold text-sm tracking-[0.5px] mb-3 uppercase text-eerie-black select-none">
                {t("description_label", safeLang)}
              </h2>
              <SafeHtml
                html={desc}
                className={`text-[13px] md:text-sm ${PRODUCT_DESCRIPTION_HTML_CLASS}`}
              />
            </div>
          )}
        </div>
      </main>

      <Footer lang={safeLang} onOpenPolicy={(p) => setActivePolicy(p)} />

      <PolicyViewerModal
        isOpen={activePolicy !== ""}
        onClose={() => setActivePolicy("")}
        policyType={activePolicy}
        lang={safeLang}
      />

      <ProductInquiryCart
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        cart={cart}
        lang={safeLang}
        totalPkgs={totalPkgs}
        totalItemsCount={totalItemsCount}
        totalWeightCart={totalWeightCart}
        totalPriceCart={totalPriceCart}
        submittingInquiry={submittingInquiry}
        handleSubmitInquiry={handleSubmitInquiry}
        handleAdjustCartItemQty={handleAdjustCartItemQty}
        handleRemoveCartItem={handleRemoveCartItem}
        onOrderCreated={handleOrderCreatedFromDrawer}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        showSuccessOverlay={showSuccessOverlay}
        setShowSuccessOverlay={setShowSuccessOverlay}
        whatsappUrl={whatsappUrl}
        orderNumber={lastOrderResult.orderNumber}
        supplierOrders={lastOrderResult.supplierOrders}
        isFormalOrder={lastOrderResult.isFormalOrder}
        onViewOrders={() => {
          window.location.href = `/profile?tab=orders&lang=${encodeURIComponent(safeLang)}`;
        }}
        onWhatsappClick={() =>
          trackWhatsappClick({
            brandId: activeProduct.brand_id,
            productId: activeProduct.id,
            sourceSurface: "inquiry_success_modal",
            targetPhone: supplierWaRaw,
          })
        }
      />

      {pendingRemove !== null && (
        <ConfirmModal
          lang={safeLang}
          message={t("remove_from_cart_confirm", safeLang)}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      <StoreChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialBrandId={activeProduct.brand_id}
        initialProductId={activeProduct.id}
        supplierDisplayName={activeProduct.brand_name || copy.defaultBrand}
        lang={safeLang}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        onAcceptOfferToCart={handleAcceptOfferToCart}
      />
    </div>
  );
}
