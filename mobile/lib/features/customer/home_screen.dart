import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/marketplace.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import '../../widgets/smart_network_image.dart';
import '../auth/supplier_application_screen.dart';
import 'blog_and_cms_screen.dart';
import 'manufacturers_screen.dart';
import 'product_detail_screen.dart';
import 'rfq_board_screen.dart';
import 'service_providers_screen.dart';

class CustomerHomeScreen extends StatefulWidget {
  final void Function({
    String? categoryId,
    String? brandId,
    String? brandSlug,
    String? query,
  }) onOpenCatalog;
  final ValueChanged<int>? onNavigateTab;

  const CustomerHomeScreen({
    super.key,
    required this.onOpenCatalog,
    this.onNavigateTab,
  });

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final _searchCtrl = TextEditingController();
  final _newsletterEmailCtrl = TextEditingController();
  late final PageController _heroController;
  Timer? _autoSlideTimer;

  int _heroIndex = 0;
  bool _singleColumnShowcase = false;
  bool _kvkkConsent = true;
  bool _subscribingNewsletter = false;
  bool _newsletterDone = false;

  List<SponsoredSlotItem> _sponsoredSlots = <SponsoredSlotItem>[];
  List<ManufacturerSummary> _manufacturers = <ManufacturerSummary>[];

  @override
  void initState() {
    super.initState();
    _heroController = PageController();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || !_heroController.hasClients) return;
      final next = (_heroIndex + 1) % 4;
      _heroController.animateToPage(
        next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutCubic,
      );
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMarketplaceFeeds());
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _heroController.dispose();
    _searchCtrl.dispose();
    _newsletterEmailCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMarketplaceFeeds() async {
    if (!mounted) return;
    final session = context.read<SessionProvider>();
    try {
      final results = await Future.wait([
        session.api.listSponsoredSlots(placement: 'home'),
        session.api.listManufacturers(),
      ]);
      if (!mounted) return;
      setState(() {
        _sponsoredSlots = results[0] as List<SponsoredSlotItem>;
        _manufacturers = results[1] as List<ManufacturerSummary>;
      });
    } catch (_) {}
  }

  Future<void> _refreshAll() async {
    final session = context.read<SessionProvider>();
    await Future.wait([
      session.loadBootstrap(),
      _loadMarketplaceFeeds(),
    ]);
  }

  void _submitSearch(String raw) {
    final q = raw.trim();
    if (q.isNotEmpty) {
      context.read<SessionProvider>().telemetry.trackSearchEvent(
            queryText: q,
            eventType: 'home_quick_search',
          );
    }
    widget.onOpenCatalog(query: q);
  }

  Future<void> _openCategorySheet(SessionProvider session) async {
    final lang = session.languageCode;
    final cats = session.categories;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.72,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.warmHairline,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppStrings.tUpper(lang, 'categories'),
                        style: TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          letterSpacing: AppStrings.letterSpacing(lang, 1.1),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ),
                  ],
                ),
                const Divider(height: 14),
                Expanded(
                  child: ListView(
                    children: [
                      ListTile(
                        title: Text(
                          AppStrings.t(lang, 'all_products'),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          Navigator.pop(ctx);
                          widget.onOpenCatalog();
                        },
                      ),
                      ...cats.map(
                        (c) => ListTile(
                          title: Text(c.displayTitle(lang)),
                          subtitle: c.activeProducts > 0
                              ? Text('${c.activeProducts}')
                              : null,
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () {
                            Navigator.pop(ctx);
                            widget.onOpenCatalog(categoryId: c.id);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _onTapSponsoredSlot(SponsoredSlotItem slot) async {
    final session = context.read<SessionProvider>();
    session.api.trackSponsoredSlotClick(slot.id);
    if (slot.brandSlug.isNotEmpty) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ManufacturerDetailScreen(slugOrId: slot.brandSlug),
        ),
      );
      return;
    }
    if (slot.brandId != null && slot.brandId!.isNotEmpty) {
      widget.onOpenCatalog(brandId: slot.brandId);
      return;
    }
    if (slot.categorySlug.isNotEmpty) {
      widget.onOpenCatalog(query: slot.categorySlug);
      return;
    }
    if (slot.targetUrl.isNotEmpty) {
      final uri = Uri.tryParse(slot.targetUrl);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  Future<void> _subscribeNewsletter() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final email = _newsletterEmailCtrl.text.trim();
    if (!email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppStrings.t(lang, 'err_validation')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    if (!_kvkkConsent) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppStrings.t(lang, 'newsletter_kvkk_required')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _subscribingNewsletter = true);
    try {
      await session.api.subscribeNewsletter(
        NewsletterSubscribePayload(
          email: email,
          fullName: session.customerUser?.fullName ?? '',
          preferredLang: lang,
          kvkkConsent: _kvkkConsent,
          commercialConsent: true,
        ),
      );
      if (!mounted) return;
      setState(() => _newsletterDone = true);
      _newsletterEmailCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'newsletter_subscribed'),
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
      if (mounted) setState(() => _subscribingNewsletter = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth >= 680;

    final featured = session.featuredProducts;
    final newest = session.newestProducts;
    final previewProducts = <Product>[
      ...featured,
      ...newest.where((n) => !featured.any((f) => f.id == n.id)),
    ].take(12).toList();

    final slides = <_HeroSlideSpec>[
      _HeroSlideSpec(
        bannerAsset: 'assets/banners/hero_slide_0.webp',
        subtitle: AppStrings.t(lang, 'portal_slide0_subtitle'),
        title: AppStrings.t(lang, 'portal_slide0_title'),
        description: AppStrings.t(lang, 'portal_slide0_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide0_cta'),
        onTap: () => widget.onOpenCatalog(),
      ),
      _HeroSlideSpec(
        bannerAsset: 'assets/banners/hero_slide_1.webp',
        subtitle: AppStrings.t(lang, 'portal_slide1_subtitle'),
        title: AppStrings.t(lang, 'portal_slide1_title'),
        description: AppStrings.t(lang, 'portal_slide1_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide1_cta'),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const ManufacturersScreen()),
        ),
      ),
      _HeroSlideSpec(
        bannerAsset: 'assets/banners/hero_slide_2.webp',
        subtitle: AppStrings.t(lang, 'portal_slide2_subtitle'),
        title: AppStrings.t(lang, 'portal_slide2_title'),
        description: AppStrings.t(lang, 'portal_slide2_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide2_cta'),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const RfqBoardScreen()),
        ),
      ),
      _HeroSlideSpec(
        bannerAsset: 'assets/banners/hero_slide_3.webp',
        subtitle: AppStrings.t(lang, 'portal_slide3_subtitle'),
        title: AppStrings.t(lang, 'portal_slide3_title'),
        description: AppStrings.t(lang, 'portal_slide3_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide3_cta'),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const SupplierApplicationScreen(),
          ),
        ),
      ),
    ];

    return RefreshIndicator(
      color: AppColors.obsidian,
      onRefresh: _refreshAll,
      child: CustomScrollView(
        slivers: [
          // 1. Quick B2B Search & Category Header Strip
          SliverToBoxAdapter(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchCtrl,
                          onSubmitted: _submitSearch,
                          textInputAction: TextInputAction.search,
                          decoration: InputDecoration(
                            hintText: AppStrings.t(lang, 'search_hint'),
                            prefixIcon:
                                const Icon(Icons.search_rounded, size: 20),
                            suffixIcon: IconButton(
                              onPressed: () => _submitSearch(_searchCtrl.text),
                              icon: const Icon(
                                Icons.arrow_forward_rounded,
                                size: 19,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Material(
                        color: AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        child: InkWell(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                          onTap: () => _openCategorySheet(session),
                          child: Container(
                            height: 46,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusSm),
                              border: Border.all(color: AppColors.cultured),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const LuxuryIcon(
                                  kind: LuxuryIconKind.collection,
                                  size: 16,
                                  color: AppColors.obsidian,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  AppStrings.t(lang, 'categories'),
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // 2. Light Luxury Editorial Hero Carousel
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppColors.radiusLg),
                child: SizedBox(
                  height: isWide ? 340 : 250,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      PageView.builder(
                        controller: _heroController,
                        itemCount: slides.length,
                        onPageChanged: (i) => setState(() => _heroIndex = i),
                        itemBuilder: (context, index) {
                          final s = slides[index];
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.asset(
                                s.bannerAsset,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => Container(
                                  color: AppColors.warmIvory,
                                ),
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.black.withValues(alpha: 0.08),
                                      Colors.black.withValues(alpha: 0.62),
                                    ],
                                  ),
                                ),
                              ),
                              Align(
                                alignment: Alignment.bottomLeft,
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    18,
                                    16,
                                    18,
                                    26,
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white
                                              .withValues(alpha: 0.92),
                                          borderRadius: BorderRadius.circular(
                                            AppColors.radiusSm,
                                          ),
                                        ),
                                        child: Text(
                                          AppStrings.upper(s.subtitle, lang),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing:
                                                AppStrings.letterSpacing(
                                              lang,
                                              1.0,
                                            ),
                                            color: AppColors.editorialGold,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        s.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: AppColors.serifFontFamily,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.white,
                                          height: 1.18,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        s.description,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 11.8,
                                          color: Colors.white
                                              .withValues(alpha: 0.9),
                                          height: 1.35,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      ElevatedButton(
                                        onPressed: s.onTap,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.white,
                                          foregroundColor: AppColors.obsidian,
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 14,
                                            vertical: 9,
                                          ),
                                          minimumSize: const Size(0, 34),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(
                                              AppColors.radiusSm,
                                            ),
                                          ),
                                        ),
                                        child: Text(
                                          AppStrings.upper(s.ctaLabel, lang),
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing:
                                                AppStrings.letterSpacing(
                                              lang,
                                              0.8,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      Positioned(
                        bottom: 10,
                        right: 14,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(
                            slides.length,
                            (i) => Container(
                              width: i == _heroIndex ? 16 : 6,
                              height: 6,
                              margin: const EdgeInsets.only(left: 4),
                              decoration: BoxDecoration(
                                color: i == _heroIndex
                                    ? AppColors.champagneGold
                                    : Colors.white.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(99),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 3. B2B Portal Quick Tiles
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
              child: GridView.count(
                crossAxisCount: isWide ? 4 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: isWide ? 1.85 : 2.15,
                children: [
                  _PortalQuickTile(
                    icon: Icons.factory_outlined,
                    title: AppStrings.t(lang, 'manufacturers_directory'),
                    accent: AppColors.editorialGold,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ManufacturersScreen(),
                      ),
                    ),
                  ),
                  _PortalQuickTile(
                    icon: Icons.request_quote_outlined,
                    title: AppStrings.t(lang, 'rfq_board'),
                    accent: AppColors.obsidian,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const RfqBoardScreen(),
                      ),
                    ),
                  ),
                  _PortalQuickTile(
                    icon: Icons.local_shipping_outlined,
                    title: AppStrings.t(lang, 'service_providers'),
                    accent: AppColors.emerald,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ServiceProvidersScreen(),
                      ),
                    ),
                  ),
                  _PortalQuickTile(
                    icon: Icons.article_outlined,
                    title: AppStrings.t(lang, 'blog_title'),
                    accent: AppColors.obsidian,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const BlogAndCmsScreen(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Become a Supplier Banner Strip
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: EditorialCard(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const SupplierApplicationScreen(),
                  ),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                backgroundColor: Colors.white,
                borderColor: AppColors.champagneGold.withValues(alpha: 0.55),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_user_outlined,
                      size: 19,
                      color: AppColors.editorialGold,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        AppStrings.t(lang, 'supplier_apply'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: AppColors.obsidian,
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4. Sponsored Slots Showcase
          if (_sponsoredSlots.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 20, 12, 10),
                child: EditorialSectionHeader(
                  eyebrow: AppStrings.t(lang, 'sponsored_badge'),
                  title: AppStrings.t(lang, 'sponsored_suppliers'),
                  languageCode: lang,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 164,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _sponsoredSlots.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final slot = _sponsoredSlots[index];
                    return SizedBox(
                      width: 280,
                      child: EditorialCard(
                        padding: const EdgeInsets.all(12),
                        onTap: () => _onTapSponsoredSlot(slot),
                        borderColor:
                            AppColors.champagneGold.withValues(alpha: 0.6),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(
                                AppColors.radiusSm,
                              ),
                              child: SizedBox(
                                width: 88,
                                height: 138,
                                child: SmartNetworkImage(
                                  imageUrl: slot.imageUrl,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  EditorialBadge(
                                    label: slot.localizedBadge(lang).isNotEmpty
                                        ? slot.localizedBadge(lang)
                                        : AppStrings.t(lang, 'sponsored_badge'),
                                    backgroundColor: AppColors.obsidian,
                                    textColor: AppColors.champagneGold,
                                    borderColor: AppColors.obsidian,
                                    languageCode: lang,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    slot.localizedTitle(lang).isNotEmpty
                                        ? slot.localizedTitle(lang)
                                        : slot.brandName,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: AppColors.serifFontFamily,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    slot.localizedSubtitle(lang).isNotEmpty
                                        ? slot.localizedSubtitle(lang)
                                        : slot.city,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.sonicSilver,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    slot.localizedCta(lang).isNotEmpty
                                        ? slot.localizedCta(lang)
                                        : AppStrings.t(lang, 'visit_storefront'),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.editorialGold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],

          // 5. Verified Manufacturers Preview Strip
          if (_manufacturers.isNotEmpty || session.brands.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 20, 12, 10),
                child: EditorialSectionHeader(
                  eyebrow: AppStrings.t(lang, 'verified_manufacturer'),
                  title: AppStrings.t(lang, 'manufacturers_directory'),
                  actionLabel: AppStrings.t(lang, 'view_all'),
                  onActionTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const ManufacturersScreen(),
                    ),
                  ),
                  languageCode: lang,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 126,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _manufacturers.isNotEmpty
                      ? _manufacturers.take(10).length
                      : session.brands.take(10).length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    if (_manufacturers.isNotEmpty) {
                      final m = _manufacturers[index];
                      return SizedBox(
                        width: 215,
                        child: EditorialCard(
                          padding: const EdgeInsets.all(12),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => ManufacturerDetailScreen(
                                slugOrId: m.slug.isNotEmpty ? m.slug : m.id,
                                initialSummary: m,
                              ),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  if (m.isVerified) ...[
                                    const Icon(
                                      Icons.verified_rounded,
                                      size: 14,
                                      color: AppColors.emerald,
                                    ),
                                    const SizedBox(width: 4),
                                  ],
                                  Expanded(
                                    child: Text(
                                      m.displayName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontFamily: AppColors.serifFontFamily,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                m.locationAddress.isNotEmpty
                                    ? m.locationAddress
                                    : 'Merter, İstanbul',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                              const Spacer(),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${m.activeProductCount} ${AppStrings.t(lang, 'nav_products')}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.editorialGold,
                                      ),
                                    ),
                                  ),
                                  const Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 14,
                                    color: AppColors.obsidian,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }
                    final b = session.brands[index];
                    return SizedBox(
                      width: 215,
                      child: EditorialCard(
                        padding: const EdgeInsets.all(12),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => ManufacturerDetailScreen(
                              slugOrId: b.slug.isNotEmpty ? b.slug : b.id,
                            ),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                if (b.isVerified) ...[
                                  const Icon(
                                    Icons.verified_rounded,
                                    size: 14,
                                    color: AppColors.emerald,
                                  ),
                                  const SizedBox(width: 4),
                                ],
                                Expanded(
                                  child: Text(
                                    b.maskedDisplayName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: AppColors.serifFontFamily,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const Spacer(),
                            Text(
                              '${b.activeProductCount} ${AppStrings.t(lang, 'nav_products')}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: AppColors.editorialGold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],

          // 6. Featured & New Arrivals Showcase Grid
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 22, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: EditorialSectionHeader(
                      eyebrow: AppStrings.t(lang, 'featured_collections'),
                      title: AppStrings.t(lang, 'portal_new_arrivals'),
                      languageCode: lang,
                    ),
                  ),
                  if (!isWide)
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            borderRadius: const BorderRadius.horizontal(
                              left: Radius.circular(AppColors.radiusSm),
                            ),
                            onTap: () =>
                                setState(() => _singleColumnShowcase = false),
                            child: Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: !_singleColumnShowcase
                                    ? AppColors.obsidian
                                    : Colors.transparent,
                                borderRadius: const BorderRadius.horizontal(
                                  left: Radius.circular(AppColors.radiusSm - 1),
                                ),
                              ),
                              child: Icon(
                                Icons.grid_view_rounded,
                                size: 15,
                                color: !_singleColumnShowcase
                                    ? Colors.white
                                    : AppColors.sonicSilver,
                              ),
                            ),
                          ),
                          InkWell(
                            borderRadius: const BorderRadius.horizontal(
                              right: Radius.circular(AppColors.radiusSm),
                            ),
                            onTap: () =>
                                setState(() => _singleColumnShowcase = true),
                            child: Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: _singleColumnShowcase
                                    ? AppColors.obsidian
                                    : Colors.transparent,
                                borderRadius: const BorderRadius.horizontal(
                                  right: Radius.circular(
                                    AppColors.radiusSm - 1,
                                  ),
                                ),
                              ),
                              child: Icon(
                                Icons.view_agenda_outlined,
                                size: 15,
                                color: _singleColumnShowcase
                                    ? Colors.white
                                    : AppColors.sonicSilver,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          if (session.loadingBootstrap && previewProducts.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
            )
          else if (previewProducts.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text(
                    AppStrings.t(lang, 'loading'),
                    style: const TextStyle(color: AppColors.sonicSilver),
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: _singleColumnShowcase && !isWide
                      ? 1
                      : (screenWidth / 210).floor().clamp(2, 4),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 10,
                  childAspectRatio:
                      _singleColumnShowcase && !isWide ? 0.65 : 0.54,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final p = previewProducts[index];
                    return B2BProductCard(
                      product: p,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                ProductDetailScreen(productId: p.id),
                          ),
                        );
                      },
                    );
                  },
                  childCount: previewProducts.length,
                ),
              ),
            ),

          // Browse All CTA Panel
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 20, 12, 0),
              child: EditorialCard(
                padding: const EdgeInsets.all(20),
                backgroundColor: Colors.white,
                child: Column(
                  children: [
                    Text(
                      AppStrings.tUpper(lang, 'portal_explore_all_collections'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.4),
                        color: AppColors.editorialGold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      AppStrings.t(lang, 'portal_all_in_one'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        onPressed: () => widget.onOpenCatalog(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                          ),
                        ),
                        child: Text(
                          AppStrings.tUpper(lang, 'portal_examine_all_products'),
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 7. Newsletter Subscription Card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 16, 12, 28),
              child: EditorialCard(
                padding: const EdgeInsets.all(18),
                backgroundColor: Colors.white,
                borderColor: AppColors.champagneGold.withValues(alpha: 0.45),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      AppStrings.t(lang, 'newsletter_title'),
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 16.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      AppStrings.t(lang, 'newsletter_subtitle'),
                      style: const TextStyle(
                        fontSize: 12.2,
                        color: AppColors.sonicSilver,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_newsletterDone)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.emeraldLight,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.check_circle_outline_rounded,
                              color: AppColors.emerald,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                AppStrings.t(lang, 'newsletter_subscribed'),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.emerald,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                    else ...[
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _newsletterEmailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                hintText: AppStrings.t(lang, 'email'),
                                prefixIcon: const Icon(
                                  Icons.mail_outline_rounded,
                                  size: 18,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 46,
                            child: ElevatedButton(
                              onPressed: _subscribingNewsletter
                                  ? null
                                  : _subscribeNewsletter,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.obsidian,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(AppColors.radiusSm),
                                ),
                              ),
                              child: _subscribingNewsletter
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      AppStrings.t(
                                        lang,
                                        'newsletter_subscribe',
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
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: () =>
                            setState(() => _kvkkConsent = !_kvkkConsent),
                        child: Row(
                          children: [
                            Checkbox(
                              value: _kvkkConsent,
                              activeColor: AppColors.obsidian,
                              visualDensity: VisualDensity.compact,
                              onChanged: (v) =>
                                  setState(() => _kvkkConsent = v ?? false),
                            ),
                            Expanded(
                              child: Text(
                                AppStrings.t(lang, 'privacy_policy'),
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.sonicSilver,
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
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroSlideSpec {
  final String bannerAsset;
  final String subtitle;
  final String title;
  final String description;
  final String ctaLabel;
  final VoidCallback onTap;

  const _HeroSlideSpec({
    required this.bannerAsset,
    required this.subtitle,
    required this.title,
    required this.description,
    required this.ctaLabel,
    required this.onTap,
  });
}

class _PortalQuickTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color accent;
  final VoidCallback onTap;

  const _PortalQuickTile({
    required this.icon,
    required this.title,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return EditorialCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.warmIvory,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: AppColors.serifFontFamily,
                fontSize: 12.2,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
