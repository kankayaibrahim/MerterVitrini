import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/app_update_dialog.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/notifications_sheet.dart';
import '../chat/chat_rooms_screen.dart';
import 'supplier_dashboard_screen.dart';
import 'supplier_orders_screen.dart';
import 'supplier_product_wizard_screen.dart';
import 'supplier_products_screen.dart';
import 'supplier_wallet_team_screen.dart';

class SupplierShell extends StatefulWidget {
  const SupplierShell({super.key});

  @override
  State<SupplierShell> createState() => _SupplierShellState();
}

class _SupplierShellState extends State<SupplierShell> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ChatProvider>().loadRoomsForCurrentRole();
      AppUpdateDialog.checkOnStartupIfNeeded(context);
    });
  }

  void _openNotifications() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(),
      builder: (_) => const NotificationsBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final chat = context.watch<ChatProvider>();
    final lang = session.languageCode;
    final supUser = session.supplierUser;

    final pages = <Widget>[
      SupplierDashboardScreen(
        onNavigateTab: (tab) => setState(() => _currentIndex = tab),
      ),
      const SupplierProductsScreen(),
      const ChatRoomsScreen(asSupplier: true),
      const SupplierOrdersScreen(),
      const SupplierWalletTeamScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.obsidian,
        titleSpacing: 12,
        title: Row(
          children: [
            const MvEditorialCrest(size: 30),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (supUser?.displayBrand ??
                            AppStrings.t(lang, 'supplier_mode'))
                        .toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: AppColors.serifFontFamily,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 1.5),
                  Text(
                    '${supUser?.contactName ?? ''} • TEDARİKÇİ STÜDYOSU'
                        .toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 8.5,
                      color: AppColors.champagneGold,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          _SupplierActionSquare(
            tooltip: 'Kamerayla Yeni Ürün Ekle',
            icon: LuxuryIconKind.studioCamera,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const SupplierProductWizardScreen(
                    autoOpenCamera: true,
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 6),
          _SupplierActionSquare(
            tooltip: 'Uygulama Güncellemelerini Kontrol Et',
            icon: LuxuryIconKind.update,
            onTap: () => AppUpdateDialog.checkManually(context),
          ),
          const SizedBox(width: 6),
          _SupplierActionSquare(
            tooltip: 'Bildirimler',
            icon: LuxuryIconKind.bell,
            badgeCount: session.unreadNotificationCount,
            onTap: _openNotifications,
          ),
          const SizedBox(width: 6),
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: InkWell(
                onTap: () => session.setActiveRole(AppRole.customer),
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border: Border.all(
                      color: AppColors.champagneGold.withValues(alpha: 0.65),
                    ),
                  ),
                  child: const Text(
                    'VİTRİN',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: EditorialBottomNavBar(
        selectedIndex: _currentIndex,
        languageCode: lang,
        onTap: (idx) {
          setState(() => _currentIndex = idx);
          if (idx == 2) {
            context.read<ChatProvider>().loadRoomsForCurrentRole();
          }
        },
        items: [
          EditorialNavItem(
            icon: LuxuryIconKind.collection,
            label: AppStrings.t(lang, 'nav_dashboard'),
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.showroom,
            label: AppStrings.t(lang, 'nav_products'),
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.concierge,
            label: AppStrings.t(lang, 'nav_messages'),
            badgeCount: chat.totalSupplierUnread,
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.orders,
            label: AppStrings.t(lang, 'nav_orders'),
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.account,
            label: AppStrings.t(lang, 'nav_wallet'),
          ),
        ],
      ),
    );
  }
}

class _SupplierActionSquare extends StatelessWidget {
  final String tooltip;
  final LuxuryIconKind icon;
  final int badgeCount;
  final VoidCallback onTap;

  const _SupplierActionSquare({
    required this.tooltip,
    required this.icon,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          onTap: onTap,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.16),
              ),
            ),
            alignment: Alignment.center,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                LuxuryIcon(
                  kind: icon,
                  size: 16,
                  color: Colors.white,
                  accentColor: AppColors.champagneGold,
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -5,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 3.5,
                        vertical: 1.5,
                      ),
                      color: AppColors.champagneGold,
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(
                          color: AppColors.obsidian,
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
