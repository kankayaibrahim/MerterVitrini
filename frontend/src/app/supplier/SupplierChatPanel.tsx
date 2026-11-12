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

function getConnectionPillProps(
  reconnecting: boolean,
  ready: boolean
): { badgeClass: string; dotClass: string; label: string } {
  if (reconnecting) {
    return {
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      dotClass: "bg-amber-500 animate-pulse",
      label: "Yeniden Bağlanıyor",
    };
  }
  if (ready) {
    return {
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotClass: "bg-emerald-500",
      label: "Canlı Sohbet Hazır",
    };
  }
  return {
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    dotClass: "bg-slate-400",
    label: "Yükleniyor",
  };
}

interface TeamManagementPanelProps {
  readonly teamMembers: readonly SupplierAgent[];
  readonly supplierUserId?: string;
  readonly newAgentName: string;
  readonly setNewAgentName: (v: string) => void;
  readonly newAgentTitle: string;
  readonly setNewAgentTitle: (v: string) => void;
  readonly newAgentLangs: string;
  readonly setNewAgentLangs: (v: string) => void;
  readonly newAgentEmail: string;
  readonly setNewAgentEmail: (v: string) => void;
  readonly newAgentPassword: string;
  readonly setNewAgentPassword: (v: string) => void;
  readonly teamSubmitting: boolean;
  readonly teamError: string;
  readonly onClose: () => void;
  readonly onCreateMember: (e: React.FormEvent) => void;
  readonly onDeleteMember: (memberId: string) => void;
}

function TeamManagementPanel({
  teamMembers,
  supplierUserId,
  newAgentName,
  setNewAgentName,
  newAgentTitle,
  setNewAgentTitle,
  newAgentLangs,
  setNewAgentLangs,
  newAgentEmail,
  setNewAgentEmail,
  newAgentPassword,
  setNewAgentPassword,
  teamSubmitting,
  teamError,
  onClose,
  onCreateMember,
  onDeleteMember,
}: TeamManagementPanelProps) {
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400">
          Firma Alt Kullanıcıları (Müşterilerin Ayrı Sohbet Edeceği Satış Temsilcileri)
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white bg-transparent border-none cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {teamMembers.map((m) => (
          <div
            key={m.id}
            className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex flex-col justify-between gap-2"
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
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                {m.job_title}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                {m.email}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/70">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                <Globe className="w-3 h-3 text-emerald-400" />
                {m.spoken_languages}
              </span>
              {m.id !== supplierUserId && (
                <button
                  type="button"
                  onClick={() => onDeleteMember(m.id)}
                  className="p-1 text-slate-400 hover:text-red-400 bg-transparent border-none cursor-pointer"
                  title="Alt Kullanıcıyı Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={onCreateMember}
        className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end"
      >
        <div>
          <label htmlFor="agent-name" className="block text-[10px] font-bold text-slate-400 mb-1">
            Temsilci Ad Soyad *
          </label>
          <input
            id="agent-name"
            type="text"
            required
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            placeholder="Örn: Elena Yılmaz"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
        </div>
        <div>
          <label htmlFor="agent-title" className="block text-[10px] font-bold text-slate-400 mb-1">
            Ünvan / Departman *
          </label>
          <input
            id="agent-title"
            type="text"
            required
            value={newAgentTitle}
            onChange={(e) => setNewAgentTitle(e.target.value)}
            placeholder="Örn: Rusya & BDT Satış"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
        </div>
        <div>
          <label htmlFor="agent-langs" className="block text-[10px] font-bold text-slate-400 mb-1">
            Konuştuğu Diller *
          </label>
          <input
            id="agent-langs"
            type="text"
            required
            value={newAgentLangs}
            onChange={(e) => setNewAgentLangs(e.target.value)}
            placeholder="Örn: TR, RU, EN"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
        </div>
        <div>
          <label htmlFor="agent-email" className="block text-[10px] font-bold text-slate-400 mb-1">
            Giriş E-Postası *
          </label>
          <input
            id="agent-email"
            type="email"
            required
            value={newAgentEmail}
            onChange={(e) => setNewAgentEmail(e.target.value)}
            placeholder="elena@firma.com"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
        </div>
        <div>
          <label htmlFor="agent-password" className="block text-[10px] font-bold text-slate-400 mb-1">
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
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={teamSubmitting}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg cursor-pointer border-none"
          >
            {teamSubmitting ? "Ekleniyor..." : "+ Alt Kullanıcı Ekle"}
          </button>
        </div>
      </form>
      {teamError && (
        <div className="text-xs text-red-400 font-semibold">{teamError}</div>
      )}
    </div>
  );
}

interface ChatMessageBubbleProps {
  readonly msg: ChatMessage;
}

function ChatMessageBubble({ msg }: ChatMessageBubbleProps) {
  const isMine = msg.sender_type === "supplier";
  const meta = msg.metadata || {};

  if (msg.message_type === "product_card") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 max-w-md shadow-2xs">
        <Image
          src={meta.image_url || "/placeholder.png"}
          alt={meta.title || "Ürün"}
          width={48}
          height={56}
          unoptimized
          className="w-12 h-14 object-cover rounded-lg border border-slate-100"
        />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-flex items-center gap-1">
            <Package className="w-3 h-3" /> Müşterinin İncelediği Ürün
          </span>
          <div className="font-bold text-xs text-slate-900 truncate mt-0.5">
            {meta.title}
          </div>
          <div className="text-[11px] text-slate-500">
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
    const totalOfferAmount = (meta.offered_unit_price || 0) * totalPieces;
    const isAccepted = meta.offer_status === "accepted";

    return (
      <div className="ml-auto max-w-md bg-slate-900 text-white rounded-2xl p-4 border border-emerald-500/40 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" /> Gönderilen Özel Fiyat Teklifi
          </span>
          {(meta.discount_percent || 0) > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500 text-white font-black text-[10px] rounded-full">
              %{meta.discount_percent?.toFixed(1)} İNDİRİM
            </span>
          )}
        </div>

        <div className="text-xs font-bold text-white">
          {meta.title} ({meta.custom_sku})
        </div>
        <div className="text-[11px] text-slate-300 mt-1">
          Miktar: <strong>{pkgs} Paket</strong> ({totalPieces} Adet) • Birim:{" "}
          <strong className="text-emerald-400">
            {meta.offered_unit_price?.toFixed(2)} {meta.currency}
          </strong>
        </div>
        <div className="text-xs font-black text-emerald-300 mt-1">
          Toplam Teklif: {totalOfferAmount.toFixed(2)} {meta.currency}
        </div>

        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-bold">
          {isAccepted ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Müşteri Teklifi Kabul Etti &amp; Sepete Ekledi
            </span>
          ) : (
            <span className="text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Müşteri Onayı Bekleniyor...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className="text-[10px] font-bold text-slate-400 mb-1 px-1">
        {msg.sender_name} •{" "}
        {new Date(msg.created_at).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
          isMine
            ? "bg-slate-900 text-white rounded-br-xs"
            : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

interface CustomOfferDrawerProps {
  readonly products: readonly SupplierProductRow[];
  readonly selectedProductId: string;
  readonly offerPackagesQty: number;
  readonly offerDiscountPercent: number;
  readonly offerCustomUnitPrice: string;
  readonly offerNote: string;
  readonly sending: boolean;
  readonly onSelectProduct: (pid: string) => void;
  readonly onChangePackagesQty: (qty: number) => void;
  readonly onChangeCustomUnitPrice: (val: string) => void;
  readonly onApplyDiscountPreset: (pct: number) => void;
  readonly onChangeOfferNote: (val: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
}

function CustomOfferDrawer({
  products,
  selectedProductId,
  offerPackagesQty,
  offerDiscountPercent,
  offerCustomUnitPrice,
  offerNote,
  sending,
  onSelectProduct,
  onChangePackagesQty,
  onChangeCustomUnitPrice,
  onApplyDiscountPreset,
  onChangeOfferNote,
  onClose,
  onSubmit,
}: CustomOfferDrawerProps) {
  const selectedProductObj = products.find((p) => p.id === selectedProductId);

  return (
    <form
      onSubmit={onSubmit}
      className="p-4 bg-slate-900 text-white border-b border-slate-800 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          Müşteriye Özel Toptan Fiyat Teklifi Kartı Oluştur
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white bg-transparent border-none cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label htmlFor="offer-product-select" className="block text-[11px] font-bold text-slate-300 mb-1">
            Teklif Verilecek Ürün
          </label>
          <select
            id="offer-product-select"
            value={selectedProductId}
            onChange={(e) => onSelectProduct(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.custom_sku} - {p.title} ({p.price} {p.currency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="offer-packages-qty" className="block text-[11px] font-bold text-slate-300 mb-1">
            Teklif Paket (Seri) Adedi
          </label>
          <input
            id="offer-packages-qty"
            type="number"
            min={1}
            value={offerPackagesQty}
            onChange={(e) => onChangePackagesQty(Number(e.target.value) || 1)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div>
          <label htmlFor="offer-unit-price" className="block text-[11px] font-bold text-slate-300 mb-1">
            Özel Teklif Birim Fiyatı ({selectedProductObj?.currency || "TRY"})
          </label>
          <input
            id="offer-unit-price"
            type="number"
            step="0.01"
            min={0.01}
            value={offerCustomUnitPrice}
            onChange={(e) => onChangeCustomUnitPrice(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-semibold">
            Hızlı İndirim Oranı:
          </span>
          {[5, 8, 10, 12, 15, 20].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onApplyDiscountPreset(pct)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                offerDiscountPercent === pct
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
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
            onChange={(e) => onChangeOfferNote(e.target.value)}
            placeholder="Teklif mesajı..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />
          <button
            type="submit"
            disabled={sending || !selectedProductId}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg cursor-pointer border-none shrink-0 disabled:opacity-50"
          >
            Teklifi Gönder
          </button>
        </div>
      </div>
    </form>
  );
}

interface ActiveConversationPaneProps {
  readonly activeRoom: ChatRoom | null;
  readonly showOfferModal: boolean;
  readonly products: readonly SupplierProductRow[];
  readonly selectedProductId: string;
  readonly offerPackagesQty: number;
  readonly offerDiscountPercent: number;
  readonly offerCustomUnitPrice: string;
  readonly offerNote: string;
  readonly messages: readonly ChatMessage[];
  readonly inputText: string;
  readonly sending: boolean;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly onToggleOfferModal: () => void;
  readonly onCloseOfferModal: () => void;
  readonly onSelectProduct: (pid: string) => void;
  readonly onChangePackagesQty: (qty: number) => void;
  readonly onChangeCustomUnitPrice: (val: string) => void;
  readonly onApplyDiscountPreset: (pct: number) => void;
  readonly onChangeOfferNote: (val: string) => void;
  readonly onSubmitCustomOffer: (e: React.FormEvent) => void;
  readonly onChangeInputText: (val: string) => void;
  readonly onSubmitText: (e: React.FormEvent) => void;
}

function ActiveConversationPane({
  activeRoom,
  showOfferModal,
  products,
  selectedProductId,
  offerPackagesQty,
  offerDiscountPercent,
  offerCustomUnitPrice,
  offerNote,
  messages,
  inputText,
  sending,
  messagesEndRef,
  onToggleOfferModal,
  onCloseOfferModal,
  onSelectProduct,
  onChangePackagesQty,
  onChangeCustomUnitPrice,
  onApplyDiscountPreset,
  onChangeOfferNote,
  onSubmitCustomOffer,
  onChangeInputText,
  onSubmitText,
}: ActiveConversationPaneProps) {
  if (!activeRoom) {
    return (
      <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h4 className="font-bold text-sm text-slate-800">
          Görüntülemek İçin Bir Müşteri Sohbeti Seçin
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Müşterilerinize anında yanıt verebilir ve tek tıkla sepete eklenebilir Özel Toptan Fiyat Teklifi Kartı gönderebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-extrabold text-sm text-slate-900">
              {activeRoom.customer_name}
            </h4>
            {activeRoom.customer_email_verified ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                ✓ Doğrulanmış Müşteri
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                Mail Onaysız
              </span>
            )}
            {activeRoom.supplier_user_name && (
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">
                Muhatap Temsilci: {activeRoom.supplier_user_name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {activeRoom.customer_email || activeRoom.customer_phone || "Aktif B2B Alıcı Oturumu"}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleOfferModal}
          className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-extrabold text-xs transition-all inline-flex items-center gap-2 cursor-pointer border-none shadow-xs"
        >
          <Gift className="w-4 h-4 text-emerald-400" />
          <span>Özel Fiyat Teklifi Gönder</span>
        </button>
      </div>

      {showOfferModal && (
        <CustomOfferDrawer
          products={products}
          selectedProductId={selectedProductId}
          offerPackagesQty={offerPackagesQty}
          offerDiscountPercent={offerDiscountPercent}
          offerCustomUnitPrice={offerCustomUnitPrice}
          offerNote={offerNote}
          sending={sending}
          onSelectProduct={onSelectProduct}
          onChangePackagesQty={onChangePackagesQty}
          onChangeCustomUnitPrice={onChangeCustomUnitPrice}
          onApplyDiscountPreset={onApplyDiscountPreset}
          onChangeOfferNote={onChangeOfferNote}
          onClose={onCloseOfferModal}
          onSubmit={onSubmitCustomOffer}
        />
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-3.5 max-h-[460px]">
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={onSubmitText}
        className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => onChangeInputText(e.target.value)}
          placeholder="Müşteriye yanıtınızı yazın..."
          className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900 text-slate-900 font-medium"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 rounded-xl font-bold text-xs transition-colors cursor-pointer border-none inline-flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Gönder</span>
        </button>
      </form>
    </>
  );
}

export default function SupplierChatPanel({
  brandId,
  supplierUserId,
  products,
  getToken,
  onUnreadTotalChange,
}: Readonly<SupplierChatPanelProps>) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [roomScope, setRoomScope] = useState<"mine" | "all">("all");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

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
  const onUnreadTotalChangeRef = useRef(onUnreadTotalChange);
  const activeRoomIdRef = useRef<string | null>(null);
  const wasWsConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onUnreadTotalChangeRef.current = onUnreadTotalChange;
  }, [onUnreadTotalChange]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id ?? null;
  }, [activeRoom]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  }, []);

  const loadSupplierRooms = useCallback(
    async (scopeOverride?: "mine" | "all") => {
      const token = getToken();
      if (!token) {
        setRoomsLoaded(true);
        return [];
      }
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
          onUnreadTotalChangeRef.current?.(totalUnread);
          return data;
        }
      } catch (err) {
        console.error("Failed to load supplier chat rooms:", err);
      } finally {
        setRoomsLoaded(true);
      }
      return [];
    },
    [getToken, roomScope]
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
    let cancelled = false;
    void (async () => {
      await loadTeamMembers();
      const list = await loadSupplierRooms();
      if (!cancelled && list.length > 0 && !activeRoomIdRef.current) {
        setActiveRoom(list[0]);
        await loadRoomMessages(list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTeamMembers, loadSupplierRooms, loadRoomMessages]);

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

  // Real-time Centrifuge subscription
  useEffect(() => {
    if (!brandId) return;
    const wsUrl = getCentrifugeWsUrl();
    const client = new Centrifuge(wsUrl, {
      token: `supplier_${supplierUserId || brandId}`,
    });

    client.on("connected", () => {
      wasWsConnectedRef.current = true;
      setWsConnected(true);
      setReconnecting(false);
    });

    client.on("disconnected", () => {
      setWsConnected(false);
      if (wasWsConnectedRef.current) {
        setReconnecting(true);
        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          setReconnecting(false);
        }, 2500);
      }
    });

    const handlePub = (ctx: PublicationContext) => {
      const env = ctx.data as CentrifugeEventEnvelope;
      if (!env?.event) return;

      if (env.event === "new_message") {
        const incoming = env.data as ChatMessage;
        if (incoming.room_id === activeRoom?.id) {
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );
          scrollToBottom();
        }
        void loadSupplierRooms();
      } else if (env.event === "offer_updated") {
        const updated = env.data as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        void loadSupplierRooms();
      } else if (env.event === "room_updated") {
        void loadSupplierRooms();
      }
    };

    const supplierSub = client.newSubscription(`chat:supplier#${brandId}`);
    supplierSub.on("publication", handlePub);
    supplierSub.subscribe();

    const agentSub = supplierUserId
      ? client.newSubscription(`chat:supplier_user#${supplierUserId}`)
      : null;
    if (agentSub) {
      agentSub.on("publication", handlePub);
      agentSub.subscribe();
    }

    const roomSub = activeRoom?.id
      ? client.newSubscription(`chat:room#${activeRoom.id}`)
      : null;
    if (roomSub) {
      roomSub.on("publication", handlePub);
      roomSub.subscribe();
    }

    client.connect();

    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (roomSub) roomSub.unsubscribe();
      if (agentSub) agentSub.unsubscribe();
      supplierSub.unsubscribe();
      client.disconnect();
    };
  }, [brandId, supplierUserId, activeRoom?.id, loadSupplierRooms, scrollToBottom]);

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
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
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
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
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

  const applyDiscountPreset = (pct: number) => {
    setOfferDiscountPercent(pct);
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      const calc = Number((prod.price * (1 - pct / 100)).toFixed(2));
      setOfferCustomUnitPrice(String(calc));
    }
  };

  const handleSelectOfferProduct = (pid: string) => {
    setSelectedProductId(pid);
    const prod = products.find((p) => p.id === pid);
    if (prod) {
      const calc = Number((prod.price * (1 - offerDiscountPercent / 100)).toFixed(2));
      setOfferCustomUnitPrice(String(calc));
    }
  };

  const pill = getConnectionPillProps(reconnecting, wsConnected || roomsLoaded);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Sub-User Team Management Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Satış Temsilcileri &amp; Alt Kullanıcılar ({teamMembers.length} Yetkili)
            </h3>
            <p className="text-xs text-slate-500">
              Müşteriler ürün sayfasında buradaki alt kullanıcılarınızdan istediği temsilciyi seçerek ayrı sohbet başlatabilir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTeamPanel((prev) => !prev)}
          className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer border-none inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>
            {showTeamPanel ? "Ekip Panelini Kapat" : "Alt Kullanıcıları Yönet / Temsilci Ekle"}
          </span>
        </button>
      </div>

      {showTeamPanel && (
        <TeamManagementPanel
          teamMembers={teamMembers}
          supplierUserId={supplierUserId}
          newAgentName={newAgentName}
          setNewAgentName={setNewAgentName}
          newAgentTitle={newAgentTitle}
          setNewAgentTitle={setNewAgentTitle}
          newAgentLangs={newAgentLangs}
          setNewAgentLangs={setNewAgentLangs}
          newAgentEmail={newAgentEmail}
          setNewAgentEmail={setNewAgentEmail}
          newAgentPassword={newAgentPassword}
          setNewAgentPassword={setNewAgentPassword}
          teamSubmitting={teamSubmitting}
          teamError={teamError}
          onClose={() => setShowTeamPanel(false)}
          onCreateMember={(e) => void handleCreateTeamMember(e)}
          onDeleteMember={(id) => void handleDeleteTeamMember(id)}
        />
      )}

      {/* Main Chat Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Left Sidebar: Customer Rooms */}
        <div className="lg:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-2.5 bg-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-800" />
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                  Müşteri Sohbetleri ({rooms.length})
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pill.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pill.dotClass}`} />
                <span>{pill.label}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setRoomScope("all");
                  void loadSupplierRooms("all");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border-none ${
                  roomScope === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "bg-transparent text-slate-500 hover:text-slate-900"
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
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "bg-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Bana Özel Sohbetler
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70">
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 leading-relaxed">
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
                        ? "bg-slate-100/90 border-l-4 border-l-slate-900"
                        : "bg-transparent hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {rm.customer_name}
                        </div>
                        {rm.supplier_user_name && (
                          <div className="text-[10px] font-bold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            Temsilci: {rm.supplier_user_name} ({rm.supplier_user_title})
                          </div>
                        )}
                        <div className="text-xs text-slate-500 truncate mt-1">
                          {rm.last_message_preview || "Yeni sohbet başlatıldı"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {new Date(rm.last_message_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {rm.unread_supplier_count > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[11px] rounded-full">
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
        <div className="lg:col-span-8 flex flex-col bg-slate-50/30">
          <ActiveConversationPane
            activeRoom={activeRoom}
            showOfferModal={showOfferModal}
            products={products}
            selectedProductId={selectedProductId}
            offerPackagesQty={offerPackagesQty}
            offerDiscountPercent={offerDiscountPercent}
            offerCustomUnitPrice={offerCustomUnitPrice}
            offerNote={offerNote}
            messages={messages}
            inputText={inputText}
            sending={sending}
            messagesEndRef={messagesEndRef}
            onToggleOfferModal={handleToggleOfferModal}
            onCloseOfferModal={() => setShowOfferModal(false)}
            onSelectProduct={handleSelectOfferProduct}
            onChangePackagesQty={setOfferPackagesQty}
            onChangeCustomUnitPrice={setOfferCustomUnitPrice}
            onApplyDiscountPreset={applyDiscountPreset}
            onChangeOfferNote={setOfferNote}
            onSubmitCustomOffer={(e) => void handleSendCustomOffer(e)}
            onChangeInputText={setInputText}
            onSubmitText={(e) => void handleSendText(e)}
          />
        </div>
      </div>
    </div>
  );
}
