"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Centrifuge, PublicationContext } from "centrifuge";
import {
  X,
  Send,
  MessageSquare,
  Gift,
  CheckCircle2,
  Package,
  Sparkles,
  ChevronLeft,
  Store,
  ShoppingBag,
  Users,
  Globe,
} from "lucide-react";
import {
  ChatRoom,
  ChatMessage,
  ChatOfferMetadata,
  SupplierAgent,
  CentrifugeEventEnvelope,
  getCentrifugeWsUrl,
  getOrInitCustomerChatIdentity,
} from "@/types/chat";
import { convertPrice, ExchangeRate } from "@/app/utils";

interface StoreChatDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialBrandId?: string;
  readonly initialProductId?: string;
  readonly supplierDisplayName?: string;
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onAcceptOfferToCart: (offer: ChatOfferMetadata) => void;
}

export default function StoreChatDrawer({
  isOpen,
  onClose,
  initialBrandId,
  initialProductId,
  supplierDisplayName,
  displayCurrency,
  exchangeRates,
  onAcceptOfferToCart,
}: Readonly<StoreChatDrawerProps>) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [brandAgents, setBrandAgents] = useState<SupplierAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [customerNameInput, setCustomerNameInput] = useState(
    () => getOrInitCustomerChatIdentity().customerName
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

  const buildHeaders = useCallback(() => {
    const identity = getOrInitCustomerChatIdentity();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Chat-Customer-Id": identity.customerId,
      "X-Chat-Customer-Name": encodeURIComponent(identity.customerName),
    };
    if (identity.token) {
      headers["Authorization"] = `Bearer ${identity.token}`;
    }
    return { headers, identity };
  }, []);

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      const { headers } = buildHeaders();
      try {
        const res = await fetch(`/api/v1/store/chat/rooms/${roomId}/messages`, {
          headers,
        });
        if (res.ok) {
          const data = (await res.json()) as ChatMessage[];
          setMessages(data);
          scrollToBottom();
        }
      } catch (err) {
        console.error("Failed to fetch chat messages:", err);
      }
    },
    [buildHeaders, scrollToBottom]
  );

  const loadCustomerRooms = useCallback(async () => {
    const { headers, identity } = buildHeaders();
    try {
      const res = await fetch(
        `/api/v1/store/chat/rooms?customer_id=${encodeURIComponent(identity.customerId)}`,
        { headers }
      );
      if (res.ok) {
        const list = (await res.json()) as ChatRoom[];
        setRooms(list);
        return list;
      }
    } catch (err) {
      console.error("Failed to fetch customer rooms:", err);
    }
    return [];
  }, [buildHeaders]);

  const loadBrandAgents = useCallback(async (bId: string) => {
    if (!bId) return [];
    try {
      const res = await fetch(`/api/v1/store/chat/brands/${bId}/agents`);
      if (res.ok) {
        const list = (await res.json()) as SupplierAgent[];
        setBrandAgents(list);
        return list;
      }
    } catch (err) {
      console.error("Failed to fetch brand agents:", err);
    }
    return [];
  }, []);

  const initProductRoom = useCallback(
    async (overrideSupplierUserId?: string) => {
      if (!initialBrandId && !initialProductId) {
        const list = await loadCustomerRooms();
        if (list.length > 0 && !activeRoom) {
          setActiveRoom(list[0]);
          if (list[0].supplier_user_id) {
            setSelectedAgentId(list[0].supplier_user_id);
          }
          await loadBrandAgents(list[0].brand_id);
          await loadRoomMessages(list[0].id);
        }
        return;
      }

      await Promise.resolve();
      setLoading(true);
      const { headers, identity } = buildHeaders();
      try {
        if (initialBrandId) {
          await loadBrandAgents(initialBrandId);
        }

        const targetAgentId = overrideSupplierUserId ?? selectedAgentId;
        const res = await fetch("/api/v1/store/chat/rooms", {
          method: "POST",
          headers,
          body: JSON.stringify({
            brand_id: initialBrandId || "",
            supplier_user_id: targetAgentId || "",
            product_id: initialProductId || "",
            customer_id: identity.customerId,
            customer_name: identity.customerName,
            customer_email: identity.customerEmail,
            customer_phone: identity.customerPhone,
          }),
        });
        if (res.ok) {
          const room = (await res.json()) as ChatRoom;
          setActiveRoom(room);
          if (room.supplier_user_id) {
            setSelectedAgentId(room.supplier_user_id);
          }
          if (!initialBrandId && room.brand_id) {
            await loadBrandAgents(room.brand_id);
          }
          await loadRoomMessages(room.id);
          await loadCustomerRooms();
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
      selectedAgentId,
      activeRoom,
      buildHeaders,
      loadBrandAgents,
      loadCustomerRooms,
      loadRoomMessages,
    ]
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      void initProductRoom();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, initProductRoom]);

  const handleSwitchSupplierAgent = (agent: SupplierAgent) => {
    setSelectedAgentId(agent.id);
    void initProductRoom(agent.id);
  };

  // Connect Centrifuge WebSocket when drawer is open and activeRoom is set
  useEffect(() => {
    if (!isOpen) return;
    const identity = getOrInitCustomerChatIdentity();
    const wsUrl = getCentrifugeWsUrl();

    const client = new Centrifuge(wsUrl, {
      token: identity.customerId,
    });

    client.on("connected", () => {
      setWsConnected(true);
    });
    client.on("disconnected", () => {
      setWsConnected(false);
    });

    const handlePublication = (ctx: PublicationContext) => {
      const env = ctx.data as CentrifugeEventEnvelope;
      if (!env || !env.event) return;

      if (env.event === "new_message") {
        const incoming = env.data as ChatMessage;
        if (activeRoom && incoming.room_id === activeRoom.id) {
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

    const customerSub = client.newSubscription(`chat:customer#${identity.customerId}`);
    customerSub.on("publication", handlePublication);
    customerSub.subscribe();

    let roomSub: ReturnType<Centrifuge["newSubscription"]> | null = null;
    if (activeRoom?.id) {
      roomSub = client.newSubscription(`chat:room#${activeRoom.id}`);
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
  }, [isOpen, activeRoom, loadCustomerRooms, scrollToBottom]);

  const handleSaveGuestName = () => {
    const trimmed = customerNameInput.trim();
    if (trimmed && typeof window !== "undefined") {
      localStorage.setItem("merter_chat_guest_name", trimmed);
    }
    setIsEditingName(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const { headers, identity } = buildHeaders();
    try {
      const res = await fetch(`/api/v1/store/chat/rooms/${activeRoom.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: identity.customerId,
          customer_name: customerNameInput.trim() || identity.customerName,
          content: text,
        }),
      });
      if (res.ok) {
        const msg = (await res.json()) as ChatMessage;
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

    const { headers } = buildHeaders();
    try {
      const res = await fetch(`/api/v1/store/chat/messages/${msg.id}/accept-offer`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
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
                title="Tüm Sohbetler"
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
                  {activeRoom?.supplier_name || supplierDisplayName || "Tedarikçi Canlı Destek"}
                </h3>
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                  title={wsConnected ? "Canlı Bağlantı Aktif (Centrifuge)" : "Bağlanıyor..."}
                />
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {activeRoom?.supplier_user_name
                  ? `${activeRoom.supplier_user_name} (${activeRoom.supplier_user_title || "Satış Temsilcisi"})`
                  : "Doğrudan Üretici / Toptancı Temsilcisi ile Canlı Sohbet"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Agent Sub-User Selector Bar (X Tedarikçisinin Alt Kullanıcıları) */}
        {brandAgents.length > 0 && (
          <div className="bg-slate-900/95 border-t border-slate-800 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>Tedarikçi Satış Temsilcileri ({brandAgents.length} Yetkili - Ayrı Sohbet):</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {brandAgents.map((agent) => {
                const isSelected =
                  activeRoom?.supplier_user_id === agent.id ||
                  (!activeRoom?.supplier_user_id && selectedAgentId === agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleSwitchSupplierAgent(agent)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                        : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {agent.contact_name}
                    </div>
                    <div className="text-[10px] opacity-85 flex items-center gap-1 mt-0.5">
                      <span>{agent.job_title}</span>
                      {agent.spoken_languages && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-black/25 text-[9px] font-mono">
                          <Globe className="w-2.5 h-2.5" />
                          {agent.spoken_languages}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Customer Display Name Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Görünür Adınız:</span>
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-purple-600"
                placeholder="Firma / Ad Soyad"
              />
              <button
                type="button"
                onClick={handleSaveGuestName}
                className="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-bold cursor-pointer border-none"
              >
                Kaydet
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{customerNameInput}</span>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-[11px] text-purple-600 hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                Değiştir
              </button>
            </div>
          )}
        </div>

        {/* Room List View (if no activeRoom selected) */}
        {!activeRoom ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">
              Tedarikçi & Temsilci Sohbetlerim ({rooms.length})
            </h4>
            {rooms.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Henüz başlatılmış bir tedarikçi sohbetiniz bulunmuyor.
              </div>
            ) : (
              rooms.map((rm) => (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => {
                    setActiveRoom(rm);
                    if (rm.supplier_user_id) {
                      setSelectedAgentId(rm.supplier_user_id);
                    }
                    void loadBrandAgents(rm.brand_id);
                    void loadRoomMessages(rm.id);
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-purple-400 bg-white hover:bg-purple-50/30 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {rm.supplier_name}
                      {rm.supplier_user_name ? ` — ${rm.supplier_user_name}` : ""}
                    </div>
                    {rm.supplier_user_title && (
                      <div className="text-[11px] text-purple-600 font-semibold">
                        {rm.supplier_user_title}{" "}
                        {rm.supplier_user_languages ? `(${rm.supplier_user_languages})` : ""}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {rm.last_message_preview || "Sohbeti görüntülemek için tıklayın"}
                    </div>
                  </div>
                  {rm.unread_customer_count > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-extrabold bg-purple-600 text-white rounded-full">
                      {rm.unread_customer_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
              {loading ? (
                <div className="text-center py-12 text-xs text-slate-400 font-semibold">
                  Sohbet geçmişi yükleniyor...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700">
                    {activeRoom.supplier_user_name
                      ? `${activeRoom.supplier_user_name} (${activeRoom.supplier_user_title || "Satış Temsilcisi"}) ile doğrudan sohbete başlayın!`
                      : "Tedarikçi ile doğrudan sohbete başlayın!"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stok durumu, renk/seri dağılımı veya yüksek adetli alımlarınız için özel fiyat teklifi isteyebilirsiniz.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_type === "customer";
                  const meta = msg.metadata || {};

                  if (msg.message_type === "product_card") {
                    const convertedUnitPrice = convertPrice(
                      meta.original_unit_price || 0,
                      meta.currency || "TRY",
                      displayCurrency,
                      [...exchangeRates]
                    );
                    return (
                      <div
                        key={msg.id}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-3"
                      >
                        <Image
                          src={meta.image_url || "/placeholder.png"}
                          alt={meta.title || "Ürün"}
                          width={56}
                          height={64}
                          unoptimized
                          className="w-14 h-16 object-cover rounded-lg border border-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                            <Package className="w-3 h-3" /> İlgilenilen Ürün
                          </span>
                          <div className="font-bold text-xs text-slate-900 truncate mt-1">
                            {meta.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            SKU: <strong className="text-slate-700">{meta.custom_sku}</strong> •{" "}
                            {meta.units_per_package || 1} Adet/Paket
                          </div>
                          <div className="text-xs font-extrabold text-salmon-pink mt-0.5">
                            {convertedUnitPrice.toFixed(2)} {displayCurrency} / Adet
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (msg.message_type === "custom_offer") {
                    const unitsPerPkg = meta.units_per_package || 1;
                    const pkgs = meta.packages_qty || 1;
                    const totalPieces = pkgs * unitsPerPkg;

                    const origUnitConv = convertPrice(
                      meta.original_unit_price || 0,
                      meta.currency || "TRY",
                      displayCurrency,
                      [...exchangeRates]
                    );
                    const offeredUnitConv = convertPrice(
                      meta.offered_unit_price || 0,
                      meta.currency || "TRY",
                      displayCurrency,
                      [...exchangeRates]
                    );
                    const totalOfferPrice = offeredUnitConv * totalPieces;
                    const isAccepted = meta.offer_status === "accepted";

                    return (
                      <div
                        key={msg.id}
                        className="bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900 text-white rounded-2xl p-4 shadow-lg border border-purple-500/40"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2.5 py-1 rounded-full">
                            <Gift className="w-3.5 h-3.5 text-amber-400" />
                            Özel Toptan Fiyat Teklifi
                          </span>
                          {(meta.discount_percent || 0) > 0 && (
                            <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[11px] rounded-full">
                              %{meta.discount_percent?.toFixed(1)} İNDİRİM
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 rounded-xl p-2.5 mb-3">
                          <Image
                            src={meta.image_url || "/placeholder.png"}
                            alt={meta.title || "Ürün"}
                            width={56}
                            height={64}
                            unoptimized
                            className="w-14 h-16 object-cover rounded-lg shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-white truncate">
                              {meta.title}
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              SKU: {meta.custom_sku} • {pkgs} Paket ({totalPieces} Adet)
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                              {origUnitConv > offeredUnitConv && (
                                <span className="text-[11px] text-slate-400 line-through">
                                  {origUnitConv.toFixed(2)} {displayCurrency}
                                </span>
                              )}
                              <span className="text-sm font-black text-emerald-400">
                                {offeredUnitConv.toFixed(2)} {displayCurrency} / Adet
                              </span>
                            </div>
                          </div>
                        </div>

                        {msg.content && (
                          <p className="text-xs text-slate-200 mb-3 italic bg-black/20 px-3 py-2 rounded-lg">
                            &ldquo;{msg.content}&rdquo;
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs border-t border-white/15 pt-2.5 mb-3">
                          <span className="text-slate-300 font-semibold">
                            Toplam Teklif Tutarı ({pkgs} Paket):
                          </span>
                          <span className="text-base font-black text-amber-300">
                            {totalOfferPrice.toFixed(2)} {displayCurrency}
                          </span>
                        </div>

                        {isAccepted ? (
                          <div className="w-full py-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Teklif Kabul Edildi & Sepete Eklendi
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={acceptingId === msg.id}
                            onClick={() => void handleAcceptOffer(msg)}
                            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            {acceptingId === msg.id
                              ? "Sepete Ekleniyor..."
                              : "Kabul Et & Sepete Ekle"}
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[10px] font-bold text-slate-400 mb-1 px-1">
                        {isMine ? "Siz" : msg.sender_name} •{" "}
                        {new Date(msg.created_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed shadow-xs ${
                          isMine
                            ? "bg-purple-600 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                "Merhaba, bu modelde stok var mı?",
                "50 paket için özel fiyat teklifi verebilir misiniz?",
                "Renk ve beden dağılımı nedir?",
              ].map((quickText) => (
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

            {/* Input Form */}
            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Temsilciye mesajınızı veya teklif talebinizi yazın..."
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-purple-600 text-slate-900 font-medium"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
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
