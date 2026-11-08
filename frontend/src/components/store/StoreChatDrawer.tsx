"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Centrifuge, PublicationContext } from "centrifuge";
import { X, Send, Sparkles, ChevronLeft, Store } from "lucide-react";
import {
  ChatRoom,
  ChatMessage,
  ChatOfferMetadata,
  SupplierAgent,
  CentrifugeEventEnvelope,
  getCentrifugeWsUrl,
  getOrInitCustomerChatIdentity,
} from "@/types/chat";
import { ExchangeRate } from "@/app/utils";
import {
  IStoreChatService,
  storeChatService,
} from "@/services/store-chat.service";
import { ChatAgentSelector } from "./chat/ChatAgentSelector";
import { ActiveRoomMessages, RoomListView } from "./chat/ChatMessageList";

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
  readonly chatService?: IStoreChatService;
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
  chatService = storeChatService,
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
    if (!isOpen) {
      initializedKeyRef.current = "";
      return;
    }

    const currentKey = `${initialBrandId || ""}:${initialProductId || ""}`;
    if (initializedKeyRef.current === currentKey) {
      return;
    }
    initializedKeyRef.current = currentKey;

    void initProductRoom();
  }, [isOpen, initialBrandId, initialProductId, initProductRoom]);

  const handleSwitchSupplierAgent = (agent: SupplierAgent) => {
    setSelectedAgentId(agent.id);
    void initProductRoom(agent.id);
  };

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, activeRoom?.id, loadCustomerRooms, scrollToBottom]);

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
                  {activeRoom?.supplier_name ||
                    supplierDisplayName ||
                    "Tedarikçi Canlı Destek"}
                </h3>
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400"
                  }`}
                  title={
                    wsConnected
                      ? "Canlı Bağlantı Aktif (Centrifuge)"
                      : "Bağlanıyor..."
                  }
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

        <ChatAgentSelector
          brandAgents={brandAgents}
          activeRoom={activeRoom}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSwitchSupplierAgent}
        />

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
              <span className="font-bold text-slate-800">
                {customerNameInput}
              </span>
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

        {!activeRoom ? (
          <RoomListView
            rooms={rooms}
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
            />

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
