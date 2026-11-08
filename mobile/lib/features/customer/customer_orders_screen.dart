import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../models/cart_and_order.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/smart_network_image.dart';

class CustomerOrdersScreen extends StatefulWidget {
  const CustomerOrdersScreen({super.key});

  @override
  State<CustomerOrdersScreen> createState() => _CustomerOrdersScreenState();
}

class _CustomerOrdersScreenState extends State<CustomerOrdersScreen> {
  List<CustomerOrder> _orders = <CustomerOrder>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOrders());
  }

  Future<void> _loadOrders() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = context.read<SessionProvider>();
      final list = await session.api.listCustomerOrders();
      if (!mounted) return;
      setState(() {
        _orders = list;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  (String, Color, Color) _statusStyle(String raw) {
    switch (raw.toUpperCase()) {
      case 'PENDING_PAYMENT':
        return (
          'Ödeme Bekleniyor',
          AppColors.accentGold,
          AppColors.accentGoldLight,
        );
      case 'PAYMENT_NOTIFIED':
        return ('Ödeme Bildirildi', AppColors.primary, AppColors.primaryLight);
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PREPARING':
        return ('Hazırlanıyor', AppColors.primary, AppColors.primaryLight);
      case 'SHIPPED':
        return ('Kargoda', AppColors.emerald, AppColors.emeraldLight);
      case 'DELIVERED':
      case 'COMPLETED':
        return ('Teslim Edildi', AppColors.emerald, AppColors.emeraldLight);
      case 'CANCELLED':
        return ('İptal Edildi', AppColors.danger, AppColors.dangerLight);
      default:
        return (raw, AppColors.textSecondary, AppColors.background);
    }
  }

  Future<void> _openPaymentNotificationSheet(CustomerOrder order) async {
    final session = context.read<SessionProvider>();
    final senderCtrl = TextEditingController(
      text: session.customerUser?.fullName ?? '',
    );
    final bankCtrl = TextEditingController(text: 'Garanti BBVA / Ziraat / İş Bankası');
    final amountCtrl = TextEditingController(
      text: order.totalAmount.toStringAsFixed(2),
    );
    final notesCtrl = TextEditingController(
      text: 'Sipariş No: ${order.orderNumber}',
    );

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        var sending = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
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
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Havale / EFT Ödeme Bildirimi (${order.orderNumber})',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: senderCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Gönderici Ad Soyad / Firma Unvanı *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: bankCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Gönderim Yapılan Banka *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: amountCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Gönderilen Tutar (₺) *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: notesCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Dekont Açıklaması / Not',
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: sending
                          ? null
                          : () async {
                              final sender = senderCtrl.text.trim();
                              final bank = bankCtrl.text.trim();
                              final amt = double.tryParse(
                                    amountCtrl.text.replaceAll(',', '.').trim(),
                                  ) ??
                                  0.0;
                              if (sender.isEmpty || bank.isEmpty || amt <= 0) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Lütfen gönderici, banka ve tutar alanlarını eksiksiz doldurunuz.',
                                    ),
                                  ),
                                );
                                return;
                              }
                              setSheetState(() => sending = true);
                              try {
                                await session.api.submitPaymentNotification(
                                  orderId: order.id,
                                  senderName: sender,
                                  bankName: bank,
                                  amount: amt,
                                  notes: notesCtrl.text.trim(),
                                );
                                if (sheetCtx.mounted) {
                                  Navigator.of(sheetCtx).pop(true);
                                }
                              } catch (err) {
                                setSheetState(() => sending = false);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(err.toString())),
                                  );
                                }
                              }
                            },
                      icon: const Icon(Icons.check_circle_outline, size: 18),
                      label: Text(
                        sending
                            ? 'Gönderiliyor...'
                            : 'Ödeme Bildirimini İlet',
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

    senderCtrl.dispose();
    bankCtrl.dispose();
    amountCtrl.dispose();
    notesCtrl.dispose();

    if (submitted == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ödeme bildiriminiz finans ekibimize iletildi.'),
          backgroundColor: AppColors.emerald,
        ),
      );
      await _loadOrders();
    }
  }

  Future<void> _confirmCancel(CustomerOrder order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sipariş İptali'),
        content: Text(
          '${order.orderNumber} numaralı toptan siparişinizi iptal etmek istediğinize emin misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Siparişi İptal Et'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await context.read<SessionProvider>().api.cancelCustomerOrder(order.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sipariş iptal edildi.')),
      );
      await _loadOrders();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'TOPTAN SİPARİŞLERİM',
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          IconButton(
            onPressed: _loadOrders,
            icon: const Icon(Icons.refresh_rounded, size: 20),
            tooltip: 'Yenile',
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.error_outline_rounded,
                          size: 46,
                          color: AppColors.danger,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 14),
                        OutlinedButton(
                          onPressed: _loadOrders,
                          child: const Text('Tekrar Dene'),
                        ),
                      ],
                    ),
                  ),
                )
              : _orders.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 68,
                              height: 68,
                              decoration: BoxDecoration(
                                color: AppColors.editorialOffWhite,
                                border: Border.all(color: AppColors.cultured),
                              ),
                              alignment: Alignment.center,
                              child: const LuxuryIcon(
                                kind: LuxuryIconKind.orders,
                                size: 30,
                                color: AppColors.obsidian,
                                accentColor: AppColors.champagneGold,
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'HENÜZ SİPARİŞİNİZ BULUNMUYOR',
                              style: TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.5,
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Oluşturduğunuz toptan siparişlerin durumunu ve ödeme bildirimlerini buradan takip edebilirsiniz.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12.5,
                                color: AppColors.sonicSilver,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadOrders,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _orders.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final order = _orders[index];
                          final (label, fg, bg) = _statusStyle(order.orderStatus);
                          final canNotifyPayment =
                              order.orderStatus.toUpperCase() ==
                                  'PENDING_PAYMENT';
                          final canCancel = order.orderStatus.toUpperCase() ==
                                  'PENDING_PAYMENT' ||
                              order.orderStatus.toUpperCase() ==
                                  'PAYMENT_NOTIFIED';

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
                                      Expanded(
                                        child: Text(
                                          '#${order.orderNumber}',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 9,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: bg,
                                          border: Border.all(
                                            color: fg.withValues(alpha: 0.25),
                                          ),
                                        ),
                                        child: Text(
                                          label.toUpperCase(),
                                          style: TextStyle(
                                            color: fg,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.7,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        dateFmt
                                            .format(order.createdAt.toLocal()),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      Text(
                                        session.formatPrice(order.totalAmount),
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          color: AppColors.navy,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (order.deliveryAddress.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'Teslimat: ${order.deliveryAddress}',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                  if (order.items.isNotEmpty) ...[
                                    const Divider(height: 20),
                                    ...order.items.map(
                                      (it) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 8),
                                        child: Row(
                                          children: [
                                            SmartNetworkImage(
                                              imageUrl: it.imageUrl,
                                              width: 44,
                                              height: 54,
                                              borderRadius:
                                                  BorderRadius.circular(8),
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
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                                  Text(
                                                    'SKU: ${it.productSku} • ${it.quantity} Adet',
                                                    style: const TextStyle(
                                                      fontSize: 11.5,
                                                      color: AppColors
                                                          .textSecondary,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Text(
                                              session.formatPrice(
                                                it.priceAtPurchase *
                                                    it.quantity,
                                              ),
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12.5,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                  if (canNotifyPayment || canCancel) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        if (canNotifyPayment)
                                          ElevatedButton.icon(
                                            onPressed: () =>
                                                _openPaymentNotificationSheet(
                                              order,
                                            ),
                                            icon: const Icon(
                                              Icons.account_balance_outlined,
                                              size: 16,
                                            ),
                                            label: const Text(
                                              'Ödeme Bildirimi Yap',
                                            ),
                                          ),
                                        if (canCancel)
                                          OutlinedButton.icon(
                                            onPressed: () =>
                                                _confirmCancel(order),
                                            icon: const Icon(
                                              Icons.cancel_outlined,
                                              size: 16,
                                              color: AppColors.danger,
                                            ),
                                            label: const Text(
                                              'İptal Et',
                                              style: TextStyle(
                                                color: AppColors.danger,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

