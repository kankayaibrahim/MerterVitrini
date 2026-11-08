"use client";

import React from "react";
import Image from "next/image";
import { MessageSquare, Package } from "lucide-react";
import { ChatMessage, ChatRoom } from "@/types/chat";
import { convertPrice, ExchangeRate } from "@/app/utils";
import { ChatOfferCard } from "./ChatOfferCard";

export function RoomListView({
  rooms,
  onSelectRoom,
}: {
  readonly rooms: readonly ChatRoom[];
  readonly onSelectRoom: (room: ChatRoom) => void;
}) {
  return (
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
            onClick={() => onSelectRoom(rm)}
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
                  {rm.supplier_user_languages
                    ? `(${rm.supplier_user_languages})`
                    : ""}
                </div>
              )}
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {rm.last_message_preview ||
                  "Sohbeti görüntülemek için tıklayın"}
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
  );
}

function ChatMessageItem({
  msg,
  displayCurrency,
  exchangeRates,
  acceptingId,
  onAcceptOffer,
}: {
  readonly msg: ChatMessage;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly acceptingId: string | null;
  readonly onAcceptOffer: (msg: ChatMessage) => void;
}) {
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
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-3">
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
    return (
      <ChatOfferCard
        msg={msg}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        acceptingId={acceptingId}
        onAcceptOffer={onAcceptOffer}
      />
    );
  }

  const attachmentUrl = meta.image_url;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
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
        {attachmentUrl && (
          <Image
            src={attachmentUrl}
            alt="Sohbet fotoğrafı"
            width={220}
            height={260}
            unoptimized
            className="w-full max-w-[220px] h-auto object-cover rounded-xl mb-2"
          />
        )}
        {msg.content}
      </div>
    </div>
  );
}

export function ActiveRoomMessages({
  loading,
  messages,
  activeRoom,
  displayCurrency,
  exchangeRates,
  acceptingId,
  onAcceptOffer,
  messagesEndRef,
}: {
  readonly loading: boolean;
  readonly messages: readonly ChatMessage[];
  readonly activeRoom: ChatRoom;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly acceptingId: string | null;
  readonly onAcceptOffer: (msg: ChatMessage) => void;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 flex items-center justify-center">
        <div className="text-center py-12 text-xs text-slate-400 font-semibold">
          Sohbet geçmişi yükleniyor...
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 flex items-center justify-center">
        <div className="text-center py-12 px-4">
          <MessageSquare className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-80" />
          <p className="text-xs font-bold text-slate-700">
            {activeRoom.supplier_user_name
              ? `${activeRoom.supplier_user_name} (${activeRoom.supplier_user_title || "Satış Temsilcisi"}) ile doğrudan sohbete başlayın!`
              : "Tedarikçi ile doğrudan sohbete başlayın!"}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Stok durumu, renk/seri dağılımı veya yüksek adetli alımlarınız için
            özel fiyat teklifi isteyebilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
      {messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          msg={msg}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          acceptingId={acceptingId}
          onAcceptOffer={onAcceptOffer}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

