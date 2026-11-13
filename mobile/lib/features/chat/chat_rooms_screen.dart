import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/chat.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../auth/auth_screen.dart';
import 'chat_conversation_screen.dart';

class ChatRoomsScreen extends StatefulWidget {
  final bool asSupplier;

  const ChatRoomsScreen({super.key, required this.asSupplier});

  @override
  State<ChatRoomsScreen> createState() => _ChatRoomsScreenState();
}

class _ChatRoomsScreenState extends State<ChatRoomsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ChatProvider>().loadRoomsForCurrentRole();
    });
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final rooms = widget.asSupplier ? chat.supplierRooms : chat.customerRooms;
    final dateFmt = DateFormat('HH:mm');

    return Container(
      color: AppColors.warmIvory,
      child: Column(
        children: [
          if (widget.asSupplier && session.isSupplierLoggedIn)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(color: AppColors.warmHairline),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _ScopeButton(
                            lang: lang,
                            label: UiText.pick(
                              lang,
                              tr: 'TÜM MESAJLAR',
                              en: 'ALL MESSAGES',
                              ru: 'ВСЕ СООБЩЕНИЯ',
                              ar: 'كل الرسائل',
                              de: 'ALLE NACHRICHTEN',
                              fr: 'TOUS LES MESSAGES',
                              pl: 'WSZYSTKIE',
                              bg: 'ВСИЧКИ',
                            ),
                            selected: chat.supplierScope == 'all',
                            onTap: () => chat.setSupplierScope('all'),
                          ),
                          const SizedBox(width: 8),
                          _ScopeButton(
                            lang: lang,
                            label: UiText.pick(
                              lang,
                              tr: 'BANA ATANANLAR',
                              en: 'ASSIGNED TO ME',
                              ru: 'МОИ ДИАЛОГИ',
                              ar: 'المُعيّنة لي',
                              de: 'MIR ZUGEWIESEN',
                              fr: 'ASSIGNÉS',
                              pl: 'PRZYPISANE',
                              bg: 'МОИТЕ',
                            ),
                            selected: chat.supplierScope == 'mine',
                            onTap: () => chat.setSupplierScope('mine'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _ConnectionStatusPill(
                    lang: lang,
                    connected: chat.isRealtimeConnected,
                    connectedLabel: UiText.pick(
                      lang,
                      tr: 'CANLI',
                      en: 'LIVE',
                      ru: 'ОНЛАЙН',
                      ar: 'مباشر',
                      de: 'LIVE',
                      fr: 'EN DIRECT',
                      pl: 'NA ŻYWO',
                      bg: 'НА ЖИВО',
                    ),
                    pendingLabel: UiText.pick(
                      lang,
                      tr: 'BAĞLANIYOR',
                      en: 'CONNECTING',
                      ru: 'ПОДКЛ.',
                      ar: 'جاري الاتصال',
                      de: 'VERBINDEN',
                      fr: 'CONNEXION',
                      pl: 'ŁĄCZENIE',
                      bg: 'СВЪРЗВАНЕ',
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(color: AppColors.warmHairline),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      UiText.pick(
                        lang,
                        tr: 'B2B ÜRETİCİ PAZARLIK HATTI',
                        en: 'B2B MANUFACTURER DIRECT DESK',
                        ru: 'ПРЯМАЯ ЛИНИЯ С ФАБРИКОЙ',
                        ar: 'خط التفاوض المباشر مع المصنع',
                        de: 'B2B HERSTELLER-DIREKTKONTAKT',
                        fr: 'LIGNE DIRECTE FABRICANT B2B',
                        pl: 'BEZPOŚREDNIA LINIA B2B',
                        bg: 'ДИРЕКТНА B2B ЛИНИЯ',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.3),
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _ConnectionStatusPill(
                    lang: lang,
                    connected: chat.isRealtimeConnected,
                    connectedLabel: UiText.pick(
                      lang,
                      tr: 'AKTİF',
                      en: 'ACTIVE',
                      ru: 'АКТИВЕН',
                      ar: 'نشط',
                      de: 'AKTIV',
                      fr: 'ACTIF',
                      pl: 'AKTYWNY',
                      bg: 'АКТИВЕН',
                    ),
                    pendingLabel: UiText.pick(
                      lang,
                      tr: 'HAZIR',
                      en: 'READY',
                      ru: 'ГОТОВ',
                      ar: 'جاهز',
                      de: 'BEREIT',
                      fr: 'PRÊT',
                      pl: 'GOTOWY',
                      bg: 'ГОТОВ',
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: !widget.asSupplier && !session.isCustomerLoggedIn
                ? Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 24,
                      ),
                      child: EditorialCard(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 68,
                              height: 68,
                              decoration: BoxDecoration(
                                color: AppColors.warmSurface,
                                borderRadius: BorderRadius.circular(
                                  AppColors.radiusMd,
                                ),
                                border: Border.all(
                                  color: AppColors.warmHairline,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.lock_outline_rounded,
                                size: 28,
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              UiText.pick(
                                lang,
                                tr: 'CANLI SOHBET ÜYELERE ÖZELDİR',
                                en: 'LIVE CHAT IS MEMBERS ONLY',
                                ru: 'ЖИВОЙ ЧАТ ТОЛЬКО ДЛЯ УЧАСТНИКОВ',
                                ar: 'المحادثة المباشرة للأعضاء فقط',
                                de: 'LIVE-CHAT NUR FÜR MITGLIEDER',
                                fr: 'CHAT EN DIRECT RÉSERVÉ AUX MEMBRES',
                                pl: 'CZAT NA ŻYWO TYLKO DLA CZŁONKÓW',
                                bg: 'ЧАТЪТ НА ЖИВО Е САМО ЗА ЧЛЕНОВЕ',
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: AppStrings.letterSpacing(
                                  lang,
                                  1.4,
                                ),
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              UiText.pick(
                                lang,
                                tr: 'Üretici temsilcileriyle canlı B2B pazarlık yapmak, stok sormak ve özel seri fiyat teklifi almak için üye girişi yapmanız gerekmektedir.',
                                en: 'Sign in to negotiate wholesale series directly with manufacturers, check live stock, and receive custom price quotes.',
                                ru: 'Войдите, чтобы вести прямые B2B-переговоры с производителями, уточнять наличие и получать индивидуальные оптовые цены.',
                                ar: 'سجّل الدخول للتفاوض مباشرة مع المصانع والتحقق من المخزون والحصول على عروض أسعار جملة مخصصة.',
                                de: 'Melden Sie sich an, um direkt mit Herstellern zu verhandeln, Bestände zu prüfen und individuelle Serienpreise zu erhalten.',
                                fr: 'Connectez-vous pour négocier directement avec les fabricants, vérifier les stocks et obtenir des devis B2B.',
                                pl: 'Zaloguj się, aby negocjować bezpośrednio z producentami, sprawdzać stany i otrzymywać oferty hurtowe.',
                                bg: 'Влезте, за да преговаряте директно с производители, да проверявате наличности и да получавате оферти на едро.',
                              ),
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.sonicSilver,
                                height: 1.45,
                              ),
                            ),
                            const SizedBox(height: 20),
                            SizedBox(
                              width: double.infinity,
                              height: 46,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.obsidian,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusSm,
                                    ),
                                  ),
                                ),
                                onPressed: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => const AuthScreen(),
                                    ),
                                  );
                                },
                                icon: const Icon(Icons.login_rounded, size: 17),
                                label: Text(
                                  UiText.pick(
                                    lang,
                                    tr: 'ÜYE GİRİŞİ YAP / KAYIT OL',
                                    en: 'SIGN IN / REGISTER',
                                    ru: 'ВОЙТИ / РЕГИСТРАЦИЯ',
                                    ar: 'تسجيل الدخول / إنشاء حساب',
                                    de: 'ANMELDEN / REGISTRIEREN',
                                    fr: 'CONNEXION / INSCRIPTION',
                                    pl: 'ZALOGUJ / ZAREJESTRUJ',
                                    bg: 'ВХОД / РЕГИСТРАЦИЯ',
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: AppStrings.letterSpacing(
                                      lang,
                                      1.0,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                : RefreshIndicator(
                    color: AppColors.obsidian,
                    onRefresh: chat.loadRoomsForCurrentRole,
                    child: chat.loadingRooms && rooms.isEmpty
                        ? const Center(
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.obsidian,
                            ),
                          )
                        : rooms.isEmpty
                            ? ListView(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 56,
                                ),
                                children: [
                                  EditorialEmptyState(
                                    icon: Icons.forum_outlined,
                                    title: UiText.pick(
                                      lang,
                                      tr: 'HENÜZ AKTİF GÖRÜŞME YOK',
                                      en: 'NO ACTIVE CONVERSATIONS YET',
                                      ru: 'ПОКА НЕТ АКТИВНЫХ ЧАТОВ',
                                      ar: 'لا توجد محادثات نشطة بعد',
                                      de: 'NOCH KEINE AKTIVEN CHATS',
                                      fr: 'AUCUNE CONVERSATION ACTIVE',
                                      pl: 'BRAK AKTYWNYCH ROZMÓW',
                                      bg: 'НЯМА АКТИВНИ РАЗГОВОРИ',
                                    ),
                                    subtitle: widget.asSupplier
                                        ? UiText.pick(
                                            lang,
                                            tr: 'Müşterilerden gelen B2B seri fiyat ve stok soruları burada listelenir.',
                                            en: 'Incoming wholesale price and stock inquiries from buyers appear here.',
                                            ru: 'Здесь отображаются входящие оптовые запросы по ценам и остаткам от покупателей.',
                                            ar: 'ستظهر هنا استفسارات المشترين حول أسعار الجملة والمخزون.',
                                            de: 'Eingehende B2B-Preis- und Bestandsanfragen von Käufern erscheinen hier.',
                                            fr: 'Les demandes de prix de gros et de stock des acheteurs apparaissent ici.',
                                            pl: 'Tutaj pojawią się zapytania B2B od kupujących o ceny i stany.',
                                            bg: 'Тук ще се появяват B2B запитванията от купувачи.',
                                          )
                                        : UiText.pick(
                                            lang,
                                            tr: 'Ürün detay veya üretici sayfasından doğrudan üretici temsilcisine bağlanabilirsiniz.',
                                            en: 'Connect directly with a manufacturer representative from any product or brand page.',
                                            ru: 'Свяжитесь с представителем фабрики напрямую со страницы товара или бренда.',
                                            ar: 'يمكنك التواصل مباشرة مع ممثل المصنع من صفحة المنتج أو العلامة التجارية.',
                                            de: 'Verbinden Sie sich direkt auf einer Produkt- oder Herstellerseite mit dem Ansprechpartner.',
                                            fr: 'Contactez directement un représentant depuis n\'importe quelle fiche produit ou marque.',
                                            pl: 'Połącz się z przedstawicielem producenta ze strony produktu lub marki.',
                                            bg: 'Свържете се директно с представител на производителя от страницата на продукта.',
                                          ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.all(14),
                                itemCount: rooms.length,
                                separatorBuilder: (context, index) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final room = rooms[index];
                                  return _RoomTile(
                                    lang: lang,
                                    room: room,
                                    asSupplier: widget.asSupplier,
                                    timeLabel: dateFmt.format(
                                      room.lastMessageAt.toLocal(),
                                    ),
                                    onTap: () async {
                                      await Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) =>
                                              ChatConversationScreen(
                                            room: room,
                                            asSupplier: widget.asSupplier,
                                          ),
                                        ),
                                      );
                                      if (context.mounted) {
                                        context
                                            .read<ChatProvider>()
                                            .loadRoomsForCurrentRole();
                                      }
                                    },
                                  );
                                },
                              ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ConnectionStatusPill extends StatelessWidget {
  final String lang;
  final bool connected;
  final String connectedLabel;
  final String pendingLabel;

  const _ConnectionStatusPill({
    required this.lang,
    required this.connected,
    required this.connectedLabel,
    required this.pendingLabel,
  });

  @override
  Widget build(BuildContext context) {
    final dotColor = connected ? AppColors.emerald : AppColors.champagneGold;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.warmSurface,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: AppColors.warmHairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            connected ? connectedLabel : pendingLabel,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              letterSpacing: AppStrings.letterSpacing(lang, 0.8),
              color: connected ? AppColors.emerald : AppColors.editorialGold,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScopeButton extends StatelessWidget {
  final String lang;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ScopeButton({
    required this.lang,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.obsidian : AppColors.warmSurface,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            border: Border.all(
              color: selected ? AppColors.obsidian : AppColors.warmHairline,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: AppStrings.letterSpacing(lang, 0.8),
              color: selected ? Colors.white : AppColors.onyx,
            ),
          ),
        ),
      ),
    );
  }
}

class _RoomTile extends StatelessWidget {
  final String lang;
  final ChatRoom room;
  final bool asSupplier;
  final String timeLabel;
  final VoidCallback onTap;

  const _RoomTile({
    required this.lang,
    required this.room,
    required this.asSupplier,
    required this.timeLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final unread =
        asSupplier ? room.unreadSupplierCount : room.unreadCustomerCount;
    final title = asSupplier
        ? room.customerName
        : (room.supplierUserName.isNotEmpty
            ? '${room.supplierName} • ${room.supplierUserName}'
            : room.supplierName);
    final repPrefix = UiText.pick(
      lang,
      tr: 'TEMSİLCİ',
      en: 'AGENT',
      ru: 'МЕНЕДЖЕР',
      ar: 'الممثل',
      de: 'BERATER',
      fr: 'AGENT',
      pl: 'OPIEKUN',
      bg: 'ПРЕДСТАВИТЕЛ',
    );
    final subtitleBadge = asSupplier
        ? (room.supplierUserName.isNotEmpty
            ? '$repPrefix: ${AppStrings.upper(room.supplierUserName, lang)}'
            : UiText.pick(
                lang,
                tr: 'GENEL MAĞAZA HATTI',
                en: 'MAIN STORE DESK',
                ru: 'ОБЩАЯ ЛИНИЯ',
                ar: 'الخط العام للمتجر',
                de: 'HAUPTKANAL',
                fr: 'LIGNE PRINCIPALE',
                pl: 'KANAŁ GŁÓWNY',
                bg: 'ОСНОВЕН КАНАЛ',
              ))
        : (room.supplierUserLanguages.isNotEmpty
            ? '${AppStrings.upper(room.supplierUserTitle, lang)} (${AppStrings.upper(room.supplierUserLanguages, lang)})'
            : UiText.pick(
                lang,
                tr: 'DOĞRUDAN ÜRETİCİ HATTI',
                en: 'DIRECT MANUFACTURER DESK',
                ru: 'ПРЯМОЙ КОНТАКТ ФАБРИКИ',
                ar: 'خط المصنع المباشر',
                de: 'DIREKTKONTAKT HERSTELLER',
                fr: 'LIGNE DIRECTE FABRICANT',
                pl: 'BEZPOŚREDNI PRODUCENT',
                bg: 'ДИРЕКТЕН ПРОИЗВОДИТЕЛ',
              ));

    final darkCrest = unread > 0 || asSupplier;

    return EditorialCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      borderColor: unread > 0
          ? AppColors.luxuryBronze.withValues(alpha: 0.55)
          : AppColors.warmHairline,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: darkCrest ? AppColors.obsidian : AppColors.warmSurface,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
              border: Border.all(
                color: darkCrest
                    ? AppColors.champagneGold.withValues(alpha: 0.65)
                    : AppColors.warmHairline,
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              title.isNotEmpty
                  ? AppStrings.upper(title.characters.first, lang)
                  : 'M',
              style: TextStyle(
                fontFamily: AppColors.serifFontFamily,
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: darkCrest ? Colors.white : AppColors.obsidian,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight:
                              unread > 0 ? FontWeight.w800 : FontWeight.w700,
                          fontSize: 14,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      timeLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.sonicSilver,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  subtitleBadge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: AppStrings.letterSpacing(lang, 0.7),
                    color: AppColors.editorialGold,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        room.lastMessagePreview.isEmpty
                            ? UiText.pick(
                                lang,
                                tr: 'Görüşme başlatıldı',
                                en: 'Conversation started',
                                ru: 'Диалог начат',
                                ar: 'بدأت المحادثة',
                                de: 'Gespräch gestartet',
                                fr: 'Conversation démarrée',
                                pl: 'Rozmowa rozpoczęta',
                                bg: 'Разговорът е започнат',
                              )
                            : room.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: unread > 0
                              ? AppColors.obsidian
                              : AppColors.sonicSilver,
                          fontWeight:
                              unread > 0 ? FontWeight.w700 : FontWeight.normal,
                        ),
                      ),
                    ),
                    if (unread > 0)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.obsidian,
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusSm,
                          ),
                        ),
                        child: Text(
                          '$unread',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
