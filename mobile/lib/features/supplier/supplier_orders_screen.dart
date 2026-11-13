import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/cart_and_order.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierOrdersScreen extends StatefulWidget {
  const SupplierOrdersScreen({super.key});

  @override
  State<SupplierOrdersScreen> createState() => _SupplierOrdersScreenState();
}

class _SupplierOrdersScreenState extends State<SupplierOrdersScreen> {
  String _selectedStatus = 'ALL';

  static const List<String> _filterCodes = [
    'ALL',
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'SENT_TO_HUB',
    'DELIVERED',
  ];

  static const List<String> _manageStatuses = [
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'SENT_TO_HUB',
    'DELIVERED',
    'CANCELLED',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/orders',
          pageTitle: AppStrings.t(session.languageCode, 'nav_orders'),
        ),
      );
      _reload();
    });
  }

  Future<void> _reload() async {
    await context.read<SupplierProvider>().loadSubOrders(
      status: _selectedStatus,
    );
  }

  Future<void> _openManageSubOrderSheet(SupplierSubOrder subOrder) async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    SupplierSubOrder detailed = subOrder;
    try {
      detailed = await sup.operationsRepo.fetchSupplierSubOrderDetail(
        subOrder.id,
      );
    } catch (_) {}
    if (!mounted) return;

    var chosenStatus = _manageStatuses.contains(detailed.status)
        ? detailed.status
        : 'ACCEPTED';
    const carriers = [
      'Merter Lojistik Hub',
      'Yurtiçi Kargo',
      'Aras Kargo',
      'DHL / MNG Kargo',
      'Sürat Kargo',
      'PTT Kargo',
      'International Cargo / Freight',
    ];
    var chosenCarrier = carriers.contains(detailed.trackingCompany)
        ? detailed.trackingCompany
        : carriers.first;
    final trackingCtrl = TextEditingController(text: detailed.trackingNumber);
    final notesCtrl = TextEditingController(text: detailed.notes);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 18,
                  right: 18,
                  top: 16,
                  bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${SupplierL10n.t(lang, 'update_order_status')} (#${detailed.subOrderNumber})',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(sheetCtx).pop(),
                            icon: const Icon(Icons.close_rounded),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (detailed.customerName.isNotEmpty ||
                          detailed.customerPhone.isNotEmpty ||
                          detailed.deliveryAddress.isNotEmpty) ...[
                        EditorialSurfaceCard(
                          backgroundColor: AppColors.warmIvory,
                          padding: const EdgeInsets.all(12),
                          borderRadius: AppColors.radiusMd,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                SupplierL10n.upper(lang, 'customer_label'),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: AppStrings.letterSpacing(
                                    lang,
                                    1.1,
                                  ),
                                  color: AppColors.luxuryBronze,
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (detailed.customerName.isNotEmpty)
                                Text(
                                  detailed.customerCompany.isNotEmpty
                                      ? '${detailed.customerName} (${detailed.customerCompany})'
                                      : detailed.customerName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                              if (detailed.customerPhone.isNotEmpty)
                                Text(
                                  '${AppStrings.t(lang, 'phone')}: ${detailed.customerPhone}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.luxuryBronze,
                                  ),
                                ),
                              if (detailed.customerEmail.isNotEmpty)
                                Text(
                                  '${AppStrings.t(lang, 'email')}: ${detailed.customerEmail}',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.charcoal,
                                  ),
                                ),
                              if (detailed.deliveryAddress.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '${SupplierL10n.t(lang, 'delivery_address_label')}: ${detailed.deliveryAddress}',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.mutedAccessible,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (detailed.items.isNotEmpty) ...[
                        ...detailed.items.map(
                          (it) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                SmartNetworkImage(
                                  imageUrl: it.imageUrl,
                                  width: 42,
                                  height: 52,
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusSm,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        it.productName,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                      Text(
                                        '${AppStrings.t(lang, 'sku')}: ${it.productSku} · ${it.quantity} ${SupplierL10n.t(lang, 'unit_pcs_short')}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.mutedAccessible,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  CurrencyFormatter.format(
                                    it.totalPrice,
                                    currency: detailed.currency,
                                  ),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12.5,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const Divider(height: 20, color: AppColors.warmHairline),
                      ],
                      DropdownButtonFormField<String>(
                        initialValue: chosenStatus,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'order_status'),
                        ),
                        items: _manageStatuses
                            .map(
                              (code) => DropdownMenuItem(
                                value: code,
                                child: Text(
                                  '${SupplierL10n.orderStatusLabel(lang, code)} ($code)',
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setSheetState(() => chosenStatus = v);
                        },
                      ),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        initialValue: chosenCarrier,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(lang, 'tracking_company'),
                        ),
                        items: carriers
                            .map(
                              (c) => DropdownMenuItem(value: c, child: Text(c)),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) {
                            setSheetState(() => chosenCarrier = v);
                          }
                        },
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: trackingCtrl,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(lang, 'tracking_number'),
                          hintText: 'TRK-902841...',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: notesCtrl,
                        maxLines: 2,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(lang, 'order_note'),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: saving
                            ? null
                            : () async {
                                setSheetState(() => saving = true);
                                try {
                                  await sup.updateSubOrderStatus(
                                    subOrderId: detailed.id,
                                    status: chosenStatus,
                                    trackingCompany: chosenCarrier,
                                    trackingNumber: trackingCtrl.text.trim(),
                                    notes: notesCtrl.text.trim(),
                                  );
                                  if (!sheetCtx.mounted || !mounted) return;
                                  Navigator.of(sheetCtx).pop();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        SupplierL10n.t(
                                          lang,
                                          'order_updated_msg',
                                        ),
                                      ),
                                      backgroundColor: AppColors.emerald,
                                    ),
                                  );
                                } catch (e) {
                                  if (!ctx.mounted) return;
                                  setSheetState(() => saving = false);
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
                        icon: const Icon(Icons.save_outlined, size: 18),
                        label: Text(AppStrings.t(lang, 'save')),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    trackingCtrl.dispose();
    notesCtrl.dispose();
  }

  String _filterLabel(String lang, String code) {
    if (code == 'ALL') return SupplierL10n.t(lang, 'orders_all');
    return SupplierL10n.orderStatusLabel(lang, code);
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final sup = context.watch<SupplierProvider>();
    final fmt = DateFormat('dd.MM.yyyy HH:mm');

    return Column(
      children: [
        Container(
          color: AppColors.pureWhite,
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: SizedBox(
            height: 36,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              scrollDirection: Axis.horizontal,
              itemCount: _filterCodes.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, idx) {
                final code = _filterCodes[idx];
                final selected = _selectedStatus == code;
                return ChoiceChip(
                  label: Text(_filterLabel(lang, code)),
                  selected: selected,
                  selectedColor: AppColors.accentGoldLight,
                  backgroundColor: AppColors.warmIvory,
                  side: BorderSide(
                    color: selected
                        ? AppColors.luxuryBronze
                        : AppColors.warmHairline,
                  ),
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? AppColors.luxuryBronze
                        : AppColors.charcoal,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  onSelected: (_) {
                    setState(() => _selectedStatus = code);
                    _reload();
                  },
                );
              },
            ),
          ),
        ),
        const Divider(height: 1, color: AppColors.warmHairline),
        Expanded(
          child: sup.loadingOrders && sup.subOrders.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(
                    color: AppColors.luxuryBronze,
                  ),
                )
              : sup.subOrders.isEmpty
              ? RefreshIndicator(
                  color: AppColors.luxuryBronze,
                  onRefresh: _reload,
                  child: ListView(
                    children: [
                      const SizedBox(height: 50),
                      EditorialEmptyState(
                        icon: Icons.inventory_2_outlined,
                        message: SupplierL10n.t(lang, 'no_orders_msg'),
                        actionLabel: AppStrings.t(lang, 'retry'),
                        onAction: _reload,
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.luxuryBronze,
                  onRefresh: _reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
                    itemCount: sup.subOrders.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, idx) {
                      final o = sup.subOrders[idx];
                      return EditorialSurfaceCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '#${o.subOrderNumber}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                ),
                                EditorialStatusBadge.forOrderStatus(
                                  lang,
                                  o.status,
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              fmt.format(o.createdAt.toLocal()),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                            if (o.customerName.isNotEmpty ||
                                o.customerPhone.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                [
                                  if (o.customerName.isNotEmpty) o.customerName,
                                  if (o.customerCompany.isNotEmpty)
                                    '(${o.customerCompany})',
                                  if (o.customerPhone.isNotEmpty)
                                    '· ${o.customerPhone}',
                                ].join(' '),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.obsidian,
                                ),
                              ),
                            ],
                            if (o.deliveryAddress.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                o.deliveryAddress,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.charcoal,
                                ),
                              ),
                            ],
                            const Divider(
                              height: 18,
                              color: AppColors.warmHairline,
                            ),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        AppStrings.t(lang, 'grand_total'),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.mutedAccessible,
                                        ),
                                      ),
                                      Text(
                                        CurrencyFormatter.format(
                                          o.grossAmount,
                                          currency: o.currency,
                                        ),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        '${SupplierL10n.t(lang, 'net_payout')} (${o.commissionRate.toStringAsFixed(0)}%)',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.mutedAccessible,
                                        ),
                                      ),
                                      Text(
                                        CurrencyFormatter.format(
                                          o.netPayoutAmount,
                                          currency: o.currency,
                                        ),
                                        style: const TextStyle(
                                          fontSize: 15.5,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.emerald,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (o.trackingNumber.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                '${o.trackingCompany} — ${o.trackingNumber}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.luxuryBronze,
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: () => _openManageSubOrderSheet(o),
                                icon: const Icon(
                                  Icons.local_shipping_outlined,
                                  size: 17,
                                ),
                                label: Text(
                                  SupplierL10n.t(lang, 'update_order_status'),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
