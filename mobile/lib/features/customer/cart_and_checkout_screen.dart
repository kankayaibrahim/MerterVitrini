import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';
import '../auth/auth_screen.dart';
import '../auth/phone_completion_sheet.dart';
import 'address_book_screen.dart';
import 'customer_orders_screen.dart';
import 'order_detail_screen.dart';

class CustomerCartScreen extends StatefulWidget {
  final VoidCallback? onBrowseCatalog;

  const CustomerCartScreen({super.key, this.onBrowseCatalog});

  @override
  State<CustomerCartScreen> createState() => _CustomerCartScreenState();
}

class _CustomerCartScreenState extends State<CustomerCartScreen> {
  bool _syncing = false;
  bool _exporting = false;

  Future<void> _syncCart() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final cart = context.read<CartProvider>();
    if (_syncing) return;
    setState(() => _syncing = true);
    try {
      await cart.syncCartWithServer();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'cart_synced'),
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
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _exportCartExcel() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final cart = context.read<CartProvider>();
    if (_exporting) return;
    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppStrings.t(lang, 'err_empty_cart_export')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _exporting = true);
    try {
      final bytes = await cart.exportCartExcel();
      final dir = await getTemporaryDirectory();
      final ts = DateTime.now().millisecondsSinceEpoch;
      final filePath = p.join(dir.path, 'merter_vitrini_cart_$ts.xlsx');
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          text: AppStrings.t(lang, 'export_cart_excel'),
          files: [XFile(file.path)],
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
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _proceedToCheckout() async {
    final session = context.read<SessionProvider>();
    if (!session.isCustomerLoggedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const AuthScreen(initialRole: AppRole.customer),
        ),
      );
      return;
    }
    if (session.requiresPhoneCompletion) {
      final completed = await showPhoneCompletionModal(context);
      if (!mounted) return;
      if (!completed && session.requiresPhoneCompletion) return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;

    if (cart.loading && cart.items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.obsidian,
        ),
      );
    }

    if (cart.items.isEmpty) {
      return EditorialEmptyState(
        icon: Icons.shopping_bag_outlined,
        title: AppStrings.tUpper(lang, 'nav_cart'),
        subtitle: UiText.pick(
          lang,
          tr: 'Toptan sepetiniz henüz boş. Katalogdan seri ekleyebilir veya tedarikçi sohbetinden gelen özel teklifleri onaylayabilirsiniz.',
          en: 'Your wholesale bag is empty. Add series from the catalog or accept custom quotes inside supplier chat.',
          ru: 'Ваша оптовая корзина пуста. Добавьте серии из каталога или примите спецпредложение в чате.',
          ar: 'حقيبة الجملة فارغة. أضف مجموعات من الكتالوج أو اقبل عروض الأسعار في المحادثة.',
          de: 'Ihr Großhandelswarenkorb ist leer. Fügen Sie Serien aus dem Katalog hinzu.',
          fr: 'Votre panier de gros est vide. Ajoutez des séries depuis le catalogue.',
          pl: 'Twój koszyk hurtowy jest pusty. Dodaj serie z katalogu.',
          bg: 'Кошницата ви на едро е празна. Добавете серии от каталога.',
        ),
        actionLabel: widget.onBrowseCatalog != null
            ? AppStrings.t(lang, 'all_products')
            : null,
        onAction: widget.onBrowseCatalog,
      );
    }

    final breakdownEntries = cart.currencyBreakdown.entries.toList();
    final convertedTry = cart.totalInCurrency('TRY');

    return Column(
      children: [
        // Top Utility Toolbar (Sync + Excel Export)
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${cart.totalPackages} ${AppStrings.tUpper(lang, 'package')} • ${cart.totalUnits} ${AppStrings.tUpper(lang, 'piece')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: AppStrings.letterSpacing(lang, 0.5),
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _syncing ? null : _syncCart,
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: AppColors.obsidian,
                  side: const BorderSide(color: AppColors.cultured),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                ),
                icon: _syncing
                    ? const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 1.6),
                      )
                    : const Icon(Icons.sync_rounded, size: 14),
                label: Text(
                  AppStrings.t(lang, 'sync_cart'),
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              OutlinedButton.icon(
                onPressed: _exporting ? null : _exportCartExcel,
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: AppColors.obsidian,
                  side: const BorderSide(color: AppColors.cultured),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                ),
                icon: _exporting
                    ? const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 1.6),
                      )
                    : const Icon(Icons.table_chart_outlined, size: 14),
                label: Text(
                  'Excel',
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // Cart Items List
        Expanded(
          child: RefreshIndicator(
            color: AppColors.obsidian,
            onRefresh: cart.loadCart,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: cart.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final it = cart.items[index];
                return EditorialCard(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SmartNetworkImage(
                        imageUrl: it.imageUrl,
                        width: 68,
                        height: 88,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              it.localizedTitle(lang),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                if (it.customSku.isNotEmpty) it.customSku,
                                if (it.color.isNotEmpty) it.color,
                                '${it.unitsPerPackage} ${AppStrings.t(lang, 'piece')}/${AppStrings.t(lang, 'package')}',
                              ].join(' • '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.sonicSilver,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (session.canViewPrices) ...[
                              Text(
                                CurrencyFormatter.format(
                                  it.lineTotal,
                                  currency: it.currency,
                                ),
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              if (it.currency.toUpperCase() !=
                                  session.currencyCode.toUpperCase())
                                Text(
                                  '≈ ${session.formatPrice(it.lineTotal, sourceCurrency: it.currency)}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.editorialGold,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                            ] else
                              Text(
                                AppStrings.t(lang, 'members_only'),
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.editorialGold,
                                ),
                              ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.warmIvory,
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusSm,
                                    ),
                                    border:
                                        Border.all(color: AppColors.cultured),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        iconSize: 17,
                                        onPressed: it.packagesQty > 1
                                            ? () => cart.updateItemPackages(
                                                  it,
                                                  it.packagesQty - 1,
                                                )
                                            : () => cart.removeItem(it),
                                        icon: const Icon(Icons.remove_rounded),
                                      ),
                                      Text(
                                        '${it.packagesQty}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                        ),
                                      ),
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        iconSize: 17,
                                        onPressed: () =>
                                            cart.updateItemPackages(
                                          it,
                                          it.packagesQty + 1,
                                        ),
                                        icon: const Icon(Icons.add_rounded),
                                      ),
                                    ],
                                  ),
                                ),
                                const Spacer(),
                                IconButton(
                                  onPressed: () => cart.removeItem(it),
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(
                                    Icons.delete_outline_rounded,
                                    size: 19,
                                    color: AppColors.danger,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),

        // Multi-Currency Summary + Checkout CTA Footer
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.cultured)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (session.canViewPrices && breakdownEntries.isNotEmpty) ...[
                  Text(
                    AppStrings.tUpper(lang, 'multi_currency_breakdown'),
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.editorialGold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: breakdownEntries.map((e) {
                      return EditorialBadge(
                        label: CurrencyFormatter.format(
                          e.value,
                          currency: e.key,
                        ),
                        backgroundColor: AppColors.warmIvory,
                        languageCode: lang,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 8),
                ],
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppStrings.tUpper(lang, 'grand_total'),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.sonicSilver,
                            ),
                          ),
                          if (session.canViewPrices) ...[
                            Text(
                              CurrencyFormatter.format(
                                cart.totalInDisplayCurrency,
                                currency: session.currencyCode,
                              ),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: AppColors.obsidian,
                              ),
                            ),
                            if (session.currencyCode.toUpperCase() != 'TRY')
                              Text(
                                CurrencyFormatter.format(
                                  convertedTry,
                                  currency: 'TRY',
                                ),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                          ] else
                            Text(
                              AppStrings.t(lang, 'members_only'),
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.editorialGold,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        onPressed: _proceedToCheckout,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                              AppColors.radiusMd,
                            ),
                          ),
                        ),
                        child: Text(
                          session.isCustomerLoggedIn
                              ? AppStrings.tUpper(lang, 'confirm')
                              : AppStrings.tUpper(lang, 'login'),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _deliveryCtrl = TextEditingController();
  final _billingCtrl = TextEditingController();
  List<CustomerAddress> _savedAddresses = <CustomerAddress>[];
  CustomerAddress? _selectedDelivery;
  CustomerAddress? _selectedBilling;
  bool _sameAsDelivery = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadSavedAddresses();
  }

  @override
  void dispose() {
    _deliveryCtrl.dispose();
    _billingCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSavedAddresses() async {
    try {
      final list =
          await context.read<SessionProvider>().api.listCustomerAddresses();
      if (!mounted) return;
      setState(() {
        _savedAddresses = list;
        if (list.isNotEmpty) {
          final def = list.firstWhere(
            (a) => a.isDefault,
            orElse: () => list.first,
          );
          _selectedDelivery = def;
          _selectedBilling = def;
          _deliveryCtrl.text = def.formattedFullAddress;
          _billingCtrl.text = def.formattedFullAddress;
        }
      });
    } catch (_) {}
  }

  Future<void> _pickOrCreateAddress({required bool forBilling}) async {
    final chosen = await Navigator.of(context).push<CustomerAddress>(
      MaterialPageRoute<CustomerAddress>(
        builder: (_) => const AddressBookScreen(selectionMode: true),
      ),
    );
    await _loadSavedAddresses();
    if (chosen != null && mounted) {
      setState(() {
        if (forBilling) {
          _selectedBilling = chosen;
          _billingCtrl.text = chosen.formattedFullAddress;
        } else {
          _selectedDelivery = chosen;
          _deliveryCtrl.text = chosen.formattedFullAddress;
          if (_sameAsDelivery) {
            _selectedBilling = chosen;
            _billingCtrl.text = chosen.formattedFullAddress;
          }
        }
      });
    }
  }

  Future<void> _submitOrder() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final delivery = _deliveryCtrl.text.trim();
    final billing = _sameAsDelivery ? delivery : _billingCtrl.text.trim();

    if (delivery.isEmpty || billing.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppStrings.t(lang, 'err_validation')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final cart = context.read<CartProvider>();
      final res = await session.api.createOrder(
        billingAddress: billing,
        deliveryAddress: delivery,
        paymentMethod: 'BANK_TRANSFER',
      );
      await cart.loadCart();
      await session.telemetry.trackMemberEvent(eventType: 'order_created');
      if (!mounted) return;
      final orderId = (res['id'] ?? '').toString();
      final orderNo = (res['order_number'] ?? '').toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            '${AppStrings.t(lang, 'success')} ($orderNo)',
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => orderId.isNotEmpty
              ? OrderDetailScreen(orderId: orderId)
              : const CustomerOrdersScreen(),
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
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'confirm'),
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
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              EditorialCard(
                padding: const EdgeInsets.all(14),
                backgroundColor: AppColors.editorialIvory,
                borderColor: AppColors.champagneGold.withValues(alpha: 0.55),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.tUpper(lang, 'wire_transfer_info'),
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.0),
                        color: AppColors.editorialGold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      UiText.pick(
                        lang,
                        tr: 'Siparişiniz onaylandığında her üretici için ayrı alt hazırlık emri oluşturulur.',
                        en: 'When confirmed, a dedicated sub-order is created directly with each verified manufacturer.',
                        ru: 'После подтверждения для каждого производителя создается отдельный субордер.',
                        ar: 'عند التأكيد، يتم إنشاء أمر فرعي مباشر لكل مصنع.',
                        de: 'Nach Bestätigung wird für jeden Hersteller ein eigener Teilauftrag erstellt.',
                        fr: 'À la confirmation, une sous-commande directe est créée pour chaque fabricant.',
                        pl: 'Po potwierdzeniu dla każdego producenta tworzone jest osobne podzamówienie.',
                        bg: 'При потвърждение се създава директна подпоръчка към всеки производител.',
                      ),
                      style: const TextStyle(
                        fontSize: 12.2,
                        color: AppColors.onyx,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              EditorialCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            AppStrings.t(lang, 'address_type_shipping'),
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () =>
                              _pickOrCreateAddress(forBilling: false),
                          icon: const Icon(
                            Icons.location_on_outlined,
                            size: 16,
                          ),
                          label: Text(AppStrings.t(lang, 'address_book')),
                        ),
                      ],
                    ),
                    if (_savedAddresses.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      DropdownButtonFormField<CustomerAddress>(
                        initialValue: _savedAddresses.contains(_selectedDelivery)
                            ? _selectedDelivery
                            : null,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'addresses'),
                        ),
                        items: _savedAddresses
                            .map(
                              (a) => DropdownMenuItem(
                                value: a,
                                child: Text(
                                  '${a.title}: ${a.formattedFullAddress}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (a) {
                          if (a == null) return;
                          setState(() {
                            _selectedDelivery = a;
                            _deliveryCtrl.text = a.formattedFullAddress;
                            if (_sameAsDelivery) {
                              _selectedBilling = a;
                              _billingCtrl.text = a.formattedFullAddress;
                            }
                          });
                        },
                      ),
                      const SizedBox(height: 10),
                    ],
                    TextField(
                      controller: _deliveryCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: '${AppStrings.t(lang, 'address_line')} *',
                      ),
                    ),
                    const SizedBox(height: 8),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      activeColor: AppColors.obsidian,
                      value: _sameAsDelivery,
                      onChanged: (v) =>
                          setState(() => _sameAsDelivery = v ?? true),
                      title: Text(
                        '${AppStrings.t(lang, 'address_type_billing')} = ${AppStrings.t(lang, 'address_type_shipping')}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (!_sameAsDelivery) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              AppStrings.t(lang, 'address_type_billing'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () =>
                                _pickOrCreateAddress(forBilling: true),
                            child: Text(AppStrings.t(lang, 'address_book')),
                          ),
                        ],
                      ),
                      if (_savedAddresses.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        DropdownButtonFormField<CustomerAddress>(
                          initialValue: _savedAddresses.contains(_selectedBilling)
                              ? _selectedBilling
                              : null,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'address_type_billing'),
                          ),
                          items: _savedAddresses
                              .map(
                                (a) => DropdownMenuItem(
                                  value: a,
                                  child: Text(
                                    '${a.title}: ${a.formattedFullAddress}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (a) {
                            if (a == null) return;
                            setState(() {
                              _selectedBilling = a;
                              _billingCtrl.text = a.formattedFullAddress;
                            });
                          },
                        ),
                        const SizedBox(height: 10),
                      ],
                      TextField(
                        controller: _billingCtrl,
                        maxLines: 3,
                        decoration: InputDecoration(
                          labelText:
                              '${AppStrings.t(lang, 'billing_address')} *',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              EditorialCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            '${AppStrings.tUpper(lang, 'grand_total')} (${cart.totalPackages} ${AppStrings.t(lang, 'package')})',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.sonicSilver,
                            ),
                          ),
                        ),
                        Text(
                          CurrencyFormatter.format(
                            cart.totalInDisplayCurrency,
                            currency: session.currencyCode,
                          ),
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            color: AppColors.obsidian,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submitOrder,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
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
                            : Text(
                                AppStrings.tUpper(lang, 'confirm'),
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing:
                                      AppStrings.letterSpacing(lang, 1.0),
                                ),
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
    );
  }
}
