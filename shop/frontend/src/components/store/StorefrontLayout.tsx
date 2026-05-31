"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Home, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Product, Brand, Category, CartItem } from "@/types/store";
import { t, getProductTitle, getCategoryPrefix, getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import { getUnitsFromSeriesRatio, apiFetch } from "@/app/utils";

// Import modular, premium Tailwind E-Commerce subcomponents
import Header from "@/components/store/Header";
import HeroBanner from "@/components/store/HeroBanner";
import FilterSidebar from "@/components/store/FilterSidebar";
import ProductCard from "@/components/store/ProductCard";
import ProductDetailsModal from "@/components/store/ProductDetailsModal";
import CartDrawer from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";

const findCategory = (tree: Category[], target: string): Category | null => {
  for (const cat of tree) {
    if (cat.id === target || cat.slug === target) return cat;
    if (cat.children && cat.children.length > 0) {
      const found = findCategory(cat.children, target);
      if (found) return found;
    }
  }
  return null;
};

interface StorefrontLayoutProps {
  mode: "portal" | "catalog";
  initialCategorySlug?: string;
  preFetchedCategories?: Category[];
  defaultLang?: string;
}

export default function StorefrontLayout({
  mode,
  initialCategorySlug,
  preFetchedCategories,
  defaultLang
}: StorefrontLayoutProps) {
  // --- UI States ---
  const [lang, setLang] = useState<string>(defaultLang || "tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // Premium Banners SEO localization mapping with fallback support
  const getLocalizedCollectionBanner = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => {
    let kadin = "/banners/collection_kadin.png";
    let erkek = "/banners/collection_erkek.png";
    let ic_giyim = "/banners/collection_ic_giyim.png";
    let aksesuar = "/banners/collection_aksesuar.png";

    switch (lang) {
      case "en":
        kadin = "/banners/collection_women_en.png";
        erkek = "/banners/collection_men_en.png";
        ic_giyim = "/banners/collection_lingerie_en.png";
        aksesuar = "/banners/collection_accessories_en.png";
        break;
      case "ar":
        kadin = "/banners/collection_women_ar.png";
        erkek = "/banners/collection_men_ar.png";
        ic_giyim = "/banners/collection_lingerie_ar.png";
        aksesuar = "/banners/collection_accessories_ar.png";
        break;
      case "ru":
        kadin = "/banners/collection_women_ru.png";
        erkek = "/banners/collection_men_ru.png";
        ic_giyim = "/banners/collection_lingerie_ru.png";
        aksesuar = "/banners/collection_accessories_ru.png";
        break;
      case "pl":
        kadin = "/banners/collection_kobiety_pl.png";
        erkek = "/banners/collection_mezczyzni_pl.png";
        ic_giyim = "/banners/collection_bielizna_pl.png";
        aksesuar = "/banners/collection_akcesoria_pl.png";
        break;
      case "bg":
        kadin = "/banners/collection_zheni_bg.png";
        erkek = "/banners/collection_muzhi_bg.png";
        ic_giyim = "/banners/collection_belyo_bg.png";
        aksesuar = "/banners/collection_aksesoari_bg.png";
        break;
      case "de":
        kadin = "/banners/collection_damen_de.png";
        erkek = "/banners/collection_herren_de.png";
        ic_giyim = "/banners/collection_unterwaesche_de.png";
        aksesuar = "/banners/collection_accessoires_de.png";
        break;
      case "fr":
        kadin = "/banners/collection_femmes_fr.png";
        erkek = "/banners/collection_hommes_fr.png";
        ic_giyim = "/banners/collection_lingerie_fr.png";
        aksesuar = "/banners/collection_accessoires_fr.png";
        break;
      default:
        break;
    }

    if (type === "kadin") return kadin;
    if (type === "erkek") return erkek;
    if (type === "ic_giyim") return ic_giyim;
    return aksesuar;
  };

  const getLocalizedSliderBanner = (type: "opportunities" | "app_promo") => {
    let opportunities = "/banners/hero_new_opportunities.png";
    let app_promo = "/banners/hero_app_promo.png";

    switch (lang) {
      case "en":
        opportunities = "/banners/hero_opportunities_en.png";
        app_promo = "/banners/hero_app_en.png";
        break;
      case "ar":
        opportunities = "/banners/hero_opportunities_ar.png";
        app_promo = "/banners/hero_app_ar.png";
        break;
      case "ru":
        opportunities = "/banners/hero_opportunities_ru.png";
        app_promo = "/banners/hero_app_ru.png";
        break;
      case "pl":
        opportunities = "/banners/hero_okazje_pl.png";
        app_promo = "/banners/hero_aplikacja_pl.png";
        break;
      case "bg":
        opportunities = "/banners/hero_vazmozhnosti_bg.png";
        app_promo = "/banners/hero_prilozhenie_bg.png";
        break;
      case "de":
        opportunities = "/banners/hero_chancen_de.png";
        app_promo = "/banners/hero_app_de.png";
        break;
      case "fr":
        opportunities = "/banners/hero_opportunites_fr.png";
        app_promo = "/banners/hero_app_fr.png";
        break;
      default:
        break;
    }

    if (type === "opportunities") return opportunities;
    return app_promo;
  };

  const handleCollectionImageError = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    let fallback = "/banners/collection_kadin.png";
    if (type === "erkek") fallback = "/banners/collection_erkek.png";
    else if (type === "ic_giyim") fallback = "/banners/collection_ic_giyim.png";
    else if (type === "aksesuar") fallback = "/banners/collection_aksesuar.png";

    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  };

  const handleSliderImageError = (type: "opportunities" | "app_promo") => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    let fallback = "/banners/hero_new_opportunities.png";
    if (type === "app_promo") fallback = "/banners/hero_app_promo.png";

    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  };
  
  // --- Filter & Catalog States ---
  const [categories, setCategories] = useState<Category[]>(preFetchedCategories || []);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributes, setAttributes] = useState<Record<string, string[]>>({});
  const [activeAttributes, setActiveAttributes] = useState<Record<string, string[]>>({});
  const [facets, setFacets] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [portalNewArrivals, setPortalNewArrivals] = useState<Product[]>([]);
  
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategorySlug || "");
  const [activeSlide, setActiveSlide] = useState<number>(0);

  // Sync initialCategorySlug prop updates to activeCategoryId state
  useEffect(() => {
    setActiveCategoryId(initialCategorySlug || "");
  }, [initialCategorySlug]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(interval);
  }, []);
  
  const [activeBrandIds, setActiveBrandIds] = useState<string[]>([]);
  const [activeSpecs, setActiveSpecs] = useState<{ gender: string[]; season: string[] }>({
    gender: [],
    season: [],
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(24);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  
  // --- B2B Details Modal States ---
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pkgQty, setPkgQty] = useState<number>(1);
  const [modalMainImg, setModalMainImg] = useState<string>("");
  
  // --- Cart Persistent State ---
  const [cart, setCart] = useState<CartItem[]>([]);
  interface ToastMessage {
    id: string;
    message: string;
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  
  // --- Quote Inquiry Submission States ---
  const [fullName, setFullName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [customerMessage, setCustomerMessage] = useState<string>("");
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  useEffect(() => {
    async function loadSettings() {
      const data = await apiFetch<any>("/settings");
      if (data) {
        setStoreSettings(data);
      }
    }
    loadSettings();
  }, []);

  // --- Dynamic HTML lang attribute sync and preferred language synchronization ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred_lang");
      if (savedLang) {
        const path = window.location.pathname;
        if (path === "/" || path === "") {
          setLang(savedLang);
        } else {
          const currentPrefix = path.split("/")[1];
          const savedLangPrefix = getCategoryPrefix(savedLang);
          if (currentPrefix === savedLangPrefix) {
            setLang(savedLang);
          } else if (defaultLang) {
            setLang(defaultLang);
          }
        }
      } else if (defaultLang) {
        setLang(defaultLang);
      }
    }
  }, [defaultLang]);

  // --- Initial Mount Loaders ---
  useEffect(() => {
    const loadCategories = async () => {
      if (categories && categories.length > 0) return;
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
    
    const savedCart = localStorage.getItem("merter_b2b_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (err) {
        console.error("Failed to parse cart storage", err);
      }
    }

    const savedCurrency = localStorage.getItem("merter_preferred_currency");
    if (savedCurrency) {
      setDisplayCurrency(savedCurrency);
    }

    const loadRates = async () => {
      const data = await apiFetch<any[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    loadRates();
    
    loadCategories();
    loadBrands();
    loadAttributes();
  }, []);

  // --- Direct Add to Cart Listener ---
  useEffect(() => {
    const addedToCartTranslations: Record<string, string> = {
      tr: "Sepete başarıyla eklendi!",
      en: "Successfully added to cart!",
      ar: "تمت إضافة المنتج إلى السلة بنجاح!",
      ru: "Успешно добавлено в корзину!",
      pl: "Pomyślnie dodano do koszyka!",
      bg: "Успешно добавено в количката!",
      de: "Erfolgreich in den Warenkorb gelegt!",
      fr: "Ajouté au panier avec succès!"
    };

    const handleDirectAddToCart = (e: Event) => {
      const customEvent = e as CustomEvent<{
        product: Product;
        quantity: number;
      }>;
      if (!customEvent.detail || !customEvent.detail.product) return;
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
          });
        }
        
        localStorage.setItem("merter_b2b_cart", JSON.stringify(updatedCart));
        return updatedCart;
      });

      // Show toast
      const prodTitle = getProductTitle(product, lang);
      let addedText = addedToCartTranslations.en;
      if (lang === "tr") addedText = addedToCartTranslations.tr;
      else if (lang === "ar") addedText = addedToCartTranslations.ar;
      else if (lang === "ru") addedText = addedToCartTranslations.ru;
      else if (lang === "pl") addedText = addedToCartTranslations.pl;
      else if (lang === "bg") addedText = addedToCartTranslations.bg;
      else if (lang === "de") addedText = addedToCartTranslations.de;
      else if (lang === "fr") addedText = addedToCartTranslations.fr;
      const message = `${prodTitle} (${quantity} ${lang === "tr" ? "Seri" : "Pack"}) - ${addedText}`;
      
      const newToast = { id: Math.random().toString(), message };
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== newToast.id));
      }, 3000);
    };

    window.addEventListener("merter-add-to-cart", handleDirectAddToCart);
    return () => {
      window.removeEventListener("merter-add-to-cart", handleDirectAddToCart);
    };
  }, [lang]);


  // --- Dynamic URL Query Param Filter Syncer ---
  useEffect(() => {
    if (typeof window !== "undefined" && mode === "catalog") {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get("category");
      const qParam = params.get("q");

      if (catParam) {
        setActiveCategoryId(catParam);
      }
      if (qParam) {
        setSearchQuery(qParam);
        // Safely sync the desktop input box value
        setTimeout(() => {
          const searchInput = document.getElementById("searchInputDesktop") as HTMLInputElement;
          if (searchInput) searchInput.value = qParam;
        }, 100);
      }
    }
  }, [mode]);

  // --- Products Catalog Loader ---
  useEffect(() => {
    const loadProducts = async () => {
      if (mode === "portal") {
        // Portal only needs a fast preview of 4 items
        setLoadingProducts(true);
        interface PortalResponse {
          products: Product[];
          total: number;
        }
        const data = await apiFetch<PortalResponse>("/products?limit=4&sort_by=newest");
        if (data && data.products) {
          setPortalNewArrivals(data.products);
        }
        setLoadingProducts(false);
        return;
      }

      setLoadingProducts(true);
      const offset = (currentPage - 1) * itemsPerPage;
      let queryParams = `?limit=${itemsPerPage}&offset=${offset}&sort_by=${sortBy}&display_currency=${displayCurrency}`;
      
      if (activeCategoryId) {
        queryParams += `&category_id=${activeCategoryId}`;
      }
      
      if (activeBrandIds.length > 0) {
        queryParams += `&brand_id=${encodeURIComponent(activeBrandIds.join(","))}`;
      }
      
      if (activeSpecs.gender.length > 0) {
        queryParams += `&gender=${encodeURIComponent(activeSpecs.gender.join(","))}`;
      }
      
      if (activeSpecs.season.length > 0) {
        queryParams += `&season=${encodeURIComponent(activeSpecs.season.join(","))}`;
      }
      
      if (searchQuery) {
        queryParams += `&q=${encodeURIComponent(searchQuery)}`;
      }

      if (minPrice) {
        queryParams += `&min_price=${encodeURIComponent(minPrice)}`;
      }
      if (maxPrice) {
        queryParams += `&max_price=${encodeURIComponent(maxPrice)}`;
      }

      Object.entries(activeAttributes).forEach(([name, values]) => {
        if (values.length > 0) {
          queryParams += `&attr_${name}=${encodeURIComponent(values.join(","))}`;
        }
      });
      
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

      const data = await apiFetch<ProductsResponse>(`/products${queryParams}`);
      if (data && data.products) {
        setProducts(data.products);
        setTotalProductsCount(data.total);
        if (data.facets) {
          setFacets(data.facets);
        } else {
          setFacets(null);
        }
      } else {
        setProducts([]);
        setTotalProductsCount(0);
        setFacets(null);
      }
      setLoadingProducts(false);
    };
    
    loadProducts();
  }, [currentPage, itemsPerPage, activeCategoryId, activeBrandIds, searchQuery, sortBy, activeSpecs, activeAttributes, minPrice, maxPrice, mode, displayCurrency]);

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
      const currentValues = (Object.prototype.hasOwnProperty.call(prev, safeName) ? Reflect.get(prev, safeName) : undefined) as string[] | undefined || [];
      const updatedValues = currentValues.includes(value)
        ? currentValues.filter(val => val !== value)
        : [...currentValues, value];
      
      const next = { ...prev };
      Reflect.set(next, safeName, updatedValues);
      return next;
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setActiveBrandIds([]);
    setActiveSpecs({ gender: [], season: [] });
    setSearchQuery("");
    setMinPrice("");
    setMaxPrice("");
    setActiveAttributes({});
    setCurrentPage(1);

    // Safely clear search inputs in the UI
    const searchDesktop = document.getElementById("searchInputDesktop") as HTMLInputElement;
    if (searchDesktop) searchDesktop.value = "";
    const searchMobile = document.getElementById("searchInputMobile") as HTMLInputElement;
    if (searchMobile) searchMobile.value = "";
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
  const handleAddToCart = (seriesQty: number, singleQtys?: Record<string, number>) => {
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
        });
      }
    }
    
    // B. Add single sales
    if (singleQtys) {
      Object.entries(singleQtys).forEach(([size, qty]) => {
        if (qty <= 0) return;
        
        const singleTitle = `${getProductTitle(activeProduct, lang)} - Bed: ${size} (${lang === "tr" ? "Tekli" : "Single"})`;
        const singleSku = `${sku}-${size}-SINGLE`;
        
        const duplicateIdx = updatedCart.findIndex(
          item => item.product_id === activeProduct.id && item.color === selectedColor && item.custom_sku === singleSku
        );
        
        if (duplicateIdx > -1) {
          const item = updatedCart.at(duplicateIdx);
          if (item) {
            item.packages_qty += qty;
          }
        } else {
          updatedCart.push({
            product_id: activeProduct.id,
            title: singleTitle,
            custom_sku: singleSku,
            color: selectedColor || activeProduct.color || "",
            packages_qty: qty,
            units_per_package: 1,
            price_per_unit: unitPrice,
            weight_per_unit: weightPerUnit,
            image_url: coverImg,
            currency: activeProduct.currency || "TRY",
          });
        }
      });
    }
    
    saveCart(updatedCart);
    setActiveProduct(null);
    setIsCartOpen(true);
  };

  const handleAdjustCartItemQty = (index: number, change: number) => {
    const updatedCart = [...cart];
    const item = updatedCart.at(index);
    if (item) {
      item.packages_qty += change;
      if (item.packages_qty <= 0) {
        updatedCart.splice(index, 1);
      }
    }
    saveCart(updatedCart);
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
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
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
      full_name: fullName,
      company: companyName || null,
      phone: phoneNumber,
      email: emailAddress,
      message: customerMessage || null,
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
        alert(`Error: ${errData.error || "Failed to submit inquiry"}`);
        setSubmittingInquiry(false);
        return;
      }
      
      const result = await response.json();
      
      // Clean states
      saveCart([]);
      setFullName("");
      setCompanyName("");
      setPhoneNumber("");
      setEmailAddress("");
      setCustomerMessage("");
      setIsCartOpen(false);
      
      setWhatsappUrl(result.whatsapp_url || "#");
      setShowSuccessOverlay(true);
      
    } catch (err) {
      console.error("Failed to submit B2B inquiry", err);
      alert("Connection error! Failed to register your quote request.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const isCategorySelected = activeCategoryId !== "";

  return (
    <div 
      className="min-h-screen flex flex-col font-sans antialiased bg-bg-dark text-text-primary" 
      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
    >
      {/* Header Subcomponent */}
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
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
        <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
          
          {/* Category Breadcrumbs */}
          {activeCategoryId && (
            <nav className="flex items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
              <a href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
                <Home className="w-3.5 h-3.5" />
                <span>{t("home", lang)}</span>
              </a>
              {getCategoryTrail(categories, activeCategoryId)?.map((cat) => (
                <React.Fragment key={cat.id}>
                  <ChevronRight className="w-3 h-3 text-spanish-gray" />
                  <a 
                    href={getCategoryUrl(categories, cat, lang)}
                    className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver last:text-salmon-pink last:pointer-events-none last:font-extrabold"
                  >
                    {getCategoryTitle(cat, lang)}
                  </a>
                </React.Fragment>
              ))}
            </nav>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Hero Banner Subcomponent */}
            <HeroBanner lang={lang} />

            {/* Left Sidebar Filter Subcomponent */}
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

            {/* Right Product Listing Catalog */}
            <section className="lg:col-span-3 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cultured pb-4 w-full">
                <div className="flex flex-col gap-1 select-none">
                  <h2 className="font-sans font-extrabold text-xl tracking-tight text-eerie-black">
                    {activeCategoryId 
                      ? getCategoryTitle(findCategory(categories, activeCategoryId), lang) || t("all_products", lang)
                      : t("all_products", lang)
                    }
                  </h2>
                  {(() => {
                    const activeCatObj = activeCategoryId ? findCategory(categories, activeCategoryId) : null;
                    if (activeCatObj) {
                      const activeCount = activeCatObj.active_products || 0;
                      const totalCount = activeCatObj.total_products || 0;
                      return (
                        <span className="text-[11px] font-semibold text-sonic-silver">
                          {lang === "tr" ? "Aktif Ürün:" : "Active Products:"} <strong className="text-salmon-pink">{activeCount}</strong> • {lang === "tr" ? "Toplam Ürün:" : "Total Products:"} <strong className="text-eerie-black">{totalCount}</strong>
                        </span>
                      );
                    } else {
                      // Total count of all products in catalog
                      return (
                        <span className="text-[11px] font-semibold text-sonic-silver">
                          {lang === "tr" ? "Katalogdaki Toplam Ürün:" : "Total Catalog Products:"} <strong className="text-salmon-pink">{totalProductsCount}</strong>
                        </span>
                      );
                    }
                  })()}
                </div>
                
                <div className="flex items-center gap-2 select-none shrink-0">
                  {/* Page Size Selector */}
                  <span className="text-[10px] uppercase font-bold text-sonic-silver tracking-wider">{lang === "tr" ? "Göster:" : "Show:"}</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-cultured rounded-[5px] px-2 py-1.5 text-xs font-bold text-onyx focus:outline-none focus:border-salmon-pink cursor-pointer shadow-sm"
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                    <option value={96}>96</option>
                  </select>

                  <select 
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-cultured rounded-[5px] px-3 py-1.5 text-xs font-bold text-onyx focus:outline-none focus:border-salmon-pink cursor-pointer shadow-sm"
                  >
                    <option value="newest">{t("sort_newest", lang)}</option>
                    <option value="price_asc">{t("sort_price_asc", lang)}</option>
                    <option value="price_desc">{t("sort_price_desc", lang)}</option>
                    <option value="name_asc">{lang === "tr" ? "Ürün Adı: A-Z" : "Product Name: A-Z"}</option>
                    <option value="name_desc">{lang === "tr" ? "Ürün Adı: Z-A" : "Product Name: Z-A"}</option>
                    <option value="sku_asc">{lang === "tr" ? "Ürün Kodu: A-Z" : "Product Code: A-Z"}</option>
                    <option value="sku_desc">{lang === "tr" ? "Ürün Kodu: Z-A" : "Product Code: Z-A"}</option>
                  </select>
                </div>
              </div>

              {/* Products Grid */}
              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="spinner animate-spin" />
                  <span className="text-xs font-bold text-sonic-silver select-none">{t("loading", lang)}</span>
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-cultured bg-white rounded-[10px] p-8 select-none shadow-sm">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-xs font-bold text-sonic-silver">{t("no_products", lang)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6" id="catalog-section">
                  {products.map((p, idx) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      lang={lang}
                      onOpenModal={handleOpenModal}
                      priority={idx < 4}
                      displayCurrency={displayCurrency}
                      exchangeRates={exchangeRates}
                    />
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {products.length > 0 && (() => {
                const totalPages = Math.ceil(totalProductsCount / itemsPerPage) || 1;
                return (
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mt-8 select-none">
                    {/* First Page Button */}
                    <button
                      disabled={currentPage === 1}
                      onClick={() => {
                        setCurrentPage(1);
                        window.scrollTo({ top: 220, behavior: "smooth" });
                      }}
                      title={lang === "tr" ? "İlk Sayfa" : "First Page"}
                      className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>

                    {/* Previous Page Button */}
                    <button
                      disabled={currentPage === 1}
                      onClick={() => {
                        setCurrentPage(prev => Math.max(prev - 1, 1));
                        window.scrollTo({ top: 220, behavior: "smooth" });
                      }}
                      title={lang === "tr" ? "Önceki Sayfa" : "Previous Page"}
                      className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Current Page Status */}
                    <span className="text-xs font-bold text-sonic-silver px-2 min-w-[70px] text-center">
                      {lang === "tr" ? "Sayfa" : "Page"} {currentPage} / {totalPages}
                    </span>
                    
                    {/* Next Page Button */}
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage(prev => Math.min(prev + 1, totalPages));
                        window.scrollTo({ top: 220, behavior: "smooth" });
                      }}
                      title={lang === "tr" ? "Sonraki Sayfa" : "Next Page"}
                      className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Last Page Button */}
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage(totalPages);
                        window.scrollTo({ top: 220, behavior: "smooth" });
                      }}
                      title={lang === "tr" ? "Son Sayfa" : "Last Page"}
                      className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}

            </section>

          </div>
        </main>
      ) : (
        <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
          
          {/* A. PREMIUM AUTO-SLIDING HERO CAROUSEL */}
          <div className="relative rounded-[20px] overflow-hidden border border-cultured aspect-[16/10] xs:aspect-[16/9] sm:aspect-[21/9] min-h-[300px] xs:min-h-[320px] sm:min-h-[280px] bg-gradient-to-br from-[#fafafa] to-[#fff0f1] shadow-sm select-none mb-10 group">
            {/* Slide 1: Opportunities Promo */}
            <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 0 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
              <img 
                src={getLocalizedSliderBanner("opportunities")} 
                alt={t("portal_daily_opportunities", lang)} 
                className="absolute inset-0 w-full h-full object-cover" 
                onError={handleSliderImageError("opportunities")}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
              <div className="relative z-10 max-w-[90vw] sm:max-w-md md:max-w-lg bg-white/85 backdrop-blur-md p-5 sm:p-6 md:p-8 rounded-[15px] border border-white/20 shadow-lg flex flex-col gap-1.5 sm:gap-2">
                <span className="text-salmon-pink font-extrabold text-[9px] sm:text-xs uppercase tracking-[1.5px] sm:tracking-[2px]">{t("portal_wholesale_opportunities", lang)}</span>
                <h2 className="font-sans font-extrabold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_daily_opportunities", lang)}</h2>
                <p className="text-[11px] xs:text-xs text-sonic-silver font-semibold leading-relaxed mt-0.5">{t("portal_daily_opportunities_desc", lang)}</p>
                <a href="/tum-urunler" className="mt-2.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] sm:text-xs font-bold uppercase rounded-[5px] transition-colors duration-300 w-fit cursor-pointer border-none shadow-sm no-underline">{t("portal_examine_catalog", lang)}</a>
              </div>
            </div>

            {/* Slide 2: Mobile App Promo */}
            <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 1 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
              <img 
                src={getLocalizedSliderBanner("app_promo")} 
                alt={t("portal_download_app", lang)} 
                className="absolute inset-0 w-full h-full object-cover" 
                onError={handleSliderImageError("app_promo")}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
              <div className="relative z-10 max-w-[90vw] sm:max-w-md md:max-w-lg bg-white/85 backdrop-blur-md p-5 sm:p-6 md:p-8 rounded-[15px] border border-white/20 shadow-lg flex flex-col gap-1.5 sm:gap-2">
                <span className="text-salmon-pink font-extrabold text-[9px] sm:text-xs uppercase tracking-[1.5px] sm:tracking-[2px]">{t("portal_mobile_ease", lang)}</span>
                <h2 className="font-sans font-extrabold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_download_app", lang)}</h2>
                <p className="text-[11px] xs:text-xs text-sonic-silver font-semibold leading-relaxed mt-0.5">{t("portal_download_app_desc", lang)}</p>
                <div className="flex gap-2 mt-2.5">
                  <span className="px-3 py-1.5 xs:px-4 xs:py-2 bg-eerie-black text-white text-[9px] xs:text-[10px] font-extrabold rounded-[5px] border-none shadow-sm cursor-pointer select-none active:scale-[0.98] transition-transform">{t("portal_app_store", lang)}</span>
                  <span className="px-3 py-1.5 xs:px-4 xs:py-2 bg-eerie-black text-white text-[9px] xs:text-[10px] font-extrabold rounded-[5px] border-none shadow-sm cursor-pointer select-none active:scale-[0.98] transition-transform">{t("portal_google_play", lang)}</span>
                </div>
              </div>
            </div>

            {/* Slide Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <button onClick={() => setActiveSlide(0)} className={`w-2.5 h-2.5 rounded-full transition-all border-none cursor-pointer ${activeSlide === 0 ? "bg-salmon-pink scale-110" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
              <button onClick={() => setActiveSlide(1)} className={`w-2.5 h-2.5 rounded-full transition-all border-none cursor-pointer ${activeSlide === 1 ? "bg-salmon-pink scale-110" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
            </div>
          </div>

          {/* B. CIRCULAR CATEGORY NAVIGATORS */}
          <div className="mb-12 select-none">
            <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-6 text-center">{t("portal_wholesale_categories", lang)}</h3>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {categories.map((cat) => {
                const prefix = getCategoryPrefix(lang);
                const url = `/${prefix}/${cat.slug || cat.id}/`;
                return (
                  <a 
                    key={cat.id} 
                    href={url}
                    className="flex flex-col items-center gap-3 group cursor-pointer border-none bg-transparent active:scale-95 transition-transform no-underline"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-cultured bg-white shadow-sm flex items-center justify-center text-2xl group-hover:border-salmon-pink group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
                      <span className="relative z-10">
                        {cat.slug === "kadin-giyim" ? "👗" : cat.slug === "erkek-giyim" ? "👔" : cat.slug === "buyuk-beden" ? "👚" : cat.slug === "ic-giyim" ? "👙" : "✨"}
                      </span>
                      <div className="absolute inset-0 bg-salmon-pink/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs font-bold text-onyx group-hover:text-salmon-pink transition-colors">
                      {getCategoryTitle(cat, lang)}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* C. VISUAL PREMIUM COLLECTIONS GRID */}
          <div className="mb-16 select-none">
            <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_season_collections", lang)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card 1: Kadın Giyim */}
              <a 
                href={`/${getCategoryPrefix(lang)}/kadin-giyim/`}
                className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm flex items-center p-8 select-none no-underline"
              >
                <img 
                  src={getLocalizedCollectionBanner("kadin")} 
                  alt={t("portal_women_clothing", lang)} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
                  onError={handleCollectionImageError("kadin")}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent z-0" />
                <div className="relative z-10 max-w-[240px] flex flex-col gap-1.5">
                  <h4 className="font-sans font-extrabold text-xl text-eerie-black">{t("portal_women_clothing", lang)}</h4>
                  <p className="text-[11px] text-sonic-silver font-semibold">{t("portal_women_trend_desc", lang)}</p>
                  <span className="text-xs font-extrabold text-salmon-pink uppercase tracking-wider border-b-2 border-salmon-pink pb-0.5 w-fit mt-2 group-hover:text-eerie-black group-hover:border-eerie-black transition-colors duration-300">{t("portal_start_shopping", lang)}</span>
                </div>
              </a>

              {/* Card 2: Erkek Giyim */}
              <a 
                href={`/${getCategoryPrefix(lang)}/erkek-giyim/`}
                className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm flex items-center p-8 select-none no-underline"
              >
                <img 
                  src={getLocalizedCollectionBanner("erkek")} 
                  alt={t("portal_men_clothing", lang)} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
                  onError={handleCollectionImageError("erkek")}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent z-0" />
                <div className="relative z-10 max-w-[240px] flex flex-col gap-1.5">
                  <h4 className="font-sans font-extrabold text-xl text-eerie-black">{t("portal_men_clothing", lang)}</h4>
                  <p className="text-[11px] text-sonic-silver font-semibold">{t("portal_men_trend_desc", lang)}</p>
                  <span className="text-xs font-extrabold text-salmon-pink uppercase tracking-wider border-b-2 border-salmon-pink pb-0.5 w-fit mt-2 group-hover:text-eerie-black group-hover:border-eerie-black transition-colors duration-300">{t("portal_start_shopping", lang)}</span>
                </div>
              </a>

              {/* Card 3: İç Giyim */}
              <a 
                href={`/tum-urunler?q=${lang === 'tr' ? 'tayt' : 'leggings'}`}
                className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm flex items-center p-8 select-none no-underline"
              >
                <img 
                  src={getLocalizedCollectionBanner("ic_giyim")} 
                  alt={t("portal_lingerie", lang)} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
                  onError={handleCollectionImageError("ic_giyim")}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent z-0" />
                <div className="relative z-10 max-w-[240px] flex flex-col gap-1.5">
                  <h4 className="font-sans font-extrabold text-xl text-eerie-black">{t("portal_lingerie", lang)}</h4>
                  <p className="text-[11px] text-sonic-silver font-semibold">{t("portal_lingerie_desc", lang)}</p>
                  <span className="text-xs font-extrabold text-salmon-pink uppercase tracking-wider border-b-2 border-salmon-pink pb-0.5 w-fit mt-2 group-hover:text-eerie-black group-hover:border-eerie-black transition-colors duration-300">{t("portal_start_shopping", lang)}</span>
                </div>
              </a>

              {/* Card 4: Aksesuar */}
              <a 
                href={`/tum-urunler?q=${lang === 'tr' ? 'aksesuar' : 'accessories'}`}
                className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm flex items-center p-8 select-none no-underline"
              >
                <img 
                  src={getLocalizedCollectionBanner("aksesuar")} 
                  alt={t("portal_accessories", lang)} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
                  onError={handleCollectionImageError("aksesuar")}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent z-0" />
                <div className="relative z-10 max-w-[240px] flex flex-col gap-1.5">
                  <h4 className="font-sans font-extrabold text-xl text-eerie-black">{t("portal_accessories", lang)}</h4>
                  <p className="text-[11px] text-sonic-silver font-semibold">{t("portal_accessories_desc", lang)}</p>
                  <span className="text-xs font-extrabold text-salmon-pink uppercase tracking-wider border-b-2 border-salmon-pink pb-0.5 w-fit mt-2 group-hover:text-eerie-black group-hover:border-eerie-black transition-colors duration-300">{t("portal_start_shopping", lang)}</span>
                </div>
              </a>

            </div>
          </div>

          {/* D. NEW ARRIVALS PREVIEW CAROUSEL */}
          {portalNewArrivals.length > 0 && (
            <div className="mb-16 select-none">
              <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_new_arrivals", lang)}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {portalNewArrivals.map((p) => (
                  <ProductCard 
                    key={p.id} 
                    product={p} 
                    lang={lang} 
                    onOpenModal={handleOpenModal} 
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                  />
                ))}
              </div>
            </div>
          )}

          {/* E. BROWSE ALL CTA PANEL */}
          <div className="bg-[#fafafa] border border-cultured rounded-[15px] p-8 md:p-12 text-center flex flex-col items-center gap-4 shadow-inner mb-6">
            <span className="text-[10px] font-extrabold tracking-[2px] uppercase text-salmon-pink">{t("portal_explore_all_collections", lang)}</span>
            <h3 className="font-sans font-extrabold text-xl md:text-2xl text-eerie-black max-w-md">{t("portal_all_in_one", lang)}</h3>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed max-w-lg">{t("portal_all_in_one_desc", lang)}</p>
            <a 
              href="/tum-urunler"
              className="mt-2 px-8 py-3.5 bg-salmon-pink hover:bg-eerie-black text-white text-xs font-extrabold uppercase rounded-[5px] transition-all duration-300 tracking-[1px] border-none shadow-md cursor-pointer active:scale-98 no-underline"
            >
              {t("portal_examine_all_products", lang)}
            </a>
          </div>

        </main>
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
          fullName={fullName}
          setFullName={setFullName}
          companyName={companyName}
          setCompanyName={setCompanyName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          emailAddress={emailAddress}
          setEmailAddress={setEmailAddress}
          customerMessage={customerMessage}
          setCustomerMessage={setCustomerMessage}
          onSubmit={handleSubmitInquiry}
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

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-toast-in {
          animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

