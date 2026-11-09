import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/localization.dart';
import '../features/auth/auth_screen.dart';
import '../models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/session_provider.dart';
import 'luxury_icons.dart';
import 'smart_network_image.dart';

class B2BProductCard extends StatefulWidget {
  final Product product;
  final VoidCallback onTap;

  const B2BProductCard({
    super.key,
    required this.product,
    required this.onTap,
  });

  @override
  State<B2BProductCard> createState() => _B2BProductCardState();
}

class _B2BProductCardState extends State<B2BProductCard> {
  int _imgIndex = 0;

  @override
  void didUpdateWidget(covariant B2BProductCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id) {
      _imgIndex = 0;
    }
  }

  void _stepImage(int delta, int count) {
    if (count <= 1) return;
    setState(() {
      _imgIndex = (_imgIndex + delta + count) % count;
    });
  }

  String _formatSeriesRatio(String ratio, String lang) {
    final trimmed = ratio.trim();
    if (trimmed.isEmpty || trimmed.toUpperCase() == 'STANDART') {
      return lang == 'tr' ? 'STD' : 'STD';
    }
    return trimmed.replaceAll(',', '-');
  }

  String _colorVariantsLabel(int count, String lang) {
    if (count <= 0) return '';
    if (lang == 'tr') return '+$count Renk';
    if (lang == 'ru') return '+$count Цветов';
    if (lang == 'ar') return '+$count ألوان';
    return '+$count Colors';
  }

  Future<void> _quickAddToCart(BuildContext context, Product product) async {
    final session = context.read<SessionProvider>();
    if (!session.canViewPrices) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthScreen()),
      );
      return;
    }
    final minPkgs = product.minOrderPackages;
    try {
      await context.read<CartProvider>().addProductPackages(product, minPkgs);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.obsidian,
          duration: const Duration(seconds: 2),
          content: Text(
            '$minPkgs Seri (${minPkgs * product.unitsPerPackage} Adet) sepete eklendi.',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.danger,
          content: Text(e.toString()),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final wishlisted = session.isWishlisted(product.id);
    final units = product.unitsPerPackage;
    final images = product.images;
    final safeIdx = images.isEmpty ? 0 : _imgIndex.clamp(0, images.length - 1);
    final activeUrl =
        images.isNotEmpty ? images[safeIdx].imageUrl : product.coverImageUrl;

    final hasDiscount = product.discountedPrice != null &&
        product.discountedPrice! > 0 &&
        product.discountedPrice! < product.price;
    final discountPct = hasDiscount && product.price > 0
        ? (((product.price - product.discountedPrice!) / product.price) * 100)
            .round()
        : 0;

    final ratioRaw = product.seriesRatio.trim().isNotEmpty
        ? product.seriesRatio
        : product.packingRatio;
    final ratioLabel = _formatSeriesRatio(ratioRaw, lang);
    final colorCountText =
        _colorVariantsLabel(product.colorVariants.length, lang);

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: ColoredBox(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Full-Bleed Tall Portrait Gallery Frame
            Expanded(
              child: GestureDetector(
                onHorizontalDragEnd: images.length > 1
                    ? (details) {
                        final vx = details.primaryVelocity ?? 0;
                        if (vx < -120) {
                          _stepImage(1, images.length);
                        } else if (vx > 120) {
                          _stepImage(-1, images.length);
                        }
                      }
                    : null,
                child: Container(
                  color: AppColors.editorialOffWhite,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      SmartNetworkImage(
                        imageUrl: activeUrl,
                        fit: BoxFit.cover,
                        alignment: Alignment.topCenter,
                      ),

                      // Top-Left: Discount or Serie Badge
                      Positioned(
                        top: 8,
                        left: 8,
                        child: (hasDiscount && session.canViewPrices)
                            ? Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 3.5,
                                ),
                                color: AppColors.discountRed,
                                child: Text(
                                  '-$discountPct%',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                              )
                            : Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 3.5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.90),
                                ),
                                child: Text(
                                  '$units ${AppStrings.tUpper(lang, 'piece')} • $ratioLabel',
                                  style: const TextStyle(
                                    color: AppColors.obsidian,
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.7,
                                  ),
                                ),
                              ),
                      ),

                      // Top-Right: Floating Wishlist Heart Button
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Material(
                          color: wishlisted
                              ? AppColors.obsidian
                              : Colors.white.withValues(alpha: 0.90),
                          child: InkWell(
                            onTap: () => session.toggleWishlist(product),
                            child: SizedBox(
                              width: 32,
                              height: 32,
                              child: Center(
                                child: LuxuryIcon(
                                  kind: LuxuryIconKind.heart,
                                  size: 15,
                                  active: wishlisted,
                                  color: wishlisted
                                      ? Colors.white
                                      : AppColors.obsidian,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Left / Right Chevrons for Multi-Image Browsing
                      if (images.length > 1) ...[
                        Positioned(
                          left: 4,
                          top: 0,
                          bottom: 0,
                          child: Center(
                            child: _CardChevronButton(
                              icon: Icons.chevron_left_rounded,
                              onPressed: () => _stepImage(-1, images.length),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 4,
                          top: 0,
                          bottom: 0,
                          child: Center(
                            child: _CardChevronButton(
                              icon: Icons.chevron_right_rounded,
                              onPressed: () => _stepImage(1, images.length),
                            ),
                          ),
                        ),
                      ],

                      // Bottom-Left: Color Variants Swatch Pill
                      if (colorCountText.isNotEmpty)
                        Positioned(
                          bottom: 10,
                          left: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3.5,
                            ),
                            color: Colors.white.withValues(alpha: 0.92),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  color: AppColors.obsidian,
                                ),
                                const SizedBox(width: 2),
                                Container(
                                  width: 6,
                                  height: 6,
                                  color: AppColors.champagneGold,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  AppStrings.upper(colorCountText, lang),
                                  style: const TextStyle(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.obsidian,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // Bottom-Right: Floating Quick-Add Bag Button
                      Positioned(
                        bottom: 10,
                        right: 8,
                        child: Material(
                          color: AppColors.obsidian.withValues(alpha: 0.92),
                          child: InkWell(
                            onTap: () => _quickAddToCart(context, product),
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: AppColors.champagneGold
                                      .withValues(alpha: 0.55),
                                  width: 0.8,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: const LuxuryIcon(
                                kind: LuxuryIconKind.bag,
                                size: 15,
                                color: Colors.white,
                                accentColor: AppColors.champagneGold,
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Bottom Edge: Minimalist Image Progress Indicator
                      if (images.length > 1)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Row(
                            children: List<Widget>.generate(
                              images.length > 6 ? 6 : images.length,
                              (i) => Expanded(
                                child: Container(
                                  height: 2,
                                  color: i == (safeIdx % 6)
                                      ? AppColors.obsidian
                                      : Colors.white.withValues(alpha: 0.55),
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

            // 2. Clean Editorial Info Block (Compact & Uncluttered)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 9, 4, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Row 1: Brand Name + SKU
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          product.maskedBrandName.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: AppColors.obsidian,
                            letterSpacing: 1.3,
                          ),
                        ),
                      ),
                      if (product.customSku.isNotEmpty)
                        Text(
                          product.customSku,
                          maxLines: 1,
                          style: const TextStyle(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.spanishGray,
                            letterSpacing: 0.3,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 2: Product Title
                  Text(
                    product.localizedTitle(lang),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.2,
                      fontWeight: FontWeight.w400,
                      color: AppColors. sonicSilver,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Row 3: Unit Price + 1 Serie Total Price (or Members-Only Lock CTA)
                  if (session.canViewPrices)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            if (hasDiscount) ...[
                              Text(
                                session.formatPrice(
                                  product.price,
                                  sourceCurrency: product.currency,
                                ),
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  color: AppColors.spanishGray,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                session.formatPrice(
                                  product.effectiveUnitPrice,
                                  sourceCurrency: product.currency,
                                ),
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.discountRed,
                                ),
                              ),
                            ] else
                              Text(
                                session.formatPrice(
                                  product.effectiveUnitPrice,
                                  sourceCurrency: product.currency,
                                ),
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.obsidian,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '1 ${AppStrings.t(lang, 'package')}: ${session.formatPrice(product.packageTotalPrice, sourceCurrency: product.currency)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.editorialGold,
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const AuthScreen(),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.obsidian,
                          border: Border.all(
                            color: AppColors.champagneGold.withValues(alpha: 0.55),
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.lock_outline_rounded,
                              size: 11,
                              color: AppColors.champagneGold,
                            ),
                            SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                'ÜYELERE ÖZEL FİYAT (GİRİŞ YAP)',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: 0.4,
                                ),
                              ),
                            ),
                          ],
                        ),
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
}

class _CardChevronButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;

  const _CardChevronButton({
    required this.icon,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.78),
      child: InkWell(
        onTap: onPressed,
        child: SizedBox(
          width: 24,
          height: 28,
          child: Icon(
            icon,
            size: 16,
            color: AppColors.obsidian,
          ),
        ),
      ),
    );
  }
}
