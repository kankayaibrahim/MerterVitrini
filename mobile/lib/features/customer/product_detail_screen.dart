import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/chat.dart';
import '../../models/product.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/smart_network_image.dart';
import '../auth/auth_screen.dart';
import '../chat/chat_conversation_screen.dart';
import 'direct_inquiry_sheet.dart';
import 'manufacturers_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String productId;

  const ProductDetailScreen({super.key, required this.productId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final PageController _pageController = PageController();

  Product? _product;
  bool _loading = true;
  String? _error;
  int _packagesQty = 1;
  int _activeImageIdx = 0;
  bool _addingCart = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadProduct(widget.productId);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
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
    final session = context.read<SessionProvider>();
    try {
      final prod = await session.api.fetchProductDetail(id);
      if (!mounted) return;
      setState(() {
        _product = prod;
        _packagesQty = prod.minOrderPackages;
      });
      await session.telemetry.trackScreenView(
        path: '/product/${prod.slug.isNotEmpty ? prod.slug : prod.id}',
        pageTitle: prod.localizedTitle(session.languageCode),
      );
      if (prod.brandId.isNotEmpty) {
        await session.telemetry.trackBrandEvent(
          brandId: prod.brandId,
          eventType: 'product_view',
          productId: prod.id,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addToCart() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    if (!session.canViewPrices) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const AuthScreen(initialRole: AppRole.customer),
        ),
      );
      return;
    }
    final p = _product;
    if (p == null) return;
    setState(() => _addingCart = true);
    try {
      await context.read<CartProvider>().addProductPackages(p, _packagesQty);
      if (!mounted) return;
      final totalUnits = _packagesQty * p.unitsPerPackage;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            UiText.seriesQuickAdded(lang, _packagesQty, totalUnits),
            style: const TextStyle(color: Colors.white),
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
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    if (!session.isMemberLoggedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthScreen()),
      );
      return;
    }

    final p = _product;
    if (p == null) return;

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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      p.maskedBrandName.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.0),
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
              const SizedBox(height: 4),
              Text(
                AppStrings.t(lang, 'live_chat'),
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.sonicSilver,
                ),
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              ...agents.map(
                (a) => ListTile(
                  contentPadding: const EdgeInsets.symmetric(vertical: 4),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.warmIvory,
                    child: Text(
                      a.contactName.isNotEmpty
                          ? a.contactName.characters.first.toUpperCase()
                          : 'S',
                      style: const TextStyle(
                        color: AppColors.obsidian,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  title: Text(
                    a.contactName,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '${a.jobTitle} • ${a.spokenLanguages}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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

  void _openBrandShowcase(Product p) {
    final slugOrId = (p.brandProfile != null && p.brandProfile!.slug.isNotEmpty)
        ? p.brandProfile!.slug
        : p.brandId;
    if (slugOrId.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ManufacturerDetailScreen(
          slugOrId: slugOrId,
          initialSummary: p.brandProfile,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final p = _product;
    final wishlisted = p != null && session.isWishlisted(p.id);

    final galleryUrls = p == null
        ? const <String>[]
        : (p.images.isNotEmpty
            ? p.images.map((e) => e.imageUrl).where((u) => u.isNotEmpty).toList()
            : [if (p.coverImageUrl.isNotEmpty) p.coverImageUrl]);

    final ratioText = p == null
        ? ''
        : (p.seriesRatio.trim().isNotEmpty
            ? p.seriesRatio.trim()
            : p.packingRatio.trim());

    final specs = <(String, String)>[
      if (p != null && p.fabric.trim().isNotEmpty)
        (AppStrings.tUpper(lang, 'fabric'), p.fabric.trim()),
      if (p != null && p.color.trim().isNotEmpty)
        (AppStrings.tUpper(lang, 'color'), p.color.trim()),
      if (p != null && p.gender.trim().isNotEmpty)
        (AppStrings.tUpper(lang, 'gender'), p.gender.trim()),
      if (p != null && p.season.trim().isNotEmpty)
        (AppStrings.tUpper(lang, 'season'), p.season.trim()),
      if (p != null && p.customSku.trim().isNotEmpty)
        (AppStrings.tUpper(lang, 'sku'), p.customSku.trim()),
      if (p != null)
        (
          AppStrings.tUpper(lang, 'series'),
          '${p.unitsPerPackage} ${AppStrings.t(lang, 'piece')} ($ratioText)',
        ),
    ];

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          p?.maskedBrandName.toUpperCase() ??
              AppStrings.tUpper(lang, 'wholesale_series'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          if (p != null) ...[
            IconButton(
              onPressed: () {
                final shareUrl = p.slug.isNotEmpty
                    ? 'https://mertervitrini.com.tr/product/${p.slug}'
                    : 'https://mertervitrini.com.tr';
                SharePlus.instance.share(
                  ShareParams(
                    text: '${p.localizedTitle(lang)} — $shareUrl',
                  ),
                );
              },
              icon: const LuxuryIcon(
                kind: LuxuryIconKind.share,
                size: 18,
                color: AppColors.obsidian,
              ),
            ),
            IconButton(
              onPressed: () => session.toggleWishlist(p),
              icon: LuxuryIcon(
                kind: LuxuryIconKind.heart,
                size: 18,
                active: wishlisted,
                color: wishlisted ? AppColors.discountRed : AppColors.obsidian,
                accentColor: AppColors.discountRed,
              ),
            ),
          ],
        ],
      ),
      body: _loading && p == null
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null && p == null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: () => _loadProduct(widget.productId),
                )
              : p == null
                  ? const SizedBox.shrink()
                  : SingleChildScrollView(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // 1. Multi-Image Editorial Carousel
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                            child: ClipRRect(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusLg),
                              child: Container(
                                color: AppColors.editorialOffWhite,
                                height: 390,
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    if (galleryUrls.isEmpty)
                                      const SmartNetworkImage(
                                        imageUrl: '',
                                        fit: BoxFit.cover,
                                      )
                                    else
                                      PageView.builder(
                                        controller: _pageController,
                                        itemCount: galleryUrls.length,
                                        onPageChanged: (idx) => setState(
                                          () => _activeImageIdx = idx,
                                        ),
                                        itemBuilder: (context, index) =>
                                            SmartNetworkImage(
                                          imageUrl: galleryUrls[index],
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    if (galleryUrls.length > 1) ...[
                                      Positioned(
                                        left: 10,
                                        top: 0,
                                        bottom: 0,
                                        child: Center(
                                          child: _CarouselArrowButton(
                                            icon: Icons.chevron_left_rounded,
                                            onTap: () => _goToImage(
                                              _activeImageIdx - 1,
                                              galleryUrls.length,
                                            ),
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        right: 10,
                                        top: 0,
                                        bottom: 0,
                                        child: Center(
                                          child: _CarouselArrowButton(
                                            icon: Icons.chevron_right_rounded,
                                            onTap: () => _goToImage(
                                              _activeImageIdx + 1,
                                              galleryUrls.length,
                                            ),
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        bottom: 12,
                                        left: 0,
                                        right: 0,
                                        child: Center(
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 5,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withValues(
                                                alpha: 0.5,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(99),
                                            ),
                                            child: Text(
                                              '${_activeImageIdx + 1} / ${galleryUrls.length}',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ),

                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // 2. Title + Price / Guest Lock + Series Stepper Card
                                EditorialCard(
                                  padding: const EdgeInsets.all(16),
                                  borderRadius: AppColors.radiusLg,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: [
                                          EditorialBadge(
                                            label:
                                                '${p.unitsPerPackage} ${AppStrings.t(lang, 'piece')} • $ratioText',
                                            backgroundColor:
                                                AppColors.warmIvory,
                                            languageCode: lang,
                                          ),
                                          EditorialBadge(
                                            label: p.stock > 0
                                                ? '${AppStrings.t(lang, 'in_stock')} (${p.seriesStock})'
                                                : AppStrings.t(
                                                    lang,
                                                    'out_of_stock',
                                                  ),
                                            backgroundColor: p.stock > 0
                                                ? AppColors.emeraldLight
                                                : AppColors.dangerLight,
                                            textColor: p.stock > 0
                                                ? AppColors.emerald
                                                : AppColors.danger,
                                            languageCode: lang,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
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
                                      if (p
                                          .localizedShortDescription(lang)
                                          .isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          p.localizedShortDescription(lang),
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: AppColors.sonicSilver,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],
                                      const Divider(height: 22),

                                      if (session.canViewPrices) ...[
                                        Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    AppStrings.tUpper(
                                                      lang,
                                                      'pack_price',
                                                    ),
                                                    style: const TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: AppColors
                                                          .sonicSilver,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    CurrencyFormatter.format(
                                                      p.packageTotalPrice,
                                                      currency:
                                                          session.currencyCode,
                                                      ratesToTry:
                                                          session.exchangeRates,
                                                      sourceCurrency:
                                                          p.currency,
                                                    ),
                                                    style: const TextStyle(
                                                      fontSize: 22,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                Text(
                                                  AppStrings.tUpper(
                                                    lang,
                                                    'unit_price',
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w800,
                                                    color:
                                                        AppColors.sonicSilver,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  session.formatPrice(
                                                    p.effectiveUnitPrice,
                                                    sourceCurrency: p.currency,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 14.5,
                                                    fontWeight: FontWeight.w800,
                                                    color:
                                                        AppColors.editorialGold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 14),
                                        // Series Quantity Stepper
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 8,
                                          ),
                                          decoration: BoxDecoration(
                                            color: AppColors.warmIvory,
                                            borderRadius: BorderRadius.circular(
                                              AppColors.radiusSm,
                                            ),
                                            border: Border.all(
                                              color: AppColors.cultured,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  '${AppStrings.t(lang, 'wholesale_series')} (${p.minOrderPackages}+ ${AppStrings.t(lang, 'package')})',
                                                  style: const TextStyle(
                                                    fontSize: 12.2,
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors.obsidian,
                                                  ),
                                                ),
                                              ),
                                              IconButton(
                                                onPressed: _packagesQty >
                                                        p.minOrderPackages
                                                    ? () => setState(
                                                        () => _packagesQty--)
                                                    : null,
                                                icon: const Icon(
                                                  Icons.remove_circle_outline,
                                                ),
                                              ),
                                              Text(
                                                '$_packagesQty',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                              IconButton(
                                                onPressed: () => setState(
                                                  () => _packagesQty++,
                                                ),
                                                icon: const Icon(
                                                  Icons.add_circle_outline,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ] else ...[
                                        // Localized Guest Members-Only Unlock Card
                                        Container(
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            color: AppColors.warmIvory,
                                            borderRadius: BorderRadius.circular(
                                              AppColors.radiusMd,
                                            ),
                                            border: Border.all(
                                              color: AppColors.champagneGold
                                                  .withValues(alpha: 0.6),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  const Icon(
                                                    Icons.lock_outline_rounded,
                                                    size: 18,
                                                    color:
                                                        AppColors.editorialGold,
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: Text(
                                                      AppStrings.tUpper(
                                                        lang,
                                                        'members_only',
                                                      ),
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        letterSpacing: AppStrings
                                                            .letterSpacing(
                                                          lang,
                                                          0.8,
                                                        ),
                                                        color:
                                                            AppColors.obsidian,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                AppStrings.t(
                                                  lang,
                                                  'guest_price_lock_subtitle',
                                                ),
                                                style: const TextStyle(
                                                  fontSize: 12.2,
                                                  color: AppColors.sonicSilver,
                                                  height: 1.4,
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: ElevatedButton(
                                                      onPressed: () {
                                                        Navigator.of(context)
                                                            .push(
                                                          MaterialPageRoute<
                                                              void>(
                                                            builder: (_) =>
                                                                const AuthScreen(
                                                              initialRole:
                                                                  AppRole
                                                                      .customer,
                                                            ),
                                                          ),
                                                        );
                                                      },
                                                      style: ElevatedButton
                                                          .styleFrom(
                                                        backgroundColor:
                                                            AppColors.obsidian,
                                                        foregroundColor:
                                                            Colors.white,
                                                        shape:
                                                            RoundedRectangleBorder(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                            AppColors.radiusSm,
                                                          ),
                                                        ),
                                                      ),
                                                      child: Text(
                                                        AppStrings.t(
                                                          lang,
                                                          'login',
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Expanded(
                                                    child: OutlinedButton(
                                                      onPressed: () {
                                                        Navigator.of(context)
                                                            .push(
                                                          MaterialPageRoute<
                                                              void>(
                                                            builder: (_) =>
                                                                const AuthScreen(
                                                              initialRole:
                                                                  AppRole
                                                                      .customer,
                                                              initialRegisterMode:
                                                                  true,
                                                            ),
                                                          ),
                                                        );
                                                      },
                                                      style: OutlinedButton
                                                          .styleFrom(
                                                        shape:
                                                            RoundedRectangleBorder(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                            AppColors.radiusSm,
                                                          ),
                                                        ),
                                                      ),
                                                      child: Text(
                                                        AppStrings.t(
                                                          lang,
                                                          'register',
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),

                                // 3. Color Sibling Variants
                                if (p.colorVariants.length > 1) ...[
                                  const SizedBox(height: 12),
                                  EditorialCard(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          UiText.colorVariantsLabel(
                                            lang,
                                            p.colorVariants.length,
                                          ),
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.obsidian,
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        SizedBox(
                                          height: 70,
                                          child: ListView.separated(
                                            scrollDirection: Axis.horizontal,
                                            itemCount: p.colorVariants.length,
                                            separatorBuilder: (_, _) =>
                                                const SizedBox(width: 8),
                                            itemBuilder: (context, idx) {
                                              final sib = p.colorVariants[idx];
                                              final current = sib.id == p.id;
                                              return InkWell(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                                onTap: current
                                                    ? null
                                                    : () =>
                                                        _loadProduct(sib.id),
                                                child: Container(
                                                  width: 56,
                                                  decoration: BoxDecoration(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      AppColors.radiusSm,
                                                    ),
                                                    border: Border.all(
                                                      color: current
                                                          ? AppColors.obsidian
                                                          : AppColors.cultured,
                                                      width: current ? 2 : 1,
                                                    ),
                                                  ),
                                                  clipBehavior: Clip.antiAlias,
                                                  child: SmartNetworkImage(
                                                    imageUrl: sib.imageUrl,
                                                    fit: BoxFit.cover,
                                                  ),
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 12),

                                // 4. Verified Manufacturer & Direct Inquiry Card
                                EditorialCard(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      InkWell(
                                        onTap: () => _openBrandShowcase(p),
                                        child: Row(
                                          children: [
                                            if (p.brandVerified) ...[
                                              const Icon(
                                                Icons.verified_rounded,
                                                size: 17,
                                                color: AppColors.emerald,
                                              ),
                                              const SizedBox(width: 6),
                                            ],
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    p.maskedBrandName,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      fontFamily: AppColors
                                                          .serifFontFamily,
                                                      fontSize: 16,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                  if (p.brandAddress.isNotEmpty)
                                                    Text(
                                                      p.brandAddress,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontSize: 11.5,
                                                        color: AppColors
                                                            .sonicSilver,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                            Text(
                                              AppStrings.t(
                                                lang,
                                                'visit_storefront',
                                              ),
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.editorialGold,
                                              ),
                                            ),
                                            const SizedBox(width: 4),
                                            const Icon(
                                              Icons.arrow_forward_rounded,
                                              size: 15,
                                              color: AppColors.editorialGold,
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: ElevatedButton.icon(
                                              onPressed: () =>
                                                  showDirectInquiryModal(
                                                context,
                                                brandId: p.brandId,
                                                brandName: p.maskedBrandName,
                                                product: p,
                                                initialPackagesQty:
                                                    _packagesQty,
                                              ),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor:
                                                    AppColors.obsidian,
                                                foregroundColor: Colors.white,
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                    AppColors.radiusSm,
                                                  ),
                                                ),
                                              ),
                                              icon: const Icon(
                                                Icons.mail_outline_rounded,
                                                size: 15,
                                              ),
                                              label: Text(
                                                AppStrings.t(
                                                  lang,
                                                  'direct_inquiry',
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: OutlinedButton.icon(
                                              onPressed:
                                                  _openSupplierChatSelector,
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor:
                                                    AppColors.obsidian,
                                                side: const BorderSide(
                                                  color: AppColors.obsidian,
                                                ),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                    AppColors.radiusSm,
                                                  ),
                                                ),
                                              ),
                                              icon: const Icon(
                                                Icons.forum_outlined,
                                                size: 15,
                                              ),
                                              label: Text(
                                                AppStrings.t(
                                                  lang,
                                                  'ask_supplier',
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (p.brandWhatsapp.isNotEmpty ||
                                          p.brandPhone.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: ElevatedButton.icon(
                                                onPressed: () {
                                                  session.telemetry
                                                      .trackBrandEvent(
                                                    brandId: p.brandId,
                                                    eventType: 'whatsapp_click',
                                                    productId: p.id,
                                                  );
                                                  final rawWa =
                                                      p.brandWhatsapp.isNotEmpty
                                                          ? p.brandWhatsapp
                                                          : p.brandPhone;
                                                  var digits = rawWa.replaceAll(
                                                    RegExp(r'\D'),
                                                    '',
                                                  );
                                                  if (digits.startsWith('0') &&
                                                      digits.length == 11) {
                                                    digits =
                                                        '90${digits.substring(1)}';
                                                  }
                                                  final msg =
                                                      '${p.maskedBrandName}: ${p.localizedTitle(lang)} (SKU: ${p.customSku}) - $_packagesQty ${AppStrings.t(lang, 'package')}';
                                                  final url = digits.isNotEmpty
                                                      ? 'https://wa.me/$digits?text=${Uri.encodeComponent(msg)}'
                                                      : 'https://wa.me/?text=${Uri.encodeComponent(msg)}';
                                                  launchUrl(
                                                    Uri.parse(url),
                                                    mode: LaunchMode
                                                        .externalApplication,
                                                  );
                                                },
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor:
                                                      AppColors.emerald,
                                                  foregroundColor: Colors.white,
                                                  shape: RoundedRectangleBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      AppColors.radiusSm,
                                                    ),
                                                  ),
                                                ),
                                                icon: const Icon(
                                                  Icons.chat_rounded,
                                                  size: 15,
                                                ),
                                                label: Text(
                                                  AppStrings.t(
                                                    lang,
                                                    'whatsapp_direct',
                                                  ),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                            ),
                                            if (p.brandPhone.isNotEmpty) ...[
                                              const SizedBox(width: 8),
                                              OutlinedButton.icon(
                                                onPressed: () {
                                                  session.telemetry
                                                      .trackBrandEvent(
                                                    brandId: p.brandId,
                                                    eventType: 'phone_click',
                                                    productId: p.id,
                                                  );
                                                  launchUrl(
                                                    Uri.parse(
                                                      'tel:${p.brandPhone}',
                                                    ),
                                                  );
                                                },
                                                style: OutlinedButton.styleFrom(
                                                  shape: RoundedRectangleBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      AppColors.radiusSm,
                                                    ),
                                                  ),
                                                ),
                                                icon: const Icon(
                                                  Icons.phone_in_talk_rounded,
                                                  size: 15,
                                                ),
                                                label: Text(p.brandPhone),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                ),

                                // 5. Technical Specs & Full Description
                                if (specs.isNotEmpty ||
                                    p.localizedDescription(lang).isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  EditorialCard(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        ...specs.map(
                                          (s) => Padding(
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 6,
                                            ),
                                            child: Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    s.$1,
                                                    style: const TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color:
                                                          AppColors.sonicSilver,
                                                    ),
                                                  ),
                                                ),
                                                Expanded(
                                                  child: Text(
                                                    s.$2,
                                                    textAlign: TextAlign.end,
                                                    style: const TextStyle(
                                                      fontSize: 12.5,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color: AppColors.obsidian,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                        if (p
                                            .localizedDescription(lang)
                                            .isNotEmpty) ...[
                                          const Divider(height: 20),
                                          Text(
                                            p.localizedDescription(lang),
                                            style: const TextStyle(
                                              fontSize: 13,
                                              color: AppColors.onyx,
                                              height: 1.55,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
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
                          '$_packagesQty ${AppStrings.tUpper(lang, 'package')} • ${_packagesQty * p.unitsPerPackage} ${AppStrings.tUpper(lang, 'piece')}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppColors.sonicSilver,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          session.canViewPrices
                              ? CurrencyFormatter.format(
                                  p.packageTotalPrice * _packagesQty,
                                  currency: session.currencyCode,
                                  ratesToTry: session.exchangeRates,
                                  sourceCurrency: p.currency,
                                )
                              : AppStrings.t(lang, 'members_only'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: session.canViewPrices ? 18 : 13.5,
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
                    child: ElevatedButton.icon(
                      onPressed: _addingCart ? null : _addToCart,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.obsidian,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusMd),
                        ),
                      ),
                      icon: _addingCart
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const LuxuryIcon(
                              kind: LuxuryIconKind.bag,
                              size: 16,
                              color: Colors.white,
                              accentColor: AppColors.champagneGold,
                            ),
                      label: Text(
                        !session.canViewPrices
                            ? AppStrings.tUpper(lang, 'login')
                            : AppStrings.tUpper(lang, 'card_add_to_cart'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: AppStrings.letterSpacing(lang, 0.9),
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

class _CarouselArrowButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CarouselArrowButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.85),
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        onTap: onTap,
        child: SizedBox(
          width: 34,
          height: 38,
          child: Icon(icon, color: AppColors.obsidian, size: 22),
        ),
      ),
    );
  }
}
