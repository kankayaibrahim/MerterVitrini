import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import '../auth/auth_screen.dart';
import 'product_detail_screen.dart';

class CustomerHomeScreen extends StatefulWidget {
  final void Function({String? categoryId, String? brandId, String? query})
      onOpenCatalog;

  const CustomerHomeScreen({super.key, required this.onOpenCatalog});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final PageController _heroPageCtrl = PageController();
  final TextEditingController _quickSearchCtrl = TextEditingController();
  Timer? _autoSlideTimer;
  int _activeSlide = 0;
  bool _singleColumnShowcase = false;

  static const int _slideCount = 6;

  @override
  void initState() {
    super.initState();
    _startAutoSlide();
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || !_heroPageCtrl.hasClients) return;
      final next = (_activeSlide + 1) % _slideCount;
      _heroPageCtrl.animateToPage(
        next,
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _jumpSlide(int target) {
    final next = (target % _slideCount + _slideCount) % _slideCount;
    setState(() => _activeSlide = next);
    if (_heroPageCtrl.hasClients) {
      _heroPageCtrl.animateToPage(
        next,
        duration: const Duration(milliseconds: 360),
        curve: Curves.easeOutCubic,
      );
    }
    _startAutoSlide();
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _heroPageCtrl.dispose();
    _quickSearchCtrl.dispose();
    super.dispose();
  }

  String? _findCategoryIdByKeyword(
    List<CategoryNode> nodes,
    List<String> keywords,
  ) {
    for (final node in nodes) {
      final slugLower = node.slug.toLowerCase();
      final titleLower = node.title.toLowerCase();
      for (final kw in keywords) {
        if (slugLower.contains(kw) || titleLower.contains(kw)) {
          return node.id;
        }
      }
      if (node.children.isNotEmpty) {
        final found = _findCategoryIdByKeyword(node.children, keywords);
        if (found != null) return found;
      }
    }
    return null;
  }

  void _openWomenCollection(SessionProvider session) {
    final catId = _findCategoryIdByKeyword(
      session.categories,
      const ['kadin-giyim', 'kadin', 'kadın'],
    );
    if (catId != null && catId.isNotEmpty) {
      widget.onOpenCatalog(categoryId: catId);
    } else {
      widget.onOpenCatalog(query: 'Kadın');
    }
  }

  void _openMenCollection(SessionProvider session) {
    final catId = _findCategoryIdByKeyword(
      session.categories,
      const ['erkek-giyim', 'erkek'],
    );
    if (catId != null && catId.isNotEmpty) {
      widget.onOpenCatalog(categoryId: catId);
    } else {
      widget.onOpenCatalog(query: 'Erkek');
    }
  }

  void _openCategorySelectorSheet(SessionProvider session, String lang) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: AppColors.cultured)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    AppStrings.t(lang, 'select_category').toUpperCase(),
                    style: const TextStyle(
                      fontFamily: AppColors.serifFontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.8,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close, size: 19),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  ListTile(
                    title: Text(
                      '✨ ${AppStrings.t(lang, 'all_products').toUpperCase()}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.0,
                      ),
                    ),
                    onTap: () {
                      Navigator.pop(ctx);
                      widget.onOpenCatalog();
                    },
                  ),
                  const Divider(height: 1),
                  ...session.categories.map(
                    (cat) => ListTile(
                      title: Text(
                        cat.displayTitle(lang).toUpperCase(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.0,
                        ),
                      ),
                      trailing: const Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: AppColors.sonicSilver,
                      ),
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onOpenCatalog(categoryId: cat.id);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<_PortalHeroSlide> _buildHeroSlides(
    SessionProvider session,
    String lang,
  ) {
    return <_PortalHeroSlide>[
      _PortalHeroSlide(
        bannerKey: 'hero_new_season',
        subtitle: AppStrings.t(lang, 'portal_slide0_subtitle'),
        title: AppStrings.t(lang, 'portal_slide0_title'),
        description: AppStrings.t(lang, 'portal_slide0_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide0_cta'),
        alignment: Alignment.topCenter,
        onTapCta: () => widget.onOpenCatalog(),
      ),
      _PortalHeroSlide(
        bannerKey: 'hero_women_collection',
        subtitle: AppStrings.t(lang, 'portal_slide1_subtitle'),
        title: AppStrings.t(lang, 'portal_slide1_title'),
        description: AppStrings.t(lang, 'portal_slide1_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide1_cta'),
        alignment: const Alignment(-0.3, -1.0),
        onTapCta: () => _openWomenCollection(session),
      ),
      _PortalHeroSlide(
        bannerKey: 'hero_men_collection',
        subtitle: AppStrings.t(lang, 'portal_slide2_subtitle'),
        title: AppStrings.t(lang, 'portal_slide2_title'),
        description: AppStrings.t(lang, 'portal_slide2_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide2_cta'),
        alignment: Alignment.topCenter,
        onTapCta: () => _openMenCollection(session),
      ),
      _PortalHeroSlide(
        bannerKey: 'hero_accessories',
        subtitle: AppStrings.t(lang, 'portal_slide3_subtitle'),
        title: AppStrings.t(lang, 'portal_slide3_title'),
        description: AppStrings.t(lang, 'portal_slide3_desc'),
        ctaLabel: AppStrings.t(lang, 'portal_slide3_cta'),
        alignment: Alignment.center,
        onTapCta: () => widget.onOpenCatalog(
          query: lang == 'tr' ? 'aksesuar' : 'accessories',
        ),
      ),
      _PortalHeroSlide(
        bannerKey: 'hero_new_opportunities',
        subtitle: AppStrings.t(lang, 'portal_wholesale_opportunities'),
        title: AppStrings.t(lang, 'portal_daily_opportunities').toUpperCase(),
        description: AppStrings.t(lang, 'portal_daily_opportunities_desc'),
        ctaLabel:
            AppStrings.t(lang, 'portal_examine_all_products').toUpperCase(),
        alignment: Alignment.center,
        onTapCta: () => widget.onOpenCatalog(),
      ),
      _PortalHeroSlide(
        bannerKey: 'hero_app_promo',
        subtitle: AppStrings.t(lang, 'portal_mobile_ease'),
        title: AppStrings.t(lang, 'portal_download_app').toUpperCase(),
        description: AppStrings.t(lang, 'portal_download_app_desc'),
        ctaLabel: AppStrings.t(lang, 'supplier_portal_login').toUpperCase(),
        alignment: Alignment.center,
        onTapCta: () {
          if (session.isSupplierLoggedIn) {
            session.setActiveRole(AppRole.supplier);
          } else {
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const AuthScreen(initialRole: AppRole.supplier),
              ),
            );
          }
        },
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isWide = screenWidth > 680;
    final slides = _buildHeroSlides(session, lang);

    final newArrivals = session.newestProducts.isNotEmpty
        ? session.newestProducts
        : session.featuredProducts;
    final previewProducts =
        newArrivals.take(isWide ? 12 : 8).toList(growable: false);

    return RefreshIndicator(
      color: AppColors.pureBlack,
      onRefresh: session.loadBootstrap,
      child: CustomScrollView(
        slivers: [
          // 0. Editorial Search + Quick Couture Category Strip
          SliverToBoxAdapter(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                children: [
                  Container(
                    height: 40,
                    padding: const EdgeInsets.only(left: 12),
                    decoration: BoxDecoration(
                      color: AppColors.editorialOffWhite,
                      border: Border.all(color: AppColors.cultured),
                    ),
                    child: Row(
                      children: [
                        const LuxuryIcon(
                          kind: LuxuryIconKind.search,
                          size: 15.5,
                          color: AppColors.sonicSilver,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _quickSearchCtrl,
                            textInputAction: TextInputAction.search,
                            onSubmitted: (q) =>
                                widget.onOpenCatalog(query: q.trim()),
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.obsidian,
                            ),
                            decoration: InputDecoration(
                              hintText: AppStrings.t(lang, 'search_hint'),
                              hintStyle: const TextStyle(
                                fontSize: 12,
                                color: AppColors.spanishGray,
                                fontWeight: FontWeight.w500,
                              ),
                              filled: false,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              isDense: true,
                              contentPadding:
                                  const EdgeInsets.symmetric(vertical: 9),
                            ),
                          ),
                        ),
                        InkWell(
                          onTap: () => widget.onOpenCatalog(
                            query: _quickSearchCtrl.text.trim(),
                          ),
                          child: Container(
                            width: 40,
                            height: 40,
                            color: AppColors.obsidian,
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.arrow_forward_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 34,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        InkWell(
                          onTap: () =>
                              _openCategorySelectorSheet(session, lang),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: const BoxDecoration(
                              color: AppColors.obsidian,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const LuxuryIcon(
                                  kind: LuxuryIconKind.collection,
                                  size: 13.5,
                                  color: Colors.white,
                                  accentColor: AppColors.champagneGold,
                                  active: true,
                                ),
                                const SizedBox(width: 7),
                                Text(
                                  AppStrings.tUpper(lang, 'select_category'),
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.0,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 14,
                                  color: AppColors.champagneGold,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () => widget.onOpenCatalog(),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 13),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.editorialIvory,
                              border: Border.all(
                                color: AppColors.champagneGold
                                    .withValues(alpha: 0.45),
                              ),
                            ),
                            child: Text(
                              AppStrings.tUpper(lang, 'all_products'),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                        ),
                        for (final cat in session.categories) ...[
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () =>
                                widget.onOpenCatalog(categoryId: cat.id),
                            child: Container(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 13),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                border: Border.all(color: AppColors.cultured),
                              ),
                              child: Text(
                                AppStrings.upper(
                                  cat.displayTitle(lang),
                                  lang,
                                ),
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.9,
                                  color: AppColors.onyx,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // A. PREMIUM AUTO-SLIDING HERO CAROUSEL (1:1 PortalView.tsx)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
              child: Container(
                height: isWide ? 420 : 340,
                decoration: BoxDecoration(
                  color: AppColors.editorialOffWhite,
                  border: Border.all(color: AppColors.cultured),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    PageView.builder(
                      controller: _heroPageCtrl,
                      itemCount: slides.length,
                      onPageChanged: (idx) =>
                          setState(() => _activeSlide = idx),
                      itemBuilder: (context, index) {
                        final slide = slides[index];
                        final assetPath = isWide
                            ? 'assets/banners/${slide.bannerKey}.webp'
                            : 'assets/banners/${slide.bannerKey}_mobile.webp';

                        return Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.asset(
                              assetPath,
                              fit: BoxFit.cover,
                              alignment: slide.alignment,
                              errorBuilder: (_, _, _) => Image.asset(
                                'assets/banners/${slide.bannerKey}.webp',
                                fit: BoxFit.cover,
                                alignment: slide.alignment,
                              ),
                            ),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.white.withValues(alpha: 0.72),
                                    Colors.white.withValues(alpha: 0.28),
                                    Colors.transparent,
                                  ],
                                  stops: const [0.0, 0.52, 1.0],
                                ),
                              ),
                            ),
                            Align(
                              alignment: isWide
                                  ? Alignment.centerLeft
                                  : Alignment.bottomLeft,
                              child: Padding(
                                padding: EdgeInsets.fromLTRB(
                                  isWide ? 44 : 16,
                                  16,
                                  16,
                                  isWide ? 24 : 34,
                                ),
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    maxWidth: isWide ? 390 : screenWidth - 64,
                                  ),
                                  child: Container(
                                    padding: EdgeInsets.all(isWide ? 26 : 18),
                                    decoration: BoxDecoration(
                                      color: AppColors.editorialIvory
                                          .withValues(alpha: 0.96),
                                      border: Border.all(
                                        color: AppColors.champagneGold
                                            .withValues(alpha: 0.42),
                                      ),
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          slide.subtitle.toUpperCase(),
                                          style: const TextStyle(
                                            color: AppColors.editorialGold,
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 2.3,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          slide.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontFamily:
                                                AppColors.serifFontFamily,
                                            fontSize: isWide ? 26 : 19,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.pureBlack,
                                            letterSpacing: 0.8,
                                            height: 1.15,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          slide.description,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AppColors.sonicSilver,
                                            height: 1.4,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        InkWell(
                                          onTap: slide.onTapCta,
                                          child: Container(
                                            padding: const EdgeInsets.only(
                                              bottom: 4,
                                            ),
                                            decoration: const BoxDecoration(
                                              border: Border(
                                                bottom: BorderSide(
                                                  color: AppColors.pureBlack,
                                                  width: 1.2,
                                                ),
                                              ),
                                            ),
                                            child: Text(
                                              slide.ctaLabel.toUpperCase(),
                                              style: const TextStyle(
                                                fontSize: 10.5,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 1.8,
                                                color: AppColors.pureBlack,
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
                          ],
                        );
                      },
                    ),

                    // Left Hero Arrow
                    Positioned(
                      left: 0,
                      top: 0,
                      bottom: 0,
                      child: Center(
                        child: _HeroEdgeArrow(
                          icon: Icons.chevron_left_rounded,
                          onTap: () => _jumpSlide(_activeSlide - 1),
                        ),
                      ),
                    ),

                    // Right Hero Arrow
                    Positioned(
                      right: 0,
                      top: 0,
                      bottom: 0,
                      child: Center(
                        child: _HeroEdgeArrow(
                          icon: Icons.chevron_right_rounded,
                          onTap: () => _jumpSlide(_activeSlide + 1),
                        ),
                      ),
                    ),

                    // Bottom Line Indicators
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 10,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List<Widget>.generate(
                          slides.length,
                          (i) => GestureDetector(
                            onTap: () => _jumpSlide(i),
                            behavior: HitTestBehavior.opaque,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 6,
                              ),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 220),
                                width: _activeSlide == i ? 28 : 12,
                                height: 2,
                                color: _activeSlide == i
                                    ? AppColors.obsidian
                                    : AppColors.spanishGray
                                        .withValues(alpha: 0.45),
                              ),
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

          // B. CATEGORY NAVIGATORS (Rectangular text badges)
          if (session.categories.isNotEmpty)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 34),
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: AppColors.cultured),
                    bottom: BorderSide(color: AppColors.cultured),
                  ),
                ),
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 10,
                  runSpacing: 10,
                  children: session.categories
                      .map(
                        (cat) => InkWell(
                          onTap: () =>
                              widget.onOpenCatalog(categoryId: cat.id),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 11,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border.all(
                                color: Colors.black.withValues(alpha: 0.12),
                              ),
                            ),
                            child: Text(
                              cat.displayTitle(lang).toUpperCase(),
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.8,
                                color: AppColors.onyx,
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ),

          // C. VISUAL PREMIUM SEASON COLLECTIONS GRID (1:1 PortalView.tsx)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 36),
              child: Column(
                children: [
                  _EditorialSectionTitle(
                    title: AppStrings.t(lang, 'portal_season_collections'),
                  ),
                  const SizedBox(height: 20),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final twoCols = constraints.maxWidth >= 640;
                      final cards = <_CollectionCardSpec>[
                        _CollectionCardSpec(
                          assetBase: 'collection_kadin',
                          subtitle:
                              AppStrings.t(lang, 'portal_women_trend_desc'),
                          title: AppStrings.t(lang, 'portal_women_clothing'),
                          alignment: Alignment.topCenter,
                          onTap: () => _openWomenCollection(session),
                        ),
                        _CollectionCardSpec(
                          assetBase: 'collection_erkek',
                          subtitle: AppStrings.t(lang, 'portal_men_trend_desc'),
                          title: AppStrings.t(lang, 'portal_men_clothing'),
                          alignment: Alignment.topCenter,
                          onTap: () => _openMenCollection(session),
                        ),
                        _CollectionCardSpec(
                          assetBase: 'collection_ic_giyim',
                          subtitle: AppStrings.t(lang, 'portal_lingerie_desc'),
                          title: AppStrings.t(lang, 'portal_lingerie'),
                          alignment: Alignment.center,
                          onTap: () => widget.onOpenCatalog(
                            query: lang == 'tr' ? 'tayt' : 'leggings',
                          ),
                        ),
                        _CollectionCardSpec(
                          assetBase: 'collection_aksesuar',
                          subtitle:
                              AppStrings.t(lang, 'portal_accessories_desc'),
                          title: AppStrings.t(lang, 'portal_accessories'),
                          alignment: Alignment.center,
                          onTap: () => widget.onOpenCatalog(
                            query: lang == 'tr' ? 'aksesuar' : 'accessories',
                          ),
                        ),
                      ];

                      if (twoCols) {
                        return GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: cards.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 16,
                            crossAxisSpacing: 16,
                            childAspectRatio: 16 / 10,
                          ),
                          itemBuilder: (_, idx) => _EditorialCollectionCard(
                            spec: cards[idx],
                            useMobileAsset: false,
                          ),
                        );
                      }

                      return Column(
                        children: [
                          for (var i = 0; i < cards.length; i++) ...[
                            if (i > 0) const SizedBox(height: 14),
                            AspectRatio(
                              aspectRatio: 16 / 10,
                              child: _EditorialCollectionCard(
                                spec: cards[i],
                                useMobileAsset: true,
                              ),
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

          // D. NEW ARRIVALS PREVIEW GRID ("YENİ GELEN SEÇKİNLER")
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
              child: Row(
                children: [
                  Expanded(
                    child: _EditorialSectionTitle(
                      title: AppStrings.t(lang, 'portal_new_arrivals'),
                    ),
                  ),
                  if (!isWide)
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            onTap: () =>
                                setState(() => _singleColumnShowcase = false),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 4,
                              ),
                              color: !_singleColumnShowcase
                                  ? AppColors.obsidian
                                  : Colors.transparent,
                              child: Icon(
                                Icons.grid_view_sharp,
                                size: 13,
                                color: !_singleColumnShowcase
                                    ? Colors.white
                                    : AppColors.sonicSilver,
                              ),
                            ),
                          ),
                          InkWell(
                            onTap: () =>
                                setState(() => _singleColumnShowcase = true),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 4,
                              ),
                              color: _singleColumnShowcase
                                  ? AppColors.obsidian
                                  : Colors.transparent,
                              child: Icon(
                                Icons.crop_portrait_sharp,
                                size: 13,
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
          _buildNewArrivalsSliver(
            context,
            previewProducts,
            session.loadingBootstrap,
            screenWidth,
          ),

          // E. POPULAR WHOLESALE B2B SEARCHES STRIP (1:1 PortalView.tsx)
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 36, 16, 28),
              padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 12),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: AppColors.cultured),
                  bottom: BorderSide(color: AppColors.cultured),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    AppStrings.t(lang, 'portal_popular_searches_title')
                        .toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: AppColors.serifFontFamily,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2.0,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 22,
                    runSpacing: 10,
                    children: [
                      _PopularSearchLink(
                        label:
                            AppStrings.t(lang, 'portal_popular_searches_link1'),
                        onTap: () => widget.onOpenCatalog(query: 'elbise'),
                      ),
                      _PopularSearchLink(
                        label:
                            AppStrings.t(lang, 'portal_popular_searches_link2'),
                        onTap: () => widget.onOpenCatalog(query: 'jaguar'),
                      ),
                      _PopularSearchLink(
                        label:
                            AppStrings.t(lang, 'portal_popular_searches_link3'),
                        onTap: () => widget.onOpenCatalog(query: 'büstiyer'),
                      ),
                      _PopularSearchLink(
                        label:
                            AppStrings.t(lang, 'portal_popular_searches_link4'),
                        onTap: () => _openMenCollection(session),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // F. BROWSE ALL CTA PANEL (1:1 PortalView.tsx)
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
              decoration: BoxDecoration(
                color: AppColors.editorialOffWhite,
                border: Border.all(color: AppColors.cultured),
              ),
              child: Column(
                children: [
                  Text(
                    AppStrings.t(lang, 'portal_explore_all_collections')
                        .toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2.0,
                      color: AppColors.editorialGold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Text(
                      AppStrings.t(lang, 'portal_all_in_one'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: AppColors.eerieBlack,
                        height: 1.25,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: Text(
                      AppStrings.t(lang, 'portal_all_in_one_desc'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.sonicSilver,
                        height: 1.45,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  InkWell(
                    onTap: () => widget.onOpenCatalog(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 13,
                      ),
                      color: AppColors.pureBlack,
                      child: Text(
                        AppStrings.t(lang, 'portal_examine_all_products')
                            .toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2.0,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNewArrivalsSliver(
    BuildContext context,
    List<Product> products,
    bool loading,
    double screenWidth,
  ) {
    final columns = _singleColumnShowcase && screenWidth < 680
        ? 1
        : (screenWidth / 210).floor().clamp(2, 4);
    final aspectRatio =
        _singleColumnShowcase && screenWidth < 680 ? 0.64 : 0.54;

    if (loading && products.isEmpty) {
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        sliver: SliverGrid(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: 18,
            crossAxisSpacing: 6,
            childAspectRatio: aspectRatio,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, _) => Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.cultured),
              ),
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Container(color: AppColors.cultured),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    height: 10,
                    width: 60,
                    color: AppColors.cultured,
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 12,
                    width: double.infinity,
                    color: AppColors.cultured,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    height: 30,
                    width: double.infinity,
                    color: AppColors.cultured,
                  ),
                ],
              ),
            ),
            childCount: 4,
          ),
        ),
      );
    }

    if (products.isEmpty) {
      return const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Center(
            child: Text(
              'Katalog ürünleri yükleniyor...',
              style: TextStyle(color: AppColors.sonicSilver, fontSize: 12.5),
            ),
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          mainAxisSpacing: 18,
          crossAxisSpacing: 6,
          childAspectRatio: aspectRatio,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final p = products[index];
            return B2BProductCard(
              product: p,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ProductDetailScreen(productId: p.id),
                  ),
                );
              },
            );
          },
          childCount: products.length,
        ),
      ),
    );
  }
}

class _PortalHeroSlide {
  final String bannerKey;
  final String subtitle;
  final String title;
  final String description;
  final String ctaLabel;
  final Alignment alignment;
  final VoidCallback onTapCta;

  const _PortalHeroSlide({
    required this.bannerKey,
    required this.subtitle,
    required this.title,
    required this.description,
    required this.ctaLabel,
    required this.alignment,
    required this.onTapCta,
  });
}

class _HeroEdgeArrow extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _HeroEdgeArrow({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.2),
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 34,
          height: 48,
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _EditorialSectionTitle extends StatelessWidget {
  final String title;

  const _EditorialSectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 24,
          height: 1,
          color: AppColors.champagneGold.withValues(alpha: 0.65),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            title.toUpperCase(),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: AppColors.serifFontFamily,
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.2,
              color: AppColors.obsidian,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Container(
          width: 24,
          height: 1,
          color: AppColors.champagneGold.withValues(alpha: 0.65),
        ),
      ],
    );
  }
}

class _CollectionCardSpec {
  final String assetBase;
  final String subtitle;
  final String title;
  final Alignment alignment;
  final VoidCallback onTap;

  const _CollectionCardSpec({
    required this.assetBase,
    required this.subtitle,
    required this.title,
    required this.alignment,
    required this.onTap,
  });
}

class _EditorialCollectionCard extends StatelessWidget {
  final _CollectionCardSpec spec;
  final bool useMobileAsset;

  const _EditorialCollectionCard({
    required this.spec,
    required this.useMobileAsset,
  });

  @override
  Widget build(BuildContext context) {
    final primaryPath = useMobileAsset
        ? 'assets/banners/${spec.assetBase}_mobile.webp'
        : 'assets/banners/${spec.assetBase}.webp';

    return InkWell(
      onTap: spec.onTap,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.cultured),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              primaryPath,
              fit: BoxFit.cover,
              alignment: spec.alignment,
              errorBuilder: (_, _, _) => Image.asset(
                'assets/banners/${spec.assetBase}.webp',
                fit: BoxFit.cover,
                alignment: spec.alignment,
              ),
            ),
            ColoredBox(color: Colors.black.withValues(alpha: 0.05)),
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(
                      color: Colors.black.withValues(alpha: 0.1),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        spec.subtitle.toUpperCase(),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.editorialGold,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        spec.title.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppColors.pureBlack,
                        ),
                      ),
                    ],
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

class _PopularSearchLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _PopularSearchLink({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
            color: AppColors.onyx,
          ),
        ),
      ),
    );
  }
}
