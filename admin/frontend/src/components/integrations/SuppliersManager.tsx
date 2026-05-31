"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Globe, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle,
  X,
  Database,
  Building,
  Phone,
  MapPin,
  ExternalLink,
  Map,
  Search,
  EyeOff,
  FolderX,
  Calendar,
  HardDrive,
  CheckSquare,
  Square,
  Filter,
  ChevronDown
} from "lucide-react";
import { XmlFeed, Brand, CategoryNode } from "../../types/integration";
import XmlImportWizard from "./XmlImportWizard";

// Strict internationalization safe LABELS dictionary
const LABELS = {
  TITLE: "Tedarikçi & XML Entegrasyon Yönetimi",
  DESC: "Ürün sağlayan toptancı tedarikçileri tanımlayın, unvanlarını, iletişim/web sitelerini, konumlarını ve XML bağlantılarını yönetin.",
  ADD_SUPPLIER: "Yeni Tedarikçi Tanımla",
  EDIT_SUPPLIER: "Tedarikçi Kartını Düzenle",
  DELETE_SUPPLIER: "Tedarikçiyi Sil",
  SUPPLIER_NAME: "Tedarikçi Firma Unvanı",
  ALIAS_CODE: "Ön Yüz Maske Rumuzu (Örn: EDUSA)",
  ALIAS_PREFIX: "Rumuz: ",
  STATUS: "Tedarikçi Durumu",
  FEEDS_TITLE: "XML Besleme Bağlantıları",
  ADD_FEED: "Yeni XML Linki Ekle",
  NO_FEEDS: "Bu tedarikçiye tanımlanmış XML linki bulunamadı.",
  FEED_ID: "Besleme Kodu (Örn: janes_elbise)",
  FEED_NAME: "Besleme Adı (Örn: Elbise Grubu)",
  FEED_URL: "XML İndirme Linki (Download URL)",
  ACTIVE: "Aktif",
  PASSIVE: "Pasif",
  SAVE: "Değişiklikleri Kaydet",
  CANCEL: "İptal",
  DELETE: "Sil",
  DELETE_FEED_CONFIRM: "Bu XML besleme bağlantısını silmek istediğinize emin misiniz?",
  DELETE_SUPPLIER_CONFIRM: "Bu tedarikçi kartını silmek istediğinize emin misiniz? Bu işlem tedarikçiye bağlı TÜM XML linklerini ve senkronizasyon geçmişlerini kalıcı olarak silecektir!",
  SUBMITTING: "İşlem yapılıyor...",
  SUCCESS_CREATED: "Tedarikçi başarıyla oluşturuldu.",
  SUCCESS_UPDATED: "Tedarikçi başarıyla güncellendi.",
  SUCCESS_DELETED: "Tedarikçi başarıyla silindi.",
  SUCCESS_FEED_CREATED: "XML besleme linki başarıyla eklendi.",
  SUCCESS_FEED_DELETED: "XML besleme linki silindi.",
  SYNC_TRIGGERED: "Senkronizasyon arka planda başlatıldı.",
  SYNC_NOW: "Şimdi Senkronize Et",
  URL_COPIED: "XML URL kopyalandı!",
  COPY_URL: "Bağlantıyı Kopyala",
  REQUIRED_FIELDS: "Lütfen gerekli tüm alanları doldurun.",
  ADD_NEW: "Yeni Ekle",
  REFRESH: "Yenile",
  NO_SUPPLIERS: "Tanımlanmış tedarikçi bulunamadı.",
  CRITICAL_ACTION: "Kritik Eylem",
  CRITICAL_SUPPLIER_WARNING: "Tedarikçi silindiğinde, tedarikçiye ait tüm XML besleme linkleri ve bu tedarikçiden çekilen ürünler sistemden etkilenebilir.",
  COPY_ALERT: "Kopyalandı",
  
  // Upgraded Labels
  WEBSITE: "Web Sitesi Adresi (URL)",
  PHONE: "İletişim Telefonu",
  ADDRESSES_HEADER: "Dükkan / Depo Adresleri",
  ADD_ADDRESS: "Yeni Adres Satırı Ekle",
  ADDRESS_TITLE: "Adres Başlığı (Örn: Merkez Ofis, Depo 1)",
  ADDRESS_TEXT: "Açık Adres Tarifi",
  COORDINATES: "Dükkan Harita Koordinatı (Örn: 41.0185, 28.8893)",
  CONTACTS_INFO: "İletişim & Konum Bilgileri",
  NO_ADDRESSES: "Tedarikçiye ait adres bilgisi tanımlanmamış.",
  GO_TO_MAPS: "Haritada Aç",
  SEARCH_PLACEHOLDER: "Tedarikçi adı veya rumuz ile arayın...",
  DEACTIVATE_PRODUCTS_CONFIRM: "Tedarikçi Ürünlerini Pasifleştir",
  DEACTIVATE_PRODUCTS_DESC: "Bu tedarikçiye ait tüm ürünleri ve varyantları pasif duruma getirmek istediğinize emin misiniz?",
  DELETE_PRODUCTS_CONFIRM: "Tedarikçi Ürünlerini Kalıcı Olarak Sil",
  DELETE_PRODUCTS_DESC: "Bu tedarikçiye ait TÜM ürünleri, varyantları ve görselleri kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!",
  DEACTIVATE_PRODUCTS: "Ürünleri Pasifleştir",
  DELETE_PRODUCTS: "Tüm Ürünleri Sil",
  DEACTIVATE_WARNING_TITLE: "Uyarı",
  DEACTIVATE_WARNING_DESC: "Bu işlem tedarikçinin tüm ürünlerini internet sitenizde gizleyecektir. Ürünler silinmez, sadece satışa ve gösterime kapatılır.",
  DELETE_WARNING_TITLE: "GERİ DÖNDÜRÜLEMEZ EYLEM",
  DELETE_WARNING_DESC: "Bu işlem tedarikçiye ait tüm ürün veritabanı kayıtlarını ve görsellerini kalıcı olarak silecektir! Bu işlem geri alınamaz!",
  DEACTIVATE_CONFIRM_SUFFIX: " firmasının tüm ürünlerini ve varyantlarını pasif duruma getirmek istediğinize emin misiniz?",
  DELETE_CONFIRM_SUFFIX: " firmasının TÜM ürünlerini, varyantlarını ve görsellerini kalıcı olarak silmek istediğinize emin misiniz?",
  
  // XML History Manager Labels
  HISTORY_TITLE: "Sunucu XML İndirme Geçmişi ve Arşiv Yönetimi",
  HISTORY_DESC: "Sunucuya indirilen XML besleme dosyalarının geçmişini inceleyin, disk boyutlarını görün ve geçmiş verileri temizleyin. Dosyalar otomatik olarak 90 gün boyunca saklanır.",
  REFRESH_LIST: "Listeyi Yenile",
  BULK_CLEAR: "Toplu Temizleme",
  DELETE_ALL_HISTORY: "Tüm XML Geçmişini Sil",
  DELETE_ETIKA_HISTORY: "Sadece Etika Geçmişini Sil",
  DELETE_JANES_HISTORY: "Sadece Jane's Geçmişini Sil",
  DELETE_BF_HISTORY: "Sadece Black Fashion Sil",
  TOTAL_ARCHIVED: "Toplam Arşivlenmiş XML",
  PIECE_FILES: " adet dosya",
  TOTAL_DISK_USAGE: "Toplam Disk Kullanımı",
  LAST_XML_UPDATE: "Son XML Güncellemesi",
  FILE_NOT_FOUND: "Dosya bulunamadı",
  SEARCH_FILES: "Dosya adıyla arayın...",
  ALL_SUPPLIERS: "Tüm Tedarikçiler",
  ETIKA_FASHION: "Etika Fashion",
  JANES_FASHION: "Jane's",
  BLACK_FASHION: "Black Fashion",
  DELETE_SELECTED: "Seçilenleri Sil",
  COL_SUPPLIER: "Tedarikçi",
  COL_FILENAME: "Dosya Adı",
  COL_FILESIZE: "Dosya Boyutu",
  COL_DOWNLOAD_DATE: "İndirilme Tarihi",
  COL_ACTION: "Eylem",
  LOADING_HISTORY: "XML geçmiş verileri yükleniyor...",
  NO_HISTORY_FOUND: "Arşivlenmiş XML dosyası bulunamadı.",
  NO_HISTORY_DESC: "Tedarikçi senkronizasyonu yapıldığında dosyalar burada görünecektir.",
  DELETE_SINGLE_FILE_TOOLTIP: "Bu dosyayı kalıcı olarak sil",
  
  // XML Parser Activator Labels
  ACTIVATE_PARSER_TITLE: "XML PARSER ENTEGRASYONU AKTİFLEŞTİR",
  CHOOSE_PARSER_SCRIPT: "Çalıştırılacak Python Parser Scripti (.py)",
  CUSTOM_SCRIPT_LABEL: "Özel Script Dosya Yolu",
  ACTIVATE_SCRIPT_BTN: "Entegrasyon Scriptini Aktifleştir",
  OPTION_CUSTOM: "Diğer / Özel Script Yolu...",
  OPTION_BF: "parsers/blackfashion.py (Black Fashion)",
  OPTION_ETIKA: "parsers/etika.py (Etika Fashion)",
  OPTION_JANES: "parsers/janes.py (Jane's)"
};

interface SupplierAddress {
  title: string;
  text: string;
  coordinates: string;
}

interface SuppliersManagerProps {
  suppliers: Brand[];
  categories: CategoryNode[];
  onRefresh: () => Promise<void>;
  apiUrl: string;
  token: string | null;
  activeSyncing: Record<string, string>;
  triggerSync: (feedId: string) => Promise<void>;
}

export default function SuppliersManager({
  suppliers,
  categories,
  onRefresh,
  apiUrl,
  token,
  activeSyncing,
  triggerSync
}: SuppliersManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWizardFeed, setActiveWizardFeed] = useState<XmlFeed | null>(null);

  // Modals state
  const [activeModal, setActiveModal] = useState<"create_supplier" | "edit_supplier" | "delete_supplier" | "delete_feed" | "deactivate_products" | "delete_products" | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Brand | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<XmlFeed | null>(null);
  const [deleteImages, setDeleteImages] = useState(false);

  // Form Fields (Supplier Brand)
  const [supplierName, setSupplierName] = useState("");
  const [supplierAlias, setSupplierAlias] = useState("");
  const [supplierWebsite, setSupplierWebsite] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddresses, setSupplierAddresses] = useState<SupplierAddress[]>([]);
  const [supplierIsActive, setSupplierIsActive] = useState(true);

  // Form Fields (Add Feed directly inside edit modal)
  const [feedCustomId, setFeedCustomId] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [selectedParserScript, setSelectedParserScript] = useState("parsers/blackfashion.py");
  const [customParserScript, setCustomParserScript] = useState("");

  // Status indicators
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // XML History Manager states
  const [xmlHistory, setXmlHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryFiles, setSelectedHistoryFiles] = useState<string[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyFilterFeedId, setHistoryFilterFeedId] = useState("all");
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  const fetchXmlHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiRequest("/api/v1/xml-history", "GET");
      setXmlHistory(data || []);
    } catch (err) {
      console.error("Failed to load XML history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchXmlHistory();
  }, []);

  const handleDeleteHistory = async (options: { filenames?: string[]; feedId?: string }) => {
    if (isDeletingHistory) return;
    
    // confirm dialog
    let confirmMsg = "Seçilen XML dosyalarını kalıcı olarak silmek istediğinize emin misiniz?";
    if (options.feedId === "all") {
      confirmMsg = "TÜM XML indirme geçmişini kalıcı olarak silmek istediğinize emin misiniz?";
    } else if (options.feedId) {
      const supplierName = options.feedId === "etika" ? "Etika" : options.feedId === "janes" ? "Jane's" : options.feedId === "blackfashion" ? "Black Fashion" : options.feedId;
      confirmMsg = `${supplierName} tedarikçisine ait tüm XML geçmişini kalıcı olarak silmek istediğinize emin misiniz?`;
    } else if (options.filenames && options.filenames.length === 1) {
      confirmMsg = `"${options.filenames[0]}" dosyasını kalıcı olarak silmek istediğinize emin misiniz?`;
    }

    if (!window.confirm(confirmMsg)) return;

    setIsDeletingHistory(true);
    setFormError(null);

    try {
      const res = await apiRequest("/api/v1/xml-history", "DELETE", {
        filenames: options.filenames || [],
        feed_id: options.feedId || ""
      });

      showToast(`Başarıyla ${res.deleted_count || 0} dosya silindi.`);
      
      // Clear selection if those files were deleted
      if (options.filenames) {
        setSelectedHistoryFiles(prev => prev.filter(f => !options.filenames!.includes(f)));
      } else {
        setSelectedHistoryFiles([]);
      }

      // Reload list
      await fetchXmlHistory();
    } catch (err: any) {
      setFormError(err.message || "Dosya silinirken bir hata oluştu.");
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const stats = useMemo(() => {
    let totalSize = 0;
    let fileCount = xmlHistory.length;
    let latestFile: any = null;

    xmlHistory.forEach(item => {
      totalSize += item.size_bytes;
      if (!latestFile || new Date(item.created_at) > new Date(latestFile.created_at)) {
        latestFile = item;
      }
    });

    // Format total size
    let formattedTotalSize = "0.00 KB";
    if (totalSize >= 1024 * 1024 * 1024) {
      formattedTotalSize = `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (totalSize >= 1024 * 1024) {
      formattedTotalSize = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      formattedTotalSize = `${(totalSize / 1024).toFixed(2)} KB`;
    }

    return {
      totalSize: formattedTotalSize,
      fileCount,
      latestFile
    };
  }, [xmlHistory]);

  const filteredHistory = useMemo(() => {
    return xmlHistory.filter(item => {
      const matchesSearch = item.filename.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                            item.supplier_name.toLowerCase().includes(historySearchQuery.toLowerCase());
      const matchesFeed = historyFilterFeedId === "all" || item.feed_id === historyFilterFeedId;
      return matchesSearch && matchesFeed;
    });
  }, [xmlHistory, historySearchQuery, historyFilterFeedId]);

  // Safe API Request Helper
  const apiRequest = async (path: string, method: string, body?: any) => {
    const headers = new Headers({
      "Content-Type": "application/json"
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  };

  // Toast indicator helper
  const showToast = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Copy feed URL
  const copyUrlToClipboard = (url: string | null, feedId: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedFeedId(feedId);
      setTimeout(() => setCopiedFeedId(null), 2000);
    });
  };

  // Open Create Supplier
  const openCreateSupplier = () => {
    setSupplierName("");
    setSupplierAlias("");
    setSupplierWebsite("");
    setSupplierPhone("");
    setSupplierAddresses([]);
    setFormError(null);
    setActiveModal("create_supplier");
  };

  // Open Edit Supplier
  const openEditSupplier = (supplier: Brand) => {
    setSelectedSupplier(supplier);
    setSupplierName(supplier.name);
    setSupplierAlias(supplier.alias_code || "");
    setSupplierWebsite(supplier.website || "");
    setSupplierPhone(supplier.phone || "");
    setSupplierAddresses((supplier.addresses as SupplierAddress[]) || []);
    setSupplierIsActive(supplier.is_active);
    
    // Reset embedded feed input fields
    setFeedCustomId("");
    setFeedName("");
    setFeedUrl("");
    
    // Determine default select based on alias
    const alias = (supplier.alias_code || "").toUpperCase();
    if (alias === "FLORM") {
      setSelectedParserScript("parsers/etika.py");
    } else if (alias === "EDUSA") {
      setSelectedParserScript("parsers/janes.py");
    } else if (alias === "NOIR") {
      setSelectedParserScript("parsers/blackfashion.py");
    } else {
      setSelectedParserScript("parsers/custom.py");
    }
    setCustomParserScript("");
    
    setFormError(null);
    setActiveModal("edit_supplier");
  };

  // Open Delete Supplier
  const openDeleteSupplier = (supplier: Brand) => {
    setSelectedSupplier(supplier);
    setFormError(null);
    setActiveModal("delete_supplier");
  };

  // Open Delete Feed
  const openDeleteFeed = (feed: XmlFeed) => {
    setSelectedFeed(feed);
    setFormError(null);
    setActiveModal("delete_feed");
  };

  // Open Deactivate Products
  const openDeactivateProducts = (supplier: Brand) => {
    setSelectedSupplier(supplier);
    setFormError(null);
    setActiveModal("deactivate_products");
  };

  // Open Delete Products
  const openDeleteProducts = (supplier: Brand) => {
    setSelectedSupplier(supplier);
    setDeleteImages(false);
    setFormError(null);
    setActiveModal("delete_products");
  };

  // Address sub-form controls
  const addAddressLine = () => {
    setSupplierAddresses([...supplierAddresses, { title: "", text: "", coordinates: "" }]);
  };

  const removeAddressLine = (index: number) => {
    setSupplierAddresses(supplierAddresses.filter((_, i) => i !== index));
  };

  const updateAddressLine = (index: number, field: keyof SupplierAddress, value: string) => {
    const updated = [...supplierAddresses];
    const target = updated.find((_, idx) => idx === index);
    if (target) {
      if (field === "title") {
        target.title = value;
      } else if (field === "text") {
        target.text = value;
      } else if (field === "coordinates") {
        target.coordinates = value;
      }
      setSupplierAddresses(updated);
    }
  };

  const handleAddFeedDirect = async () => {
    if (!selectedSupplier) return;

    const alias = (selectedSupplier.alias_code || "SUPP").toUpperCase();
    const scriptPath = selectedParserScript === "parsers/custom.py" 
      ? customParserScript.trim() 
      : selectedParserScript.trim();

    if (!scriptPath) {
      setFormError("Lütfen Python parser script dosya yolunu belirtin.");
      return;
    }

    // Determine target feed ID from selected script or fallback
    let feedId = `${alias.toLowerCase()}_feed`;
    if (scriptPath.includes("blackfashion.py")) {
      feedId = "blackfashion";
    } else if (scriptPath.includes("etika.py")) {
      feedId = "etika";
    } else if (scriptPath.includes("janes.py")) {
      feedId = "janes";
    } else {
      // For custom scripts, extract base name without extension as the ID
      const baseName = scriptPath.split("/").pop()?.split("\\").pop()?.replace(/\.py$/, "");
      if (baseName) {
        feedId = baseName.toLowerCase();
      }
    }

    const feedName = `${selectedSupplier.name} XML Entegrasyonu`;
    const feedPayload = {
      id: feedId,
      name: feedName,
      alias_code: alias,
      feed_url: "",
      is_active: true
    };

    startTransition(async () => {
      try {
        // 1. Create the logical feed connection row
        await apiRequest(`/api/v1/suppliers/${selectedSupplier.id}/feeds`, "POST", feedPayload);

        // 2. Map it immediately to the selected Python Script
        const mappingPayload = {
          mapping_config: {
            parser_type: "python_script",
            python_script: scriptPath
          },
          category_mapping: {}
        };
        await apiRequest(`/api/v1/feeds/${feedId}/mapping`, "POST", mappingPayload);

        showToast("XML Entegrasyon Scripti başarıyla aktifleştirildi!");
        
        // Reset states
        setFeedCustomId("");
        setFeedName("");
        setFeedUrl("");
        setCustomParserScript("");
        
        // Reload categories & feeds lists in parent and refresh active edit brand
        await onRefresh();
        const freshSupplier = suppliers.find(s => s.id === selectedSupplier.id);
        if (freshSupplier) {
          setSelectedSupplier(freshSupplier);
        } else {
          setActiveModal(null);
        }
      } catch (err: any) {
        setFormError(err.message || "Entegrasyon oluşturulurken hata oluştu.");
      }
    });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Supplier CRUD submissions
    if (activeModal === "create_supplier" || activeModal === "edit_supplier") {
      if (!supplierName.trim()) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }

      const payload = {
        name: supplierName.trim(),
        alias_code: supplierAlias.trim() || null,
        website: supplierWebsite.trim() || null,
        phone: supplierPhone.trim() || null,
        addresses: supplierAddresses.filter(addr => addr.title.trim() && addr.text.trim()),
        is_active: supplierIsActive
      };

      startTransition(async () => {
        try {
          if (activeModal === "create_supplier") {
            await apiRequest("/api/v1/suppliers", "POST", payload);
            showToast(LABELS.SUCCESS_CREATED);
          } else if (activeModal === "edit_supplier" && selectedSupplier) {
            await apiRequest(`/api/v1/suppliers/${selectedSupplier.id}`, "PUT", payload);
            showToast(LABELS.SUCCESS_UPDATED);
          }
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "İşlem gerçekleştirilirken hata oluştu.");
        }
      });
      return;
    }

    // Delete Supplier Submission
    if (activeModal === "delete_supplier") {
      if (!selectedSupplier) return;
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/suppliers/${selectedSupplier.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "Silme işlemi sırasında hata oluştu.");
        }
      });
      return;
    }

    // Delete Feed Submission
    if (activeModal === "delete_feed") {
      if (!selectedFeed) return;
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/feeds/${selectedFeed.id}`, "DELETE");
          showToast(LABELS.SUCCESS_FEED_DELETED);
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "XML besleme bağlantısı silinirken hata oluştu.");
        }
      });
      return;
    }

    // Deactivate Products Submission
    if (activeModal === "deactivate_products") {
      if (!selectedSupplier) return;
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/suppliers/${selectedSupplier.id}/products/deactivate`, "POST");
          showToast("Tedarikçinin tüm ürünleri başarıyla pasifleştirildi.");
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "İşlem sırasında bir hata oluştu.");
        }
      });
      return;
    }

    // Delete Products Submission
    if (activeModal === "delete_products") {
      if (!selectedSupplier) return;
      startTransition(async () => {
        try {
          const res = await apiRequest(`/api/v1/suppliers/${selectedSupplier.id}/products?delete_images=${deleteImages}`, "DELETE");
          showToast(res.message || "Tedarikçinin tüm ürünleri başarıyla silindi.");
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "Silme işlemi sırasında hata oluştu.");
        }
      });
      return;
    }
  };

  // Filter suppliers by name and alias code
  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (supplier.alias_code && supplier.alias_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Header toolbar */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">{LABELS.TITLE}</h2>
          <p className="text-sm text-zinc-500 mt-1">{LABELS.DESC}</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={async () => {
              startTransition(async () => {
                await onRefresh();
              });
            }}
            disabled={isPending}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold"
            type="button"
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
            {LABELS.REFRESH}
          </button>

          <button
            onClick={openCreateSupplier}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all"
            type="button"
          >
            <Plus size={16} />
            {LABELS.ADD_SUPPLIER}
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200/60 rounded-2xl focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold shadow-sm transition-all"
          placeholder={LABELS.SEARCH_PLACEHOLDER}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Suppliers Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSuppliers.length > 0 ? (
          filteredSuppliers.map(supplier => (
            <div 
              key={supplier.id} 
              className={`glass-card bg-white border rounded-3xl p-6 shadow-sm transition-all hover:shadow-md flex flex-col gap-5 ${
                supplier.is_active ? "border-zinc-200/50" : "border-zinc-200 bg-zinc-50/40 opacity-90"
              }`}
            >
              {/* Supplier Header Info */}
              <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${supplier.is_active ? "bg-violet-50 text-violet-600" : "bg-zinc-100 text-zinc-500"}`}>
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2">
                      {supplier.name}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex ${
                        supplier.is_active 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                          : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                      }`}>
                        {supplier.is_active ? LABELS.ACTIVE : LABELS.PASSIVE}
                      </span>
                    </h3>
                    <p className="text-xs font-mono text-zinc-400 mt-1 uppercase">
                      {LABELS.ALIAS_PREFIX}<span className="font-bold text-zinc-700">{supplier.alias_code || "-"}</span>
                    </p>
                  </div>
                </div>

                {/* Edit & Delete quick buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openDeactivateProducts(supplier)}
                    className="p-2 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                    title={LABELS.DEACTIVATE_PRODUCTS}
                    type="button"
                  >
                    <EyeOff size={16} />
                  </button>
                  <button
                    onClick={() => openDeleteProducts(supplier)}
                    className="p-2 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title={LABELS.DELETE_PRODUCTS}
                    type="button"
                  >
                    <FolderX size={16} />
                  </button>
                  <button
                    onClick={() => openEditSupplier(supplier)}
                    className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title={LABELS.EDIT_SUPPLIER}
                    type="button"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => openDeleteSupplier(supplier)}
                    className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title={LABELS.DELETE_SUPPLIER}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* CONTACTS & ADDRESSES BLOCK */}
              <div className="flex flex-col gap-3.5 bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-200/50 pb-2">
                  <Globe size={13} />
                  {LABELS.CONTACTS_INFO}
                </h4>

                {/* Website & Phone rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {supplier.website ? (
                    <a 
                      href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-violet-600 hover:text-violet-700 font-semibold transition-colors"
                    >
                      <Globe size={15} className="text-violet-500 shrink-0" />
                      <span className="truncate">{supplier.website}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Globe size={15} className="shrink-0" />
                      <span className="italic text-xs">-</span>
                    </div>
                  )}

                  {supplier.phone ? (
                    <div className="flex items-center gap-2 text-zinc-700 font-semibold">
                      <Phone size={15} className="text-emerald-500 shrink-0" />
                      <span>{supplier.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone size={15} className="shrink-0" />
                      <span className="italic text-xs">-</span>
                    </div>
                  )}
                </div>

                {/* Supplier Multiple Addresses display */}
                {supplier.addresses && supplier.addresses.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {supplier.addresses.map((addr: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between border-t border-zinc-200/40 pt-2 gap-3">
                        <div className="flex items-start gap-2 text-xs">
                          <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-zinc-800 block mb-0.5">{addr.title}</span>
                            <span className="text-zinc-500 block leading-relaxed">{addr.text}</span>
                          </div>
                        </div>

                        {/* Coordinates GPS map button */}
                        {addr.coordinates && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.coordinates)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100/60 px-2 py-1 rounded border border-violet-100 flex items-center gap-1 shrink-0 transition-colors"
                            title={LABELS.GO_TO_MAPS}
                          >
                            <Map size={10} />
                            {LABELS.GO_TO_MAPS}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 italic pt-1">{LABELS.NO_ADDRESSES}</div>
                )}
              </div>

              {/* Connected Feeds List */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={13} />
                    {LABELS.FEEDS_TITLE} ({supplier.feeds?.length || 0})
                  </h4>
                </div>

                {/* Feeds Sub-rows */}
                {supplier.feeds && supplier.feeds.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {supplier.feeds.map(feed => {
                      const isSyncing = !!Reflect.get(activeSyncing, feed.id);
                      return (
                        <div 
                          key={feed.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between border border-zinc-100 rounded-2xl p-3 bg-zinc-50/40 hover:bg-zinc-50 transition-all gap-3"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                              {feed.name}
                              <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                                feed.is_active 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
                              }`}>
                                {feed.is_active ? LABELS.ACTIVE : LABELS.PASSIVE}
                              </span>
                            </span>
                            
                          </div>

                          {/* Feed Row Actions (Sync & Delete) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {/* Match/Mapping Wizard button */}
                            <button
                              onClick={() => setActiveWizardFeed(feed)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100/60 border border-violet-100 transition-colors shadow-sm"
                              type="button"
                              title="XML Haritalama Sihirbazını Aç"
                            >
                              <Database size={12} />
                              Eşleştir
                            </button>

                            {/* Trigger Senkronize button */}
                            <button
                              onClick={() => triggerSync(feed.id)}
                              disabled={isSyncing || !feed.is_active}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                isSyncing 
                                  ? "bg-violet-50 text-violet-600 border-violet-100" 
                                  : "bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200"
                              }`}
                              type="button"
                            >
                              <RefreshCw size={12} className={isSyncing ? "animate-spin text-violet-600" : "text-zinc-500"} />
                              {isSyncing ? "Senkronize Ediliyor" : LABELS.SYNC_NOW}
                            </button>

                            {/* Delete feed button */}
                            <button
                              onClick={() => openDeleteFeed(feed)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={LABELS.DELETE}
                              type="button"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center border border-dashed border-zinc-200 rounded-2xl py-8 text-center bg-zinc-50/20">
                    <p className="text-zinc-400 text-xs font-medium">{LABELS.NO_FEEDS}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-3xl py-20 text-center bg-white">
            <Building size={48} className="text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm max-w-xs">{LABELS.NO_SUPPLIERS}</p>
            <button
              onClick={openCreateSupplier}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
              type="button"
            >
              {LABELS.ADD_SUPPLIER}
            </button>
          </div>
        )}
      </div>

      {/* -------------------- XML HISTORY MANAGEMENT SECTION -------------------- */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 shadow-sm flex flex-col gap-6 w-full animate-in fade-in duration-200 mt-4">
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Database size={18} className="text-violet-600" />
              {LABELS.HISTORY_TITLE}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {LABELS.HISTORY_DESC}
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchXmlHistory}
              disabled={loadingHistory}
              className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
              type="button"
            >
              <RefreshCw size={13} className={loadingHistory ? "animate-spin" : ""} />
              {LABELS.REFRESH_LIST}
            </button>

            {/* Clear All Dropdown / Actions */}
            <div className="relative group">
              <button
                type="button"
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs shadow-sm transition-all border border-red-200 flex items-center gap-1.5 cursor-pointer"
              >
                <FolderX size={14} />
                {LABELS.BULK_CLEAR}
              </button>
              
              {/* Dropdown menu */}
              <div className="absolute right-0 bottom-full mb-2 w-52 bg-white rounded-2xl border border-zinc-200/80 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 p-1.5 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleDeleteHistory({ feedId: "all" })}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 size={13} />
                  {LABELS.DELETE_ALL_HISTORY}
                </button>
                <div className="h-px bg-zinc-100 my-0.5" />
                <button
                  type="button"
                  onClick={() => handleDeleteHistory({ feedId: "etika" })}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Building size={13} className="text-violet-500" />
                  {LABELS.DELETE_ETIKA_HISTORY}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory({ feedId: "janes" })}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Building size={13} className="text-indigo-500" />
                  {LABELS.DELETE_JANES_HISTORY}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory({ feedId: "blackfashion" })}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Building size={13} className="text-zinc-950" />
                  {LABELS.DELETE_BF_HISTORY}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STATS TILES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tile 1: Count */}
          <div className="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-4 flex items-center gap-4.5 shadow-sm">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <Database size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">{LABELS.TOTAL_ARCHIVED}</span>
              <span className="text-lg font-extrabold text-zinc-800 block mt-0.5">{stats.fileCount}{LABELS.PIECE_FILES}</span>
            </div>
          </div>

          {/* Tile 2: Size */}
          <div className="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-4 flex items-center gap-4.5 shadow-sm">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <HardDrive size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">{LABELS.TOTAL_DISK_USAGE}</span>
              <span className="text-lg font-extrabold text-zinc-800 block mt-0.5">{stats.totalSize}</span>
            </div>
          </div>

          {/* Tile 3: Latest */}
          <div className="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-4 flex items-center gap-4.5 shadow-sm min-w-0">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Calendar size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">{LABELS.LAST_XML_UPDATE}</span>
              <span className="text-sm font-bold text-zinc-800 truncate block mt-0.5" title={stats.latestFile ? stats.latestFile.filename : "YOK"}>
                {stats.latestFile ? stats.latestFile.filename : LABELS.FILE_NOT_FOUND}
              </span>
              {stats.latestFile && (
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                  {new Date(stats.latestFile.created_at).toLocaleString("tr-TR")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH ROW */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white text-xs font-semibold shadow-sm transition-all"
              placeholder={LABELS.SEARCH_FILES}
            />
            {historySearchQuery && (
              <button
                onClick={() => setHistorySearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Supplier Filter dropdown */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-600 shadow-sm shrink-0">
              <Filter size={12} className="text-zinc-400" />
              <select
                value={historyFilterFeedId}
                onChange={(e) => setHistoryFilterFeedId(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">{LABELS.ALL_SUPPLIERS}</option>
                <option value="etika">{LABELS.ETIKA_FASHION}</option>
                <option value="janes">{LABELS.JANES_FASHION}</option>
                <option value="blackfashion">{LABELS.BLACK_FASHION}</option>
              </select>
            </div>

            {/* Selected Files count and Bulk Delete Button */}
            {selectedHistoryFiles.length > 0 && (
              <button
                onClick={() => handleDeleteHistory({ filenames: selectedHistoryFiles })}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-red-600/10 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                type="button"
              >
                <Trash2 size={13} />
                {LABELS.DELETE_SELECTED} ({selectedHistoryFiles.length})
              </button>
            )}
          </div>
        </div>

        {/* FILES TABLE CONTAINER */}
        <div className="border border-zinc-200/60 rounded-2xl overflow-hidden bg-zinc-50/20 shadow-inner max-h-96 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200/60 text-zinc-500 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisibleNames = filteredHistory.map(item => item.filename);
                      const isAllChecked = allVisibleNames.every(name => selectedHistoryFiles.includes(name));
                      if (isAllChecked) {
                        // Deselect all visible
                        setSelectedHistoryFiles(prev => prev.filter(name => !allVisibleNames.includes(name)));
                      } else {
                        // Select all visible
                        setSelectedHistoryFiles(prev => Array.from(new Set([...prev, ...allVisibleNames])));
                      }
                    }}
                    className="text-zinc-400 hover:text-violet-600 transition-colors cursor-pointer"
                  >
                    {filteredHistory.length > 0 && filteredHistory.map(item => item.filename).every(name => selectedHistoryFiles.includes(name)) ? (
                      <CheckSquare size={16} className="text-violet-600 fill-violet-50" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">{LABELS.COL_SUPPLIER}</th>
                <th className="py-3 px-4">{LABELS.COL_FILENAME}</th>
                <th className="py-3 px-4">{LABELS.COL_FILESIZE}</th>
                <th className="py-3 px-4">{LABELS.COL_DOWNLOAD_DATE}</th>
                <th className="py-3 px-4 text-right w-20">{LABELS.COL_ACTION}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 text-xs font-semibold text-zinc-700">
              {loadingHistory ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-violet-500 mb-2" />
                    <span className="font-medium">{LABELS.LOADING_HISTORY}</span>
                  </td>
                </tr>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  const isChecked = selectedHistoryFiles.includes(item.filename);
                  
                  // supplier-specific premium badge styling
                  let badgeClass = "bg-zinc-100 text-zinc-700 border-zinc-200";
                  if (item.feed_id === "etika") {
                    badgeClass = "bg-violet-50 text-violet-700 border-violet-100";
                  } else if (item.feed_id === "janes") {
                    badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
                  } else if (item.feed_id === "blackfashion") {
                    badgeClass = "bg-zinc-950 text-zinc-100 border-zinc-900";
                  }

                  return (
                    <tr 
                      key={item.filename}
                      className={`hover:bg-zinc-50/50 transition-colors ${isChecked ? "bg-violet-50/10" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedHistoryFiles(prev => prev.filter(name => name !== item.filename));
                            } else {
                              setSelectedHistoryFiles(prev => [...prev, item.filename]);
                            }
                          }}
                          className="text-zinc-400 hover:text-violet-600 transition-colors cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-violet-600 fill-violet-50" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                          <Building size={10} />
                          {item.supplier_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 truncate max-w-xs" title={item.filename}>
                        {item.filename}
                      </td>
                      <td className="py-3 px-4 font-bold text-zinc-800">
                        {item.formatted_size}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(item.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory({ filenames: [item.filename] })}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex cursor-pointer"
                          title={LABELS.DELETE_SINGLE_FILE_TOOLTIP}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-400">
                    <FolderX size={32} className="mx-auto text-zinc-300 mb-2" />
                    <span className="font-semibold block text-zinc-500">{LABELS.NO_HISTORY_FOUND}</span>
                    <span className="text-[10px] text-zinc-400 mt-1 block">{LABELS.NO_HISTORY_DESC}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------- DYNAMIC MODALS & OVERLAYS -------------------- */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          
          <div className="bg-white rounded-3xl border border-zinc-100 max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 animate-in zoom-in-95 duration-200 max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
              <h3 className="font-bold text-lg text-zinc-900">
                {activeModal === "create_supplier" && LABELS.ADD_SUPPLIER}
                {activeModal === "edit_supplier" && LABELS.EDIT_SUPPLIER}
                {activeModal === "delete_supplier" && LABELS.DELETE_SUPPLIER}
                {activeModal === "delete_feed" && LABELS.DELETE_FEED_CONFIRM}
                {activeModal === "deactivate_products" && LABELS.DEACTIVATE_PRODUCTS_CONFIRM}
                {activeModal === "delete_products" && LABELS.DELETE_PRODUCTS_CONFIRM}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-600 transition-colors"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
              
              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                
                {/* General Alerts / Error Display */}
                {formError && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Delete Supplier Warning */}
                {activeModal === "delete_supplier" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-zinc-600 text-sm leading-relaxed">{LABELS.DELETE_SUPPLIER_CONFIRM}</p>
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-xs font-medium">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-800 mb-0.5">{LABELS.CRITICAL_ACTION}</span>
                        <span>{LABELS.CRITICAL_SUPPLIER_WARNING}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Delete Feed Warning */}
                {activeModal === "delete_feed" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-zinc-600 text-sm leading-relaxed">{LABELS.DELETE_FEED_CONFIRM}</p>
                  </div>
                )}

                {/* 3. Deactivate Supplier Products Warning */}
                {activeModal === "deactivate_products" && selectedSupplier && (
                  <div className="flex flex-col gap-3">
                    <p className="text-zinc-600 text-sm leading-relaxed">
                      <strong>{selectedSupplier.name}</strong>{LABELS.DEACTIVATE_CONFIRM_SUFFIX}
                    </p>
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-xs font-medium">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-800 mb-0.5">{LABELS.DEACTIVATE_WARNING_TITLE}</span>
                        <span>{LABELS.DEACTIVATE_WARNING_DESC}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Delete Supplier Products Warning */}
                {activeModal === "delete_products" && selectedSupplier && (
                  <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                    <p className="text-zinc-600 text-sm leading-relaxed">
                      <strong>{selectedSupplier.name}</strong>{LABELS.DELETE_CONFIRM_SUFFIX}
                    </p>
                    <div className="bg-red-50 border border-red-200 text-red-950 rounded-2xl p-4 flex gap-3 text-xs font-medium">
                      <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-red-800 mb-0.5">{LABELS.DELETE_WARNING_TITLE}</span>
                        <span>{LABELS.DELETE_WARNING_DESC}</span>
                      </div>
                    </div>

                    {/* Physical Image Files Deletion Option Checkbox */}
                    <div className="flex items-start gap-3 border border-zinc-200/60 rounded-2xl p-4 bg-zinc-50/50 hover:bg-zinc-50 transition-all mt-1 shadow-sm">
                      <input 
                        type="checkbox"
                        id="delete-images-checkbox"
                        checked={deleteImages}
                        onChange={(e) => setDeleteImages(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500/20 cursor-pointer accent-violet-600"
                      />
                      <label htmlFor="delete-images-checkbox" className="text-xs font-semibold text-zinc-600 cursor-pointer select-none leading-relaxed">
                        <span className="font-bold text-zinc-900 block mb-0.5">Ürün Görsel Dosyaları da Sunucudan Silinsin mi?</span>
                        <span className="text-zinc-500 font-medium">Seçerseniz, bu ürünlerin sunucu diskinde depolanan tüm resim dosyaları kalıcı olarak silinecektir. Seçmezseniz, görseller sunucuda kalır ve gelecekte tekrar indirilme süresinden tasarruf edilir.</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 3. Create / Edit Supplier Form */}
                {(activeModal === "create_supplier" || activeModal === "edit_supplier") && (
                  <div className="flex flex-col gap-4">
                    {/* Supplier Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.SUPPLIER_NAME}</label>
                      <input 
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold transition-all"
                        placeholder="Örn: Janes Toptan Tekstil, Lustrin"
                        required
                        disabled={isPending}
                      />
                    </div>

                    {/* Alias Code & Status row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Alias Code */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.ALIAS_CODE}</label>
                        <input 
                          type="text"
                          value={supplierAlias}
                          onChange={(e) => setSupplierAlias(e.target.value)}
                          className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold transition-all"
                          placeholder="Örn: EDUSA, MIMOZA, FLORA"
                          disabled={isPending}
                        />
                      </div>

                      {/* Status checkbox */}
                      <div className="flex items-center justify-between border border-zinc-100 rounded-2xl px-4 py-2 bg-zinc-50/40">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-zinc-800">{LABELS.STATUS}</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setSupplierIsActive(!supplierIsActive)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            supplierIsActive ? "bg-violet-600" : "bg-zinc-200"
                          }`}
                          disabled={isPending}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              supplierIsActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Website & Phone Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Website */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.WEBSITE}</label>
                        <input 
                          type="text"
                          value={supplierWebsite}
                          onChange={(e) => setSupplierWebsite(e.target.value)}
                          className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold transition-all"
                          placeholder="Örn: www.janestoptan.net"
                          disabled={isPending}
                        />
                      </div>

                      {/* Phone */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.PHONE}</label>
                        <input 
                          type="text"
                          value={supplierPhone}
                          onChange={(e) => setSupplierPhone(e.target.value)}
                          className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold transition-all"
                          placeholder="Örn: +90 212 555 6677"
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    {/* ADDRESSES SUB-FORM */}
                    <div className="flex flex-col gap-3.5 border-t border-zinc-150 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">{LABELS.ADDRESSES_HEADER}</label>
                        <button
                          type="button"
                          onClick={addAddressLine}
                          className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"
                          disabled={isPending}
                        >
                          <Plus size={13} />
                          {LABELS.ADD_ADDRESS}
                        </button>
                      </div>

                      {/* Address Lines list */}
                      {supplierAddresses.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {supplierAddresses.map((addr, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-zinc-50 border border-zinc-200/50 rounded-2xl relative group">
                              {/* Remove address button */}
                              <button
                                type="button"
                                onClick={() => removeAddressLine(idx)}
                                className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-zinc-200 rounded-lg transition-all"
                                disabled={isPending}
                              >
                                <X size={14} />
                              </button>

                              {/* Title Input */}
                              <div className="flex flex-col gap-1 w-[85%]">
                                <input 
                                  type="text"
                                  value={addr.title}
                                  onChange={(e) => updateAddressLine(idx, "title", e.target.value)}
                                  className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white text-xs font-bold focus:outline-none focus:border-violet-500"
                                  placeholder={LABELS.ADDRESS_TITLE}
                                  required
                                  disabled={isPending}
                                />
                              </div>

                              {/* Text Input */}
                              <div className="flex flex-col gap-1 mt-1">
                                <textarea
                                  value={addr.text}
                                  onChange={(e) => updateAddressLine(idx, "text", e.target.value)}
                                  className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white text-xs focus:outline-none focus:border-violet-500 h-16 resize-none"
                                  placeholder={LABELS.ADDRESS_TEXT}
                                  required
                                  disabled={isPending}
                                />
                              </div>

                              {/* Coordinates Input */}
                              <div className="flex flex-col gap-1 mt-1">
                                <input 
                                  type="text"
                                  value={addr.coordinates}
                                  onChange={(e) => updateAddressLine(idx, "coordinates", e.target.value)}
                                  className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white text-[11px] font-mono focus:outline-none focus:border-violet-500"
                                  placeholder={LABELS.COORDINATES}
                                  disabled={isPending}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400 italic bg-zinc-50 border border-zinc-150 p-4 text-center rounded-2xl">
                          {LABELS.NO_ADDRESSES}
                        </div>
                      )}
                    </div>

                    {/* FEEDS DIRECT MANAGEMENT INSIDE EDIT MODAL */}
                    {activeModal === "edit_supplier" && (
                      <div className="flex flex-col gap-4 border-t border-zinc-150 pt-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
                            {LABELS.ACTIVATE_PARSER_TITLE}
                          </label>
                        </div>

                        <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                              {LABELS.CHOOSE_PARSER_SCRIPT}
                            </label>
                            
                            <div className="relative">
                              <select
                                value={selectedParserScript}
                                onChange={(e) => setSelectedParserScript(e.target.value)}
                                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl bg-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-xs font-semibold cursor-pointer appearance-none pr-10"
                              >
                                <option value="parsers/blackfashion.py">{LABELS.OPTION_BF}</option>
                                <option value="parsers/etika.py">{LABELS.OPTION_ETIKA}</option>
                                <option value="parsers/janes.py">{LABELS.OPTION_JANES}</option>
                                <option value="parsers/custom.py">{LABELS.OPTION_CUSTOM}</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>

                          {/* Custom manual path input (renders only if custom selected) */}
                          {selectedParserScript === "parsers/custom.py" && (
                            <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                {LABELS.CUSTOM_SCRIPT_LABEL}
                              </label>
                              <input
                                type="text"
                                value={customParserScript}
                                onChange={(e) => setCustomParserScript(e.target.value)}
                                placeholder="Örn: parsers/lustral.py"
                                className="px-3 py-2 border border-zinc-200 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:border-violet-500 font-mono"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleAddFeedDirect}
                            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                          >
                            <Plus size={14} />
                            {LABELS.ACTIVATE_SCRIPT_BTN}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm"
                  disabled={isPending}
                >
                  {LABELS.CANCEL}
                </button>
                
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all ${
                    activeModal === "delete_supplier" || activeModal === "delete_feed" || activeModal === "delete_products"
                      ? "bg-red-600 hover:bg-red-700 shadow-red-600/10 hover:shadow-lg hover:shadow-red-600/20" 
                      : activeModal === "deactivate_products"
                      ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20"
                      : "bg-violet-600 hover:bg-violet-700 shadow-violet-600/10 hover:shadow-lg hover:shadow-violet-600/20"
                  }`}
                  disabled={isPending}
                >
                  {isPending ? LABELS.SUBMITTING : (
                    activeModal === "delete_supplier" || activeModal === "delete_feed" ? LABELS.DELETE :
                    activeModal === "delete_products" ? LABELS.DELETE_PRODUCTS :
                    activeModal === "deactivate_products" ? LABELS.DEACTIVATE_PRODUCTS :
                    LABELS.SAVE
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}

      {/* DYNAMIC XML FIELD & CATEGORY MAPPING WIZARD */}
      {activeWizardFeed && (
        <XmlImportWizard
          feed={activeWizardFeed}
          categories={categories}
          onClose={() => setActiveWizardFeed(null)}
          onSaveSuccess={async () => {
            await onRefresh();
          }}
          apiUrl={apiUrl}
          token={token}
        />
      )}

    </div>
  );
}
