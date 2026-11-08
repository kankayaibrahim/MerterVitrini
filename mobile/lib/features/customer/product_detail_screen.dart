import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_theme.dart';
import '../../models/chat.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/smart_network_image.dart';
import '../chat/chat_conversation_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String productId;

  const ProductDetailScreen({super.key, required this.productId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final PageController _pageController = PageController();
  final FocusNode _galleryFocusNode = FocusNode();

  Product? _product;
  bool _loading = true;
  String? _error;
  int _packagesQty = 1;
  int _activeImageIdx = 0;
  bool _addingCart = false;

  @override
  void initState() {
    super.initState();
    _loadProduct(widget.productId);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _galleryFocusNode.dispose();
    super.dispose();
  }

  void _goToImage(int targetIdx, int total) {
    if (total <= 1) return;
    final nextIdx = (targetIdx % total + total) % total;
    setState(() => _activeImageIdx = nextIdx);
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        nextIdx,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _loadProduct(String id) async {
    setState(() {
      _loading = true;
      _error = null;
      _activeImageIdx = 0;
    });
    if (_pageController.hasClients) {
      _pageController.jumpToPage(0);
    }
    try {
      final prod = await context.read<SessionProvider>().api.fetchProductDetail(
            id,
          );
      if (!mounted) return;
      setState(() {
        _product = prod;
        _packagesQty = prod.minOrderPackages;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _galleryFocusNode.requestFocus();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addToCart() async {
    final p = _product;
    if (p == null) return;
    setState(() => _addingCart = true);
    try {
      await context.read<CartProvider>().addProductPackages(p, _packagesQty);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            '$_packagesQty Seri (${_packagesQty * p.unitsPerPackage} Adet) toptan sepetinize eklendi.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _addingCart = false);
    }
  }

  Future<void> _openSupplierChatSelector() async {
    final p = _product;
    if (p == null) return;

    final session = context.read<SessionProvider>();
    final chat = context.read<ChatProvider>();
    var agents = <SupplierAgent>[];
    try {
      agents = await session.api.listBrandAgents(p.brandId);
    } catch (_) {}

    if (!mounted) return;

    if (agents.length <= 1) {
      await _launchRoom(
        chat: chat,
        brandId: p.brandId,
        supplierUserId: agents.isNotEmpty ? agents.first.id : '',
        productId: p.id,
      );
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${p.maskedBrandName.toUpperCase()} SATIŞ TEMSİLCİSİ',
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close_rounded, size: 19),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              const Text(
                'Dil tercihinize uygun müşteri temsilcisiyle canlı B2B pazarlığa başlayın:',
                style: TextStyle(fontSize: 12, color: AppColors.sonicSilver),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1),
              ...agents.map(
                (a) => ListTile(
                  contentPadding: const EdgeInsets.symmetric(vertical: 4),
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.obsidian,
                      border: Border.all(
                        color: AppColors.champagneGold.withValues(alpha: 0.6),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      a.contactName.isNotEmpty
                          ? a.contactName.characters.first.toUpperCase()
                          : 'T',
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  title: Text(
                    a.contactName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                      color: AppColors.obsidian,
                    ),
                  ),
                  subtitle: Text(
                    '${a.jobTitle} • Diller: ${a.spokenLanguages}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                  trailing: const Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 14,
                    color: AppColors.editorialGold,
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    _launchRoom(
                      chat: chat,
                      brandId: p.brandId,
                      supplierUserId: a.id,
                      productId: p.id,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _launchRoom({
    required ChatProvider chat,
    required String brandId,
    required String supplierUserId,
    required String productId,
  }) async {
    try {
      final room = await chat.startCustomerProductOrBrandChat(
        brandId: brandId,
        supplierUserId: supplierUserId,
        productId: productId,
      );
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatConversationScreen(
            room: room,
            asSupplier: false,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final p = _product;
    final wishlisted = p != null && session.isWishlisted(p.id);

    final hasDiscount = p != null &&
        p.discountedPrice != null &&
        p.discountedPrice! > 0 &&
        p.discountedPrice! < p.price;

    final specs = <(String, String)>[
      if (p != null && p.fabric.trim().isNotEmpty) ('KUMAŞ', p.fabric.trim()),
      if (p != null && p.color.trim().isNotEmpty) ('RENK', p.color.trim()),
      if (p != null && p.gender.trim().isNotEmpty)
        ('KOLEKSİYON', p.gender.trim()),
      if (p != null && p.season.trim().isNotEmpty) ('SEZON', p.season.trim()),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.cultured)),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: AppColors.cultured),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.arrow_back_rounded,
                        size: 18,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (p != null)
                          Text(
                            p.maskedBrandName.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.8,
                              color: AppColors.editorialGold,
                            ),
                          ),
                        Text(
                          p?.localizedTitle(lang) ?? 'ÜRÜN DETAYI',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.obsidian,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (p != null) ...[
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () => session.toggleWishlist(p),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: wishlisted ? AppColors.obsidian : Colors.white,
                          border: Border.all(
                            color: wishlisted
                                ? AppColors.obsidian
                                : AppColors.cultured,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: LuxuryIcon(
                          kind: LuxuryIconKind.heart,
                          size: 16,
                          active: wishlisted,
                          color: wishlisted ? Colors.white : AppColors.obsidian,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () {
                        SharePlus.instance.share(
                          ShareParams(
                            text:
                                '${p.title} (${p.customSku}) - https://mertervitrini.com.tr/product/${p.slug}',
                          ),
                        );
                      },
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: AppColors.cultured),
                        ),
                        alignment: Alignment.center,
                        child: const LuxuryIcon(
                          kind: LuxuryIconKind.share,
                          size: 16,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : (_error != null || p == null)
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error ?? 'Ürün bulunamadı.'),
                  ),
                )
              : CallbackShortcuts(
                  bindings: <ShortcutActivator, VoidCallback>{
                    const SingleActivator(LogicalKeyboardKey.arrowLeft): () =>
                        _goToImage(_activeImageIdx - 1, p.images.length),
                    const SingleActivator(LogicalKeyboardKey.arrowRight): () =>
                        _goToImage(_activeImageIdx + 1, p.images.length),
                  },
                  child: Focus(
                    focusNode: _galleryFocusNode,
                    autofocus: true,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.only(bottom: 120),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 1. Tall Editorial Gallery Frame
                          Container(
                            height: MediaQuery.sizeOf(context).width > 560
                                ? 540
                                : (MediaQuery.sizeOf(context).width * 1.28)
                                    .clamp(480.0, 580.0),
                            decoration: const BoxDecoration(
                              color: AppColors.editorialOffWhite,
                              border: Border(
                                bottom: BorderSide(color: AppColors.cultured),
                              ),
                            ),
                            child: Stack(
                              children: [
                                PageView.builder(
                                  controller: _pageController,
                                  physics: const BouncingScrollPhysics(),
                                  itemCount: p.images.isNotEmpty
                                      ? p.images.length
                                      : 1,
                                  onPageChanged: (i) =>
                                      setState(() => _activeImageIdx = i),
                                  itemBuilder: (context, index) {
                                    final url = p.images.isNotEmpty
                                        ? p.images[index].imageUrl
                                        : '';
                                    final isWide =
                                        MediaQuery.sizeOf(context).width > 560;
                                    return InteractiveViewer(
                                      panEnabled: false,
                                      minScale: 1.0,
                                      maxScale: 3.0,
                                      child: SmartNetworkImage(
                                        imageUrl: url,
                                        fit: isWide
                                            ? BoxFit.contain
                                            : BoxFit.cover,
                                      ),
                                    );
                                  },
                                ),
                                if (p.images.length > 1) ...[
                                  Positioned(
                                    left: 12,
                                    top: 0,
                                    bottom: 0,
                                    child: Center(
                                      child: _GalleryNavButton(
                                        icon: Icons.chevron_left_rounded,
                                        tooltip: 'Önceki Görsel (←)',
                                        onPressed: () => _goToImage(
                                          _activeImageIdx - 1,
                                          p.images.length,
                                        ),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    right: 12,
                                    top: 0,
                                    bottom: 0,
                                    child: Center(
                                      child: _GalleryNavButton(
                                        icon: Icons.chevron_right_rounded,
                                        tooltip: 'Sonraki Görsel (→)',
                                        onPressed: () => _goToImage(
                                          _activeImageIdx + 1,
                                          p.images.length,
                                        ),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 14,
                                    right: 14,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.obsidian
                                            .withValues(alpha: 0.88),
                                        border: Border.all(
                                          color: AppColors.champagneGold
                                              .withValues(alpha: 0.55),
                                        ),
                                      ),
                                      child: Text(
                                        '${_activeImageIdx + 1} / ${p.images.length}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),

                          // 2. Architectural Portrait Thumbnail Strip
                          if (p.images.length > 1)
                            Container(
                              color: Colors.white,
                              padding:
                                  const EdgeInsets.fromLTRB(16, 12, 16, 4),
                              child: SizedBox(
                                height: 70,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: p.images.length,
                                  separatorBuilder: (context, index) =>
                                      const SizedBox(width: 8),
                                  itemBuilder: (context, index) {
                                    final selected = index == _activeImageIdx;
                                    return GestureDetector(
                                      onTap: () =>
                                          _goToImage(index, p.images.length),
                                      child: AnimatedContainer(
                                        duration:
                                            const Duration(milliseconds: 160),
                                        padding: const EdgeInsets.all(2),
                                        decoration: BoxDecoration(
                                          border: Border.all(
                                            color: selected
                                                ? AppColors.obsidian
                                                : AppColors.cultured,
                                            width: selected ? 2.0 : 1.0,
                                          ),
                                        ),
                                        child: SmartNetworkImage(
                                          imageUrl: p.images[index].imageUrl,
                                          width: 52,
                                          height: 64,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),

                          // 3. Product Editorial Body
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Masked Brand Crest Pill + SKU
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4.5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.editorialIvory,
                                        border: Border.all(
                                          color: AppColors.champagneGold
                                              .withValues(alpha: 0.55),
                                        ),
                                      ),
                                      child: Text(
                                        p.maskedBrandName.toUpperCase(),
                                        style: const TextStyle(
                                          color: AppColors.obsidian,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 10,
                                          letterSpacing: 1.6,
                                        ),
                                      ),
                                    ),
                                    const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.editorialOffWhite,
                                        border: Border.all(
                                          color: AppColors.cultured,
                                        ),
                                      ),
                                      child: Text(
                                        'SKU: ${p.customSku}',
                                        style: const TextStyle(
                                          color: AppColors.sonicSilver,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.6,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  p.localizedTitle(lang),
                                  style: const TextStyle(
                                    fontFamily: AppColors.serifFontFamily,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.obsidian,
                                    height: 1.25,
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // 4. Couture Wholesale Series & Pack Calculator
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: AppColors.editorialOffWhite,
                                    border:
                                        Border.all(color: AppColors.cultured),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text(
                                                  'BİRİM TOPTAN FİYATI',
                                                  style: TextStyle(
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w800,
                                                    letterSpacing: 1.1,
                                                    color:
                                                        AppColors.sonicSilver,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                if (hasDiscount)
                                                  Text(
                                                    session.formatPrice(
                                                      p.price,
                                                      sourceCurrency:
                                                          p.currency,
                                                    ),
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      color: AppColors
                                                          .spanishGray,
                                                      decoration: TextDecoration
                                                          .lineThrough,
                                                    ),
                                                  ),
                                                Text(
                                                  session.formatPrice(
                                                    p.effectiveUnitPrice,
                                                    sourceCurrency: p.currency,
                                                  ),
                                                  style: TextStyle(
                                                    fontSize: 23,
                                                    fontWeight: FontWeight.w900,
                                                    color: hasDiscount
                                                        ? AppColors.discountRed
                                                        : AppColors.obsidian,
                                                    letterSpacing: -0.3,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 13,
                                              vertical: 10,
                                            ),
                                            decoration: BoxDecoration(
                                              color: AppColors.obsidian,
                                              border: Border.all(
                                                color: AppColors.champagneGold
                                                    .withValues(alpha: 0.65),
                                              ),
                                            ),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                Text(
                                                  '1 SERİ (${p.unitsPerPackage} ADET)',
                                                  style: const TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w800,
                                                    letterSpacing: 1.0,
                                                    color:
                                                        AppColors.champagneGold,
                                                  ),
                                                ),
                                                const SizedBox(height: 3),
                                                Text(
                                                  session.formatPrice(
                                                    p.packageTotalPrice,
                                                    sourceCurrency: p.currency,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 16.5,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 14),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 9,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          border: Border.all(
                                            color: AppColors.cultured,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  const Text(
                                                    'SERİ DAĞILIMI',
                                                    style: TextStyle(
                                                      fontSize: 8.5,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      letterSpacing: 1.0,
                                                      color: AppColors
                                                          .spanishGray,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    p.seriesRatio.isNotEmpty
                                                        ? p.seriesRatio
                                                        : (p.packingRatio
                                                                .isNotEmpty
                                                            ? p.packingRatio
                                                            : 'STANDART'),
                                                    style: const TextStyle(
                                                      fontSize: 12.5,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              width: 1,
                                              height: 26,
                                              color: AppColors.cultured,
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  const Text(
                                                    'MİNİMUM SİPARİŞ',
                                                    style: TextStyle(
                                                      fontSize: 8.5,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      letterSpacing: 1.0,
                                                      color: AppColors
                                                          .spanishGray,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    '${p.minOrderPackages} Seri (${p.minOrderUnits} Adet)',
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 14),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'SİPARİŞ SERİ ADEDİ',
                                                style: TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 1.0,
                                                  color: AppColors.obsidian,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                '$_packagesQty Seri × ${p.unitsPerPackage} Adet = ${_packagesQty * p.unitsPerPackage} Adet',
                                                style: const TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.editorialGold,
                                                ),
                                              ),
                                            ],
                                          ),
                                          Container(
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              border: Border.all(
                                                color: AppColors.obsidian,
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                InkWell(
                                                  onTap: _packagesQty >
                                                          p.minOrderPackages
                                                      ? () => setState(
                                                            () =>
                                                                _packagesQty--,
                                                          )
                                                      : null,
                                                  child: Container(
                                                    width: 36,
                                                    height: 36,
                                                    alignment: Alignment.center,
                                                    child: Icon(
                                                      Icons.remove,
                                                      size: 16,
                                                      color: _packagesQty >
                                                              p.minOrderPackages
                                                          ? AppColors.obsidian
                                                          : AppColors
                                                              .spanishGray,
                                                    ),
                                                  ),
                                                ),
                                                Container(
                                                  constraints:
                                                      const BoxConstraints(
                                                    minWidth: 78,
                                                  ),
                                                  height: 36,
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                    horizontal: 12,
                                                  ),
                                                  decoration:
                                                      const BoxDecoration(
                                                    border: Border.symmetric(
                                                      vertical: BorderSide(
                                                        color:
                                                            AppColors.cultured,
                                                      ),
                                                    ),
                                                  ),
                                                  alignment: Alignment.center,
                                                  child: Text(
                                                    '$_packagesQty SERİ',
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                      letterSpacing: 0.6,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ),
                                                InkWell(
                                                  onTap: () => setState(
                                                    () => _packagesQty++,
                                                  ),
                                                  child: Container(
                                                    width: 36,
                                                    height: 36,
                                                    alignment: Alignment.center,
                                                    child: const Icon(
                                                      Icons.add,
                                                      size: 16,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),

                                // 5. Color Variants ("DİĞER RENK SEÇENEKLERİ")
                                if (p.colorVariants.isNotEmpty) ...[
                                  const SizedBox(height: 22),
                                  const Text(
                                    'DİĞER RENK SEÇENEKLERİ',
                                    style: TextStyle(
                                      fontFamily: AppColors.serifFontFamily,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12.5,
                                      letterSpacing: 1.5,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  SizedBox(
                                    height: 96,
                                    child: ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: p.colorVariants.length,
                                      separatorBuilder: (context, index) =>
                                          const SizedBox(width: 10),
                                      itemBuilder: (context, index) {
                                        final sib = p.colorVariants[index];
                                        return GestureDetector(
                                          onTap: () => _loadProduct(sib.id),
                                          child: SizedBox(
                                            width: 64,
                                            child: Column(
                                              children: [
                                                Container(
                                                  decoration: BoxDecoration(
                                                    border: Border.all(
                                                      color: AppColors.cultured,
                                                    ),
                                                  ),
                                                  child: SmartNetworkImage(
                                                    imageUrl: sib.imageUrl,
                                                    width: 62,
                                                    height: 72,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  sib.color.toUpperCase(),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w700,
                                                    letterSpacing: 0.4,
                                                    color: AppColors.onyx,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ],

                                // 6. Concierge Live Supplier Negotiation CTA
                                const SizedBox(height: 18),
                                InkWell(
                                  onTap: _openSupplierChatSelector,
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppColors.editorialIvory,
                                      border: Border.all(
                                        color: AppColors.champagneGold
                                            .withValues(alpha: 0.65),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 38,
                                          height: 38,
                                          color: AppColors.obsidian,
                                          alignment: Alignment.center,
                                          child: const LuxuryIcon(
                                            kind: LuxuryIconKind.concierge,
                                            size: 18,
                                            color: Colors.white,
                                            accentColor:
                                                AppColors.champagneGold,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        const Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'TEDARİKÇİYE SOR / ÖZEL SERİ TEKLİFİ İSTE',
                                                style: TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 0.9,
                                                  color: AppColors.obsidian,
                                                ),
                                              ),
                                              SizedBox(height: 2),
                                              Text(
                                                'Üretici temsilcisiyle canlı pazarlık ve stok teyidi başlatın',
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  color: AppColors.sonicSilver,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 17,
                                          color: AppColors.editorialGold,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),

                                // 7. Architectural Specification Table & Description
                                if (specs.isNotEmpty ||
                                    p
                                        .localizedDescription(lang)
                                        .isNotEmpty) ...[
                                  const SizedBox(height: 22),
                                  const Text(
                                    'TEKNİK ÖZELLİKLER & DETAYLAR',
                                    style: TextStyle(
                                      fontFamily: AppColors.serifFontFamily,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12.5,
                                      letterSpacing: 1.5,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  if (specs.isNotEmpty)
                                    Container(
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                          color: AppColors.cultured,
                                        ),
                                      ),
                                      child: Column(
                                        children: [
                                          for (var i = 0;
                                              i < specs.length;
                                              i++) ...[
                                            if (i > 0)
                                              const Divider(height: 1),
                                            Padding(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 12,
                                                vertical: 9,
                                              ),
                                              child: Row(
                                                children: [
                                                  SizedBox(
                                                    width: 110,
                                                    child: Text(
                                                      specs[i].$1,
                                                      style: const TextStyle(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        letterSpacing: 1.0,
                                                        color: AppColors
                                                            .sonicSilver,
                                                      ),
                                                    ),
                                                  ),
                                                  Expanded(
                                                    child: Text(
                                                      specs[i].$2,
                                                      style: const TextStyle(
                                                        fontSize: 12.5,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        color:
                                                            AppColors.obsidian,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  if (p
                                      .localizedDescription(lang)
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    Text(
                                      p
                                          .localizedDescription(lang)
                                          .replaceAll(RegExp(r'<[^>]*>'), ''),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: AppColors.sonicSilver,
                                        height: 1.55,
                                      ),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
      bottomNavigationBar: p == null
          ? null
          : Container(
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                MediaQuery.of(context).padding.bottom + 12,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.cultured)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'TOPLAM ($_packagesQty SERİ • ${_packagesQty * p.unitsPerPackage} ADET)',
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: AppColors.sonicSilver,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          session.formatPrice(
                            p.packageTotalPrice * _packagesQty,
                            sourceCurrency: p.currency,
                          ),
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            color: AppColors.obsidian,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    height: 46,
                    child: Material(
                      color: AppColors.obsidian,
                      child: InkWell(
                        onTap: _addingCart ? null : _addToCart,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const LuxuryIcon(
                                kind: LuxuryIconKind.bag,
                                size: 16,
                                color: Colors.white,
                                accentColor: AppColors.champagneGold,
                              ),
                              const SizedBox(width: 9),
                              Text(
                                _addingCart
                                    ? 'EKLENİYOR...'
                                    : 'SERİYİ SEPETE EKLE',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _GalleryNavButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const _GalleryNavButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white.withValues(alpha: 0.92),
        child: InkWell(
          onTap: onPressed,
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black.withValues(alpha: 0.12)),
            ),
            alignment: Alignment.center,
            child: Icon(
              icon,
              color: AppColors.obsidian,
              size: 21,
            ),
          ),
        ),
      ),
    );
  }
}
