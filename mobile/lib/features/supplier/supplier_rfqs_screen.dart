import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/marketplace.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierRfqsScreen extends StatefulWidget {
  final bool showAppBar;

  const SupplierRfqsScreen({super.key, this.showAppBar = true});

  @override
  State<SupplierRfqsScreen> createState() => _SupplierRfqsScreenState();
}

class _SupplierRfqsScreenState extends State<SupplierRfqsScreen> {
  String _filter = 'all';
  String? _loadError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/rfqs',
          pageTitle: AppStrings.t(session.languageCode, 'rfq_board'),
        ),
      );
      _load();
    });
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      await context.read<SupplierProvider>().loadRfqs();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _openOfferModal(RfqItem rfq) async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final existing = rfq.myOffer;

    final priceCtrl = TextEditingController(
      text: existing != null
          ? existing.offeredUnitPrice.toStringAsFixed(2)
          : (rfq.targetPrice != null
                ? rfq.targetPrice!.toStringAsFixed(2)
                : ''),
    );
    final moqCtrl = TextEditingController(
      text: '${existing?.minOrderQuantity ?? (rfq.targetQuantity > 0 ? rfq.targetQuantity : 1)}',
    );
    final daysCtrl = TextEditingController(
      text: '${existing?.deliveryDays ?? 7}',
    );
    final notesCtrl = TextEditingController(text: existing?.notes ?? '');
    var selectedCurrency = (existing?.currency ?? rfq.currency).toUpperCase();
    if (!['USD', 'EUR', 'TRY', 'GBP', 'RUB'].contains(selectedCurrency)) {
      selectedCurrency = 'USD';
    }
    var submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return SafeArea(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  18,
                  18,
                  18,
                  20 + MediaQuery.of(ctx).viewInsets.bottom,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                existing == null
                                    ? AppStrings.t(lang, 'rfq_submit_offer')
                                    : SupplierL10n.t(lang, 'rfq_update_offer'),
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              Text(
                                '${rfq.rfqNumber} · ${rfq.title}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.mutedAccessible,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: TextField(
                            controller: priceCtrl,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              labelText: AppStrings.t(
                                lang,
                                'rfq_offered_unit_price',
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: selectedCurrency,
                            decoration: InputDecoration(
                              labelText:
                                  SupplierL10n.t(lang, 'rfq_currency_label'),
                            ),
                            items: const ['USD', 'EUR', 'TRY', 'GBP', 'RUB']
                                .map(
                                  (c) => DropdownMenuItem(
                                    value: c,
                                    child: Text(c),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) {
                              if (v != null) selectedCurrency = v;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: moqCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: SupplierL10n.t(lang, 'rfq_moq_label'),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: daysCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText:
                                  AppStrings.t(lang, 'rfq_delivery_days'),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: notesCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: SupplierL10n.t(lang, 'rfq_notes_label'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: submitting
                            ? null
                            : () async {
                                final unitPrice = double.tryParse(
                                  priceCtrl.text.trim().replaceAll(',', '.'),
                                );
                                final moq = int.tryParse(moqCtrl.text.trim());
                                final days = int.tryParse(daysCtrl.text.trim());
                                if (unitPrice == null || unitPrice <= 0) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        AppStrings.t(lang, 'err_validation'),
                                      ),
                                      backgroundColor: AppColors.danger,
                                    ),
                                  );
                                  return;
                                }
                                setModalState(() => submitting = true);
                                try {
                                  await sup.submitRfqOffer(
                                    rfqId: rfq.id,
                                    payload: SubmitRfqOfferPayload(
                                      offeredUnitPrice: unitPrice,
                                      currency: selectedCurrency,
                                      minOrderQuantity:
                                          (moq != null && moq > 0) ? moq : 1,
                                      deliveryDays:
                                          (days != null && days > 0) ? days : 7,
                                      notes: notesCtrl.text.trim(),
                                    ),
                                  );
                                  if (!mounted || !ctx.mounted) return;
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        AppStrings.t(lang, 'rfq_offer_sent'),
                                      ),
                                      backgroundColor: AppColors.emerald,
                                    ),
                                  );
                                } catch (e) {
                                  if (!ctx.mounted) return;
                                  setModalState(() => submitting = false);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        e.toString().replaceFirst(
                                          'Exception: ',
                                          '',
                                        ),
                                      ),
                                      backgroundColor: AppColors.danger,
                                    ),
                                  );
                                }
                              },
                        icon: submitting
                            ? const SizedBox(
                                width: 15,
                                height: 15,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.send_rounded, size: 17),
                        label: Text(
                          SupplierL10n.t(lang, 'rfq_send_offer_cta'),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    priceCtrl.dispose();
    moqCtrl.dispose();
    daysCtrl.dispose();
    notesCtrl.dispose();
  }

  List<RfqItem> _filteredRfqs(List<RfqItem> source) {
    switch (_filter) {
      case 'open':
        return source
            .where((r) =>
                r.status.toLowerCase() == 'open' ||
                r.status.toLowerCase() == 'active')
            .toList();
      case 'quoted':
        return source.where((r) => r.myOffer != null).toList();
      case 'closed':
        return source
            .where((r) =>
                r.status.toLowerCase() == 'closed' ||
                r.status.toLowerCase() == 'awarded' ||
                r.status.toLowerCase() == 'completed')
            .toList();
      default:
        return source;
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final sup = context.watch<SupplierProvider>();
    final items = _filteredRfqs(sup.rfqs);

    final body = Column(
      children: [
        Container(
          width: double.infinity,
          color: AppColors.pureWhite,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip(lang, 'all', SupplierL10n.t(lang, 'filter_all')),
                const SizedBox(width: 8),
                _buildFilterChip(lang, 'open', SupplierL10n.t(lang, 'rfq_status_open')),
                const SizedBox(width: 8),
                _buildFilterChip(lang, 'quoted', SupplierL10n.t(lang, 'rfq_status_quoted')),
                const SizedBox(width: 8),
                _buildFilterChip(lang, 'closed', SupplierL10n.t(lang, 'rfq_status_closed')),
              ],
            ),
          ),
        ),
        const Divider(height: 1, color: AppColors.warmHairline),
        Expanded(
          child: sup.loadingRfqs && sup.rfqs.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(
                    color: AppColors.luxuryBronze,
                  ),
                )
              : _loadError != null && sup.rfqs.isEmpty
              ? EditorialEmptyState(
                  icon: Icons.assignment_outlined,
                  message: _loadError!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : items.isEmpty
              ? RefreshIndicator(
                  color: AppColors.luxuryBronze,
                  onRefresh: _load,
                  child: ListView(
                    children: [
                      const SizedBox(height: 60),
                      EditorialEmptyState(
                        icon: Icons.request_quote_outlined,
                        message: SupplierL10n.t(lang, 'rfq_no_items'),
                        actionLabel: AppStrings.t(lang, 'retry'),
                        onAction: _load,
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.luxuryBronze,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, idx) => _RfqCard(
                      lang: lang,
                      rfq: items[idx],
                      onOfferTap: () => _openOfferModal(items[idx]),
                    ),
                  ),
                ),
        ),
      ],
    );

    if (!widget.showAppBar) return body;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: buildSupplierSubPageAppBar(
        context: context,
        title: AppStrings.t(lang, 'rfq_board'),
        subtitle: '${sup.rfqs.length} ${AppStrings.t(lang, 'rfq_offers_count')}',
        actions: [
          IconButton(
            tooltip: AppStrings.t(lang, 'retry'),
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded, size: 21),
          ),
        ],
      ),
      body: body,
    );
  }

  Widget _buildFilterChip(String lang, String key, String label) {
    final selected = _filter == key;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => _filter = key),
      selectedColor: AppColors.accentGoldLight,
      backgroundColor: AppColors.warmIvory,
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
  }
}

class _RfqCard extends StatelessWidget {
  final String lang;
  final RfqItem rfq;
  final VoidCallback onOfferTap;

  const _RfqCard({
    required this.lang,
    required this.rfq,
    required this.onOfferTap,
  });

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('dd.MM.yyyy');
    final targetPriceText = rfq.targetPrice != null && rfq.targetPrice! > 0
        ? CurrencyFormatter.format(rfq.targetPrice!, currency: rfq.currency)
        : '—';

    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (rfq.rfqNumber.isNotEmpty)
                      EditorialStatusBadge.neutral(rfq.rfqNumber),
                    EditorialStatusBadge.forRfqStatus(lang, rfq.status),
                    if (rfq.productionType.isNotEmpty)
                      EditorialStatusBadge.bronze(rfq.productionType),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                dateFmt.format(rfq.createdAt.toLocal()),
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.mutedAccessible,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            rfq.title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.obsidian,
            ),
          ),
          if (rfq.description.trim().isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              rfq.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.charcoal,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _RfqSpecPill(
                icon: Icons.category_outlined,
                label: rfq.categoryName.isNotEmpty ? rfq.categoryName : 'B2B',
              ),
              _RfqSpecPill(
                icon: Icons.inventory_2_outlined,
                label:
                    '${rfq.targetQuantity} ${rfq.unitType.isNotEmpty ? rfq.unitType : AppStrings.t(lang, 'piece')}',
              ),
              _RfqSpecPill(
                icon: Icons.sell_outlined,
                label:
                    '${AppStrings.t(lang, 'rfq_target_price')}: $targetPriceText',
              ),
              if (rfq.buyerCountry.isNotEmpty || rfq.buyerCompany.isNotEmpty)
                _RfqSpecPill(
                  icon: Icons.public_outlined,
                  label: [
                    if (rfq.buyerCompany.isNotEmpty) rfq.buyerCompany,
                    if (rfq.buyerCountry.isNotEmpty) rfq.buyerCountry,
                  ].join(' · '),
                ),
            ],
          ),
          if (rfq.myOffer != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.emeraldLight,
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
                border: Border.all(
                  color: AppColors.emerald.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_outlined,
                        size: 15,
                        color: AppColors.emerald,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '${SupplierL10n.t(lang, 'rfq_my_offer')}: ${CurrencyFormatter.format(rfq.myOffer!.offeredUnitPrice, currency: rfq.myOffer!.currency)} · MOQ ${rfq.myOffer!.minOrderQuantity} · ${rfq.myOffer!.deliveryDays}d',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.emerald,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (rfq.myOffer!.notes.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      rfq.myOffer!.notes,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.charcoal,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                '${rfq.offerCount} ${AppStrings.t(lang, 'rfq_offers_count')}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.mutedAccessible,
                ),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: onOfferTap,
                icon: Icon(
                  rfq.myOffer == null
                      ? Icons.add_task_rounded
                      : Icons.edit_outlined,
                  size: 16,
                ),
                label: Text(
                  rfq.myOffer == null
                      ? AppStrings.t(lang, 'rfq_submit_offer')
                      : SupplierL10n.t(lang, 'rfq_update_offer'),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: rfq.myOffer == null
                      ? AppColors.obsidian
                      : AppColors.luxuryBronze,
                  foregroundColor: AppColors.pureWhite,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RfqSpecPill extends StatelessWidget {
  final IconData icon;
  final String label;

  const _RfqSpecPill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.luxuryBronze),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.charcoal,
            ),
          ),
        ),
      ],
    );
  }
}
