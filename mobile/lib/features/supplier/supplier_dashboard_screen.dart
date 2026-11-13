import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';
import 'supplier_analytics_screen.dart';
import 'supplier_billing_payouts_screen.dart';
import 'supplier_editorial_profile_screen.dart';
import 'supplier_product_wizard_screen.dart';
import 'supplier_rfqs_screen.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierDashboardScreen extends StatefulWidget {
  final void Function(int tabIndex) onNavigateTab;
  final VoidCallback? onOpenStudioRouteCompleted;

  const SupplierDashboardScreen({
    super.key,
    required this.onNavigateTab,
    this.onOpenStudioRouteCompleted,
  });

  @override
  State<SupplierDashboardScreen> createState() =>
      _SupplierDashboardScreenState();
}

class _SupplierDashboardScreenState extends State<SupplierDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      final sup = context.read<SupplierProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier',
          pageTitle: AppStrings.t(session.languageCode, 'nav_dashboard'),
        ),
      );
      sup.loadDashboard();
      if (sup.analyticsOverview == null && !sup.loadingAnalytics) {
        unawaited(_safeLoadAnalytics(sup));
      }
    });
  }

  Future<void> _safeLoadAnalytics(SupplierProvider sup) async {
    try {
      await sup.loadAnalytics(period: sup.analyticsPeriod);
    } catch (_) {}
  }

  Future<void> _pushScreen(Widget screen) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
    if (mounted) widget.onOpenStudioRouteCompleted?.call();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final sup = context.watch<SupplierProvider>();
    final lang = session.languageCode;
    final kpis = sup.kpis;
    final wallet = sup.wallet;
    final analytics = sup.analyticsOverview?.summary;

    final activeProducts = (kpis['active_products'] as num?)?.toInt() ?? 0;
    final totalProducts = (kpis['total_products'] as num?)?.toInt() ?? 0;
    final totalStock = (kpis['total_stock'] as num?)?.toInt() ?? 0;
    final pendingOrders = (kpis['pending_orders'] as num?)?.toInt() ?? 0;
    final unreadChats = (kpis['unread_chat_rooms'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      color: AppColors.luxuryBronze,
      onRefresh: () async {
        await sup.loadDashboard();
        await _safeLoadAnalytics(sup);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          _buildEditorialHeroCard(context, session, lang),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.5,
            children: [
              EditorialMetricTile(
                icon: Icons.checkroom_outlined,
                label: AppStrings.t(lang, 'active_products_count'),
                value: '$activeProducts / $totalProducts',
                subtitle: '$totalStock ${SupplierL10n.t(lang, 'unit_pcs_short')}',
                accentColor: AppColors.obsidian,
                onTap: () => widget.onNavigateTab(1),
              ),
              EditorialMetricTile(
                icon: Icons.local_shipping_outlined,
                label: SupplierL10n.t(lang, 'kpi_pending_orders'),
                value: '$pendingOrders',
                subtitle: SupplierL10n.t(lang, 'awaiting_fulfillment'),
                accentColor: AppColors.luxuryBronze,
                onTap: () => widget.onNavigateTab(3),
              ),
              EditorialMetricTile(
                icon: Icons.forum_outlined,
                label: AppStrings.t(lang, 'nav_chat'),
                value: '$unreadChats',
                subtitle: SupplierL10n.t(lang, 'live_chat_rooms'),
                accentColor: AppColors.emerald,
                onTap: () => widget.onNavigateTab(2),
              ),
              EditorialMetricTile(
                icon: Icons.account_balance_wallet_outlined,
                label: SupplierL10n.t(lang, 'kpi_available_balance'),
                value: CurrencyFormatter.format(
                  wallet.availableBalance,
                  currency: wallet.currency,
                ),
                subtitle:
                    '${SupplierL10n.t(lang, 'provision_label')}: ${CurrencyFormatter.format(wallet.pendingBalance, currency: wallet.currency)}',
                accentColor: AppColors.luxuryBronze,
                onTap: () => widget.onNavigateTab(4),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildRoiSnapshotCard(lang, analytics),
          const SizedBox(height: 16),
          _buildStudioHubCard(lang),
          if (sup.lowStockProducts.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildLowStockCard(lang, sup.lowStockProducts),
          ],
          const SizedBox(height: 16),
          _buildRecentOrdersCard(lang, sup),
        ],
      ),
    );
  }

  Widget _buildEditorialHeroCard(
    BuildContext context,
    SessionProvider session,
    String lang,
  ) {
    final brandLabel = session.supplierUser?.displayBrand ??
        AppStrings.t(lang, 'supplier_mode');

    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              EditorialStatusBadge.bronze(
                brandLabel,
                icon: Icons.workspace_premium_outlined,
              ),
              const Spacer(),
              TextButton.icon(
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.obsidian,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () => session.setActiveRole(AppRole.customer),
                icon: const Icon(Icons.storefront_outlined, size: 16),
                label: Text(
                  SupplierL10n.t(lang, 'switch_buyer'),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            SupplierL10n.t(lang, 'hero_studio_headline'),
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: AppColors.obsidian,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            SupplierL10n.t(lang, 'hero_studio_desc'),
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.charcoal,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidian,
                    foregroundColor: AppColors.pureWhite,
                  ),
                  onPressed: () => _pushScreen(
                    const SupplierProductWizardScreen(autoOpenCamera: true),
                  ),
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(
                    SupplierL10n.t(lang, 'quick_camera_cta'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pushScreen(
                    const SupplierProductWizardScreen(),
                  ),
                  icon: const Icon(Icons.add_box_outlined, size: 18),
                  label: Text(
                    SupplierL10n.t(lang, 'quick_wizard_cta'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRoiSnapshotCard(String lang, dynamic summary) {
    final profileViews = summary?.profileViews ?? 0;
    final productViews = summary?.productViews ?? 0;
    final contacts = summary?.totalBuyerContacts ?? 0;

    return EditorialSurfaceCard(
      onTap: () => _pushScreen(const SupplierAnalyticsScreen()),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            eyebrow: 'ANALYTICS',
            title: AppStrings.t(lang, 'supplier_analytics'),
            actionLabel: SupplierL10n.t(lang, 'open_analytics'),
            onAction: () => _pushScreen(const SupplierAnalyticsScreen()),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MiniRoiMetric(
                  label: AppStrings.t(lang, 'analytics_profile_views'),
                  value: '$profileViews',
                ),
              ),
              Expanded(
                child: _MiniRoiMetric(
                  label: AppStrings.t(lang, 'analytics_product_views'),
                  value: '$productViews',
                ),
              ),
              Expanded(
                child: _MiniRoiMetric(
                  label: AppStrings.t(lang, 'analytics_total_contacts'),
                  value: '$contacts',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStudioHubCard(String lang) {
    final destinations = [
      (
        icon: Icons.analytics_outlined,
        label: AppStrings.t(lang, 'supplier_analytics'),
        onTap: () => _pushScreen(const SupplierAnalyticsScreen()),
      ),
      (
        icon: Icons.request_quote_outlined,
        label: AppStrings.t(lang, 'rfq_board'),
        onTap: () => _pushScreen(const SupplierRfqsScreen()),
      ),
      (
        icon: Icons.receipt_long_outlined,
        label: SupplierL10n.t(lang, 'billing_payouts_title'),
        onTap: () => _pushScreen(const SupplierBillingPayoutsScreen()),
      ),
      (
        icon: Icons.store_mall_directory_outlined,
        label: AppStrings.t(lang, 'supplier_profile_editorial'),
        onTap: () => _pushScreen(const SupplierEditorialProfileScreen()),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EditorialSectionHeader(
          lang: lang,
          eyebrow: SupplierL10n.t(lang, 'studio_eyebrow'),
          title: SupplierL10n.t(lang, 'studio_hub'),
        ),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: destinations.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 2.35,
          ),
          itemBuilder: (_, idx) {
            final d = destinations[idx];
            return EditorialSurfaceCard(
              onTap: d.onTap,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: AppColors.accentGoldLight,
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                    child: Icon(
                      d.icon,
                      size: 18,
                      color: AppColors.luxuryBronze,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      d.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildLowStockCard(String lang, List<Map<String, dynamic>> items) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: AppColors.luxuryBronze,
                size: 19,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  SupplierL10n.t(lang, 'critical_stock_warning'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...items.map((item) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  SmartNetworkImage(
                    imageUrl: (item['cover_image'] ?? '').toString(),
                    width: 40,
                    height: 48,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (item['title'] ?? '').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppColors.obsidian,
                          ),
                        ),
                        Text(
                          '${AppStrings.t(lang, 'sku')}: ${item['custom_sku'] ?? ''}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.mutedAccessible,
                          ),
                        ),
                      ],
                    ),
                  ),
                  EditorialStatusBadge.danger(
                    '${item['stock'] ?? 0} ${SupplierL10n.t(lang, 'unit_pcs_short')}',
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildRecentOrdersCard(String lang, SupplierProvider sup) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: SupplierL10n.t(lang, 'recent_orders'),
            actionLabel: SupplierL10n.t(lang, 'view_all_orders'),
            onAction: () => widget.onNavigateTab(3),
          ),
          const SizedBox(height: 8),
          if (sup.recentOrders.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  SupplierL10n.t(lang, 'no_recent_orders_msg'),
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.mutedAccessible,
                  ),
                ),
              ),
            )
          else
            ...sup.recentOrders.map(
              (ord) => Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.warmHairline),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.accentGoldLight,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: const Icon(
                        Icons.inventory_2_outlined,
                        color: AppColors.luxuryBronze,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '#${ord.subOrderNumber}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5,
                              color: AppColors.obsidian,
                            ),
                          ),
                          const SizedBox(height: 2),
                          EditorialStatusBadge.forOrderStatus(lang, ord.status),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      CurrencyFormatter.format(
                        ord.netPayoutAmount,
                        currency: ord.currency,
                      ),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: AppColors.obsidian,
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
}

class _MiniRoiMetric extends StatelessWidget {
  final String label;
  final String value;

  const _MiniRoiMetric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.mutedAccessible,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: AppColors.obsidian,
          ),
        ),
      ],
    );
  }
}
