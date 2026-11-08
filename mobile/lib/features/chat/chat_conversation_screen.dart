import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../models/chat.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/supplier_provider.dart';
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => _SupplierCustomOfferSheet(
        roomId: widget.room.id,
        initialProductId: widget.room.initialProductId,
      ),
    );
    _scrollToBottom();
  }

  Future<void> _acceptOffer(ChatMessage msg) async {
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
          const SnackBar(
            content: Text(
              'Özel fiyat teklifi kabul edildi ve sepetinize eklendi!',
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
    final messages = chat.activeMessages;
    final headerTitle = widget.asSupplier
        ? widget.room.customerName
        : widget.room.supplierName;
    final headerSub = widget.asSupplier
        ? (widget.room.customerPhone.isNotEmpty
            ? widget.room.customerPhone
            : 'B2B Alıcı Müşteri')
        : (widget.room.supplierUserName.isNotEmpty
            ? '${widget.room.supplierUserName} (${widget.room.supplierUserLanguages})'
            : 'Üretici Satış Hattı');

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(headerTitle, style: const TextStyle(fontSize: 15.5)),
            Text(
              headerSub,
              style: TextStyle(
                fontSize: 11.5,
                color: widget.asSupplier
                    ? Colors.white70
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
        actions: [
          if (widget.asSupplier)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: _openSendCustomOfferModal,
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.accentGold,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
                icon: const Icon(Icons.local_offer_rounded, size: 16),
                label: const Text(
                  'Özel Teklif',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: chat.loadingMessages && messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
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
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            padding: EdgeInsets.only(
              left: 8,
              right: 8,
              top: 8,
              bottom: MediaQuery.of(context).padding.bottom + 8,
            ),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Kamerayla Çek',
                  onPressed: chat.sending ? null : _captureAndSendCameraPhoto,
                  icon: const Icon(
                    Icons.photo_camera_outlined,
                    color: AppColors.primary,
                  ),
                ),
                IconButton(
                  tooltip: 'Galeriden Seç',
                  onPressed: chat.sending ? null : _pickAndSendGalleryPhoto,
                  icon: const Icon(
                    Icons.image_outlined,
                    color: AppColors.textSecondary,
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _msgCtrl,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendText(),
                    decoration: const InputDecoration(
                      hintText: 'Mesajınızı yazın...',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                CircleAvatar(
                  backgroundColor: widget.asSupplier
                      ? AppColors.navy
                      : AppColors.primary,
                  child: IconButton(
                    onPressed: chat.sending ? null : _sendText,
                    icon: chat.sending
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool isMine;
  final bool asSupplier;
  final VoidCallback onAcceptOffer;

  const _MessageBubble({
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
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.primaryLight, width: 1.5),
        ),
        child: Row(
          children: [
            SmartNetworkImage(
              imageUrl: meta.imageUrl,
              width: 54,
              height: 68,
              borderRadius: BorderRadius.circular(8),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'İLGİLENİLEN TOPTAN ÜRÜN',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                  Text(
                    meta.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'SKU: ${meta.customSku} • Seri: ${meta.seriesRatio} (${meta.unitsPerPackage} Adet)',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textSecondary,
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
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isAccepted ? AppColors.emerald : AppColors.accentGold,
            width: 1.6,
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
                  color: isAccepted ? AppColors.emerald : AppColors.accentGold,
                ),
                const SizedBox(width: 6),
                Text(
                  isAccepted
                      ? 'KABUL EDİLEN TOPTAN TEKLİF'
                      : 'ÖZEL TOPTAN FİYAT TEKLİFİ',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color:
                        isAccepted ? AppColors.emerald : AppColors.accentGold,
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
                  borderRadius: BorderRadius.circular(8),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        meta.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13.5,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${meta.packagesQty} Paket × ${meta.unitsPerPackage} Adet = ${meta.packagesQty * meta.unitsPerPackage} Adet',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Teklif Birim: ${meta.offeredUnitPrice.toStringAsFixed(2)} ${meta.currency}  (Toplam: ${meta.totalOfferPrice.toStringAsFixed(2)} ${meta.currency})',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy,
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
                  ),
                  icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
                  label: const Text('Teklifi Kabul Et & Sepete Ekle'),
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
          maxWidth: MediaQuery.of(context).size.width * 0.76,
        ),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: isMine
              ? (asSupplier ? AppColors.navy : AppColors.primary)
              : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMine ? 16 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 16),
          ),
          border: isMine ? null : Border.all(color: AppColors.border),
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
                    color: AppColors.primary,
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
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            if (message.content.isNotEmpty &&
                !(message.messageType == 'image' &&
                    message.content == '📷 Fotoğraf'))
              Text(
                message.content,
                style: TextStyle(
                  color: isMine ? Colors.white : AppColors.textPrimary,
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
                  color: isMine ? Colors.white70 : AppColors.textMuted,
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
          const Text(
            '🎁 Müşteriye Özel Toptan Fiyat Teklifi Gönder',
            style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          if (products.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'Teklif gönderebilmek için önce aktif bir ürününüz olmalıdır.',
              ),
            )
          else ...[
            DropdownButtonFormField<Product>(
              initialValue: _selectedProduct,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Ürün Seçin'),
              items: products
                  .map(
                    (p) => DropdownMenuItem<Product>(
                      value: p,
                      child: Text(
                        '${p.title} (${p.price.toStringAsFixed(2)} ${p.currency})',
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
                    decoration: const InputDecoration(
                      labelText: 'Paket / Seri Adedi',
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
                          'Teklif Birim Fiyatı (${_selectedProduct?.currency ?? 'TRY'})',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtrl,
              decoration: const InputDecoration(
                labelText: 'Teklif Notu (Opsiyonel)',
                hintText: 'Örn: Peşin havale alımına özel seri fiyatıdır.',
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _submitting ? null : _send,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accentGold,
              ),
              icon: const Icon(Icons.send_rounded),
              label: Text(
                _submitting ? 'Gönderiliyor...' : 'Özel Teklifi Anında Gönder',
              ),
            ),
          ],
        ],
      ),
    );
  }
}

