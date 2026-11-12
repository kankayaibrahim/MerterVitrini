"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { Product, Brand, Category, CartItem } from "@/types/store";
import { t, getProductTitle, getCategoryPrefix } from "@/app/i18n";
import { getUnitsFromSeriesRatio, apiFetch, showToast, ExchangeRate } from "@/app/utils";
import { syncShowPricesToGuestsSetting } from "@/app/storeAuth";

// Import modular, premium Tailwind E-Commerce subcomponents
import Header from "@/components/store/Header";
import FilterSidebar, { B2BSourcingFilters } from "@/components/store/FilterSidebar";
import ProductDetailsModal from "@/components/store/ProductDetailsModal";
import CartDrawer, { InquiryFormData } from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import ConfirmModal from "@/components/store/ConfirmModal";

// Modular layout view subcomponents
import QueryParamSyncer from "@/components/store/QueryParamSyncer";
import PortalView from "@/components/store/PortalView";
import CatalogView from "@/components/store/CatalogView";

interface StorefrontLayoutProps {
  readonly mode: "portal" | "catalog";
  readonly initialCategorySlug?: string;
  readonly preFetchedCategories?: Category[];
  readonly defaultLang?: string;
  readonly initialProducts?: Product[];
  readonly initialTotalProducts?: number;
  readonly initialPortalProducts?: Product[];
  readonly categoryFaqs?: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}

interface ToastMessage {
  id: string;
  message: string;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  facets?: {
    brands?: Record<string, number>;
    genders?: Record<string, number>;
    seasons?: Record<string, number>;
    attributes?: Record<string, Record<string, number>>;
  };
}

const ADDED_TO_CART_TRANSLATIONS: Record<string, string> = {
  tr: "Sepete başarıyla eklendi!",
  en: "Successfully added to cart!",
  ar: "تمت إضافة المنتج إلى السلة بنجاح!",
  ru: "Успешно добавлено в корзину!",
  pl: "Pomyślnie dodano do koszyka!",
  bg: "Успешно добавено в количката!",
  de: "Erfolgreich in den Warenkorb gelegt!",
  fr: "Ajouté au panier avec succès!",
};

function removeToastById(toasts: ToastMessage[], id: string): ToastMessage[] {
  return toasts.filter((t) => t.id !== id);
}

interface CatalogQueryParams {
  itemsPerPage: number;
  currentPage: number;
  sortBy: string;
  displayCurrency: string;
  activeCategoryId: string;
  activeBrandIds: string[];
  activeSpecs: { gender: string[]; season: string[] };
  b2bFilters: B2BSourcingFilters;
  searchQuery: string;
  minPrice: string;
  maxPrice: string;
  activeAttributes: Record<string, string[]>;
}

function appendB2bQueryParams(b2b: B2BSourcingFilters): string {
  let fragment = "";
  if (b2b.fason) fragment += "&fason=true";
  if (b2b.privateLabel) fragment += "&private_label=true";
  if (b2b.companyType) fragment += `&company_type=${encodeURIComponent(b2b.companyType)}`;
  if (b2b.maxMoq) fragment += `&max_moq=${encodeURIComponent(b2b.maxMoq)}`;
  if (b2b.exportCountry) fragment += `&export_country=${encodeURIComponent(b2b.exportCountry)}`;
  return fragment;
}

function countActiveB2bFilters(b2b: B2BSourcingFilters): number {
  let count = 0;
  if (b2b.fason) count += 1;
  if (b2b.privateLabel) count += 1;
  if (b2b.companyType !== "") count += 1;
  if (b2b.maxMoq !== "") count += 1;
  if (b2b.exportCountry !== "") count += 1;
  return count;
}

function buildCatalogQueryParams(params: CatalogQueryParams): string {
  const offset = (params.currentPage - 1) * params.itemsPerPage;
  let queryParams = `?limit=${params.itemsPerPage}&offset=${offset}&sort_by=${params.sortBy}&display_currency=${params.displayCurrency}`;

  if (params.activeCategoryId && params.activeCategoryId !== "tum-urunler") {
    queryParams += `&category_id=${params.activeCategoryId}`;
  }

  if (params.activeBrandIds.length > 0) {
    queryParams += `&brand_id=${encodeURIComponent(params.activeBrandIds.join(","))}`;
  }

  if (params.activeSpecs.gender.length > 0) {
    queryParams += `&gender=${encodeURIComponent(params.activeSpecs.gender.join(","))}`;
  }

  if (params.activeSpecs.season.length > 0) {
    queryParams += `&season=${encodeURIComponent(params.activeSpecs.season.join(","))}`;
  }

  queryParams += appendB2bQueryParams(params.b2bFilters);

  if (params.searchQuery) {
    queryParams += `&q=${encodeURIComponent(params.searchQuery)}`;
  }

  if (params.minPrice) {
    queryParams += `&min_price=${encodeURIComponent(params.minPrice)}`;
  }
  if (params.maxPrice) {
    queryParams += `&max_price=${encodeURIComponent(params.maxPrice)}`;
  }

  for (const [name, values] of Object.entries(params.activeAttributes)) {
    if (values.length > 0) {
      queryParams += `&attr_${name}=${encodeURIComponent(values.join(","))}`;
    }
  }

  return queryParams;
}

interface StoreSettings {
  show_single_price?: boolean;
  show_prices_to_guests?: boolean;
  [key: string]: unknown;
}

function getInitialLang(defaultLang?: string): string {
  if (typeof window !== "undefined") {
    const savedLang = localStorage.getItem("preferred_lang");
    if (savedLang) {
      const path = window.location.pathname;
      if (path === "/" || path === "") {
        return savedLang;
      }
      const currentPrefix = path.split("/")[1];
      const savedLangPrefix = getCategoryPrefix(savedLang);
      if (currentPrefix === savedLangPrefix) {
        return savedLang;
      }
    }
  }
  return defaultLang || "tr";
}

export default function StorefrontLayout({
  mode,
  initialCategorySlug,
  preFetchedCategories,
  defaultLang,
  initialProducts,
  initialTotalProducts,
  initialPortalProducts,
  categoryFaqs,
}: Readonly<StorefrontLayoutProps>) {
  // --- UI States ---
  const [lang, setLang] = useState<string>(() => getInitialLang(defaultLang));
  const [prevDefaultLang, setPrevDefaultLang] = useState(defaultLang);
  if (defaultLang !== prevDefaultLang) {
    setPrevDefaultLang(defaultLang);
    if (defaultLang) {
      setLang(defaultLang);
    }
  }

  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [pendingRemove, setPendingRemove] = useState<{ index: number; change: number } | null>(null);

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("merter_preferred_currency") || "TRY";
    }
    return "TRY";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // --- Filter & Catalog States ---
  const [categories, setCategories] = useState<Category[]>(preFetchedCategories || []);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributes, setAttributes] = useState<Record<string, string[]>>({});
  const [activeAttributes, setActiveAttributes] = useState<Record<string, string[]>>({});
  const [facets, setFacets] = useState<ProductsResponse["facets"] | null>(null);
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [portalNewArrivals, setPortalNewArrivals] = useState<Product[]>(initialPortalProducts || []);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategorySlug || "");
  const [prevInitialCategorySlug, setPrevInitialCategorySlug] = useState(initialCategorySlug);

  if (initialCategorySlug !== prevInitialCategorySlug) {
    setPrevInitialCategorySlug(initialCategorySlug);
    setActiveCategoryId(initialCategorySlug || "");
  }
  
  const [activeBrandIds, setActiveBrandIds] = useState<string[]>([]);
  const [activeSpecs, setActiveSpecs] = useState<{ gender: string[]; season: string[] }>({
    gender: [],
    season: [],
  });
  const [b2bFilters, setB2bFilters] = useState<B2BSourcingFilters>({
    fason: false,
    privateLabel: false,
    companyType: "",
    maxMoq: "",
    exportCountry: "",
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 24;
  const [totalProductsCount, setTotalProductsCount] = useState<number>(
    initialTotalProducts ?? (initialProducts?.length || 0)
  );
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  const hasInitialSsrProducts =
    mode === "portal"
      ? Boolean(initialPortalProducts && initialPortalProducts.length > 0)
      : Boolean(initialProducts && initialProducts.length > 0);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(!hasInitialSsrProducts);
  const initialMountRef = useRef<boolean>(true);
  
  // --- B2B Details Modal States ---
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pkgQty, setPkgQty] = useState<number>(1);
  const [modalMainImg, setModalMainImg] = useState<string>("");
  
  // --- Cart Persistent State ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          return JSON.parse(savedCart) as CartItem[];
        } catch (err) {
          console.error("Failed to parse cart storage", err);
        }
      }
    }
    return [];
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [centerFlash, setCenterFlash] = useState<{
    show: boolean;
    productTitle: string;
    quantity: number;
    unitsPerPkg: number;
    addedText: string;
  } | null>(null);

  
  // --- Quote Inquiry Submission States ---
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const data = await apiFetch<StoreSettings>("/settings");
      if (data) {
        setStoreSettings(data);
        syncShowPricesToGuestsSetting(Boolean(data.show_prices_to_guests));
      }
    }
    void loadSettings();
  }, []);

  // --- Dynamic HTML lang attribute sync and preferred language synchronization ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // --- Initial Mount Loaders ---
  useEffect(() => {
    const loadCategories = async () => {
      if (preFetchedCategories && preFetchedCategories.length > 0) return;
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };
    
    const loadBrands = async () => {
      const data = await apiFetch<Brand[]>("/brands");
      if (data) setBrands(data);
    };

    const loadAttributes = async () => {
      const data = await apiFetch<Record<string, string[]>>("/attributes");
      if (data) setAttributes(data);
    };

    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    void loadRates();
    
    void loadCategories();
    void loadBrands();
    void loadAttributes();
  }, [preFetchedCategories]);

  useEffect(() => {
    const handleCartUpdate = () => {
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch {
          setCart([]);
        }
      } else {
        setCart([]);
      }
    };
    window.addEventListener("merter-cart-update", handleCartUpdate);
    return () => window.removeEventListener("merter-cart-update", handleCartUpdate);
  }, []);

  // --- Direct Add to Cart Listener ---
  useEffect(() => {
    const handleDirectAddToCart = (e: Event) => {
      const customEvent = e as CustomEvent<{
        product: Product;
        quantity: number;
      }>;
      if (!customEvent.detail?.product) return;
      const { product, quantity } = customEvent.detail;
      
      const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
      const weightPerUnit = product.shipping_weight_kg || 0.35;
      const hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;
      const unitPrice = hasDiscount ? product.discounted_price : product.price;
      const sku = product.custom_sku || product.source_product_id || "";
      
      let coverImg = "/placeholder.png";
      if (product.images && product.images.length > 0) {
        const coverObj = product.images.find(img => img.is_cover) || product.images[0];
        coverImg = coverObj.image_url;
      }
      
      setCart((prevCart) => {
        const updatedCart = [...prevCart];
        const duplicateIdx = updatedCart.findIndex(
          item => item.product_id === product.id && item.units_per_package > 1
        );
        
        if (duplicateIdx > -1) {
          const item = updatedCart[duplicateIdx];
          if (item) {
            item.packages_qty += quantity;
          }
        } else {
          updatedCart.push({
            product_id: product.id,
            title: getProductTitle(product, lang),
            custom_sku: sku,
            color: product.color || "Standart",
            packages_qty: quantity,
            units_per_package: unitsPerPkg,
            price_per_unit: unitPrice,
            weight_per_unit: weightPerUnit,
            image_url: coverImg,
            currency: product.currency || "TRY",
            title_translations: {
              tr: product.title || "",
              en: product.translations?.en?.title || product.title || "",
              pl: product.translations?.pl?.title || product.title || "",
              ar: product.translations?.ar?.title || product.title || "",
              ru: product.translations?.ru?.title || product.title || "",
              de: product.translations?.de?.title || product.title || "",
              bg: product.translations?.bg?.title || product.title || "",
              fr: product.translations?.fr?.title || product.title || "",
            },
            slug: product.slug || product.id,
          });
        }
        
        localStorage.setItem("merter_b2b_cart", JSON.stringify(updatedCart));
        return updatedCart;
      });

      // Show toast
      const prodTitle = getProductTitle(product, lang);
      const addedText = ADDED_TO_CART_TRANSLATIONS[lang] || ADDED_TO_CART_TRANSLATIONS.en;
      
      // Trigger center screen premium flash overlay
      setCenterFlash({
        show: true,
        productTitle: prodTitle,
        quantity,
        unitsPerPkg,
        addedText
      });
      setTimeout(() => {
        setCenterFlash(null);
      }, 1300);
    };

    const handleShowCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastMessage>;
      if (customEvent.detail) {
        const newToast = customEvent.detail;
        setToasts((prev) => [...prev, newToast]);
        setTimeout(() => {
          setToasts((prev) => removeToastById(prev, newToast.id));
        }, 3000);
      }
    };

    window.addEventListener("merter-add-to-cart", handleDirectAddToCart);
    window.addEventListener("merter-show-toast", handleShowCustomToast);
    
    return () => {
      window.removeEventListener("merter-add-to-cart", handleDirectAddToCart);
      window.removeEventListener("merter-show-toast", handleShowCustomToast);
    };
  }, [lang]);


  // --- Dynamic URL Query Param Filter Syncer handled by QueryParamSyncer component ---

  // --- Products Catalog Loader ---
  useEffect(() => {
    const isFirstMount = initialMountRef.current;
    initialMountRef.current = false;

    const loadProducts = async () => {
      if (mode === "portal") {
        if (isFirstMount && initialPortalProducts && initialPortalProducts.length > 0) {
          setLoadingProducts(false);
          return;
        }
        setLoadingProducts(true);
        interface PortalResponse {
          products: Product[];
          total: number;
        }
        const data = await apiFetch<PortalResponse>("/products?limit=8&sort_by=newest");
        if (data?.products) {
          setPortalNewArrivals(data.products);
        }
        setLoadingProducts(false);
        return;
      }

      const canKeepSsrVisible =
        isFirstMount &&
        Boolean(initialProducts && initialProducts.length > 0) &&
        currentPage === 1 &&
        sortBy === "newest" &&
        !searchQuery;

      if (!canKeepSsrVisible) {
        setLoadingProducts(true);
      }
      setFetchError(null);
      const queryParams = buildCatalogQueryParams({
        itemsPerPage,
        currentPage,
        sortBy,
        displayCurrency,
        activeCategoryId,
        activeBrandIds,
        activeSpecs,
        b2bFilters,
        searchQuery,
        minPrice,
        maxPrice,
        activeAttributes,
      });

      const data = await apiFetch<ProductsResponse>(`/products${queryParams}`);
      if (data?.products) {
        setProducts(data.products);
        setTotalProductsCount(data.total);
        setFacets(data.facets || null);
      } else if (!canKeepSsrVisible) {
        setProducts([]);
        setTotalProductsCount(0);
        setFacets(null);
        setFetchError("connection_error");
      }
      setLoadingProducts(false);
    };
    
    void loadProducts();
  }, [currentPage, itemsPerPage, activeCategoryId, activeBrandIds, searchQuery, sortBy, activeSpecs, b2bFilters, activeAttributes, minPrice, maxPrice, mode, displayCurrency, initialPortalProducts, initialProducts]);

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("merter_b2b_cart", JSON.stringify(newCart));
  };

  // --- Filter Toggles ---
  const handleBrandChange = (brandId: string) => {
    setActiveBrandIds(prev => 
      prev.includes(brandId) ? prev.filter(id => id !== brandId) : [...prev, brandId]
    );
    setCurrentPage(1);
  };

  const handleSpecChange = (type: "gender" | "season", value: string) => {
    setActiveSpecs(prev => {
      if (type === "gender") {
        const current = prev.gender;
        const updated = current.includes(value)
          ? current.filter(val => val !== value)
          : [...current, value];
        return { ...prev, gender: updated };
      } else {
        const current = prev.season;
        const updated = current.includes(value)
          ? current.filter(val => val !== value)
          : [...current, value];
        return { ...prev, season: updated };
      }
    });
    setCurrentPage(1);
  };

  const handleAttributeChange = (name: string, value: string) => {
    const safeName = String(name).trim();
    if (safeName === "__proto__" || safeName === "constructor" || safeName === "prototype") {
      return;
    }
    setActiveAttributes(prev => {
      const currentValues = (Object.hasOwn(prev, safeName) ? Reflect.get(prev, safeName) : undefined) as string[] | undefined || [];
      const updatedValues = currentValues.includes(value)
        ? currentValues.filter(val => val !== value)
        : [...currentValues, value];
      
      const next = { ...prev };
      Reflect.set(next, safeName, updatedValues);
      return next;
    });
    setCurrentPage(1);
  };

  const handleB2bFilterChange = (patch: Partial<B2BSourcingFilters>) => {
    setB2bFilters((prev) => ({ ...prev, ...patch }));
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setActiveBrandIds([]);
    setActiveSpecs({ gender: [], season: [] });
    setB2bFilters({
      fason: false,
      privateLabel: false,
      companyType: "",
      maxMoq: "",
      exportCountry: "",
    });
    setSearchQuery("");
    setMinPrice("");
    setMaxPrice("");
    setActiveAttributes({});
    setCurrentPage(1);
  };

  // --- Modal Controllers ---
  const handleOpenModal = async (productId: string) => {
    const product = await apiFetch<Product>(`/products/${productId}`);
    if (product) {
      setActiveProduct(product);
      
      let colors: string[] = [];
      if (product.color) {
        colors = [product.color];
      }
      if (colors.length === 0) colors = ["Standart"];
      
      setSelectedColor(colors[0]);
      
      let cover = "/placeholder.png";
      if (product.images && product.images.length > 0) {
        const coverObj = product.images.find(img => img.is_cover) || product.images[0];
        cover = coverObj.image_url;
      }
      setModalMainImg(cover);
      
      const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
      const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
      setPkgQty(minPkgs);
    }
  };

  const handleCloseModal = () => {
    setActiveProduct(null);
  };

  // --- Cart Calculations & Actions ---
  const handleAddToCart = (seriesQty: number) => {
    if (!activeProduct) return;
    
    const unitsPerPkg = getUnitsFromSeriesRatio(activeProduct.series_ratio);
    const weightPerUnit = activeProduct.shipping_weight_kg || 0.35;
    
    const hasDiscount = activeProduct.discounted_price < activeProduct.price && activeProduct.discounted_price > 0;
    const unitPrice = hasDiscount ? activeProduct.discounted_price : activeProduct.price;
    const sku = activeProduct.custom_sku || activeProduct.source_product_id || "";
    
    let coverImg = "/placeholder.png";
    if (activeProduct.images && activeProduct.images.length > 0) {
      const coverObj = activeProduct.images.find(img => img.is_cover) || activeProduct.images[0];
      coverImg = coverObj.image_url;
    }
    
    const updatedCart = [...cart];
    
    // A. Add series pack if seriesQty > 0
    if (seriesQty > 0) {
      const duplicateIdx = updatedCart.findIndex(
        item => item.product_id === activeProduct.id && item.color === selectedColor && item.units_per_package > 1
      );
      
      if (duplicateIdx > -1) {
        const item = updatedCart.at(duplicateIdx);
        if (item) {
          item.packages_qty += seriesQty;
        }
      } else {
        updatedCart.push({
          product_id: activeProduct.id,
          title: getProductTitle(activeProduct, lang),
          custom_sku: sku,
          color: selectedColor || activeProduct.color || "",
          packages_qty: seriesQty,
          units_per_package: unitsPerPkg,
          price_per_unit: unitPrice,
          weight_per_unit: weightPerUnit,
          image_url: coverImg,
          currency: activeProduct.currency || "TRY",
          slug: activeProduct.slug || activeProduct.id,
        });
      }
    }

    
    saveCart(updatedCart);
    setActiveProduct(null);
    setIsCartOpen(true);
  };

  const handleAdjustCartItemQty = (index: number, change: number) => {
    const updatedCart = [...cart];
    const item = updatedCart.at(index);
    if (item) {
      if (change < 0 && item.packages_qty + change <= 0) {
        setPendingRemove({ index, change });
        return;
      }
      item.packages_qty += change;
      if (item.packages_qty <= 0) {
        updatedCart.splice(index, 1);
      }
    }
    saveCart(updatedCart);
  };

  const confirmRemove = () => {
    if (pendingRemove !== null) {
      const { index, change } = pendingRemove;
      const updatedCart = [...cart];
      const item = updatedCart.at(index);
      if (item) {
        item.packages_qty += change;
        if (item.packages_qty <= 0) {
          updatedCart.splice(index, 1);
        }
      }
      saveCart(updatedCart);
      setPendingRemove(null);
    }
  };

  const handleRemoveCartItem = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    saveCart(updatedCart);
  };

  // --- Totals Computations ---
  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package), 0);
  const totalWeight = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.weight_per_unit), 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.price_per_unit), 0);

  // --- Quote Inquiry Form Submission ---
  const handleSubmitInquiry = async (formData: InquiryFormData) => {
    if (cart.length === 0) return;
    
    setSubmittingInquiry(true);
    
    const inquiryItems = cart.map(item => {
      const totalUnits = item.packages_qty * item.units_per_package;
      return {
        product_id: item.product_id,
        title: `${item.title} (${item.color}) - ${item.packages_qty} ${t("package", lang)} (${totalUnits} ${t("piece", lang)})`,
        custom_sku: item.custom_sku || item.product_id,
        quantity: totalUnits,
        price: item.price_per_unit,
      };
    });
    
    const payload = {
      full_name: formData.fullName,
      company: formData.companyName || null,
      phone: formData.phoneNumber,
      email: formData.emailAddress,
      message: formData.customerMessage || null,
      items: inquiryItems,
    };
    
    try {
      const response = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errData = await response.json();
        showToast(`Error: ${errData.error || "Failed to submit inquiry"}`);
        setSubmittingInquiry(false);
        return;
      }
      
      const result = await response.json();
      
      // Clean states
      saveCart([]);
      setIsCartOpen(false);
      
      setWhatsappUrl(result.whatsapp_url || "#");
      setShowSuccessOverlay(true);
      
    } catch (err) {
      console.error("Failed to submit B2B inquiry", err);
      showToast("Connection error! Failed to register your quote request.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const hasActiveFiltersCount =
    activeBrandIds.length +
    activeSpecs.gender.length +
    activeSpecs.season.length +
    countActiveB2bFilters(b2bFilters) +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0) +
    Object.values(activeAttributes).reduce((sum, values) => sum + (values ? values.length : 0), 0);

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans antialiased bg-bg-dark text-text-primary overflow-x-hidden" 
      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
    >
      <Suspense fallback={null}>
        <QueryParamSyncer 
          mode={mode} 
          setSearchQuery={setSearchQuery} 
          setActiveCategoryId={setActiveCategoryId} 
          setSortBy={setSortBy}
        />
      </Suspense>
      {/* Preload critical LCP hero image on portal home only */}
      {mode === "portal" && (
        <link rel="preload" href="/banners/hero_new_season.webp?v=2" as="image" type="image/webp" fetchPriority="high" />
      )}

      {/* Header Subcomponent */}
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setCurrentPage={setCurrentPage}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* Main Content Area */}
      {mode === "catalog" ? (
        <CatalogView
          lang={lang}
          categories={categories}
          activeCategoryId={activeCategoryId}
          products={products}
          totalProductsCount={totalProductsCount}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          sortBy={sortBy}
          setSortBy={setSortBy}
          fetchError={fetchError}
          loadingProducts={loadingProducts}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          handleOpenModal={handleOpenModal}
          hasActiveFiltersCount={hasActiveFiltersCount}
          setIsMobileFiltersOpen={setIsMobileFiltersOpen}
          categoryFaqs={categoryFaqs}
          sidebar={
            <FilterSidebar
              lang={lang}
              brands={brands}
              activeBrandIds={activeBrandIds}
              handleBrandChange={handleBrandChange}
              activeSpecs={activeSpecs}
              handleSpecChange={handleSpecChange}
              b2bFilters={b2bFilters}
              onB2bFilterChange={handleB2bFilterChange}
              attributes={attributes}
              activeAttributes={activeAttributes}
              handleAttributeChange={handleAttributeChange}
              minPrice={minPrice}
              maxPrice={maxPrice}
              setMinPrice={setMinPrice}
              setMaxPrice={setMaxPrice}
              facets={facets}
              handleClearAllFilters={handleClearAllFilters}
            />
          }
        />
      ) : (
        <PortalView
          lang={lang}
          categories={categories}
          portalNewArrivals={portalNewArrivals}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          handleOpenModal={handleOpenModal}
        />
      )}

      <Footer 
        lang={lang} 
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      {/* 1. B2B Product Details Modal Subcomponent */}
      {activeProduct && (
        <ProductDetailsModal
          product={activeProduct}
          lang={lang}
          onClose={handleCloseModal}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          pkgQty={pkgQty}
          setPkgQty={setPkgQty}
          modalMainImg={modalMainImg}
          setModalMainImg={setModalMainImg}
          onAddToCart={handleAddToCart}
          showSinglePrice={storeSettings?.show_single_price}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      )}

      {/* 2. Cart Drawer Sidebar Subcomponent */}
      {isCartOpen && (
        <CartDrawer
          onClose={() => setIsCartOpen(false)}
          lang={lang}
          cart={cart}
          onAdjustQty={handleAdjustCartItemQty}
          onRemove={handleRemoveCartItem}
          totalPkgs={totalPkgs}
          totalItemsCount={totalItemsCount}
          totalWeight={totalWeight}
          totalPrice={totalPrice}
          onSubmitInquiry={handleSubmitInquiry}
          submittingInquiry={submittingInquiry}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      )}

      {/* 3. Success Feedback Overlay Modal */}
      {showSuccessOverlay && (
        <SuccessModal
          onClose={() => setShowSuccessOverlay(false)}
          lang={lang}
          whatsappUrl={whatsappUrl}
        />
      )}

      {/* 4. Legal Policy Dynamic Viewer Modal */}
      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={lang}
      />

      {pendingRemove !== null && (
        <ConfirmModal
          lang={lang}
          message={t("remove_from_cart_confirm", lang) || "Sepetten komple kaldırılacaktır onaylıyor musunuz?"}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      {/* 5. Premium Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-eerie-black/95 text-white py-3.5 px-4.5 rounded-[12px] shadow-premium flex items-center justify-between gap-3.5 text-[11px] font-semibold border border-white/10 animate-toast-in pointer-events-auto backdrop-blur-md"
          >
            <div className="flex items-center gap-2 flex-grow min-w-0">
              <span className="text-emerald-500 font-bold shrink-0 text-sm">✓</span>
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter(t => t.id !== toast.id))}
              className="text-white/60 hover:text-white transition-colors border-none bg-transparent cursor-pointer font-bold shrink-0 p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 6. Center Premium Success Flash Modal */}
      {centerFlash && centerFlash.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px] transition-all duration-300 animate-fade-in">
          <div className="bg-slate-900/95 border border-white/10 text-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 max-w-sm w-full mx-4 flex flex-col items-center justify-center text-center gap-4 transition-all duration-300 transform animate-scale-in backdrop-blur-md">
            {/* Success Checkmark Circle with Ping effect */}
            <div className="relative flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></span>
              <svg className="w-8 h-8 shrink-0 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div className="space-y-1 w-full">
              <h3 className="text-base font-extrabold text-white tracking-wide">
                {t("Added to Cart!", lang)}
              </h3>
              <p className="text-xs font-semibold text-slate-300 line-clamp-2 max-w-[280px] mx-auto leading-normal">
                {centerFlash.productTitle}
              </p>
              <p className="text-[11px] font-extrabold text-emerald-400 mt-2 bg-emerald-500/10 px-3 py-1 rounded-full w-fit mx-auto border border-emerald-500/20 shadow-sm">
                {centerFlash.quantity} {t("package", lang)} ({centerFlash.quantity * centerFlash.unitsPerPkg} {t("piece", lang)})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Slide-Over Filter Drawer */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-end lg:hidden select-none">
          {/* Backdrop */}
          <button 
            type="button"
            aria-label={t("Close", lang) || "Close"}
            tabIndex={-1}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in border-none cursor-default" 
            onClick={() => setIsMobileFiltersOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="relative w-full max-w-[320px] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-cultured shrink-0">
              <span className="font-extrabold text-sm uppercase text-eerie-black tracking-wide">
                {t("Filter Options", lang)}
              </span>
              <button 
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-1 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer font-black text-lg"
              >
                ✕
              </button>
            </div>
            {/* Scrollable Filters */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
              <FilterSidebar
                lang={lang}
                brands={brands}
                activeBrandIds={activeBrandIds}
                handleBrandChange={handleBrandChange}
                activeSpecs={activeSpecs}
                handleSpecChange={handleSpecChange}
                attributes={attributes}
                activeAttributes={activeAttributes}
                handleAttributeChange={handleAttributeChange}
                minPrice={minPrice}
                maxPrice={maxPrice}
                setMinPrice={setMinPrice}
                setMaxPrice={setMaxPrice}
                facets={facets}
                handleClearAllFilters={handleClearAllFilters}
              />
            </div>
            {/* Sticky Footer */}
            <div className="p-4 border-t border-cultured shrink-0 bg-zinc-50 flex gap-2">
              {hasActiveFiltersCount > 0 && (
                <button
                  onClick={() => {
                    handleClearAllFilters();
                    setIsMobileFiltersOpen(false);
                  }}
                  className="flex-1 py-3 border border-zinc-200 hover:bg-zinc-100 text-onyx text-xs font-bold uppercase rounded-xl transition-all cursor-pointer text-center bg-white"
                >
                  {t("Clear", lang)}
                </button>
              )}
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="flex-2 py-3 bg-salmon-pink hover:bg-eerie-black text-white text-xs font-extrabold uppercase rounded-xl transition-all cursor-pointer text-center border-none shadow-md flex-1"
              >
                {t("Apply", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-toast-in {
          animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in {
          animation: scaleIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards;
        }
      `}</style>
    </div>
  );
}

