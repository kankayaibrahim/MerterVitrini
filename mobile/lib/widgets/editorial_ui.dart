import 'package:flutter/material.dart';

import '../core/app_theme.dart';
import '../core/localization.dart';

/// 8-language helper for supplementary B2B UI microcopy that complements
/// [AppStrings] without altering `mobile/lib/core/localization.dart`.
class UiText {
  UiText._();

  static String pick(
    String langCode, {
    required String tr,
    required String en,
    String? ru,
    String? ar,
    String? de,
    String? fr,
    String? pl,
    String? bg,
  }) {
    switch (AppStrings.normalizeCode(langCode)) {
      case 'en':
        return en;
      case 'ru':
        return ru ?? en;
      case 'ar':
        return ar ?? en;
      case 'de':
        return de ?? en;
      case 'fr':
        return fr ?? en;
      case 'pl':
        return pl ?? en;
      case 'bg':
        return bg ?? en;
      case 'tr':
      default:
        return tr;
    }
  }

  static String colorVariantsLabel(String langCode, int count) {
    final code = AppStrings.normalizeCode(langCode);
    switch (code) {
      case 'tr':
        return '$count Renk';
      case 'ru':
        return '$count цв.';
      case 'ar':
        return '$count ألوان';
      case 'de':
        return '$count Farben';
      case 'fr':
        return '$count Couleurs';
      case 'pl':
        return '$count Kolory';
      case 'bg':
        return '$count цвята';
      case 'en':
      default:
        return '$count Colors';
    }
  }

  static String seriesQuickAdded(String langCode, int minPkgs, int totalUnits) {
    final pkgWord = AppStrings.t(langCode, 'package');
    final pcsWord = AppStrings.t(langCode, 'piece');
    final suffix = pick(
      langCode,
      tr: 'sepete eklendi.',
      en: 'added to bag.',
      ru: 'добавлено в корзину.',
      ar: 'تمت الإضافة إلى الحقيبة.',
      de: 'in den Warenkorb gelegt.',
      fr: 'ajouté au panier.',
      pl: 'dodano do koszyka.',
      bg: 'добавено в кошницата.',
    );
    return '$minPkgs $pkgWord ($totalUnits $pcsWord) $suffix';
  }

  static String statusLabel(String langCode, String rawStatus) {
    switch (rawStatus.toUpperCase()) {
      case 'PENDING_PAYMENT':
        return pick(
          langCode,
          tr: 'Ödeme Bekleniyor',
          en: 'Awaiting Payment',
          ru: 'Ожидает оплаты',
          ar: 'بانتظار الدفع',
          de: 'Zahlung ausstehend',
          fr: 'En attente de paiement',
          pl: 'Oczekuje na płatność',
          bg: 'Очаква плащане',
        );
      case 'PAYMENT_NOTIFIED':
        return pick(
          langCode,
          tr: 'Ödeme Bildirildi',
          en: 'Payment Notified',
          ru: 'Оплата подтверждена',
          ar: 'تم إشعار الدفع',
          de: 'Zahlung gemeldet',
          fr: 'Paiement signalé',
          pl: 'Zgłoszono płatność',
          bg: 'Плащането е заявено',
        );
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PREPARING':
        return pick(
          langCode,
          tr: 'Hazırlanıyor',
          en: 'Preparing',
          ru: 'Готовится',
          ar: 'قيد التجهيز',
          de: 'In Vorbereitung',
          fr: 'En préparation',
          pl: 'W przygotowaniu',
          bg: 'В подготовка',
        );
      case 'SHIPPED':
        return pick(
          langCode,
          tr: 'Kargoda',
          en: 'Shipped',
          ru: 'Отправлено',
          ar: 'تم الشحن',
          de: 'Versendet',
          fr: 'Expédié',
          pl: 'Wysłano',
          bg: 'Изпратено',
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return pick(
          langCode,
          tr: 'Teslim Edildi',
          en: 'Delivered',
          ru: 'Доставлено',
          ar: 'تم التسليم',
          de: 'Geliefert',
          fr: 'Livré',
          pl: 'Dostarczono',
          bg: 'Доставено',
        );
      case 'CANCELLED':
        return pick(
          langCode,
          tr: 'İptal Edildi',
          en: 'Cancelled',
          ru: 'Отменено',
          ar: 'ملغي',
          de: 'Storniert',
          fr: 'Annulé',
          pl: 'Anulowano',
          bg: 'Отказано',
        );
      default:
        return rawStatus;
    }
  }
}

/// Crisp Corporate Light Luxury Editorial container card (`8–12px` radius).
class EditorialCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color backgroundColor;
  final Color borderColor;
  final double borderRadius;
  final VoidCallback? onTap;

  const EditorialCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.backgroundColor = Colors.white,
    this.borderColor = AppColors.cultured,
    this.borderRadius = AppColors.radiusMd,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: AppColors.obsidian.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return content;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(borderRadius),
      child: InkWell(
        borderRadius: BorderRadius.circular(borderRadius),
        onTap: onTap,
        child: content,
      ),
    );
  }
}

/// Editorial status or capability pill badge (`8px` radius).
class EditorialBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;
  final IconData? icon;
  final String languageCode;

  const EditorialBadge({
    super.key,
    required this.label,
    this.backgroundColor = AppColors.editorialOffWhite,
    this.textColor = AppColors.obsidian,
    this.borderColor,
    this.icon,
    this.languageCode = 'tr',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(
          color: borderColor ?? AppColors.cultured,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: AppStrings.letterSpacing(languageCode, 0.6),
                color: textColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Overflow-safe section header with optional right-aligned CTA button.
class EditorialSectionHeader extends StatelessWidget {
  final String title;
  final String? eyebrow;
  final String? actionLabel;
  final VoidCallback? onActionTap;
  final String languageCode;

  const EditorialSectionHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.actionLabel,
    this.onActionTap,
    this.languageCode = 'tr',
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                Text(
                  AppStrings.upper(eyebrow!, languageCode),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: AppStrings.letterSpacing(languageCode, 1.4),
                    color: AppColors.editorialGold,
                  ),
                ),
                const SizedBox(height: 3),
              ],
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: AppStrings.letterSpacing(languageCode, 0.3),
                  color: AppColors.obsidian,
                ),
              ),
            ],
          ),
        ),
        if (actionLabel != null && onActionTap != null) ...[
          const SizedBox(width: 10),
          TextButton(
            onPressed: onActionTap,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.obsidian,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  actionLabel!,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_forward_rounded, size: 14),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Standard Corporate Light Luxury empty / error state block.
class EditorialEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EditorialEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: AppColors.editorialOffWhite,
                borderRadius: BorderRadius.circular(AppColors.radiusLg),
                border: Border.all(color: AppColors.cultured),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 30, color: AppColors.obsidian),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: AppColors.serifFontFamily,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.sonicSilver,
                height: 1.45,
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.obsidian,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  ),
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
