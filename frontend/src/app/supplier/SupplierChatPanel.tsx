"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Centrifuge, PublicationContext } from "centrifuge";
import {
  MessageSquare,
  Send,
  Gift,
  CheckCircle2,
  Clock,
  Package,
  User,
  Sparkles,
  X,
  Users,
  Plus,
  Trash2,
  Globe,
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";
import {
  ChatRoom,
  ChatMessage,
  SupplierAgent,
  CentrifugeEventEnvelope,
  getCentrifugeWsUrl,
} from "@/types/chat";

interface SupplierChatPanelProps {
  readonly brandId: string;
  readonly supplierUserId?: string;
  readonly products: readonly SupplierProductRow[];
  readonly getToken: () => string | null;
  readonly onUnreadTotalChange?: (totalUnread: number) => void;
}

export default function SupplierChatPanel({
  brandId,
  supplierUserId,
  products,
  getToken,
  onUnreadTotalChange,
}: Readonly<SupplierChatPanelProps>) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomScope, setRoomScope] = useState<"mine" | "all">("all");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Sub-User Team Management State
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [teamMembers, setTeamMembers] = useState<SupplierAgent[]>([]);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentPassword, setNewAgentPassword] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [newAgentTitle, setNewAgentTitle] = useState("İhracat Satış Temsilcisi");
  const [newAgentLangs, setNewAgentLangs] = useState("TR, EN, RU");
  const [teamError, setTeamError] = useState("");
  const [teamSubmitting, setTeamSubmitting] = useState(false);

  // Custom Offer Builder State
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [offerPackagesQty, setOfferPackagesQty] = useState<number>(10);
  const [offerDiscountPercent, setOfferDiscountPercent] = useState<number>(8);
  const [offerCustomUnitPrice, setOfferCustomUnitPrice] = useState<string>("");
  const [offerNote, setOfferNote] = useState<string>(
    "Toptan alımınıza özel indirimli birim fiyat teklifimizdir."
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  }, []);

  const loadSupplierRooms = useCallback(
    async (scopeOverride?: "mine" | "all") => {
      const token = getToken();
      if (!token) return [];
      const activeScope = scopeOverride || roomScope;
      try {
        const res = await fetch(`/api/v1/supplier/chat/rooms?scope=${activeScope}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as ChatRoom[];
          setRooms(data);
          const totalUnread = data.reduce(
            (sum, r) => sum + (r.unread_supplier_count || 0),
            0
          );
          onUnreadTotalChange?.(totalUnread);
          return data;
        }
      } catch (err) {
        console.error("Failed to load supplier chat rooms:", err);
      }
      return [];
    },
    [getToken, onUnreadTotalChange, roomScope]
  );

  const loadTeamMembers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/v1/supplier/team", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as SupplierAgent[];
        setTeamMembers(list);
      }
    } catch (err) {
      console.error("Failed to load supplier team:", err);
    }
  }, [getToken]);

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/v1/supplier/chat/rooms/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as ChatMessage[];
          setMessages(data);
          scrollToBottom();
          void loadSupplierRooms();
        }
      } catch (err) {
        console.error("Failed to load supplier messages:", err);
      }
    },
    [getToken, loadSupplierRooms, scrollToBottom]
  );

  useEffect(() => {
    void (async () => {
      await loadTeamMembers();
      const list = await loadSupplierRooms();
      if (list.length > 0 && !activeRoom) {
        setActiveRoom(list[0]);
        await loadRoomMessages(list[0].id);
      }
    })();
  }, [activeRoom, loadRoomMessages, loadSupplierRooms, loadTeamMembers]);

  const handleToggleOfferModal = () => {
    setShowOfferModal((prev) => {
      const next = !prev;
      if (next && !selectedProductId && products.length > 0) {
        const initProd =
          products.find((p) => p.id === activeRoom?.initial_product_id) ||
          products[0];
        if (initProd) {
          setSelectedProductId(initProd.id);
          const discounted = Number(
            (initProd.price * (1 - offerDiscountPercent / 100)).toFixed(2)
          );
          setOfferCustomUnitPrice(String(discounted));
        }
      }
      return next;
    });
  };

  // Real-time Centrifuge subscription (both brand-level and sub-user personal channel)
  useEffect(() => {
    if (!brandId) return;
    const wsUrl = getCentrifugeWsUrl();
    const client = new Centrifuge(wsUrl, {
      token: `supplier_${supplierUserId || brandId}`,
    });

    client.on("connected", () => setWsConnected(true));
    client.on("disconnected", () => setWsConnected(false));

    const handlePub = (ctx: PublicationContext) => {
      const env = ctx.data as CentrifugeEventEnvelope;
      if (!env?.event) return;

      if (env.event === "new_message") {
        const incoming = env.data as ChatMessage;
        if (incoming.room_id === activeRoom?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          scrollToBottom();
        }
        void loadSupplierRooms();
      } else if (env.event === "offer_updated") {
        const updated = env.data as ChatMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m))
        );
        void loadSupplierRooms();
      } else if (env.event === "room_updated") {
        void loadSupplierRooms();
      }
    };

    const supplierSub = client.newSubscription(`chat:supplier#${brandId}`);
    supplierSub.on("publication", handlePub);
    supplierSub.subscribe();

    let agentSub: ReturnType<Centrifuge["newSubscription"]> | null = null;
    if (supplierUserId) {
      agentSub = client.newSubscription(`chat:supplier_user#${supplierUserId}`);
      agentSub.on("publication", handlePub);
      agentSub.subscribe();
    }

    let roomSub: ReturnType<Centrifuge["newSubscription"]> | null = null;
    if (activeRoom?.id) {
      roomSub = client.newSubscription(`chat:room#${activeRoom.id}`);
      roomSub.on("publication", handlePub);
      roomSub.subscribe();
    }

    client.connect();

    return () => {
      if (roomSub) roomSub.unsubscribe();
      if (agentSub) agentSub.unsubscribe();
      supplierSub.unsubscribe();
      client.disconnect();
    };
  }, [brandId, supplierUserId, activeRoom, loadSupplierRooms, scrollToBottom]);

  const handleCreateTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError("");
    const token = getToken();
    if (!token) return;

    setTeamSubmitting(true);
    try {
      const res = await fetch("/api/v1/supplier/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contact_name: newAgentName,
          email: newAgentEmail,
          password: newAgentPassword,
          phone: newAgentPhone,
          job_title: newAgentTitle,
          spoken_languages: newAgentLangs,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setTeamError(data.error || "Alt kullanıcı oluşturulamadı.");
        return;
      }
      setNewAgentName("");
      setNewAgentEmail("");
      setNewAgentPassword("");
      setNewAgentPhone("");
      await loadTeamMembers();
    } catch {
      setTeamError("Bağlantı hatası oluştu.");
    } finally {
      setTeamSubmitting(false);
    }
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/supplier/team/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadTeamMembers();
      }
    } catch (err) {
      console.error("Failed to delete team member:", err);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !inputText.trim() || sending) return;
    const token = getToken();
    if (!token) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch(
        `/api/v1/supplier/chat/rooms/${activeRoom.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message_type: "text",
            content: text,
          }),
        }
      );
      if (res.ok) {
        const msg = (await res.json()) as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        void loadSupplierRooms();
      }
    } catch (err) {
      console.error("Failed to send supplier message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSendCustomOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !selectedProductId || sending) return;
    const token = getToken();
    if (!token) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/supplier/chat/rooms/${activeRoom.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message_type: "custom_offer",
            product_id: selectedProductId,
            packages_qty: Number(offerPackagesQty) || 1,
            offered_unit_price: Number(offerCustomUnitPrice) || 0,
            discount_percent: Number(offerDiscountPercent) || 0,
            content: offerNote.trim(),
          }),
        }
      );
      if (res.ok) {
        const msg = (await res.json()) as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setShowOfferModal(false);
        scrollToBottom();
        void loadSupplierRooms();
      }
    } catch (err) {
      console.error("Failed to send custom offer:", err);
    } finally {
      setSending(false);
    }
  };

  const selectedProductObj = products.find((p) => p.id === selectedProductId);

  const applyDiscountPreset = (pct: number) => {
    setOfferDiscountPercent(pct);
    if (selectedProductObj) {
      const calc = Number((selectedProductObj.price * (1 - pct / 100)).toFixed(2));
      setOfferCustomUnitPrice(String(calc));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Sub-User Team Management Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-zinc-900">
              Satış Temsilcileri & Alt Kullanıcılar ({teamMembers.length} Yetkili)
            </h3>
            <p className="text-xs text-zinc-500">
              Müşteriler ürün sayfasında buradaki alt kullanıcılarınızdan istediği temsilciyi seçerek ayrı sohbet başlatabilir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTeamPanel((prev) => !prev)}
          className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-amber-500 text-white hover:text-zinc-950 text-xs font-extrabold transition-colors cursor-pointer border-none flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {showTeamPanel ? "Ekip Panelini Kapat" : "Alt Kullanıcıları Yönet / Temsilci Ekle"}
        </button>
      </div>

      {/* Collapsible Sub-User Team Management Panel */}
      {showTeamPanel && (
        <div className="bg-zinc-900 text-white rounded-2xl p-5 border border-zinc-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs uppercase tracking-wider text-amber-400">
              Firma Alt Kullanıcıları (Müşterilerin Ayrı Sohbet Edeceği Satış Temsilcileri)
            </h4>
            <button
              type="button"
              onClick={() => setShowTeamPanel(false)}
              className="text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Existing Sub-Users List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamMembers.map((m) => (
              <div
                key={m.id}
                className="bg-zinc-800/90 border border-zinc-700 rounded-xl p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-white truncate">
                      {m.contact_name}
                    </span>
                    {m.id === supplierUserId && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full">
                        Aktif Oturum
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                    {m.job_title}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                    {m.email}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-700/70">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-300">
                    <Globe className="w-3 h-3 text-amber-400" />
                    {m.spoken_languages}
                  </span>
                  {m.id !== supplierUserId && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteTeamMember(m.id)}
                      className="p-1 text-zinc-400 hover:text-red-400 bg-transparent border-none cursor-pointer"
                      title="Alt Kullanıcıyı Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Sub-User Form */}
          <form
            onSubmit={(e) => void handleCreateTeamMember(e)}
            className="pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end"
          >
            <div>
              <label htmlFor="agent-name" className="block text-[10px] font-bold text-zinc-400 mb-1">
                Temsilci Ad Soyad *
              </label>
              <input
                id="agent-name"
                type="text"
                required
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="Örn: Elena Yılmaz"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="agent-title" className="block text-[10px] font-bold text-zinc-400 mb-1">
                Ünvan / Departman *
              </label>
              <input
                id="agent-title"
                type="text"
                required
                value={newAgentTitle}
                onChange={(e) => setNewAgentTitle(e.target.value)}
                placeholder="Örn: Rusya & BDT Satış"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="agent-langs" className="block text-[10px] font-bold text-zinc-400 mb-1">
                Konuştuğu Diller *
              </label>
              <input
                id="agent-langs"
                type="text"
                required
                value={newAgentLangs}
                onChange={(e) => setNewAgentLangs(e.target.value)}
                placeholder="Örn: TR, RU, EN"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="agent-email" className="block text-[10px] font-bold text-zinc-400 mb-1">
                Giriş E-Postası *
              </label>
              <input
                id="agent-email"
                type="email"
                required
                value={newAgentEmail}
                onChange={(e) => setNewAgentEmail(e.target.value)}
                placeholder="elena@firma.com"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="agent-password" className="block text-[10px] font-bold text-zinc-400 mb-1">
                Giriş Şifresi *
              </label>
              <input
                id="agent-password"
                type="password"
                required
                minLength={6}
                value={newAgentPassword}
                onChange={(e) => setNewAgentPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={teamSubmitting}
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-lg cursor-pointer border-none"
              >
                {teamSubmitting ? "Ekleniyor..." : "+ Alt Kullanıcı Ekle"}
              </button>
            </div>
          </form>
          {teamError && (
            <div className="text-xs text-red-400 font-semibold">{teamError}</div>
          )}
        </div>
      )}

      {/* Main Chat Grid */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Sidebar: Customer Rooms */}
        <div className="lg:col-span-4 border-r border-zinc-200 flex flex-col bg-zinc-50/50">
          <div className="p-4 border-b border-zinc-200 flex flex-col gap-2.5 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <h3 className="font-black text-xs uppercase tracking-wider text-zinc-900">
                  Müşteri Sohbetleri ({rooms.length})
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  wsConnected
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                {wsConnected ? "Canlı (Centrifuge)" : "Bağlanıyor"}
              </span>
            </div>

            {/* Scope Filter: Bana Atananlar vs Tüm Mağaza */}
            <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setRoomScope("all");
                  void loadSupplierRooms("all");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border-none ${
                  roomScope === "all"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "bg-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Tüm Temsilciler
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomScope("mine");
                  void loadSupplierRooms("mine");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border-none ${
                  roomScope === "mine"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "bg-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Bana Özel Sohbetler
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/70">
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Henüz müşterilerden gelen bir mesaj bulunmuyor. Ürün sayfalarınızdan gelen sorular ve pazarlık talepleri anında burada listelenir.
              </div>
            ) : (
              rooms.map((rm) => {
                const isSelected = activeRoom?.id === rm.id;
                return (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => {
                      setActiveRoom(rm);
                      void loadRoomMessages(rm.id);
                    }}
                    className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 cursor-pointer border-none ${
                      isSelected
                        ? "bg-amber-50/90 border-l-4 border-l-amber-500"
                        : "bg-transparent hover:bg-zinc-100/70"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-900 truncate">
                          {rm.customer_name}
                        </div>
                        {rm.supplier_user_name && (
                          <div className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            Temsilci: {rm.supplier_user_name} ({rm.supplier_user_title})
                          </div>
                        )}
                        <div className="text-xs text-zinc-500 truncate mt-1">
                          {rm.last_message_preview || "Yeni sohbet başlatıldı"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-zinc-400 font-semibold">
                        {new Date(rm.last_message_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {rm.unread_supplier_count > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-zinc-950 font-black text-[11px] rounded-full">
                          {rm.unread_supplier_count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation & Custom Offer Builder */}
        <div className="lg:col-span-8 flex flex-col bg-zinc-50/30">
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <MessageSquare className="w-12 h-12 text-zinc-300 mb-3" />
              <h4 className="font-bold text-sm text-zinc-700">
                Görüntülemek İçin Bir Müşteri Sohbeti Seçin
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">
                Müşterilerinize anında yanıt verebilir ve tek tıkla sepete eklenebilir Özel Toptan Fiyat Teklifi Kartı gönderebilirsiniz.
              </p>
            </div>
          ) : (
            <>
              {/* Conversation Top Bar */}
              <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-zinc-900">
                      {activeRoom.customer_name}
                    </h4>
                    {activeRoom.supplier_user_name && (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 text-[10px] font-bold">
                        Muhatap Temsilci: {activeRoom.supplier_user_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {activeRoom.customer_email || activeRoom.customer_phone || "Aktif B2B Alıcı Oturumu"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleOfferModal}
                  className="px-4 py-2 bg-zinc-950 hover:bg-amber-500 text-white hover:text-zinc-950 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer border-none shadow-xs"
                >
                  <Gift className="w-4 h-4 text-amber-400" />
                  Özel Fiyat Teklifi Gönder
                </button>
              </div>

              {/* Custom Offer Creator Drawer/Panel */}
              {showOfferModal && (
                <form
                  onSubmit={(e) => void handleSendCustomOffer(e)}
                  className="p-4 bg-zinc-900 text-white border-b border-zinc-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Müşteriye Özel Toptan Fiyat Teklifi Kartı Oluştur
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOfferModal(false)}
                      className="p-1 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label htmlFor="offer-product-select" className="block text-[11px] font-bold text-zinc-300 mb-1">
                        Teklif Verilecek Ürün
                      </label>
                      <select
                        id="offer-product-select"
                        value={selectedProductId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedProductId(pid);
                          const prod = products.find((p) => p.id === pid);
                          if (prod) {
                            const calc = Number(
                              (prod.price * (1 - offerDiscountPercent / 100)).toFixed(2)
                            );
                            setOfferCustomUnitPrice(String(calc));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.custom_sku} - {p.title} ({p.price} {p.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="offer-packages-qty" className="block text-[11px] font-bold text-zinc-300 mb-1">
                        Teklif Paket (Seri) Adedi
                      </label>
                      <input
                        id="offer-packages-qty"
                        type="number"
                        min={1}
                        value={offerPackagesQty}
                        onChange={(e) => setOfferPackagesQty(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                      </input>
                    </div>

                    <div>
                      <label htmlFor="offer-unit-price" className="block text-[11px] font-bold text-zinc-300 mb-1">
                        Özel Teklif Birim Fiyatı ({selectedProductObj?.currency || "TRY"})
                      </label>
                      <input
                        id="offer-unit-price"
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={offerCustomUnitPrice}
                        onChange={(e) => setOfferCustomUnitPrice(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Quick Discount Presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400 font-semibold">
                        Hızlı İndirim Oranı:
                      </span>
                      {[5, 8, 10, 12, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyDiscountPreset(pct)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                            offerDiscountPercent === pct
                              ? "bg-amber-400 text-zinc-950 border-amber-400"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                          }`}
                        >
                          %{pct}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <input
                        type="text"
                        value={offerNote}
                        onChange={(e) => setOfferNote(e.target.value)}
                        placeholder="Teklif mesajı..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white"
                      />
                      <button
                        type="submit"
                        disabled={sending || !selectedProductId}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-lg cursor-pointer border-none shrink-0"
                      >
                        Teklifi Gönder
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5 max-h-[460px]">
                {messages.map((msg) => {
                  const isMine = msg.sender_type === "supplier";
                  const meta = msg.metadata || {};

                  if (msg.message_type === "product_card") {
                    return (
                      <div
                        key={msg.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3 max-w-md shadow-2xs"
                      >
                        <Image
                          src={meta.image_url || "/placeholder.png"}
                          alt={meta.title || "Ürün"}
                          width={48}
                          height={56}
                          unoptimized
                          className="w-12 h-14 object-cover rounded-lg border border-zinc-100"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-extrabold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Package className="w-3 h-3" /> Müşterinin İncelediği Ürün
                          </span>
                          <div className="font-bold text-xs text-zinc-900 truncate mt-0.5">
                            {meta.title}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            SKU: <strong>{meta.custom_sku}</strong> • Liste Fiyatı:{" "}
                            <strong>
                              {meta.original_unit_price?.toFixed(2)} {meta.currency}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (msg.message_type === "custom_offer") {
                    const unitsPerPkg = meta.units_per_package || 1;
                    const pkgs = meta.packages_qty || 1;
                    const totalPieces = pkgs * unitsPerPkg;
                    const totalOfferAmount =
                      (meta.offered_unit_price || 0) * totalPieces;
                    const isAccepted = meta.offer_status === "accepted";

                    return (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-md bg-zinc-900 text-white rounded-2xl p-4 border border-amber-500/40 shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5" /> Gönderilen Özel Fiyat Teklifi
                          </span>
                          {(meta.discount_percent || 0) > 0 && (
                            <span className="px-2 py-0.5 bg-amber-400 text-zinc-950 font-black text-[10px] rounded-full">
                              %{meta.discount_percent?.toFixed(1)} İNDİRİM
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-white">
                          {meta.title} ({meta.custom_sku})
                        </div>
                        <div className="text-[11px] text-zinc-300 mt-1">
                          Miktar: <strong>{pkgs} Paket</strong> ({totalPieces} Adet) • Birim:{" "}
                          <strong className="text-emerald-400">
                            {meta.offered_unit_price?.toFixed(2)} {meta.currency}
                          </strong>
                        </div>
                        <div className="text-xs font-black text-amber-300 mt-1">
                          Toplam Teklif: {totalOfferAmount.toFixed(2)} {meta.currency}
                        </div>

                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-bold">
                          {isAccepted ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Müşteri Teklifi Kabul Etti & Sepete Ekledi
                            </span>
                          ) : (
                            <span className="text-amber-300 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Müşteri Onayı Bekleniyor...
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="text-[10px] font-bold text-zinc-400 mb-1 px-1">
                        {msg.sender_name} •{" "}
                        {new Date(msg.created_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                          isMine
                            ? "bg-zinc-900 text-white rounded-br-xs"
                            : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-xs shadow-2xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form
                onSubmit={(e) => void handleSendText(e)}
                className="p-3.5 bg-white border-t border-zinc-200 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Müşteriye yanıtınızı yazın..."
                  className="flex-1 px-4 py-2.5 text-xs bg-zinc-100 border border-zinc-200 rounded-xl focus:outline-none focus:bg-white focus:border-zinc-900 text-zinc-900 font-medium"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="px-4 py-2.5 bg-zinc-950 hover:bg-amber-500 text-white hover:text-zinc-950 disabled:opacity-50 rounded-xl font-bold text-xs transition-colors cursor-pointer border-none flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gönder
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
