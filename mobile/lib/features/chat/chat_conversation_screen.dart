import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/chat.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';
import '../supplier/camera_studio_screen.dart';

class ChatConversationScreen extends StatefulWidget {
  final ChatRoom room;
  final bool asSupplier;

  const ChatConversationScreen({
    super.key,
    required this.room,
    required this.asSupplier,
  });

  @override
  State<ChatConversationScreen> createState() => _ChatConversationScreenState();
}

class _ChatConversationScreenState extends State<ChatConversationScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();
  ChatProvider? _chatRef;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      _chatRef = context.read<ChatProvider>();
      await _chatRef!.openRoom(widget.room.id);
      _scrollToBottom();
    });
  }

  @override
  void dispose() {
    _chatRef?.closeActiveRoom();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendText() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    _msgCtrl.clear();
    try {
      await context.read<ChatProvider>().sendTextMessage(widget.room.id, text);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _captureAndSendCameraPhoto() async {
    final shots = await Navigator.of(context).push<List<String>>(
      MaterialPageRoute<List<String>>(
        builder: (_) =>
            const CameraStudioScreen(allowMultiple: false, maxPhotos: 1),
      ),
    );
    if (shots == null || shots.isEmpty || !mounted) return;
    try {
      await context
          .read<ChatProvider>()
          .sendPhotoMessage(widget.room.id, shots.first);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _pickAndSendGalleryPhoto() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 86,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (picked == null || !mounted) return;
    try {
      await context
          .read<ChatProvider>()
          .sendPhotoMessage(widget.room.id, picked.path);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _openSendCustomOfferModal() async {
    final supProv = context.read<SupplierProvider>();
    if (supProv.products.isEmpty) {
      await supProv.loadProducts(status: 'active');
    }
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => _SupplierCustomOfferSheet(
        roomId: widget.room.id,
        initialProductId: widget.room.initialProductId,
      ),
    );
    _scrollToBottom();
  }

  Future<void> _acceptOffer(ChatMessage msg) async {
    final lang = context.read<SessionProvider>().languageCode;
    try {
      final chat = context.read<ChatProvider>();
      final cart = context.read<CartProvider>();
      final updated = await chat.acceptOfferAsCustomer(msg.id);
      final meta = updated.metadata;
      await cart.applyAcceptedOfferLocallyIfGuest(
        productId: meta.productId,
        title: meta.title,
        customSku: meta.customSku,
        color: meta.color,
        imageUrl: meta.imageUrl,
        slug: meta.slug,
        unitsPerPackage: meta.unitsPerPackage,
        packagesQty: meta.packagesQty,
        offeredUnitPrice: meta.offeredUnitPrice,
        currency: meta.currency,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              UiText.pick(
                lang,
                tr: 'Özel fiyat teklifi kabul edildi ve sepetinize eklendi!',
                en: 'Custom quote accepted and added to your cart!',
                ru: 'Спецпредложение принято и добавлено в корзину!',
                ar: 'تم قبول العرض الخاص وإضافته إلى سلتك!',
                de: 'Sonderangebot angenommen und zum Warenkorb hinzugefügt!',
                fr: 'Offre spéciale acceptée et ajoutée au panier !',
                pl: 'Oferta specjalna zaakceptowana i dodana do koszyka!',
                bg: 'Специалната оферта е приета и добавена в количката!',
              ),
            ),
            backgroundColor: AppColors.emerald,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final lang = context.watch<SessionProvider>().languageCode;
    final messages = chat.activeMessages;
    final headerTitle = widget.asSupplier
        ? widget.room.customerName
        : widget.room.supplierName;
    final headerSub = widget.asSupplier
        ? (widget.room.customerPhone.isNotEmpty
            ? widget.room.customerPhone
            : UiText.pick(
                lang,
                tr: 'B2B Alıcı Müşteri',
                en: 'B2B Wholesale Buyer',
                ru: 'Оптовый покупатель B2B',
                ar: 'مشتري جملة B2B',
                de: 'B2B-Großhandelskunde',
                fr: 'Acheteur grossiste B2B',
                pl: 'Kupujący hurtowy B2B',
                bg: 'B2B купувач на едро',
              ))
        : (widget.room.supplierUserName.isNotEmpty
            ? '${widget.room.supplierUserName} (${widget.room.supplierUserLanguages})'
            : UiText.pick(
                lang,
                tr: 'Üretici Satış Hattı',
                en: 'Manufacturer Sales Desk',
                ru: 'Отдел продаж фабрики',
                ar: 'مكتب مبيعات المصنع',
                de: 'Hersteller-Vertrieb',
                fr: 'Service commercial fabricant',
                pl: 'Dział sprzedaży producenta',
                bg: 'Търговски отдел на производителя',
              ));

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: AppColors.warmHairline),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              headerTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w800,
                color: AppColors.obsidian,
              ),
            ),
            Text(
              headerSub,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.sonicSilver,
              ),
            ),
          ],
        ),
        actions: [
          if (widget.asSupplier)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: TextButton.icon(
                onPressed: _openSendCustomOfferModal,
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.luxuryBronze,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                ),
                icon: const Icon(Icons.local_offer_rounded, size: 15),
                label: Text(
                  UiText.pick(
                    lang,
                    tr: 'Özel Teklif',
                    en: 'Custom Offer',
                    ru: 'Спеццена',
                    ar: 'عرض خاص',
                    de: 'Sonderangebot',
                    fr: 'Offre B2B',
                    pl: 'Oferta',
                    bg: 'Оферта',
                  ),
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: chat.loadingMessages && messages.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.obsidian,
                    ),
                  )
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(14),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final m = messages[index];
                      final isMine = widget.asSupplier
                          ? m.senderType == 'supplier'
                          : m.senderType == 'customer';
                      return _MessageBubble(
                        lang: lang,
                        message: m,
                        isMine: isMine,
                        asSupplier: widget.asSupplier,
                        onAcceptOffer: () => _acceptOffer(m),
                      );
                    },
                  ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: AppColors.warmHairline),
              ),
            ),
            padding: EdgeInsets.only(
              left: 8,
              right: 10,
              top: 8,
              bottom: MediaQuery.of(context).padding.bottom + 8,
            ),
            child: Row(
              children: [
                IconButton(
                  tooltip: UiText.pick(
                    lang,
                    tr: 'Kamerayla Çek',
                    en: 'Take Photo',
                    ru: 'Снять фото',
                    ar: 'التقاط صورة',
                    de: 'Foto aufnehmen',
                    fr: 'Prendre une photo',
                    pl: 'Zrób zdjęcie',
                    bg: 'Направи снимка',
                  ),
                  onPressed: chat.sending ? null : _captureAndSendCameraPhoto,
                  icon: const Icon(
                    Icons.photo_camera_outlined,
                    color: AppColors.obsidian,
                  ),
                ),
                IconButton(
                  tooltip: UiText.pick(
                    lang,
                    tr: 'Galeriden Seç',
                    en: 'Choose from Gallery',
                    ru: 'Выбрать из галереи',
                    ar: 'اختيار من المعرض',
                    de: 'Aus Galerie wählen',
                    fr: 'Choisir dans la galerie',
                    pl: 'Wybierz z galerii',
                    bg: 'Избери от галерията',
                  ),
                  onPressed: chat.sending ? null : _pickAndSendGalleryPhoto,
                  icon: const Icon(
                    Icons.image_outlined,
                    color: AppColors.sonicSilver,
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _msgCtrl,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendText(),
                    decoration: InputDecoration(
                      hintText: UiText.pick(
                        lang,
                        tr: 'Mesajınızı yazın...',
                        en: 'Write your message...',
                        ru: 'Введите сообщение...',
                        ar: 'اكتب رسالتك...',
                        de: 'Nachricht schreiben...',
                        fr: 'Écrivez votre message...',
                        pl: 'Napisz wiadomość...',
                        bg: 'Напишете съобщението си...',
                      ),
                      filled: true,
                      fillColor: AppColors.warmSurface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                        borderSide: const BorderSide(
                          color: AppColors.warmHairline,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                        borderSide: const BorderSide(
                          color: AppColors.warmHairline,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                        borderSide: const BorderSide(
                          color: AppColors.obsidian,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 42,
                  height: 42,
                  child: Material(
                    color: widget.asSupplier
                        ? AppColors.luxuryBronze
                        : AppColors.obsidian,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      onTap: chat.sending ? null : _sendText,
                      child: Center(
                        child: chat.sending
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(
                                Icons.send_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final String lang;
  final ChatMessage message;
  final bool isMine;
  final bool asSupplier;
  final VoidCallback onAcceptOffer;

  const _MessageBubble({
    required this.lang,
    required this.message,
    required this.isMine,
    required this.asSupplier,
    required this.onAcceptOffer,
  });

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('HH:mm').format(message.createdAt.toLocal());

    if (message.messageType == 'product_card') {
      final meta = message.metadata;
      final unitWord = AppStrings.t(lang, 'pieces_short');
      final seriesWord = AppStrings.t(lang, 'series_label');
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
          border: Border.all(
            color: AppColors.luxuryBronze.withValues(alpha: 0.5),
            width: 1.3,
          ),
        ),
        child: Row(
          children: [
            SmartNetworkImage(
              imageUrl: meta.imageUrl,
              width: 54,
              height: 68,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    UiText.pick(
                      lang,
                      tr: 'İLGİLENİLEN TOPTAN ÜRÜN',
                      en: 'WHOLESALE PRODUCT INQUIRY',
                      ru: 'ИНТЕРЕСУЮЩИЙ ОПТОВЫЙ ТОВАР',
                      ar: 'منتج الجملة المستفسر عنه',
                      de: 'ANGEFRAGTES GROSSHANDELSPRODUKT',
                      fr: 'PRODUIT DE GROS DEMANDÉ',
                      pl: 'PRODUKT HURTOWY W ZAPYTANIU',
                      bg: 'ЗАПИТВАНЕ ЗА ПРОДУКТ НА ЕДРО',
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: AppStrings.letterSpacing(lang, 0.8),
                      color: AppColors.luxuryBronze,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    meta.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.obsidian,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'SKU: ${meta.customSku} • $seriesWord: ${meta.seriesRatio} (${meta.unitsPerPackage} $unitWord)',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (message.messageType == 'custom_offer') {
      final meta = message.metadata;
      final isAccepted = meta.offerStatus == 'accepted';
      final unitWord = AppStrings.t(lang, 'pieces_short');
      final pkgWord = UiText.pick(
        lang,
        tr: 'Paket',
        en: 'Pkg',
        ru: 'Уп.',
        ar: 'طرد',
        de: 'Pack',
        fr: 'Lot',
        pl: 'Op.',
        bg: 'Пак.',
      );
      final offerUnitPrefix = UiText.pick(
        lang,
        tr: 'Teklif Birim',
        en: 'Offered Unit',
        ru: 'Цена за ед.',
        ar: 'سعر الوحدة',
        de: 'Stückpreis',
        fr: 'Prix unitaire',
        pl: 'Cena szt.',
        bg: 'Ед. цена',
      );
      final totalLabel = UiText.pick(
        lang,
        tr: 'Toplam',
        en: 'Total',
        ru: 'Итого',
        ar: 'الإجمالي',
        de: 'Gesamt',
        fr: 'Total',
        pl: 'Razem',
        bg: 'Общо',
      );
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
          border: Border.all(
            color: isAccepted ? AppColors.emerald : AppColors.luxuryBronze,
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isAccepted ? Icons.verified_rounded : Icons.redeem_rounded,
                  size: 18,
                  color:
                      isAccepted ? AppColors.emerald : AppColors.luxuryBronze,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    isAccepted
                        ? UiText.pick(
                            lang,
                            tr: 'KABUL EDİLEN TOPTAN TEKLİF',
                            en: 'ACCEPTED WHOLESALE OFFER',
                            ru: 'ПРИНЯТОЕ ОПТОВОЕ ПРЕДЛОЖЕНИЕ',
                            ar: 'تم قبول عرض الجملة',
                            de: 'ANGENOMMENES B2B-ANGEBOT',
                            fr: 'OFFRE DE GROS ACCEPTÉE',
                            pl: 'ZAAKCEPTOWANA OFERTA HURTOWA',
                            bg: 'ПРИЕТА ОФЕРТА НА ЕДРО',
                          )
                        : UiText.pick(
                            lang,
                            tr: 'ÖZEL TOPTAN FİYAT TEKLİFİ',
                            en: 'CUSTOM WHOLESALE QUOTE',
                            ru: 'ИНДИВИДУАЛЬНОЕ ОПТОВОЕ ПРЕДЛОЖЕНИЕ',
                            ar: 'عرض سعر جملة خاص',
                            de: 'INDIVIDUELLES B2B-ANGEBOT',
                            fr: 'DEVIS DE GROS PERSONNALISÉ',
                            pl: 'INDYWIDUALNA OFERTA HURTOWA',
                            bg: 'СПЕЦИАЛНА ОФЕРТА НА ЕДРО',
                          ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: AppStrings.letterSpacing(lang, 0.7),
                      color: isAccepted
                          ? AppColors.emerald
                          : AppColors.luxuryBronze,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                SmartNetworkImage(
                  imageUrl: meta.imageUrl,
                  width: 56,
                  height: 70,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        meta.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13.5,
                          color: AppColors.obsidian,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${meta.packagesQty} $pkgWord × ${meta.unitsPerPackage} $unitWord = ${meta.packagesQty * meta.unitsPerPackage} $unitWord',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.sonicSilver,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$offerUnitPrefix: ${meta.offeredUnitPrice.toStringAsFixed(2)} ${meta.currency}  ($totalLabel: ${meta.totalOfferPrice.toStringAsFixed(2)} ${meta.currency})',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (!asSupplier && !isAccepted) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: onAcceptOffer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.emerald,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                  ),
                  icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
                  label: Text(
                    UiText.pick(
                      lang,
                      tr: 'Teklifi Kabul Et & Sepete Ekle',
                      en: 'Accept Quote & Add to Cart',
                      ru: 'Принять и добавить в корзину',
                      ar: 'قبول العرض وإضافة للسلة',
                      de: 'Angebot annehmen & in Warenkorb',
                      fr: 'Accepter & ajouter au panier',
                      pl: 'Akceptuj i dodaj do koszyka',
                      bg: 'Приеми офертата и добави',
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: isMine
              ? (asSupplier ? AppColors.luxuryBronze : AppColors.obsidian)
              : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(AppColors.radiusLg),
            topRight: const Radius.circular(AppColors.radiusLg),
            bottomLeft: Radius.circular(isMine ? AppColors.radiusLg : 4),
            bottomRight: Radius.circular(isMine ? 4 : AppColors.radiusLg),
          ),
          border: isMine ? null : Border.all(color: AppColors.warmHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isMine && message.senderName.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  message.senderName,
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.luxuryBronze,
                  ),
                ),
              ),
            if (message.messageType == 'image' &&
                message.metadata.imageUrl.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: SmartNetworkImage(
                  imageUrl: message.metadata.imageUrl,
                  width: 220,
                  height: 260,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
              ),
            if (message.content.isNotEmpty &&
                !(message.messageType == 'image' &&
                    message.content == '📷 Fotoğraf'))
              Text(
                message.content,
                style: TextStyle(
                  color: isMine ? Colors.white : AppColors.obsidian,
                  fontSize: 13.5,
                  height: 1.35,
                ),
              ),
            const SizedBox(height: 3),
            Align(
              alignment: Alignment.bottomRight,
              child: Text(
                timeStr,
                style: TextStyle(
                  fontSize: 10,
                  color: isMine ? Colors.white70 : AppColors.sonicSilver,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SupplierCustomOfferSheet extends StatefulWidget {
  final String roomId;
  final String? initialProductId;

  const _SupplierCustomOfferSheet({
    required this.roomId,
    this.initialProductId,
  });

  @override
  State<_SupplierCustomOfferSheet> createState() =>
      _SupplierCustomOfferSheetState();
}

class _SupplierCustomOfferSheetState extends State<_SupplierCustomOfferSheet> {
  Product? _selectedProduct;
  final _pkgsCtrl = TextEditingController(text: '5');
  final _unitPriceCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final products = context.read<SupplierProvider>().products;
    if (products.isNotEmpty) {
      _selectedProduct = products.firstWhere(
        (p) => p.id == widget.initialProductId,
        orElse: () => products.first,
      );
      _unitPriceCtrl.text =
          (_selectedProduct!.effectiveUnitPrice * 0.92).toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    _pkgsCtrl.dispose();
    _unitPriceCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final prod = _selectedProduct;
    final pkgs = int.tryParse(_pkgsCtrl.text.trim()) ?? 1;
    final unitPrice =
        double.tryParse(_unitPriceCtrl.text.trim().replaceAll(',', '.')) ?? 0.0;

    if (prod == null || unitPrice <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lütfen ürün ve geçerli teklif birim fiyatı giriniz.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<ChatProvider>().sendSupplierCustomOffer(
            roomId: widget.roomId,
            productId: prod.id,
            packagesQty: pkgs <= 0 ? 1 : pkgs,
            offeredUnitPrice: unitPrice,
            note: _noteCtrl.text,
          );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = context.watch<SupplierProvider>().products;
    final lang = context.watch<SessionProvider>().languageCode;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            UiText.pick(
              lang,
              tr: 'Özel Toptan Fiyat Teklifi Gönder',
              en: 'Send Custom Wholesale Quote',
              ru: 'Отправить оптовое спецпредложение',
              ar: 'إرسال عرض سعر جملة خاص',
              de: 'Individuelles B2B-Angebot senden',
              fr: 'Envoyer un devis de gros',
              pl: 'Wyślij ofertę hurtową',
              bg: 'Изпрати специална оферта на едро',
            ),
            style: const TextStyle(
              fontFamily: AppColors.serifFontFamily,
              fontSize: 16.5,
              fontWeight: FontWeight.w800,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 14),
          if (products.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                UiText.pick(
                  lang,
                  tr: 'Teklif gönderebilmek için önce aktif bir ürününüz olmalıdır.',
                  en: 'You must have at least one active product to send a quote.',
                  ru: 'Для отправки предложения нужен хотя бы один активный товар.',
                  ar: 'يجب أن يكون لديك منتج نشط واحد على الأقل لإرسال عرض.',
                  de: 'Sie benötigen mindestens ein aktives Produkt, um ein Angebot zu senden.',
                  fr: 'Vous devez avoir au moins un produit actif pour envoyer un devis.',
                  pl: 'Musisz mieć przynajmniej jeden aktywny produkt, aby wysłać ofertę.',
                  bg: 'Трябва да имате поне един активен продукт, за да изпратите оферта.',
                ),
                style: const TextStyle(color: AppColors.sonicSilver),
              ),
            )
          else ...[
            DropdownButtonFormField<Product>(
              initialValue: _selectedProduct,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: UiText.pick(
                  lang,
                  tr: 'Ürün Seçin',
                  en: 'Select Product',
                  ru: 'Выберите товар',
                  ar: 'اختر المنتج',
                  de: 'Produkt wählen',
                  fr: 'Sélectionner un produit',
                  pl: 'Wybierz produkt',
                  bg: 'Изберете продукт',
                ),
              ),
              items: products
                  .map(
                    (p) => DropdownMenuItem<Product>(
                      value: p,
                      child: Text(
                        '${p.localizedTitle(lang)} (${p.price.toStringAsFixed(2)} ${p.currency})',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (val) {
                setState(() {
                  _selectedProduct = val;
                  if (val != null) {
                    _unitPriceCtrl.text =
                        (val.effectiveUnitPrice * 0.92).toStringAsFixed(2);
                  }
                });
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _pkgsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: UiText.pick(
                        lang,
                        tr: 'Paket / Seri Adedi',
                        en: 'Series / Packs Qty',
                        ru: 'Кол-во серий',
                        ar: 'عدد الطرود',
                        de: 'Serien / Pakete',
                        fr: 'Qté séries / lots',
                        pl: 'Liczba serii',
                        bg: 'Брой серии',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _unitPriceCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(
                      labelText:
                          '${UiText.pick(lang, tr: 'Teklif Birim Fiyatı', en: 'Quote Unit Price', ru: 'Цена за единицу', ar: 'سعر الوحدة المقترح', de: 'Stückpreis Angebot', fr: 'Prix unitaire devis', pl: 'Cena jednostkowa', bg: 'Единична цена')} (${_selectedProduct?.currency ?? 'TRY'})',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtrl,
              decoration: InputDecoration(
                labelText: UiText.pick(
                  lang,
                  tr: 'Teklif Notu (Opsiyonel)',
                  en: 'Quote Note (Optional)',
                  ru: 'Примечание (необяз.)',
                  ar: 'ملاحظة العرض (اختياري)',
                  de: 'Angebotsnotiz (Optional)',
                  fr: 'Note du devis (Optionnel)',
                  pl: 'Uwaga do oferty (Opcjonalnie)',
                  bg: 'Бележка към офертата',
                ),
                hintText: UiText.pick(
                  lang,
                  tr: 'Örn: Peşin havale alımına özel seri fiyatıdır.',
                  en: 'e.g. Special series rate for wire transfer.',
                  ru: 'Напр.: Спеццена при оплате переводом.',
                  ar: 'مثال: سعر خاص للدفع بالتحويل البنكي.',
                  de: 'z.B. Sonderpreis bei Überweisung.',
                  fr: 'Ex: Tarif spécial pour virement.',
                  pl: 'Np. Specjalna cena przy przelewie.',
                  bg: 'Напр.: Специална цена при банков превод.',
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 46,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _send,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.luxuryBronze,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                ),
                icon: const Icon(Icons.send_rounded, size: 17),
                label: Text(
                  _submitting
                      ? UiText.pick(
                          lang,
                          tr: 'Gönderiliyor...',
                          en: 'Sending...',
                          ru: 'Отправка...',
                          ar: 'جاري الإرسال...',
                          de: 'Wird gesendet...',
                          fr: 'Envoi...',
                          pl: 'Wysyłanie...',
                          bg: 'Изпращане...',
                        )
                      : UiText.pick(
                          lang,
                          tr: 'Özel Teklifi Anında Gönder',
                          en: 'Send Custom Quote Now',
                          ru: 'Отправить спецпредложение',
                          ar: 'إرسال العرض الخاص الآن',
                          de: 'Sonderangebot sofort senden',
                          fr: 'Envoyer le devis maintenant',
                          pl: 'Wyślij ofertę teraz',
                          bg: 'Изпрати офертата веднага',
                        ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

