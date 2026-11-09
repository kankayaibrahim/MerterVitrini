import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../models/cart_and_order.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';

class SupplierOrdersScreen extends StatefulWidget {
  const SupplierOrdersScreen({super.key});

  @override
  State<SupplierOrdersScreen> createState() => _SupplierOrdersScreenState();
}

class _SupplierOrdersScreenState extends State<SupplierOrdersScreen> {
  String _selectedStatus = 'ALL';

  static const List<(String, String)> _statusFilters = [
    ('ALL', 'Tümü'),
    ('PENDING', 'Yeni Gelen'),
    ('ACCEPTED', 'Onaylandı'),
    ('PREPARING', 'Hazırlanıyor'),
    ('SENT_TO_HUB', 'Kargo / Hub'),
    ('DELIVERED', 'Teslim Edildi'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SupplierProvider>().loadSubOrders(status: _selectedStatus);
    });
  }

  Future<void> _reload() async {
    await context
        .read<SupplierProvider>()
        .loadSubOrders(status: _selectedStatus);
  }

  Future<void> _openManageSubOrderSheet(SupplierSubOrder subOrder) async {
    SupplierSubOrder detailed = subOrder;
    try {
      detailed = await context
          .read<SessionProvider>()
          .api
          .fetchSupplierSubOrderDetail(subOrder.id);
    } catch (_) {}
    if (!mounted) return;

    var chosenStatus = detailed.status;
    var chosenCarrier = detailed.trackingCompany.isNotEmpty
        ? detailed.trackingCompany
        : 'Merter Lojistik Hub';
    final trackingCtrl = TextEditingController(text: detailed.trackingNumber);
    final notesCtrl = TextEditingController(text: detailed.notes);

    const carriers = [
      'Merter Lojistik Hub',
      'Yurtiçi Kargo',
      'Aras Kargo',
      'DHL / MNG Kargo',
      'Sürat Kargo',
      'PTT Kargo',
      'Uluslararası Ambar / Kargo',
    ];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Sipariş Yönetimi (#${detailed.subOrderNumber})',
                      style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (detailed.customerName.isNotEmpty ||
                        detailed.customerPhone.isNotEmpty ||
                        detailed.deliveryAddress.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ALICI İLETİŞİM & TESLİMAT BİLGİLERİ',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textMuted,
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
                                ),
                              ),
                            if (detailed.customerPhone.isNotEmpty)
                              Text(
                                'Tel: ${detailed.customerPhone}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            if (detailed.customerEmail.isNotEmpty)
                              Text(
                                'E-posta: ${detailed.customerEmail}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            if (detailed.deliveryAddress.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Adres: ${detailed.deliveryAddress}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.textSecondary,
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
                                borderRadius: BorderRadius.circular(8),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      it.productName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                    Text(
                                      'SKU: ${it.productSku} • ${it.quantity} Adet',
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        color: AppColors.textSecondary,
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
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Divider(height: 20),
                    ],
                    DropdownButtonFormField<String>(
                      initialValue: const [
                        'PENDING',
                        'ACCEPTED',
                        'PREPARING',
                        'SENT_TO_HUB',
                        'DELIVERED',
                        'CANCELLED',
                      ].contains(chosenStatus)
                          ? chosenStatus
                          : 'ACCEPTED',
                      decoration: const InputDecoration(
                        labelText: 'Sipariş Hazırlık & Sevkiyat Durumu',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'PENDING',
                          child: Text('Beklemede (PENDING)'),
                        ),
                        DropdownMenuItem(
                          value: 'ACCEPTED',
                          child: Text('Siparişi Onayla (ACCEPTED)'),
                        ),
                        DropdownMenuItem(
                          value: 'PREPARING',
                          child: Text('Paketleniyor (PREPARING)'),
                        ),
                        DropdownMenuItem(
                          value: 'SENT_TO_HUB',
                          child: Text('Kargoya / Merter Hub\'a Verildi'),
                        ),
                        DropdownMenuItem(
                          value: 'DELIVERED',
                          child: Text('Teslim Edildi (DELIVERED)'),
                        ),
                        DropdownMenuItem(
                          value: 'CANCELLED',
                          child: Text('İptal Edildi (CANCELLED)'),
                        ),
                      ],
                      onChanged: (v) {
                        if (v != null) setSheetState(() => chosenStatus = v);
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: carriers.contains(chosenCarrier)
                          ? chosenCarrier
                          : carriers.first,
                      decoration: const InputDecoration(
                        labelText: 'Kargo / Sevkiyat Firması',
                      ),
                      items: carriers
                          .map(
                            (c) => DropdownMenuItem(value: c, child: Text(c)),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setSheetState(() => chosenCarrier = v);
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: trackingCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Kargo Takip / İrsaliye Kodu',
                        hintText: 'Örn: TRK-902841...',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: notesCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Operasyon Notu (Çuval/Koli Adedi vb.)',
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              setSheetState(() => saving = true);
                              try {
                                await context
                                    .read<SupplierProvider>()
                                    .updateSubOrderStatus(
                                      subOrderId: detailed.id,
                                      status: chosenStatus,
                                      trackingCompany: chosenCarrier,
                                      trackingNumber: trackingCtrl.text.trim(),
                                      notes: notesCtrl.text.trim(),
                                    );
                                if (sheetCtx.mounted) {
                                  Navigator.of(sheetCtx).pop();
                                }
                              } catch (err) {
                                setSheetState(() => saving = false);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(err.toString())),
                                  );
                                }
                              }
                            },
                      icon: const Icon(Icons.local_shipping_outlined, size: 18),
                      label: Text(
                        saving
                            ? 'Güncelleniyor...'
                            : 'Durum ve Kargo Bilgisini Kaydet',
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

    trackingCtrl.dispose();
    notesCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sup = context.watch<SupplierProvider>();
    final fmt = DateFormat('dd.MM.yyyy HH:mm');

    return Column(
      children: [
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: SizedBox(
            height: 36,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              scrollDirection: Axis.horizontal,
              itemCount: _statusFilters.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, idx) {
                final item = _statusFilters[idx];
                return ChoiceChip(
                  label: Text(item.$2),
                  selected: _selectedStatus == item.$1,
                  onSelected: (_) {
                    setState(() => _selectedStatus = item.$1);
                    _reload();
                  },
                );
              },
            ),
          ),
        ),
        Expanded(
          child: sup.loadingOrders && sup.subOrders.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : sup.subOrders.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Text(
                          'Seçili filtrede toptan alt sipariş bulunmuyor.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _reload,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: sup.subOrders.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, idx) {
                          final o = sup.subOrders[idx];
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '#${o.subOrderNumber}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 15,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 9,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: AppColors.accentGoldLight,
                                          borderRadius:
                                              BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          o.status,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.navy,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    fmt.format(o.createdAt.toLocal()),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  if (o.customerName.isNotEmpty ||
                                      o.customerPhone.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      [
                                        if (o.customerName.isNotEmpty)
                                          o.customerName,
                                        if (o.customerCompany.isNotEmpty)
                                          '(${o.customerCompany})',
                                        if (o.customerPhone.isNotEmpty)
                                          '• ${o.customerPhone}',
                                      ].join(' '),
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
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
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                  const Divider(height: 18),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Brüt Tutar',
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textMuted,
                                            ),
                                          ),
                                          Text(
                                            CurrencyFormatter.format(
                                              o.grossAmount,
                                              currency: o.currency,
                                            ),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            'Net Hakediş (%${o.commissionRate.toStringAsFixed(0)} Kom.)',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textMuted,
                                            ),
                                          ),
                                          Text(
                                            CurrencyFormatter.format(
                                              o.netPayoutAmount,
                                              currency: o.currency,
                                            ),
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w900,
                                              color: AppColors.emerald,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  if (o.trackingNumber.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'Kargo: ${o.trackingCompany} — ${o.trackingNumber}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 10),
                                  SizedBox(
                                    width: double.infinity,
                                    child: OutlinedButton.icon(
                                      onPressed: () =>
                                          _openManageSubOrderSheet(o),
                                      icon: const Icon(
                                        Icons.local_shipping_outlined,
                                        size: 17,
                                      ),
                                      label: const Text(
                                        'Sipariş Detayı & Kargo Güncelle',
                                      ),
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
    );
  }
}

