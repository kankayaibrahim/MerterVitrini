import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/smart_network_image.dart';
import '../auth/auth_screen.dart';
import 'customer_orders_screen.dart';

class CustomerCartScreen extends StatelessWidget {
  const CustomerCartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final session = context.watch<SessionProvider>();

    if (cart.loading && cart.items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.obsidian,
        ),
      );
    }

    if (cart.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.editorialOffWhite,
                  border: Border.all(color: AppColors.cultured),
                ),
                alignment: Alignment.center,
                child: const LuxuryIcon(
                  kind: LuxuryIconKind.bag,
                  size: 32,
                  color: AppColors.obsidian,
                  accentColor: AppColors.champagneGold,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'TOPTAN SEPETİNİZ BOŞ',
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.8,
                  color: AppColors.obsidian,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Katalogdan seri/paket ürünleri ekleyebilir veya tedarikçi sohbetinden gelen özel fiyat tekliflerini onaylayabilirsiniz.',
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
      );
    }

    return Column(
      children: [
        // Editorial Cart Header Strip
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            color: AppColors.editorialOffWhite,
            border: Border(bottom: BorderSide(color: AppColors.cultured)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'TOPTAN SİPARİŞ SEPETİ',
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.5,
                  color: AppColors.obsidian,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${cart.totalPackages} SERİ • ${cart.totalUnits} ADET',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.0,
                      color: AppColors.editorialGold,
                    ),
                  ),
                  const SizedBox(width: 10),
                  InkWell(
                    onTap: () => cart.clearCart(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: const Text(
                        'TEMİZLE',
                        style: TextStyle(
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: AppColors.sonicSilver,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: cart.items.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = cart.items[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: AppColors.cultured),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: SmartNetworkImage(
                        imageUrl: item.imageUrl,
                        width: 72,
                        height: 92,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: AppColors.obsidian,
                                    height: 1.25,
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () => cart.updateItemPackages(item, 0),
                                child: const Padding(
                                  padding: EdgeInsets.only(left: 8, bottom: 4),
                                  child: Icon(
                                    Icons.close_rounded,
                                    size: 16,
                                    color: AppColors.spanishGray,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'SKU: ${item.customSku}${item.color.isNotEmpty ? ' • ${item.color}' : ''} • 1 Seri = ${item.unitsPerPackage} Adet',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.sonicSilver,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${item.packagesQty} Seri (${item.totalUnits} Adet) × ${session.formatPrice(item.pricePerUnit, sourceCurrency: item.currency)} / Adet',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                session.formatPrice(
                                  item.lineTotal,
                                  sourceCurrency: item.currency,
                                ),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 15,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.obsidian),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    InkWell(
                                      onTap: () => cart.updateItemPackages(
                                        item,
                                        item.packagesQty - 1,
                                      ),
                                      child: Container(
                                        width: 28,
                                        height: 28,
                                        alignment: Alignment.center,
                                        child: const Icon(
                                          Icons.remove,
                                          size: 14,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      height: 28,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 9,
                                      ),
                                      decoration: const BoxDecoration(
                                        border: Border.symmetric(
                                          vertical: BorderSide(
                                            color: AppColors.cultured,
                                          ),
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        '${item.packagesQty} SERİ',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 11,
                                          letterSpacing: 0.4,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () => cart.updateItemPackages(
                                        item,
                                        item.packagesQty + 1,
                                      ),
                                      child: Container(
                                        width: 28,
                                        height: 28,
                                        alignment: Alignment.center,
                                        child: const Icon(
                                          Icons.add,
                                          size: 14,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                  ],
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
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.cultured)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'GENEL TOPLAM (${cart.totalPackages} SERİ / ${cart.totalUnits} ADET)',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                  Text(
                    session.formatPrice(cart.totalAmountTry),
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: AppColors.obsidian,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 46,
                child: Material(
                  color: AppColors.obsidian,
                  child: InkWell(
                    onTap: () async {
                      if (!session.isCustomerLoggedIn) {
                        final ok = await Navigator.of(context).push<bool>(
                          MaterialPageRoute<bool>(
                            builder: (_) =>
                                const AuthScreen(initialRole: AppRole.customer),
                          ),
                        );
                        if (ok != true || !context.mounted) return;
                      }
                      if (!context.mounted) return;
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const CheckoutScreen(),
                        ),
                      );
                    },
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        LuxuryIcon(
                          kind: LuxuryIconKind.shield,
                          size: 16,
                          color: Colors.white,
                          accentColor: AppColors.champagneGold,
                        ),
                        SizedBox(width: 9),
                        Text(
                          'TOPTAN SİPARİŞİ TAMAMLA',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
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
      if (list.isNotEmpty && mounted) {
        setState(() {
          _deliveryCtrl.text = list.first.formattedFullAddress;
          _billingCtrl.text = list.first.formattedFullAddress;
        });
      }
    } catch (_) {}
  }

  Future<void> _submitOrder() async {
    final delivery = _deliveryCtrl.text.trim();
    final billing = _sameAsDelivery ? delivery : _billingCtrl.text.trim();

    if (delivery.isEmpty || billing.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lütfen teslimat ve fatura adresini giriniz.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final session = context.read<SessionProvider>();
      final cart = context.read<CartProvider>();
      final res = await session.api.createOrder(
        billingAddress: billing,
        deliveryAddress: delivery,
        paymentMethod: 'BANK_TRANSFER',
      );
      await cart.loadCart();
      if (!mounted) return;
      final orderNo = (res['order_number'] ?? '').toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Siparişiniz oluşturuldu ($orderNo)! Havale bildirimini Siparişlerim ekranından iletebilirsiniz.',
          ),
          backgroundColor: AppColors.obsidian,
        ),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => const CustomerOrdersScreen(),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final session = context.watch<SessionProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'TOPTAN SİPARİŞ ONAYI',
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.editorialIvory,
                  border: Border.all(
                    color: AppColors.champagneGold.withValues(alpha: 0.55),
                  ),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'KURUMSAL BANKA HAVALESİ / EFT / SWIFT',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                        color: AppColors.editorialGold,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Siparişiniz onaylandığında her üretici için ayrı alt hazırlık emri (Sub-Order) otomatik oluşturulur.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.onyx,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: _deliveryCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Teslimat / Kargo Ambar Adresi *',
                  hintText:
                      'Firma adı, alıcı, açık adres, il/ilçe, ülke ve telefon...',
                ),
              ),
              const SizedBox(height: 10),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.obsidian,
                value: _sameAsDelivery,
                onChanged: (v) => setState(() => _sameAsDelivery = v ?? true),
                title: const Text(
                  'Fatura adresi teslimat adresi ile aynı olsun',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              if (!_sameAsDelivery) ...[
                TextField(
                  controller: _billingCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Kurumsal Fatura Bilgileri & Vergi No *',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              const Divider(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'GENEL TOPLAM (${cart.totalPackages} SERİ / ${cart.totalUnits} ADET)',
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                  Text(
                    session.formatPrice(cart.totalAmountTry),
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: AppColors.obsidian,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidian,
                  ),
                  onPressed: _submitting ? null : _submitOrder,
                  child: Text(
                    _submitting
                        ? 'SİPARİŞ OLUŞTURULUYOR...'
                        : 'TOPTAN SİPARİŞİ KESİNLEŞTİR',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
