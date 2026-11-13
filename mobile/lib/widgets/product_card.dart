import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/currency_formatter.dart';
import '../core/localization.dart';
import '../models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/session_provider.dart';
import '../features/auth/auth_screen.dart';
import 'editorial_ui.dart';
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
  bool _adding = false;

  Future<void> _quickAdd() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    if (!session.canViewPrices) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthScreen()),
      );
      return;
    }

    setState(() => _adding = true);
    try {
      final minPkgs = widget.product.minOrderPackages;
      await context.read<CartProvider>().addProductPackages(
            widget.product,
            minPkgs,
          );
      if (!mounted) return;
      final totalUnits = minPkgs * widget.product.unitsPerPackage;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 2),
          backgroundColor: AppColors.obsidian,
          content: Text(
            UiText.seriesQuickAdded(lang, minPkgs, totalUnits),
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
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final p = widget.product;
    final wishlisted = session.isWishlisted(p.id);
    final inStock = p.stock > 0;
    final hasDiscount = p.hasDiscount;

    final int? discountPct = hasDiscount && p.price > 0
        ? (((p.price - p.discountedPrice!) / p.price) * 100).round().clamp(1, 95)
        : null;

    final int units = p.unitsPerPackage;
    final String ratioLabel = p.seriesRatio.trim().isNotEmpty
        ? p.seriesRatio.trim()
        : (p.packingRatio.trim().isNotEmpty ? p.packingRatio.trim() : '1S-1M-1L');
    final int colorCount = p.colorVariants.length > 1 ? p.colorVariants.length : 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radiusMd),
        border: Border.all(color: AppColors.cultured),
        boxShadow: [
          BoxShadow(
            color: AppColors.obsidian.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppColors.radiusMd),
        onTap: widget.onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Portrait 3:4 Editorial Product Media
            AspectRatio(
              aspectRatio: 3 / 4,
              child: Container(
                color: AppColors.editorialOffWhite,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    SmartNetworkImage(
                      imageUrl: p.coverImageUrl,
                      fit: BoxFit.cover,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(AppColors.radiusMd - 1),
                      ),
                    ),

                    // Top-Left Editorial Badges (Discount + Series + Stock)
                    Positioned(
                      top: 8,
                      left: 8,
                      right: 44,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (discountPct != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 4),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.discountRed,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radiusSm),
                              ),
                              child: Text(
                                '-$discountPct%',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: AppStrings.letterSpacing(lang, 0.5),
                                ),
                              ),
                            ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3.5,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusSm),
                              border: Border.all(
                                color: AppColors.champagneGold.withValues(
                                  alpha: 0.5,
                                ),
                              ),
                            ),
                            child: Text(
                              '$units ${AppStrings.tUpper(lang, 'piece')} • $ratioLabel',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: AppColors.obsidian,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: AppStrings.letterSpacing(lang, 0.4),
                              ),
                            ),
                          ),
                          if (!inStock)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.obsidian.withValues(alpha: 0.85),
                                borderRadius:
                                    BorderRadius.circular(AppColors.radiusSm),
                              ),
                              child: Text(
                                AppStrings.tUpper(lang, 'out_of_stock'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: AppStrings.letterSpacing(lang, 0.4),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),

                    // Top-Right Wishlist Icon Button (8px radius)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Material(
                        color: Colors.white.withValues(alpha: 0.94),
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        child: InkWell(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                          onTap: () => session.toggleWishlist(p),
                          child: Container(
                            width: 31,
                            height: 31,
                            decoration: BoxDecoration(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusSm),
                              border: Border.all(color: AppColors.cultured),
                            ),
                            alignment: Alignment.center,
                            child: LuxuryIcon(
                              kind: LuxuryIconKind.heart,
                              size: 14,
                              active: wishlisted,
                              color: wishlisted
                                  ? AppColors.discountRed
                                  : AppColors.obsidian,
                              accentColor: AppColors.discountRed,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Bottom-Left Color Variants Count Pill
                    if (colorCount > 0)
                      Positioned(
                        left: 8,
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3.5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.94),
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                            border: Border.all(color: AppColors.cultured),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.editorialGold,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                UiText.colorVariantsLabel(lang, colorCount),
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.obsidian,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                    // Bottom-Right Quick-Add Bag Button (8px radius)
                    Positioned(
                      right: 8,
                      bottom: 8,
                      child: Material(
                        color: inStock
                            ? AppColors.obsidian
                            : AppColors.sonicSilver.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        child: InkWell(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                          onTap: _adding || !inStock ? null : _quickAdd,
                          child: Container(
                            width: 34,
                            height: 34,
                            alignment: Alignment.center,
                            child: _adding
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 1.8,
                                      color: Colors.white,
                                    ),
                                  )
                                : const LuxuryIcon(
                                    kind: LuxuryIconKind.bag,
                                    size: 16,
                                    color: Colors.white,
                                    accentColor: AppColors.champagneGold,
                                  ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 2. Editorial Metadata Section (Overflow-safe for all 8 languages)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(9, 8, 9, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Open Wholesale Brand Row + Verified Badge
                    Row(
                      children: [
                        if (p.brandVerified) ...[
                          const Icon(
                            Icons.verified_rounded,
                            size: 12,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            p.maskedBrandName.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9.2,
                              fontWeight: FontWeight.w800,
                              letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                              color: AppColors.editorialGold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),

                    // Localized Product Title
                    Expanded(
                      child: Text(
                        p.localizedTitle(lang),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 12.2,
                          fontWeight: FontWeight.w600,
                          height: 1.24,
                          color: AppColors.eerieBlack,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),

                    // SKU + MOQ subtle line
                    Text(
                      p.customSku.isNotEmpty
                          ? '${p.customSku} • ${AppStrings.t(lang, 'moq')}: ${p.minOrderPackages}'
                          : '${AppStrings.t(lang, 'moq')}: ${p.minOrderPackages} ${AppStrings.t(lang, 'package')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 9.5,
                        color: AppColors.sonicSilver,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 6),

                    // B2B Price Area OR Localized Member-Only Gate
                    if (session.canViewPrices) ...[
                      Row(
                        children: [
                          if (hasDiscount) ...[
                            Flexible(
                              child: Text(
                                CurrencyFormatter.format(
                                  p.price * p.unitsPerPackage,
                                  currency: session.currencyCode,
                                  ratesToTry: session.exchangeRates,
                                  sourceCurrency: p.currency,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  color: AppColors.spanishGray,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ),
                            const SizedBox(width: 5),
                          ],
                          Expanded(
                            child: Text(
                              CurrencyFormatter.format(
                                p.packageTotalPrice,
                                currency: session.currencyCode,
                                ratesToTry: session.exchangeRates,
                                sourceCurrency: p.currency,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w900,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${session.formatPrice(hasDiscount ? p.discountedPrice! : p.price, sourceCurrency: p.currency)} / ${AppStrings.t(lang, 'piece').toLowerCase()}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.sonicSilver,
                        ),
                      ),
                    ] else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warmIvory,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                          border: Border.all(
                            color: AppColors.champagneGold.withValues(
                              alpha: 0.5,
                            ),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.lock_outline_rounded,
                              size: 11,
                              color: AppColors.editorialGold,
                            ),
                            const SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                '${AppStrings.t(lang, 'members_only')} • ${AppStrings.t(lang, 'login')}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing:
                                      AppStrings.letterSpacing(lang, 0.3),
                                  color: AppColors.obsidian,
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
          ],
        ),
      ),
    );
  }
}
