import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_theme.dart';
import '../../../core/currency_formatter.dart';
import '../../../core/localization.dart';
import '../../../providers/session_provider.dart';
import '../../../widgets/country_flag_icon.dart';
import '../utils/supplier_l10n.dart';

/// Pure white editorial card with `#E7E2D8` hairline border and `8–12px` radius.
class EditorialSurfaceCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;
  final Color? borderColor;
  final double borderRadius;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const EditorialSurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.backgroundColor,
    this.borderColor,
    this.borderRadius = AppColors.radiusLg,
    this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    final box = Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.pureWhite,
        borderRadius: radius,
        border: Border.all(color: borderColor ?? AppColors.warmHairline),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          borderRadius: radius,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
    return box;
  }
}

/// Editorial section title with optional eyebrow caption and trailing action link.
class EditorialSectionHeader extends StatelessWidget {
  final String lang;
  final String title;
  final String? eyebrow;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EditorialSectionHeader({
    super.key,
    required this.lang,
    required this.title,
    this.eyebrow,
    this.actionLabel,
    this.onAction,
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
                  AppStrings.normalizeCode(lang) == 'ar'
                      ? eyebrow!
                      : eyebrow!.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: AppStrings.letterSpacing(lang, 1.3),
                    color: AppColors.luxuryBronze,
                  ),
                ),
                const SizedBox(height: 2),
              ],
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.obsidian,
                ),
              ),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.luxuryBronze,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              actionLabel!,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

/// Refined light KPI metric card with top micro-icon pill, figure, and caption.
class EditorialMetricTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final Color accentColor;
  final VoidCallback? onTap;

  const EditorialMetricTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.subtitle,
    this.accentColor = AppColors.luxuryBronze,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return EditorialSurfaceCard(
      onTap: onTap,
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.11),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Icon(icon, color: accentColor, size: 17),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.mutedAccessible,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.obsidian,
              ),
            ),
          ),
          if (subtitle != null && subtitle!.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: accentColor,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// WCAG AA compliant luxury hairline status pill (`8px` radius).
class EditorialStatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color? backgroundColor;
  final IconData? icon;

  const EditorialStatusBadge({
    super.key,
    required this.label,
    required this.color,
    this.backgroundColor,
    this.icon,
  });

  factory EditorialStatusBadge.positive(String label, {IconData? icon}) =>
      EditorialStatusBadge(
        label: label,
        color: AppColors.emerald,
        backgroundColor: AppColors.emeraldLight,
        icon: icon,
      );

  factory EditorialStatusBadge.bronze(String label, {IconData? icon}) =>
      EditorialStatusBadge(
        label: label,
        color: AppColors.luxuryBronze,
        backgroundColor: AppColors.accentGoldLight,
        icon: icon,
      );

  factory EditorialStatusBadge.warning(String label, {IconData? icon}) =>
      EditorialStatusBadge(
        label: label,
        color: const Color(0xFFB45309),
        backgroundColor: const Color(0xFFFEF3C7),
        icon: icon,
      );

  factory EditorialStatusBadge.danger(String label, {IconData? icon}) =>
      EditorialStatusBadge(
        label: label,
        color: AppColors.danger,
        backgroundColor: AppColors.dangerLight,
        icon: icon,
      );

  factory EditorialStatusBadge.neutral(String label, {IconData? icon}) =>
      EditorialStatusBadge(
        label: label,
        color: AppColors.charcoal,
        backgroundColor: AppColors.warmSurface,
        icon: icon,
      );

  static EditorialStatusBadge forOrderStatus(String lang, String status) {
    final upper = status.trim().toUpperCase();
    final label = SupplierL10n.orderStatusLabel(lang, upper);
    switch (upper) {
      case 'DELIVERED':
        return EditorialStatusBadge.positive(label);
      case 'CONFIRMED':
      case 'ACCEPTED':
      case 'PREPARING':
      case 'SENT_TO_HUB':
      case 'SHIPPED':
        return EditorialStatusBadge.bronze(label);
      case 'CANCELLED':
        return EditorialStatusBadge.danger(label);
      default:
        return EditorialStatusBadge.neutral(label);
    }
  }

  static EditorialStatusBadge forRfqStatus(String lang, String status) {
    final lower = status.trim().toLowerCase();
    final label = SupplierL10n.rfqStatusLabel(lang, lower);
    if (lower == 'open' || lower == 'active') {
      return EditorialStatusBadge.positive(label);
    }
    if (lower == 'quoted' || lower == 'in_progress') {
      return EditorialStatusBadge.bronze(label);
    }
    return EditorialStatusBadge.neutral(label);
  }

  static EditorialStatusBadge forBillingOrPayout(String lang, String status, {bool isPayout = false}) {
    final upper = status.trim().toUpperCase();
    final label = isPayout
        ? SupplierL10n.payoutStatusLabel(lang, upper)
        : SupplierL10n.billingStatusLabel(lang, upper);
    if (upper == 'ACTIVE' || upper == 'PAID' || upper == 'APPROVED' || upper == 'COMPLETED') {
      return EditorialStatusBadge.positive(label);
    }
    if (upper == 'OVERDUE' || upper == 'REJECTED' || upper == 'CANCELLED' || upper == 'CANCELED') {
      return EditorialStatusBadge.danger(label);
    }
    if (upper == 'PENDING' || upper == 'PROCESSING' || upper == 'UNPAID' || upper == 'AWAITING_PAYMENT') {
      return EditorialStatusBadge.bronze(label);
    }
    return EditorialStatusBadge.neutral(label);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor ?? color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Clean horizontal distribution progress bar used in Analytics & Quotas.
class EditorialBarMeter extends StatelessWidget {
  final double ratio;
  final Color color;
  final double height;

  const EditorialBarMeter({
    super.key,
    required this.ratio,
    this.color = AppColors.luxuryBronze,
    this.height = 7,
  });

  @override
  Widget build(BuildContext context) {
    final clamped = ratio.clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: LinearProgressIndicator(
        value: clamped,
        minHeight: height,
        backgroundColor: AppColors.warmSurface,
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }
}

/// Corporate Light empty & retry state card.
class EditorialEmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EditorialEmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: EditorialSurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.warmSurface,
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                ),
                child: Icon(icon, size: 32, color: AppColors.luxuryBronze),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.charcoal,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: 14),
                OutlinedButton(
                  onPressed: onAction,
                  child: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Consistent Corporate Light subpage AppBar with pure white/ivory tone and `#E7E2D8` divider.
PreferredSizeWidget buildSupplierSubPageAppBar({
  required BuildContext context,
  required String title,
  String? subtitle,
  List<Widget>? actions,
  PreferredSizeWidget? bottom,
}) {
  return AppBar(
    backgroundColor: AppColors.pureWhite,
    foregroundColor: AppColors.obsidian,
    elevation: 0,
    scrolledUnderElevation: 0,
    surfaceTintColor: Colors.transparent,
    titleSpacing: 8,
    title: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.obsidian,
          ),
        ),
        if (subtitle != null && subtitle.trim().isNotEmpty)
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.mutedAccessible,
            ),
          ),
      ],
    ),
    actions: actions,
    bottom: bottom ??
        const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: AppColors.warmHairline),
        ),
  );
}

/// Interactive Light modal dialog allowing supplier users to switch across all 8
/// languages and 5 currencies seamlessly.
Future<void> showSupplierLanguageCurrencyDialog(BuildContext context) async {
  final session = context.read<SessionProvider>();
  final lang = session.languageCode;
  final curr = session.currencyCode;
  const supportedCurrencies = ['TRY', 'USD', 'EUR', 'GBP', 'RUB'];

  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.pureWhite,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (ctx) {
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                AppStrings.t(lang, 'language'),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.obsidian,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: AppStrings.supportedCodes.map((code) {
                  final selected = AppStrings.normalizeCode(lang) == code;
                  return InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: () {
                      session.setLanguage(code);
                      Navigator.pop(ctx);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.accentGoldLight
                            : AppColors.warmIvory,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(
                          color: selected
                              ? AppColors.luxuryBronze
                              : AppColors.warmHairline,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CountryFlagIcon(code: code, width: 18, height: 13),
                          const SizedBox(width: 7),
                          Text(
                            AppStrings.localeLabels[code] ?? code.toUpperCase(),
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: selected
                                  ? AppColors.luxuryBronze
                                  : AppColors.obsidian,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 18),
              const Divider(color: AppColors.warmHairline),
              const SizedBox(height: 12),
              Text(
                AppStrings.t(lang, 'currency'),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.obsidian,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: supportedCurrencies.map((c) {
                  final selected = curr.toUpperCase() == c;
                  final symbol = CurrencyFormatter.symbols[c] ?? '';
                  return InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: () {
                      session.setCurrency(c);
                      Navigator.pop(ctx);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.accentGoldLight
                            : AppColors.warmIvory,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(
                          color: selected
                              ? AppColors.luxuryBronze
                              : AppColors.warmHairline,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CountryFlagIcon(code: c, width: 18, height: 13),
                          const SizedBox(width: 6),
                          Text(
                            '$c $symbol',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: selected
                                  ? AppColors.luxuryBronze
                                  : AppColors.obsidian,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      );
    },
  );
}
