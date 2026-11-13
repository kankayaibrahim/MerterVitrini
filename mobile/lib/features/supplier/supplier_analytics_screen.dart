import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/marketplace.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/country_flag_icon.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierAnalyticsScreen extends StatefulWidget {
  final bool showAppBar;

  const SupplierAnalyticsScreen({super.key, this.showAppBar = true});

  @override
  State<SupplierAnalyticsScreen> createState() =>
      _SupplierAnalyticsScreenState();
}

class _SupplierAnalyticsScreenState extends State<SupplierAnalyticsScreen> {
  static const List<String> _periods = ['7d', '30d', '90d'];
  String? _loadError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final sup = context.read<SupplierProvider>();
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/analytics',
          pageTitle: AppStrings.t(session.languageCode, 'supplier_analytics'),
        ),
      );
      if (sup.analyticsOverview == null && !sup.loadingAnalytics) {
        _loadPeriod(sup.analyticsPeriod);
      }
    });
  }

  Future<void> _loadPeriod(String period) async {
    setState(() => _loadError = null);
    try {
      await context.read<SupplierProvider>().loadAnalytics(period: period);
    } catch (e) {
      if (mounted) {
        setState(() => _loadError = e.toString());
      }
    }
  }

  Future<void> _selectPeriod(String period) async {
    final session = context.read<SessionProvider>();
    unawaited(
      session.telemetry.trackScreenView(
        path: '/supplier/analytics?period=$period',
        pageTitle: AppStrings.t(session.languageCode, 'supplier_analytics'),
      ),
    );
    await _loadPeriod(period);
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final sup = context.watch<SupplierProvider>();
    final lang = session.languageCode;
    final overview = sup.analyticsOverview;

    final body = RefreshIndicator(
      color: AppColors.luxuryBronze,
      onRefresh: () => _loadPeriod(sup.analyticsPeriod),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          _PeriodSelectorStrip(
            lang: lang,
            selectedPeriod: sup.analyticsPeriod,
            periods: _periods,
            onSelected: _selectPeriod,
          ),
          const SizedBox(height: 16),
          if (sup.loadingAnalytics && overview == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.luxuryBronze,
                ),
              ),
            )
          else if (_loadError != null && overview == null)
            EditorialEmptyState(
              icon: Icons.analytics_outlined,
              message: _loadError!,
              actionLabel: AppStrings.t(lang, 'retry'),
              onAction: () => _loadPeriod(sup.analyticsPeriod),
            )
          else ...[
            _buildSummarySection(lang, overview?.summary ?? const SupplierAnalyticsSummary()),
            const SizedBox(height: 18),
            _buildChannelBreakdown(lang, overview?.summary ?? const SupplierAnalyticsSummary()),
            const SizedBox(height: 18),
            _buildCountryDistribution(lang, overview?.countryDistribution ?? const []),
            const SizedBox(height: 18),
            _buildTopProducts(lang, overview?.topProducts ?? const []),
            const SizedBox(height: 18),
            _buildDailyTrend(lang, overview?.dailyTrend ?? const []),
          ],
        ],
      ),
    );

    if (!widget.showAppBar) return body;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: buildSupplierSubPageAppBar(
        context: context,
        title: AppStrings.t(lang, 'supplier_analytics'),
        subtitle: SupplierL10n.t(lang, 'roi_subtitle'),
        actions: [
          IconButton(
            tooltip: AppStrings.t(lang, 'retry'),
            onPressed: () => sup.loadAnalytics(period: sup.analyticsPeriod),
            icon: const Icon(Icons.refresh_rounded, size: 21),
          ),
        ],
      ),
      body: body,
    );
  }

  Widget _buildSummarySection(String lang, SupplierAnalyticsSummary s) {
    final metrics = [
      (
        icon: Icons.storefront_outlined,
        label: AppStrings.t(lang, 'analytics_profile_views'),
        value: '${s.profileViews}',
        color: AppColors.obsidian,
      ),
      (
        icon: Icons.visibility_outlined,
        label: AppStrings.t(lang, 'analytics_product_views'),
        value: '${s.productViews}',
        color: AppColors.luxuryBronze,
      ),
      (
        icon: Icons.people_outline_rounded,
        label: AppStrings.t(lang, 'analytics_unique_visitors'),
        value: '${s.uniqueVisitors}',
        color: AppColors.emerald,
      ),
      (
        icon: Icons.handshake_outlined,
        label: AppStrings.t(lang, 'analytics_total_contacts'),
        value: '${s.totalBuyerContacts}',
        color: AppColors.luxuryBronze,
      ),
      (
        icon: Icons.chat_outlined,
        label: AppStrings.t(lang, 'analytics_whatsapp_clicks'),
        value: '${s.whatsappClicks}',
        color: AppColors.emerald,
      ),
      (
        icon: Icons.phone_in_talk_outlined,
        label: AppStrings.t(lang, 'analytics_phone_clicks'),
        value: '${s.phoneClicks}',
        color: AppColors.charcoal,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EditorialSectionHeader(
          lang: lang,
          eyebrow: SupplierL10n.t(lang, 'studio_eyebrow'),
          title: SupplierL10n.t(lang, 'roi_snapshot'),
        ),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: metrics.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.55,
          ),
          itemBuilder: (_, idx) {
            final item = metrics[idx];
            return EditorialMetricTile(
              icon: item.icon,
              label: item.label,
              value: item.value,
              accentColor: item.color,
            );
          },
        ),
      ],
    );
  }

  Widget _buildChannelBreakdown(String lang, SupplierAnalyticsSummary s) {
    final channels = [
      (
        icon: Icons.mail_outline_rounded,
        label: SupplierL10n.t(lang, 'email_web_clicks'),
        count: s.emailWebsiteClicks,
        color: AppColors.charcoal,
      ),
      (
        icon: Icons.request_quote_outlined,
        label: SupplierL10n.t(lang, 'inquiry_leads'),
        count: s.inquiryLeads,
        color: AppColors.luxuryBronze,
      ),
      (
        icon: Icons.forum_outlined,
        label: SupplierL10n.t(lang, 'live_chat_rooms'),
        count: s.liveChatRooms,
        color: AppColors.emerald,
      ),
    ];

    return EditorialSurfaceCard(
      child: Row(
        children: channels.map((c) {
          return Expanded(
            child: Column(
              children: [
                Icon(c.icon, size: 18, color: c.color),
                const SizedBox(height: 6),
                Text(
                  '${c.count}',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppColors.obsidian,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  c.label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.mutedAccessible,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCountryDistribution(
    String lang,
    List<BrandCountryStatItem> countries,
  ) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'analytics_country_distribution'),
          ),
          const SizedBox(height: 12),
          if (countries.isEmpty)
            Text(
              AppStrings.t(lang, 'empty'),
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.mutedAccessible,
              ),
            )
          else
            ...countries.take(8).map((c) {
              final code = c.countryCode.trim().toLowerCase();
              final ratio = c.percentage > 0
                  ? (c.percentage / 100.0)
                  : 0.0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (code.isNotEmpty) ...[
                          CountryFlagIcon(code: code, width: 18, height: 13),
                          const SizedBox(width: 8),
                        ],
                        Expanded(
                          child: Text(
                            c.countryLabel.isNotEmpty
                                ? c.countryLabel
                                : c.countryCode.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${c.views} ${SupplierL10n.t(lang, 'views_label')} · ${c.contacts} ${SupplierL10n.t(lang, 'contacts_label')} (${c.percentage.toStringAsFixed(1)}%)',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.mutedAccessible,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    EditorialBarMeter(
                      ratio: ratio,
                      color: AppColors.luxuryBronze,
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildTopProducts(
    String lang,
    List<BrandTopProductStatItem> topProducts,
  ) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'analytics_top_products'),
          ),
          const SizedBox(height: 12),
          if (topProducts.isEmpty)
            Text(
              AppStrings.t(lang, 'empty'),
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.mutedAccessible,
              ),
            )
          else
            ...topProducts.asMap().entries.map((entry) {
              final idx = entry.key;
              final item = entry.value;
              return Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: idx == topProducts.length - 1
                      ? null
                      : const Border(
                          bottom: BorderSide(color: AppColors.warmHairline),
                        ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: idx == 0
                            ? AppColors.accentGoldLight
                            : AppColors.warmSurface,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: Text(
                        '${idx + 1}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: idx == 0
                              ? AppColors.luxuryBronze
                              : AppColors.charcoal,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                          if (item.customSku.isNotEmpty)
                            Text(
                              item.customSku,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Wrap(
                      spacing: 6,
                      children: [
                        EditorialStatusBadge.neutral('${item.views}'),
                        EditorialStatusBadge.positive(
                          '${item.whatsappClicks + item.inquiries}',
                          icon: Icons.chat_bubble_outline_rounded,
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildDailyTrend(String lang, List<BrandDailyStatItem> dailyTrend) {
    final maxViews = dailyTrend.fold<int>(
      1,
      (prev, item) => item.views > prev ? item.views : prev,
    );

    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'analytics_daily_trend'),
          ),
          const SizedBox(height: 12),
          if (dailyTrend.isEmpty)
            Text(
              AppStrings.t(lang, 'empty'),
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.mutedAccessible,
              ),
            )
          else
            ...dailyTrend.reversed.take(10).map((d) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 82,
                      child: Text(
                        d.date,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.charcoal,
                        ),
                      ),
                    ),
                    Expanded(
                      child: EditorialBarMeter(
                        ratio: d.views / maxViews,
                        color: AppColors.obsidian,
                        height: 8,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${d.views} / ${d.contacts}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _PeriodSelectorStrip extends StatelessWidget {
  final String lang;
  final String selectedPeriod;
  final List<String> periods;
  final ValueChanged<String> onSelected;

  const _PeriodSelectorStrip({
    required this.lang,
    required this.selectedPeriod,
    required this.periods,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: periods.map((p) {
        final selected = p == selectedPeriod;
        return ChoiceChip(
          label: Text(AppStrings.t(lang, 'period_$p')),
          selected: selected,
          onSelected: (_) => onSelected(p),
          selectedColor: AppColors.accentGoldLight,
          backgroundColor: AppColors.pureWhite,
          side: BorderSide(
            color: selected ? AppColors.luxuryBronze : AppColors.warmHairline,
          ),
          labelStyle: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? AppColors.luxuryBronze : AppColors.charcoal,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
        );
      }).toList(),
    );
  }
}
