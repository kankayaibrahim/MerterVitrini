import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/cart_and_order.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  final CustomerOrder? initialOrder;

  const OrderDetailScreen({
    super.key,
    required this.orderId,
    this.initialOrder,
  });

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderDetailModel? _detail;
  bool _loading = true;
  bool _downloadingFile = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/orders/${widget.orderId}',
            pageTitle: 'Order Detail',
          );
      _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await context.read<SessionProvider>().api.fetchOrderDetail(
            widget.orderId,
          );
      if (!mounted) return;
      setState(() => _detail = res);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _downloadAndShare({required bool isZip}) async {
    final order = _detail;
    if (order == null || _downloadingFile) return;
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    setState(() => _downloadingFile = true);
    try {
      final bytes = isZip
          ? await session.api.downloadOrderImagesZip(order.id)
          : await session.api.downloadOrderExcel(order.id);
      final dir = await getTemporaryDirectory();
      final ext = isZip ? 'zip' : 'xlsx';
      final safeNo = order.orderNumber.isNotEmpty
          ? order.orderNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_')
          : order.id;
      final filePath = p.join(dir.path, 'order_$safeNo.$ext');
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          text: '${order.orderNumber} ($ext)',
          files: [XFile(file.path)],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${AppStrings.t(lang, 'error')}: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _downloadingFile = false);
    }
  }

  Future<void> _openPaymentSheet(CustomerOrder order) async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final senderCtrl = TextEditingController(
      text: session.customerUser?.fullName ?? '',
    );
    final bankCtrl = TextEditingController();
    final amountCtrl = TextEditingController(
      text: order.totalAmount.toStringAsFixed(2),
    );
    final notesCtrl = TextEditingController(
      text: order.orderNumber,
    );

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppStrings.tUpper(lang, 'submit_wire_payment'),
              style: TextStyle(
                fontFamily: AppColors.serifFontFamily,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: AppStrings.letterSpacing(lang, 0.9),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: senderCtrl,
              decoration: InputDecoration(
                labelText: AppStrings.t(lang, 'sender_name'),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: bankCtrl,
              decoration: InputDecoration(
                labelText: AppStrings.t(lang, 'bank_name'),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: amountCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText:
                    '${AppStrings.t(lang, 'payment_amount')} (${order.currency})',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: notesCtrl,
              decoration: InputDecoration(
                labelText: AppStrings.t(lang, 'bank_reference'),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 46,
              child: ElevatedButton(
                onPressed: () async {
                  final amt = double.tryParse(
                        amountCtrl.text.trim().replaceAll(',', '.'),
                      ) ??
                      order.totalAmount;
                  try {
                    await session.api.submitPaymentNotification(
                      orderId: order.id,
                      senderName: senderCtrl.text.trim(),
                      bankName: bankCtrl.text.trim(),
                      amount: amt,
                      currency: order.currency,
                      notes: notesCtrl.text.trim(),
                    );
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(
                          content: Text(e.toString()),
                          backgroundColor: AppColors.danger,
                        ),
                      );
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.obsidian,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  ),
                ),
                child: Text(AppStrings.tUpper(lang, 'submit_wire_payment')),
              ),
            ),
          ],
        ),
      ),
    );

    senderCtrl.dispose();
    bankCtrl.dispose();
    amountCtrl.dispose();
    notesCtrl.dispose();

    if (ok == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'success'),
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
      await _load();
    }
  }

  Future<void> _openRefundModal(OrderDetailModel order) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => _OrderRefundSheet(order: order),
    );
    if (ok == true && mounted) {
      await _load();
    }
  }

  Future<void> _confirmCancel(CustomerOrder order) async {
    final lang = context.read<SessionProvider>().languageCode;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        title: Text(order.orderNumber),
        content: Text(
          UiText.pick(
            lang,
            tr: 'Bu siparişi iptal etmek istediğinize emin misiniz?',
            en: 'Are you sure you want to cancel this order?',
            ru: 'Вы уверены, что хотите отменить этот заказ?',
            ar: 'هل أنت متأكد أنك تريد إلغاء هذا الطلب؟',
            de: 'Möchten Sie diese Bestellung wirklich stornieren?',
            fr: 'Voulez-vous vraiment annuler cette commande ?',
            pl: 'Czy na pewno chcesz anulować to zamówienie?',
            bg: 'Сигурни ли сте, че искате да откажете тази поръчка?',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: Text(AppStrings.t(lang, 'confirm')),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<SessionProvider>().api.cancelCustomerOrder(order.id);
      if (!mounted) return;
      await _load();
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
    final lang = session.languageCode;
    final order = _detail;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');
    final bankIban = (session.storeSettings['bank_iban'] ??
            session.storeSettings['iban'] ??
            '')
        .toString();
    final bankName = (session.storeSettings['bank_name'] ?? '').toString();
    final bankHolder =
        (session.storeSettings['bank_account_holder'] ?? '').toString();

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          order?.orderNumber ?? AppStrings.tUpper(lang, 'order_detail'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14.5,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      body: _loading && order == null
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null && order == null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : ListView(
                  padding: const EdgeInsets.all(14),
                  children: [
                    // 1. Order Status & Timeline Card
                    EditorialCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      AppStrings.tUpper(lang, 'order_status'),
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing:
                                            AppStrings.letterSpacing(lang, 1.0),
                                        color: AppColors.editorialGold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      order!.orderNumber,
                                      style: const TextStyle(
                                        fontFamily: AppColors.serifFontFamily,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              EditorialBadge(
                                label: UiText.statusLabel(
                                  lang,
                                  order.orderStatus,
                                ),
                                backgroundColor: AppColors.warmIvory,
                                languageCode: lang,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            '${AppStrings.t(lang, 'order_timeline')}: ${dateFmt.format(order.createdAt.toLocal())}',
                            style: const TextStyle(
                              fontSize: 12.2,
                              color: AppColors.sonicSilver,
                            ),
                          ),
                          if (order.trackingCompany.isNotEmpty ||
                              order.trackingNumber.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              '${order.trackingCompany} ${order.trackingNumber}'
                                  .trim(),
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ],
                          if (order.refundStatus.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            EditorialBadge(
                              label: 'Refund: ${order.refundStatus}',
                              backgroundColor: AppColors.editorialOffWhite,
                              languageCode: lang,
                            ),
                          ],
                          const Divider(height: 22),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                AppStrings.tUpper(lang, 'grand_total'),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    order.formatOriginalBreakdown(),
                                    style: const TextStyle(
                                      fontSize: 19,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  if (order.isMultiCurrency ||
                                      session.currencyCode.toUpperCase() !=
                                          order.currency.toUpperCase())
                                    Text(
                                      '≈ ${session.formatPrice(order.totalAmountTry > 0 ? order.totalAmountTry : order.totalAmount, sourceCurrency: order.totalAmountTry > 0 ? 'TRY' : order.currency)}',
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.sonicSilver,
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 2. Wire Transfer Info Card (when available)
                    if (bankIban.isNotEmpty || bankName.isNotEmpty) ...[
                      EditorialCard(
                        padding: const EdgeInsets.all(16),
                        backgroundColor: AppColors.editorialIvory,
                        borderColor:
                            AppColors.champagneGold.withValues(alpha: 0.6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppStrings.tUpper(lang, 'wire_transfer_info'),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing:
                                    AppStrings.letterSpacing(lang, 1.0),
                                color: AppColors.editorialGold,
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (bankName.isNotEmpty)
                              Text(
                                bankName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13.5,
                                ),
                              ),
                            if (bankHolder.isNotEmpty)
                              Text(
                                bankHolder,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.onyx,
                                ),
                              ),
                            if (bankIban.isNotEmpty)
                              SelectableText(
                                bankIban,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  color: AppColors.obsidian,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // 3. Export & Actions Card (Excel + ZIP + Payment + Refund + Cancel)
                    EditorialCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _downloadingFile
                                      ? null
                                      : () => _downloadAndShare(isZip: false),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.obsidian,
                                    side: const BorderSide(
                                      color: AppColors.obsidian,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 11,
                                      horizontal: 8,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusSm,
                                      ),
                                    ),
                                  ),
                                  icon: const Icon(
                                    Icons.table_chart_outlined,
                                    size: 16,
                                  ),
                                  label: Text(
                                    AppStrings.t(lang, 'download_order_excel'),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _downloadingFile
                                      ? null
                                      : () => _downloadAndShare(isZip: true),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.obsidian,
                                    side: const BorderSide(
                                      color: AppColors.obsidian,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 11,
                                      horizontal: 8,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusSm,
                                      ),
                                    ),
                                  ),
                                  icon: const Icon(
                                    Icons.folder_zip_outlined,
                                    size: 16,
                                  ),
                                  label: Text(
                                    AppStrings.t(lang, 'download_order_images'),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (order.orderStatus.toUpperCase() ==
                                  'PENDING_PAYMENT' ||
                              order.orderStatus.toUpperCase() ==
                                  'PENDING') ...[
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _openPaymentSheet(order),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.obsidian,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(
                                          AppColors.radiusSm,
                                        ),
                                      ),
                                    ),
                                    icon: const Icon(
                                      Icons.account_balance_outlined,
                                      size: 16,
                                    ),
                                    label: Text(
                                      AppStrings.t(lang, 'payment_notification'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  onPressed: () => _confirmCancel(order),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.danger,
                                    side: const BorderSide(
                                      color: AppColors.danger,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusSm,
                                      ),
                                    ),
                                  ),
                                  child: Text(AppStrings.t(lang, 'cancel')),
                                ),
                              ],
                            ),
                          ],
                          if (order.orderStatus.toUpperCase() != 'CANCELLED' &&
                              order.refundStatus.isEmpty) ...[
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () => _openRefundModal(order),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.obsidian,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusSm,
                                  ),
                                ),
                              ),
                              icon: const Icon(
                                Icons.assignment_return_outlined,
                                size: 16,
                              ),
                              label: Text(AppStrings.t(lang, 'request_refund')),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 4. Shipping & Billing Addresses
                    EditorialCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppStrings.tUpper(lang, 'address_type_shipping'),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            order.deliveryAddress,
                            style: const TextStyle(fontSize: 12.8),
                          ),
                          const Divider(height: 18),
                          Text(
                            AppStrings.tUpper(lang, 'address_type_billing'),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            order.billingAddress,
                            style: const TextStyle(fontSize: 12.8),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 5. Line Items
                    EditorialCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${AppStrings.tUpper(lang, 'all_products')} (${order.items.length})',
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const Divider(height: 18),
                          ...order.items.map(
                            (it) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Row(
                                children: [
                                  SmartNetworkImage(
                                    imageUrl: it.imageUrl,
                                    width: 50,
                                    height: 62,
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusSm,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          it.productName,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${it.productSku} • ${it.quantity} ${AppStrings.t(lang, 'piece')}',
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AppColors.sonicSilver,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    CurrencyFormatter.format(
                                      it.priceAtPurchase * it.quantity,
                                      currency: it.currency.isNotEmpty
                                          ? it.currency
                                          : order.currency,
                                    ),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
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
    );
  }
}

class _OrderRefundSheet extends StatefulWidget {
  final OrderDetailModel order;

  const _OrderRefundSheet({required this.order});

  @override
  State<_OrderRefundSheet> createState() => _OrderRefundSheetState();
}

class _OrderRefundSheetState extends State<_OrderRefundSheet> {
  String _refundType = 'FULL';
  final _reasonCtrl = TextEditingController();
  final Map<String, int> _itemQty = <String, int>{};
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    for (final it in widget.order.items) {
      _itemQty[it.id] = 0;
    }
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final reason = _reasonCtrl.text.trim();
    if (reason.length < 3) {
      setState(() => _error = AppStrings.t(lang, 'err_validation'));
      return;
    }
    final partialItems = <OrderRefundItemPayload>[];
    if (_refundType == 'PARTIAL') {
      _itemQty.forEach((id, qty) {
        if (qty > 0) {
          partialItems.add(OrderRefundItemPayload(orderItemId: id, quantity: qty));
        }
      });
      if (partialItems.isEmpty) {
        setState(() => _error = AppStrings.t(lang, 'err_validation'));
        return;
      }
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await session.api.requestOrderRefund(
        orderId: widget.order.id,
        payload: OrderRefundPayload(
          refundType: _refundType,
          reason: reason,
          items: partialItems,
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'refund_submitted'),
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      AppStrings.tUpper(lang, 'request_refund'),
                      style: TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      selected: _refundType == 'FULL',
                      onSelected: (_) => setState(() => _refundType = 'FULL'),
                      label: SizedBox(
                        width: double.infinity,
                        child: Text(
                          AppStrings.t(lang, 'refund_full'),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      selectedColor: AppColors.obsidian,
                      labelStyle: TextStyle(
                        color: _refundType == 'FULL'
                            ? Colors.white
                            : AppColors.obsidian,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      selected: _refundType == 'PARTIAL',
                      onSelected: (_) =>
                          setState(() => _refundType = 'PARTIAL'),
                      label: SizedBox(
                        width: double.infinity,
                        child: Text(
                          AppStrings.t(lang, 'refund_partial'),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      selectedColor: AppColors.obsidian,
                      labelStyle: TextStyle(
                        color: _refundType == 'PARTIAL'
                            ? Colors.white
                            : AppColors.obsidian,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              if (_refundType == 'PARTIAL') ...[
                const SizedBox(height: 12),
                ...widget.order.items.map((it) {
                  final qty = _itemQty[it.id] ?? 0;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${it.productName} (max ${it.quantity})',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5),
                          ),
                        ),
                        IconButton(
                          onPressed: qty > 0
                              ? () => setState(() => _itemQty[it.id] = qty - 1)
                              : null,
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                        Text(
                          '$qty',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        IconButton(
                          onPressed: qty < it.quantity
                              ? () => setState(() => _itemQty[it.id] = qty + 1)
                              : null,
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: _reasonCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: '${AppStrings.t(lang, 'refund_reason')} *',
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                height: 46,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidian,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    ),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(AppStrings.tUpper(lang, 'request_refund')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
