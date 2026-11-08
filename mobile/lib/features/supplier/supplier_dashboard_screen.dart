import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';
import 'supplier_product_wizard_screen.dart';

class SupplierDashboardScreen extends StatefulWidget {
  final void Function(int tabIndex) onNavigateTab;

  const SupplierDashboardScreen({super.key, required this.onNavigateTab});

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
      context.read<SupplierProvider>().loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final sup = context.watch<SupplierProvider>();
    final kpis = sup.kpis;
    final wallet = sup.wallet;

    final activeProducts = (kpis['active_products'] as num?)?.toInt() ?? 0;
    final totalProducts = (kpis['total_products'] as num?)?.toInt() ?? 0;
    final totalStock = (kpis['total_stock'] as num?)?.toInt() ?? 0;
    final pendingOrders = (kpis['pending_orders'] as num?)?.toInt() ?? 0;
    final unreadChats = (kpis['unread_chat_rooms'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: sup.loadDashboard,
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          // HERO ACTION: SHOOT & UPLOAD PRODUCT FROM CAMERA
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.navy, Color(0xFF1E3A8A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accentGold,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        session.supplierUser?.displayBrand ??
                            'Tedarikçi Stüdyosu',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => session.setActiveRole(AppRole.customer),
                      icon: const Icon(Icons.storefront_outlined, size: 16),
                      label: const Text(
                        'Vitrine Geç',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Kamerayla Çek, Seri Kur ve Anında Yayınla',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Showroom veya atölyenizde yeni modelleri doğrudan telefon kameranızla çekin; seri oranını (1-2-2-1) seçip saniyeler içinde global B2B vitrinine açın.',
                  style: TextStyle(
                    color: Color(0xFFCBD5E1),
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentGold,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                        ),
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const SupplierProductWizardScreen(
                                autoOpenCamera: true,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.camera_alt_rounded, size: 19),
                        label: const Text('Kamerayla Ürün Çek & Yükle'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white12,
                        foregroundColor: Colors.white,
                      ),
                      tooltip: 'Form ile Ekle',
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const SupplierProductWizardScreen(
                              autoOpenCamera: false,
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.post_add_rounded),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // KPI GRID
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.55,
            children: [
              _KpiTile(
                title: 'Aktif / Toplam Ürün',
                value: '$activeProducts / $totalProducts',
                subtitle: 'Toplam $totalStock Adet Stok',
                icon: Icons.checkroom_rounded,
                accent: AppColors.primary,
                onTap: () => widget.onNavigateTab(1),
              ),
              _KpiTile(
                title: 'Bekleyen Sipariş',
                value: '$pendingOrders',
                subtitle: 'Hazırlık & Kargo Bekleyen',
                icon: Icons.local_shipping_outlined,
                accent: AppColors.accentGold,
                onTap: () => widget.onNavigateTab(3),
              ),
              _KpiTile(
                title: 'Müşteri Mesajları',
                value: '$unreadChats',
                subtitle: 'Yanıt Bekleyen Sohbet',
                icon: Icons.chat_bubble_outline_rounded,
                accent: AppColors.emerald,
                onTap: () => widget.onNavigateTab(2),
              ),
              _KpiTile(
                title: 'Çekilebilir Hakediş',
                value: CurrencyFormatter.format(
                  wallet.availableBalance,
                  currency: wallet.currency,
                ),
                subtitle:
                    'Provizyon: ${CurrencyFormatter.format(wallet.pendingBalance, currency: wallet.currency)}',
                icon: Icons.account_balance_wallet_outlined,
                accent: AppColors.navy,
                onTap: () => widget.onNavigateTab(4),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // LOW STOCK ALERTS
          if (sup.lowStockProducts.isNotEmpty) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(
                          Icons.warning_amber_rounded,
                          color: AppColors.accentGold,
                          size: 20,
                        ),
                        SizedBox(width: 6),
                        Text(
                          'Kritik Stok Uyarısı (< 12 Adet)',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...sup.lowStockProducts.map((item) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            SmartNetworkImage(
                              imageUrl: (item['cover_image'] ?? '').toString(),
                              width: 40,
                              height: 48,
                              borderRadius: BorderRadius.circular(8),
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
                                    ),
                                  ),
                                  Text(
                                    'SKU: ${item['custom_sku'] ?? ''}',
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.dangerLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${item['stock'] ?? 0} Adet',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.danger,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // RECENT SUB-ORDERS
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Son Gelen Toptan Siparişler',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                        ),
                      ),
                      TextButton(
                        onPressed: () => widget.onNavigateTab(3),
                        child: const Text('Tümünü Gör'),
                      ),
                    ],
                  ),
                  if (sup.recentOrders.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: Center(
                        child: Text(
                          'Henüz bekleyen alt sipariş bulunmuyor.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    )
                  else
                    ...sup.recentOrders.map(
                      (ord) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: AppColors.accentGoldLight,
                          child: const Icon(
                            Icons.inventory_2_outlined,
                            color: AppColors.accentGold,
                            size: 18,
                          ),
                        ),
                        title: Text(
                          '#${ord.subOrderNumber}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                        subtitle: Text(
                          'Durum: ${ord.status}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: Text(
                          CurrencyFormatter.format(
                            ord.netPayoutAmount,
                            currency: ord.currency,
                          ),
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.emerald,
                          ),
                        ),
                        onTap: () => widget.onNavigateTab(3),
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

class _KpiTile extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  const _KpiTile({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  Icon(icon, size: 18, color: accent),
                ],
              ),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10.5,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

