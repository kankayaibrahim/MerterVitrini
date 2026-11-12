"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Centrifuge, PublicationContext } from "centrifuge";
import { X, Send, Sparkles, ChevronLeft, Store, Lock } from "lucide-react";
import {
  ChatRoom,
  ChatMessage,
  ChatOfferMetadata,
  SupplierAgent,
  CentrifugeEventEnvelope,
  getCentrifugeWsUrl,
  getOrInitCustomerChatIdentity,
  resolveChatLang,
} from "@/types/chat";
import { pickLangText, SupportedLangCode, t } from "@/app/i18n";
import { ExchangeRate } from "@/app/utils";
import { useIsStoreMemberLoggedIn, openStoreAuthModal } from "@/app/storeAuth";
import {
  IStoreChatService,
  storeChatService,
} from "@/services/store-chat.service";
import { ChatAgentSelector } from "./chat/ChatAgentSelector";
import { ActiveRoomMessages, RoomListView } from "./chat/ChatMessageList";

interface ChatDrawerTexts {
  lockedHeaderTitle: string;
  lockedHeaderSubtitle: string;
  loginGateTitle: string;
  loginGateDesc: string;
  loginGateBtn: string;
  allChatsTitle: string;
  fallbackSupplierSupport: string;
  onlineBadge: string;
  offlineBadge: string;
  onlineTooltip: string;
  offlineTooltip: string;
  salesRepFallback: string;
  directSupplierSubtitle: string;
  displayNameLabel: string;
  displayNamePlaceholder: string;
  saveBtn: string;
  editBtn: string;
  quickReplies: readonly [string, string, string];
  inputPlaceholder: string;
  sendAriaLabel: string;
}

const CHAT_DRAWER_TEXTS: Record<SupportedLangCode, ChatDrawerTexts> = {
  tr: {
    lockedHeaderTitle: "Canlı B2B Sohbet (Üyelere Özel)",
    lockedHeaderSubtitle: "Tedarikçi Temsilcisi ile Doğrudan İletişim",
    loginGateTitle: "Canlı Sohbet İçin Üye Girişi Gerekli",
    loginGateDesc: "Üretici ve toptancı firma temsilcileriyle canlı görüşmek, stok sormak ve özel seri fiyat teklifi almak için üye girişi yapmanız gerekmektedir.",
    loginGateBtn: "Üye Girişi Yap / Kayıt Ol",
    allChatsTitle: "Tüm Sohbetler",
    fallbackSupplierSupport: "Tedarikçi Canlı Destek",
    onlineBadge: "Çevrimiçi",
    offlineBadge: "Bağlanıyor",
    onlineTooltip: "Canlı Bağlantı Aktif",
    offlineTooltip: "Çevrimdışı / Bağlanıyor...",
    salesRepFallback: "Satış Temsilcisi",
    directSupplierSubtitle: "Doğrudan Üretici / Toptancı Temsilcisi ile Canlı Sohbet",
    displayNameLabel: "Görünür Adınız:",
    displayNamePlaceholder: "Firma / Ad Soyad",
    saveBtn: "Kaydet",
    editBtn: "Değiştir",
    quickReplies: [
      "Merhaba, bu modelde stok var mı?",
      "50 paket için özel fiyat teklifi verebilir misiniz?",
      "Renk ve beden dağılımı nedir?",
    ],
    inputPlaceholder: "Temsilciye mesajınızı veya teklif talebinizi yazın...",
    sendAriaLabel: "Mesaj Gönder",
  },
  en: {
    lockedHeaderTitle: "Live B2B Chat (Members Only)",
    lockedHeaderSubtitle: "Direct Communication with Supplier Representative",
    loginGateTitle: "Member Sign-In Required for Live Chat",
    loginGateDesc: "Please sign in to chat live with manufacturer and wholesaler representatives, check stock, and request custom bulk price offers.",
    loginGateBtn: "Sign In / Register",
    allChatsTitle: "All Chats",
    fallbackSupplierSupport: "Supplier Live Support",
    onlineBadge: "Online",
    offlineBadge: "Connecting",
    onlineTooltip: "Live Connection Active",
    offlineTooltip: "Offline / Connecting...",
    salesRepFallback: "Sales Representative",
    directSupplierSubtitle: "Live Chat Directly with Manufacturer / Wholesaler Representative",
    displayNameLabel: "Display Name:",
    displayNamePlaceholder: "Company / Full Name",
    saveBtn: "Save",
    editBtn: "Edit",
    quickReplies: [
      "Hello, is this model currently in stock?",
      "Can you offer a special B2B price for 50 packs?",
      "What is the color and size breakdown?",
    ],
    inputPlaceholder: "Write your message or price offer request to the representative...",
    sendAriaLabel: "Send Message",
  },
  ru: {
    lockedHeaderTitle: "Онлайн B2B Чат (для участников)",
    lockedHeaderSubtitle: "Прямая связь с представителем поставщика",
    loginGateTitle: "Для чата необходим вход в аккаунт",
    loginGateDesc: "Войдите в систему, чтобы общаться напрямую с фабриками и оптовиками, уточнять наличие и получать индивидуальные оптовые цены.",
    loginGateBtn: "Войти / Регистрация",
    allChatsTitle: "Все чаты",
    fallbackSupplierSupport: "Онлайн-поддержка поставщика",
    onlineBadge: "В сети",
    offlineBadge: "Подключение",
    onlineTooltip: "Прямое соединение активно",
    offlineTooltip: "Не в сети / Подключение...",
    salesRepFallback: "Менеджер по продажам",
    directSupplierSubtitle: "Прямой чат с представителем производителя / оптовика",
    displayNameLabel: "Ваше имя:",
    displayNamePlaceholder: "Компания / Имя Фамилия",
    saveBtn: "Сохранить",
    editBtn: "Изменить",
    quickReplies: [
      "Здравствуйте, есть ли эта модель в наличии?",
      "Можете предложить спеццену на 50 упаковок?",
      "Какая раскладка по цветам и размерам?",
    ],
    inputPlaceholder: "Напишите сообщение или запрос цены представителю...",
    sendAriaLabel: "Отправить сообщение",
  },
  ar: {
    lockedHeaderTitle: "محادثة B2B مباشرة (للأعضاء فقط)",
    lockedHeaderSubtitle: "تواصل مباشر مع ممثل المورد",
    loginGateTitle: "تسجيل الدخول مطلوب للمحادثة المباشرة",
    loginGateDesc: "يرجى تسجيل الدخول للتحدث مباشرة مع ممثلي المصانع وتجار الجملة والاستفسار عن المخزون وطلب عروض أسعار خاصة.",
    loginGateBtn: "تسجيل الدخول / إنشاء حساب",
    allChatsTitle: "جميع المحادثات",
    fallbackSupplierSupport: "الدعم المباشر للمورد",
    onlineBadge: "متصل",
    offlineBadge: "جاري الاتصال",
    onlineTooltip: "الاتصال المباشر نشط",
    offlineTooltip: "غير متصل / جاري الاتصال...",
    salesRepFallback: "ممثل المبيعات",
    directSupplierSubtitle: "محادثة مباشرة مع ممثل المصنع / تاجر الجملة",
    displayNameLabel: "الاسم الظاهر:",
    displayNamePlaceholder: "الشركة / الاسم الكامل",
    saveBtn: "حفظ",
    editBtn: "تعديل",
    quickReplies: [
      "مرحباً، هل هذا الموديل متوفر في المخزون؟",
      "هل يمكنكم تقديم سعر خاص لـ 50 حزمة؟",
      "ما هو توزيع الألوان والمقاسات؟",
    ],
    inputPlaceholder: "اكتب رسالتك أو طلب عرض السعر للممثل...",
    sendAriaLabel: "إرسال الرسالة",
  },
  de: {
    lockedHeaderTitle: "Live-B2B-Chat (Nur für Mitglieder)",
    lockedHeaderSubtitle: "Direkter Kontakt mit dem Lieferantenvertreter",
    loginGateTitle: "Anmeldung für Live-Chat erforderlich",
    loginGateDesc: "Bitte melden Sie sich an, um direkt mit Herstellern und Großhändlern zu chatten, Bestände zu prüfen und individuelle Serienpreise anzufragen.",
    loginGateBtn: "Anmelden / Registrieren",
    allChatsTitle: "Alle Chats",
    fallbackSupplierSupport: "Lieferanten-Live-Support",
    onlineBadge: "Online",
    offlineBadge: "Verbinden",
    onlineTooltip: "Live-Verbindung aktiv",
    offlineTooltip: "Offline / Verbinden...",
    salesRepFallback: "Vertriebsmitarbeiter",
    directSupplierSubtitle: "Direkter Live-Chat mit Hersteller- / Großhandelsvertreter",
    displayNameLabel: "Anzeigename:",
    displayNamePlaceholder: "Firma / Vor- und Nachname",
    saveBtn: "Speichern",
    editBtn: "Ändern",
    quickReplies: [
      "Hallo, ist dieses Modell aktuell auf Lager?",
      "Können Sie einen Sonderpreis für 50 Pakete anbieten?",
      "Wie ist die Farb- und Größenaufteilung?",
    ],
    inputPlaceholder: "Schreiben Sie Ihre Nachricht oder Preisanfrage...",
    sendAriaLabel: "Nachricht senden",
  },
  fr: {
    lockedHeaderTitle: "Chat B2B en direct (Réservé aux membres)",
    lockedHeaderSubtitle: "Contact direct avec le représentant du fournisseur",
    loginGateTitle: "Connexion requise pour le chat en direct",
    loginGateDesc: "Veuillez vous connecter pour discuter en direct avec les fabricants et grossistes, vérifier le stock et demander des offres de prix B2B.",
    loginGateBtn: "Se connecter / S'inscrire",
    allChatsTitle: "Toutes les discussions",
    fallbackSupplierSupport: "Support fournisseur en direct",
    onlineBadge: "En ligne",
    offlineBadge: "Connexion",
    onlineTooltip: "Connexion en direct active",
    offlineTooltip: "Hors ligne / Connexion...",
    salesRepFallback: "Conseiller commercial",
    directSupplierSubtitle: "Chat en direct avec le représentant du fabricant / grossiste",
    displayNameLabel: "Votre nom affiché :",
    displayNamePlaceholder: "Société / Nom complet",
    saveBtn: "Enregistrer",
    editBtn: "Modifier",
    quickReplies: [
      "Bonjour, ce modèle est-il disponible en stock ?",
      "Pouvez-vous proposer un tarif spécial pour 50 lots ?",
      "Quelle est la répartition des couleurs et des tailles ?",
    ],
    inputPlaceholder: "Écrivez votre message ou demande d'offre au conseiller...",
    sendAriaLabel: "Envoyer le message",
  },
  pl: {
    lockedHeaderTitle: "Czat B2B na żywo (Tylko dla członków)",
    lockedHeaderSubtitle: "Bezpośredni kontakt z przedstawicielem dostawcy",
    loginGateTitle: "Wymagane logowanie do czatu na żywo",
    loginGateDesc: "Zaloguj się, aby rozmawiać na żywo z przedstawicielami producentów i hurtowni, pytać o stany magazynowe i otrzymywać oferty cenowe B2B.",
    loginGateBtn: "Zaloguj się / Zarejestruj",
    allChatsTitle: "Wszystkie czaty",
    fallbackSupplierSupport: "Wsparcie dostawcy na żywo",
    onlineBadge: "Online",
    offlineBadge: "Łączenie",
    onlineTooltip: "Połączenie na żywo aktywne",
    offlineTooltip: "Offline / Łączenie...",
    salesRepFallback: "Przedstawiciel handlowy",
    directSupplierSubtitle: "Bezpośredni czat z przedstawicielem producenta / hurtowni",
    displayNameLabel: "Widoczna nazwa:",
    displayNamePlaceholder: "Firma / Imię i nazwisko",
    saveBtn: "Zapisz",
    editBtn: "Zmień",
    quickReplies: [
      "Dzień dobry, czy ten model jest dostępny w magazynie?",
      "Czy mogą Państwo zaproponować cenę specjalną za 50 pakietów?",
      "Jaki jest podział kolorów i rozmiarów?",
    ],
    inputPlaceholder: "Napisz wiadomość lub zapytanie ofertowe do przedstawiciela...",
    sendAriaLabel: "Wyślij wiadomość",
  },
  bg: {
    lockedHeaderTitle: "B2B чат на живо (Само за членове)",
    lockedHeaderSubtitle: "Директна връзка с представител на доставчика",
    loginGateTitle: "Изисква се вход за чат на живо",
    loginGateDesc: "Моля, влезте в профила си, за да разговаряте на живо с производители и търговци на едро, да проверявате наличности и да получавате специални оферти.",
    loginGateBtn: "Вход / Регистрация",
    allChatsTitle: "Всички чатове",
    fallbackSupplierSupport: "Чат поддръжка с доставчика",
    onlineBadge: "Онлайн",
    offlineBadge: "Свързване",
    onlineTooltip: "Активна връзка на живо",
    offlineTooltip: "Офлайн / Свързване...",
    salesRepFallback: "Търговски представител",
    directSupplierSubtitle: "Директен чат с представител на производителя / търговеца",
    displayNameLabel: "Вашето име:",
    displayNamePlaceholder: "Фирма / Име и фамилия",
    saveBtn: "Запази",
    editBtn: "Промени",
    quickReplies: [
      "Здравейте, наличен ли е този модел на склад?",
      "Можете ли да предложите специална цена за 50 пакета?",
      "Какво е разпределението по цветове и размери?",
    ],
    inputPlaceholder: "Напишете съобщение или запитване за оферта до представителя...",
    sendAriaLabel: "Изпрати съобщение",
  },
};

interface StoreChatDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialBrandId?: string;
  readonly initialProductId?: string;
  readonly supplierDisplayName?: string;
  readonly lang?: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onAcceptOfferToCart: (offer: ChatOfferMetadata) => void;
  readonly chatService?: IStoreChatService;
}

export default function StoreChatDrawer({
  isOpen,
  onClose,
  initialBrandId,
  initialProductId,
  supplierDisplayName,
  lang,
  displayCurrency,
  exchangeRates,
  onAcceptOfferToCart,
  chatService = storeChatService,
}: Readonly<StoreChatDrawerProps>) {
  const effectiveLang = resolveChatLang(lang);
  const txt = pickLangText(effectiveLang, CHAT_DRAWER_TEXTS);
  const isAuthenticated = useIsStoreMemberLoggedIn();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [brandAgents, setBrandAgents] = useState<SupplierAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [customerNameInput, setCustomerNameInput] = useState(
    () => getOrInitCustomerChatIdentity(effectiveLang).customerName
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const centrifugeRef = useRef<Centrifuge | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  }, []);

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      try {
        const data = await chatService.listRoomMessages(roomId);
        setMessages(data);
        scrollToBottom();
      } catch (err) {
        console.error("Failed to fetch chat messages:", err);
      }
    },
    [chatService, scrollToBottom]
  );

  const loadCustomerRooms = useCallback(async () => {
    try {
      const list = await chatService.listCustomerRooms();
      setRooms(list);
      return list;
    } catch (err) {
      console.error("Failed to fetch customer rooms:", err);
      return [];
    }
  }, [chatService]);

  const loadBrandAgents = useCallback(
    async (bId: string) => {
      if (!bId) return [];
      try {
        const list = await chatService.listBrandAgents(bId);
        setBrandAgents(list);
        return list;
      } catch (err) {
        console.error("Failed to fetch brand agents:", err);
        return [];
      }
    },
    [chatService]
  );

  const activeRoomRef = useRef<ChatRoom | null>(null);
  const selectedAgentIdRef = useRef<string>("");
  const initializedKeyRef = useRef<string>("");

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  const setupInitialCustomerRoom = useCallback(async () => {
    const list = await loadCustomerRooms();
    if (list.length > 0 && !activeRoomRef.current) {
      const firstRoom = list[0];
      setActiveRoom(firstRoom);
      if (firstRoom.supplier_user_id) {
        setSelectedAgentId(firstRoom.supplier_user_id);
      }
      await loadBrandAgents(firstRoom.brand_id);
      await loadRoomMessages(firstRoom.id);
    }
  }, [loadCustomerRooms, loadBrandAgents, loadRoomMessages]);

  const applyActiveRoom = useCallback(
    async (room: ChatRoom) => {
      setActiveRoom(room);
      if (room.supplier_user_id) {
        setSelectedAgentId(room.supplier_user_id);
      }
      if (!initialBrandId && room.brand_id) {
        await loadBrandAgents(room.brand_id);
      }
      await loadRoomMessages(room.id);
      await loadCustomerRooms();
    },
    [initialBrandId, loadBrandAgents, loadRoomMessages, loadCustomerRooms]
  );

  const initProductRoom = useCallback(
    async (overrideSupplierUserId?: string) => {
      if (!initialBrandId && !initialProductId) {
        await setupInitialCustomerRoom();
        return;
      }

      setLoading(true);
      try {
        if (initialBrandId) {
          await loadBrandAgents(initialBrandId);
        }

        const targetAgentId =
          overrideSupplierUserId ?? selectedAgentIdRef.current;
        const room = await chatService.initOrGetRoom({
          brandId: initialBrandId,
          supplierUserId: targetAgentId,
          productId: initialProductId,
        });
        if (room) {
          await applyActiveRoom(room);
        }
      } catch (err) {
        console.error("Failed to init chat room:", err);
      } finally {
        setLoading(false);
      }
    },
    [
      initialBrandId,
      initialProductId,
      setupInitialCustomerRoom,
      applyActiveRoom,
      chatService,
      loadBrandAgents,
    ]
  );

  useEffect(() => {
    if (!isOpen || !isAuthenticated) {
      initializedKeyRef.current = "";
      return;
    }

    const currentKey = `${initialBrandId || ""}:${initialProductId || ""}`;
    if (initializedKeyRef.current === currentKey) {
      return;
    }
    initializedKeyRef.current = currentKey;

    void initProductRoom();
  }, [isOpen, isAuthenticated, initialBrandId, initialProductId, initProductRoom]);

  const handleSwitchSupplierAgent = (agent: SupplierAgent) => {
    setSelectedAgentId(agent.id);
    void initProductRoom(agent.id);
  };

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const identity = getOrInitCustomerChatIdentity();
    const wsUrl = getCentrifugeWsUrl();

    const client = new Centrifuge(wsUrl, {
      token: identity.customerId,
    });

    client.on("connected", () => setWsConnected(true));
    client.on("disconnected", () => setWsConnected(false));

    const handlePublication = (ctx: PublicationContext) => {
      const env = ctx.data as CentrifugeEventEnvelope;
      if (!env?.event) return;

      if (env.event === "new_message") {
        const incoming = env.data as ChatMessage;
        if (incoming.room_id === activeRoomRef.current?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          scrollToBottom();
        }
        void loadCustomerRooms();
      } else if (env.event === "offer_updated") {
        const updatedMsg = env.data as ChatMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
        );
      }
    };

    const customerSub = client.newSubscription(
      `chat:customer#${identity.customerId}`
    );
    customerSub.on("publication", handlePublication);
    customerSub.subscribe();

    let roomSub: ReturnType<Centrifuge["newSubscription"]> | null = null;
    const currentRoomId = activeRoom?.id;
    if (currentRoomId) {
      roomSub = client.newSubscription(`chat:room#${currentRoomId}`);
      roomSub.on("publication", handlePublication);
      roomSub.subscribe();
    }

    client.connect();
    centrifugeRef.current = client;

    return () => {
      if (roomSub) {
        roomSub.unsubscribe();
      }
      customerSub.unsubscribe();
      client.disconnect();
      centrifugeRef.current = null;
    };
  }, [isOpen, isAuthenticated, activeRoom?.id, loadCustomerRooms, scrollToBottom]);

  const handleSaveGuestName = () => {
    chatService.saveGuestDisplayName(customerNameInput);
    setIsEditingName(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const msg = await chatService.sendCustomerMessage(
        activeRoom.id,
        text,
        customerNameInput
      );
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptOffer = async (msg: ChatMessage) => {
    if (acceptingId) return;
    setAcceptingId(msg.id);

    try {
      const ok = await chatService.acceptCustomOffer(msg.id);
      if (ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, metadata: { ...m.metadata, offer_status: "accepted" } }
              : m
          )
        );
        onAcceptOfferToCart({
          ...msg.metadata,
          offer_status: "accepted",
        });
      }
    } catch (err) {
      console.error("Failed to accept custom offer:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
        <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
          <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">{txt.lockedHeaderTitle}</h3>
                <p className="text-[11px] text-slate-300">{txt.lockedHeaderSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close_modal", effectiveLang)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900">
              {txt.loginGateTitle}
            </h4>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed max-w-xs">
              {txt.loginGateDesc}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                openStoreAuthModal("login");
              }}
              className="w-full max-w-xs py-3 px-4 rounded-xl bg-slate-900 hover:bg-salmon-pink text-white text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer border-none shadow-sm"
            >
              {txt.loginGateBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const headerSubtitle = activeRoom?.supplier_user_name
    ? `${activeRoom.supplier_user_name} (${activeRoom.supplier_user_title || txt.salesRepFallback})`
    : txt.directSupplierSubtitle;
  const statusTooltip = wsConnected ? txt.onlineTooltip : txt.offlineTooltip;
  const statusBadgeText = wsConnected ? txt.onlineBadge : txt.offlineBadge;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            {rooms.length > 1 && activeRoom && (
              <button
                type="button"
                onClick={() => setActiveRoom(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border-none"
                title={txt.allChatsTitle}
                aria-label={txt.allChatsTitle}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-400/30 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-purple-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate text-white">
                  {activeRoom?.supplier_name ||
                    supplierDisplayName ||
                    txt.fallbackSupplierSupport}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                    wsConnected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                  }`}
                  title={statusTooltip}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      wsConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  {statusBadgeText}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close_modal", effectiveLang)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ChatAgentSelector
          brandAgents={brandAgents}
          activeRoom={activeRoom}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSwitchSupplierAgent}
          lang={effectiveLang}
        />

        {/* Customer Display Name Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{txt.displayNameLabel}</span>
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-purple-600"
                placeholder={txt.displayNamePlaceholder}
              />
              <button
                type="button"
                onClick={handleSaveGuestName}
                className="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-bold cursor-pointer border-none"
              >
                {txt.saveBtn}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                {customerNameInput}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-[11px] text-purple-600 hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                {txt.editBtn}
              </button>
            </div>
          )}
        </div>

        {!activeRoom ? (
          <RoomListView
            rooms={rooms}
            lang={effectiveLang}
            onSelectRoom={(rm) => {
              setActiveRoom(rm);
              if (rm.supplier_user_id) {
                setSelectedAgentId(rm.supplier_user_id);
              }
              void loadBrandAgents(rm.brand_id);
              void loadRoomMessages(rm.id);
            }}
          />
        ) : (
          <>
            <ActiveRoomMessages
              loading={loading}
              messages={messages}
              activeRoom={activeRoom}
              displayCurrency={displayCurrency}
              exchangeRates={exchangeRates}
              acceptingId={acceptingId}
              onAcceptOffer={handleAcceptOffer}
              messagesEndRef={messagesEndRef}
              lang={effectiveLang}
            />

            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {txt.quickReplies.map((quickText) => (
                <button
                  key={quickText}
                  type="button"
                  onClick={() => setInputText(quickText)}
                  className="shrink-0 text-[11px] font-semibold bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 px-2.5 py-1 rounded-full transition-colors cursor-pointer border-none flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  {quickText}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={txt.inputPlaceholder}
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-purple-600 text-slate-900 font-medium"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                aria-label={txt.sendAriaLabel}
                className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer border-none flex items-center justify-center shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
