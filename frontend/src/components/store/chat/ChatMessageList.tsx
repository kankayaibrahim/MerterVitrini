"use client";

import React from "react";
import Image from "next/image";
import { MessageSquare, Package } from "lucide-react";
import {
  CHAT_LOCALE_BY_LANG,
  ChatMessage,
  ChatRoom,
  resolveChatLang,
} from "@/types/chat";
import { pickLangText, SupportedLangCode, t } from "@/app/i18n";
import { convertPrice, ExchangeRate } from "@/app/utils";
import { ChatOfferCard } from "./ChatOfferCard";

interface MessageListTexts {
  myChatsHeader: (count: number) => string;
  noChatsYet: string;
  clickToViewChat: string;
  productFallbackAlt: string;
  interestedProductBadge: string;
  youSender: string;
  chatPhotoAlt: string;
  loadingHistory: string;
  salesRepFallback: string;
  startChatWithRep: (name: string, title: string) => string;
  startChatGeneric: string;
  emptyChatHint: string;
  todayLabel: string;
  yesterdayLabel: string;
}

const MESSAGE_LIST_TEXTS: Record<SupportedLangCode, MessageListTexts> = {
  tr: {
    myChatsHeader: (c) => `Tedarikçi & Temsilci Sohbetlerim (${c})`,
    noChatsYet: "Henüz başlatılmış bir tedarikçi sohbetiniz bulunmuyor.",
    clickToViewChat: "Sohbeti görüntülemek için tıklayın",
    productFallbackAlt: "Ürün",
    interestedProductBadge: "İlgilenilen Ürün",
    youSender: "Siz",
    chatPhotoAlt: "Sohbet fotoğrafı",
    loadingHistory: "Sohbet geçmişi yükleniyor...",
    salesRepFallback: "Satış Temsilcisi",
    startChatWithRep: (n, ttl) => `${n} (${ttl}) ile doğrudan sohbete başlayın!`,
    startChatGeneric: "Tedarikçi ile doğrudan sohbete başlayın!",
    emptyChatHint: "Stok durumu, renk/seri dağılımı veya yüksek adetli alımlarınız için özel fiyat teklifi isteyebilirsiniz.",
    todayLabel: "Bugün",
    yesterdayLabel: "Dün",
  },
  en: {
    myChatsHeader: (c) => `My Supplier & Agent Chats (${c})`,
    noChatsYet: "You do not have any active supplier conversations yet.",
    clickToViewChat: "Click to view conversation",
    productFallbackAlt: "Product",
    interestedProductBadge: "Selected Product",
    youSender: "You",
    chatPhotoAlt: "Chat attachment",
    loadingHistory: "Loading chat history...",
    salesRepFallback: "Sales Representative",
    startChatWithRep: (n, ttl) => `Start chatting directly with ${n} (${ttl})!`,
    startChatGeneric: "Start chatting directly with the supplier!",
    emptyChatHint: "Ask about stock availability, color/pack breakdown, or request a custom B2B bulk price offer.",
    todayLabel: "Today",
    yesterdayLabel: "Yesterday",
  },
  ru: {
    myChatsHeader: (c) => `Мои чаты с поставщиками (${c})`,
    noChatsYet: "У вас пока нет начатых диалогов с поставщиками.",
    clickToViewChat: "Нажмите, чтобы открыть чат",
    productFallbackAlt: "Товар",
    interestedProductBadge: "Выбранный товар",
    youSender: "Вы",
    chatPhotoAlt: "Фото из чата",
    loadingHistory: "Загрузка истории чата...",
    salesRepFallback: "Менеджер по продажам",
    startChatWithRep: (n, ttl) => `Начните прямой чат с ${n} (${ttl})!`,
    startChatGeneric: "Начните прямой чат с поставщиком!",
    emptyChatHint: "Уточните наличие на складе, цвета и размерный ряд или запросите индивидуальное оптовое предложение.",
    todayLabel: "Сегодня",
    yesterdayLabel: "Вчера",
  },
  ar: {
    myChatsHeader: (c) => `محادثاتي مع الموردين (${c})`,
    noChatsYet: "لا توجد لديك محادثات نشطة مع الموردين بعد.",
    clickToViewChat: "انقر لعرض المحادثة",
    productFallbackAlt: "منتج",
    interestedProductBadge: "المنتج المختار",
    youSender: "أنت",
    chatPhotoAlt: "صورة المحادثة",
    loadingHistory: "جاري تحميل سجل المحادثة...",
    salesRepFallback: "ممثل المبيعات",
    startChatWithRep: (n, ttl) => `ابدأ المحادثة المباشرة مع ${n} (${ttl})!`,
    startChatGeneric: "ابدأ المحادثة المباشرة مع المورد!",
    emptyChatHint: "يمكنك الاستفسار عن توفر المخزون وتوزيع الألوان والمقاسات أو طلب عرض سعر خاص للكميات الكبيرة.",
    todayLabel: "اليوم",
    yesterdayLabel: "أمس",
  },
  de: {
    myChatsHeader: (c) => `Meine Lieferanten-Chats (${c})`,
    noChatsYet: "Sie haben noch keine aktiven Lieferanten-Chats.",
    clickToViewChat: "Klicken, um den Chat zu öffnen",
    productFallbackAlt: "Produkt",
    interestedProductBadge: "Angefragtes Produkt",
    youSender: "Sie",
    chatPhotoAlt: "Chat-Foto",
    loadingHistory: "Chatverlauf wird geladen...",
    salesRepFallback: "Vertriebsmitarbeiter",
    startChatWithRep: (n, ttl) => `Starten Sie den Direktchat mit ${n} (${ttl})!`,
    startChatGeneric: "Starten Sie den Direktchat mit dem Lieferanten!",
    emptyChatHint: "Fragen Sie nach Lagerbestand, Farb-/Größenverteilung oder fordern Sie ein individuelles B2B-Mengenangebot an.",
    todayLabel: "Heute",
    yesterdayLabel: "Gestern",
  },
  fr: {
    myChatsHeader: (c) => `Mes discussions fournisseurs (${c})`,
    noChatsYet: "Vous n'avez pas encore de discussion fournisseur active.",
    clickToViewChat: "Cliquez pour voir la discussion",
    productFallbackAlt: "Produit",
    interestedProductBadge: "Produit concerné",
    youSender: "Vous",
    chatPhotoAlt: "Photo du chat",
    loadingHistory: "Chargement de l'historique...",
    salesRepFallback: "Conseiller commercial",
    startChatWithRep: (n, ttl) => `Démarrez une discussion directe avec ${n} (${ttl}) !`,
    startChatGeneric: "Démarrez une discussion directe avec le fournisseur !",
    emptyChatHint: "Demandez la disponibilité du stock, la répartition tailles/couleurs ou une offre de prix B2B personnalisée.",
    todayLabel: "Aujourd'hui",
    yesterdayLabel: "Hier",
  },
  pl: {
    myChatsHeader: (c) => `Moje czaty z dostawcami (${c})`,
    noChatsYet: "Nie masz jeszcze rozpoczętych rozmów z dostawcami.",
    clickToViewChat: "Kliknij, aby zobaczyć rozmowę",
    productFallbackAlt: "Produkt",
    interestedProductBadge: "Wybrany produkt",
    youSender: "Ty",
    chatPhotoAlt: "Zdjęcie z czatu",
    loadingHistory: "Ładowanie historii czatu...",
    salesRepFallback: "Przedstawiciel handlowy",
    startChatWithRep: (n, ttl) => `Rozpocznij bezpośredni czat z ${n} (${ttl})!`,
    startChatGeneric: "Rozpocznij bezpośredni czat z dostawcą!",
    emptyChatHint: "Zapytaj o stan magazynowy, kolory i rozmiary w pakiecie lub poproś o indywidualną wycenę hurtową B2B.",
    todayLabel: "Dzisiaj",
    yesterdayLabel: "Wczoraj",
  },
  bg: {
    myChatsHeader: (c) => `Моите чатове с доставчици (${c})`,
    noChatsYet: "Все още нямате започнати разговори с доставчици.",
    clickToViewChat: "Кликнете за преглед на чата",
    productFallbackAlt: "Продукт",
    interestedProductBadge: "Избран продукт",
    youSender: "Вие",
    chatPhotoAlt: "Снимка в чата",
    loadingHistory: "Зареждане на историята на чата...",
    salesRepFallback: "Търговски представител",
    startChatWithRep: (n, ttl) => `Започнете директен чат с ${n} (${ttl})!`,
    startChatGeneric: "Започнете директен чат с доставчика!",
    emptyChatHint: "Попитайте за наличност, цветове и размери в серията или поискайте специална B2B оферта за количества.",
    todayLabel: "Днес",
    yesterdayLabel: "Вчера",
  },
};

function getMessageDayKey(isoDate: string): string {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) {
    return "";
  }
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

function formatMessageDateDivider(isoDate: string, lang: SupportedLangCode): string {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) {
    return "";
  }
  const txt = pickLangText(lang, MESSAGE_LIST_TEXTS);
  const locale = pickLangText(lang, CHAT_LOCALE_BY_LANG);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
  const msgKey = getMessageDayKey(isoDate);

  if (msgKey === todayKey) {
    return txt.todayLabel;
  }
  if (msgKey === yesterdayKey) {
    return txt.yesterdayLabel;
  }
  return dt.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function RoomListView({
  rooms,
  onSelectRoom,
  lang,
}: {
  readonly rooms: readonly ChatRoom[];
  readonly onSelectRoom: (room: ChatRoom) => void;
  readonly lang?: string;
}) {
  const effectiveLang = resolveChatLang(lang);
  const txt = pickLangText(effectiveLang, MESSAGE_LIST_TEXTS);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
      <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">
        {txt.myChatsHeader(rooms.length)}
      </h4>
      {rooms.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          {txt.noChatsYet}
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
                {rm.last_message_preview || txt.clickToViewChat}
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
  lang,
}: {
  readonly msg: ChatMessage;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly acceptingId: string | null;
  readonly onAcceptOffer: (msg: ChatMessage) => void;
  readonly lang: SupportedLangCode;
}) {
  const isMine = msg.sender_type === "customer";
  const meta = msg.metadata || {};
  const txt = pickLangText(lang, MESSAGE_LIST_TEXTS);
  const locale = pickLangText(lang, CHAT_LOCALE_BY_LANG);
  const pieceLabel = t("piece", lang);
  const pkgLabel = t("package", lang);

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
          alt={meta.title || txt.productFallbackAlt}
          width={56}
          height={64}
          unoptimized
          className="w-14 h-16 object-cover rounded-lg border border-slate-100 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
            <Package className="w-3 h-3" /> {txt.interestedProductBadge}
          </span>
          <div className="font-bold text-xs text-slate-900 truncate mt-1">
            {meta.title}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            SKU: <strong className="text-slate-700">{meta.custom_sku}</strong> •{" "}
            {meta.units_per_package || 1} {pieceLabel}/{pkgLabel}
          </div>
          <div className="text-xs font-extrabold text-salmon-pink mt-0.5">
            {convertedUnitPrice.toFixed(2)} {displayCurrency} / {pieceLabel}
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
        lang={lang}
      />
    );
  }

  const attachmentUrl = meta.image_url;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className="text-[10px] font-bold text-slate-400 mb-1 px-1">
        {isMine ? txt.youSender : msg.sender_name} •{" "}
        {new Date(msg.created_at).toLocaleTimeString(locale, {
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
            alt={txt.chatPhotoAlt}
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
  lang,
}: {
  readonly loading: boolean;
  readonly messages: readonly ChatMessage[];
  readonly activeRoom: ChatRoom;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly acceptingId: string | null;
  readonly onAcceptOffer: (msg: ChatMessage) => void;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  readonly lang?: string;
}) {
  const effectiveLang = resolveChatLang(lang);
  const txt = pickLangText(effectiveLang, MESSAGE_LIST_TEXTS);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 flex items-center justify-center">
        <div className="text-center py-12 text-xs text-slate-400 font-semibold">
          {txt.loadingHistory}
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    const emptyHeader = activeRoom.supplier_user_name
      ? txt.startChatWithRep(
          activeRoom.supplier_user_name,
          activeRoom.supplier_user_title || txt.salesRepFallback
        )
      : txt.startChatGeneric;

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 flex items-center justify-center">
        <div className="text-center py-12 px-4">
          <MessageSquare className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-80" />
          <p className="text-xs font-bold text-slate-700">{emptyHeader}</p>
          <p className="text-[11px] text-slate-500 mt-1">{txt.emptyChatHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
      {messages.map((msg, idx) => {
        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const showDateDivider =
          !prevMsg || getMessageDayKey(prevMsg.created_at) !== getMessageDayKey(msg.created_at);
        const dividerText = showDateDivider
          ? formatMessageDateDivider(msg.created_at, effectiveLang)
          : "";

        return (
          <React.Fragment key={msg.id}>
            {dividerText && (
              <div className="flex items-center justify-center my-2">
                <span className="px-3 py-0.5 rounded-full bg-slate-200/75 text-slate-600 text-[10px] font-bold tracking-wide">
                  {dividerText}
                </span>
              </div>
            )}
            <ChatMessageItem
              msg={msg}
              displayCurrency={displayCurrency}
              exchangeRates={exchangeRates}
              acceptingId={acceptingId}
              onAcceptOffer={onAcceptOffer}
              lang={effectiveLang}
            />
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

