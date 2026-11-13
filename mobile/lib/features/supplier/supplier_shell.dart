import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/app_update_dialog.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/notifications_sheet.dart';
import '../chat/chat_rooms_screen.dart';
import 'supplier_analytics_screen.dart';
import 'supplier_billing_payouts_screen.dart';
import 'supplier_dashboard_screen.dart';
import 'supplier_editorial_profile_screen.dart';
import 'supplier_orders_screen.dart';
import 'supplier_product_wizard_screen.dart';
import 'supplier_products_screen.dart';
import 'supplier_rfqs_screen.dart';
import 'supplier_wallet_team_screen.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierShell extends StatefulWidget {
  const SupplierShell({super.key});

  @override
  State<SupplierShell> createState() => _SupplierShellState();
}

class _SupplierShellState extends State<SupplierShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ChatProvider>().loadRoomsForCurrentRole();
      AppUpdateDialog.checkOnStartupIfNeeded(context);
      _emitTabTelemetry(0);
    });
  }

  void _emitTabTelemetry(int index) {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final (path, title) = switch (index) {
      0 => ('/supplier', AppStrings.t(lang, 'nav_dashboard')),
      1 => ('/supplier/products', AppStrings.t(lang, 'nav_products')),
      2 => ('/supplier/chat', AppStrings.t(lang, 'nav_messages')),
      3 => ('/supplier/orders', AppStrings.t(lang, 'nav_orders')),
      _ => ('/supplier/wallet', AppStrings.t(lang, 'nav_wallet')),
    };
    unawaited(
      session.telemetry.trackScreenView(path: path, pageTitle: title),
    );
  }

  void _selectTab(int idx) {
    if (_currentIndex != idx) {
      setState(() => _currentIndex = idx);
    }
    if (idx == 2) {
      context.read<ChatProvider>().loadRoomsForCurrentRole();
    }
    _emitTabTelemetry(idx);
  }

  Future<void> _pushStudioPage(Widget screen) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  void _openNotifications() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
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
      SupplierDashboardScreen(onNavigateTab: _selectTab),
      const SupplierProductsScreen(),
      const ChatRoomsScreen(asSupplier: true),
      const SupplierOrdersScreen(),
      const SupplierWalletTeamScreen(),
    ];

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.warmIvory,
      drawer: _buildStudioDrawer(context, session, chat, lang, supUser),
      appBar: AppBar(
        backgroundColor: AppColors.pureWhite,
        foregroundColor: AppColors.obsidian,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        leading: IconButton(
          tooltip: SupplierL10n.t(lang, 'studio_menu'),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          icon: const Icon(Icons.menu_rounded, color: AppColors.obsidian),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              supUser?.displayBrand ?? AppStrings.t(lang, 'supplier_panel'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.obsidian,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              SupplierL10n.upper(lang, 'studio_eyebrow'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.luxuryBronze,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: AppStrings.letterSpacing(lang, 1.5),
              ),
            ),
          ],
        ),
        actions: [
          _LightHeaderSquare(
            tooltip: SupplierL10n.t(lang, 'quick_camera_cta'),
            onTap: () => _pushStudioPage(
              const SupplierProductWizardScreen(autoOpenCamera: true),
            ),
            child: const LuxuryIcon(
              kind: LuxuryIconKind.studioCamera,
              size: 16,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(width: 6),
          _LightHeaderSquare(
            tooltip: AppStrings.t(lang, 'notifications'),
            badgeCount: session.unreadNotificationCount,
            onTap: _openNotifications,
            child: const LuxuryIcon(
              kind: LuxuryIconKind.bell,
              size: 16,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(width: 6),
          Center(
            child: InkWell(
              onTap: () => showSupplierLanguageCurrencyDialog(context),
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
              child: Container(
                height: 32,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.warmIvory,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  border: Border.all(color: AppColors.warmHairline),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CountryFlagIcon(code: lang, width: 15, height: 11),
                    const SizedBox(width: 4),
                    Text(
                      lang.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 6, right: 10),
            child: Center(
              child: InkWell(
                onTap: () => session.setActiveRole(AppRole.customer),
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.accentGoldLight,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    border: Border.all(
                      color: AppColors.luxuryBronze.withValues(alpha: 0.45),
                    ),
                  ),
                  child: Text(
                    SupplierL10n.upper(lang, 'switch_buyer'),
                    style: TextStyle(
                      color: AppColors.luxuryBronze,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: AppStrings.letterSpacing(lang, 0.8),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: AppColors.warmHairline),
        ),
      ),
      body: Column(
        children: [
          _StudioQuickAccessBar(
            lang: lang,
            onAnalytics: () => _pushStudioPage(const SupplierAnalyticsScreen()),
            onRfqs: () => _pushStudioPage(const SupplierRfqsScreen()),
            onBilling: () =>
                _pushStudioPage(const SupplierBillingPayoutsScreen()),
            onProfile: () =>
                _pushStudioPage(const SupplierEditorialProfileScreen()),
          ),
          const Divider(height: 1, color: AppColors.warmHairline),
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: pages,
            ),
          ),
        ],
      ),
      bottomNavigationBar: EditorialBottomNavBar(
        selectedIndex: _currentIndex,
        darkTheme: false,
        languageCode: lang,
        onTap: _selectTab,
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

  Widget _buildStudioDrawer(
    BuildContext context,
    SessionProvider session,
    ChatProvider chat,
    String lang,
    SupplierUser? supUser,
  ) {
    void closeAnd(VoidCallback action) {
      Navigator.pop(context);
      action();
    }

    return Drawer(
      backgroundColor: AppColors.pureWhite,
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  EditorialStatusBadge.bronze(
                    SupplierL10n.upper(lang, 'studio_eyebrow'),
                    icon: Icons.workspace_premium_outlined,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    supUser?.displayBrand ?? AppStrings.t(lang, 'supplier_mode'),
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.obsidian,
                    ),
                  ),
                  if ((supUser?.email ?? '').isNotEmpty)
                    Text(
                      supUser!.email,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.mutedAccessible,
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.warmHairline),
            _DrawerDestinationTile(
              icon: Icons.dashboard_outlined,
              label: AppStrings.t(lang, 'nav_dashboard'),
              selected: _currentIndex == 0,
              onTap: () => closeAnd(() => _selectTab(0)),
            ),
            _DrawerDestinationTile(
              icon: Icons.analytics_outlined,
              label: AppStrings.t(lang, 'supplier_analytics'),
              onTap: () => closeAnd(
                () => _pushStudioPage(const SupplierAnalyticsScreen()),
              ),
            ),
            _DrawerDestinationTile(
              icon: Icons.checkroom_outlined,
              label: AppStrings.t(lang, 'nav_products'),
              selected: _currentIndex == 1,
              onTap: () => closeAnd(() => _selectTab(1)),
            ),
            _DrawerDestinationTile(
              icon: Icons.request_quote_outlined,
              label: AppStrings.t(lang, 'rfq_board'),
              onTap: () => closeAnd(
                () => _pushStudioPage(const SupplierRfqsScreen()),
              ),
            ),
            _DrawerDestinationTile(
              icon: Icons.local_shipping_outlined,
              label: AppStrings.t(lang, 'nav_orders'),
              selected: _currentIndex == 3,
              onTap: () => closeAnd(() => _selectTab(3)),
            ),
            _DrawerDestinationTile(
              icon: Icons.receipt_long_outlined,
              label: SupplierL10n.t(lang, 'billing_payouts_title'),
              onTap: () => closeAnd(
                () => _pushStudioPage(const SupplierBillingPayoutsScreen()),
              ),
            ),
            _DrawerDestinationTile(
              icon: Icons.store_mall_directory_outlined,
              label: AppStrings.t(lang, 'supplier_profile_editorial'),
              onTap: () => closeAnd(
                () => _pushStudioPage(const SupplierEditorialProfileScreen()),
              ),
            ),
            _DrawerDestinationTile(
              icon: Icons.account_balance_wallet_outlined,
              label: SupplierL10n.t(lang, 'wallet_team_title'),
              selected: _currentIndex == 4,
              onTap: () => closeAnd(() => _selectTab(4)),
            ),
            _DrawerDestinationTile(
              icon: Icons.forum_outlined,
              label: AppStrings.t(lang, 'nav_messages'),
              selected: _currentIndex == 2,
              badgeCount: chat.totalSupplierUnread,
              onTap: () => closeAnd(() => _selectTab(2)),
            ),
            _DrawerDestinationTile(
              icon: Icons.notifications_none_rounded,
              label: AppStrings.t(lang, 'notifications'),
              badgeCount: session.unreadNotificationCount,
              onTap: () => closeAnd(_openNotifications),
            ),
            const Divider(color: AppColors.warmHairline),
            _DrawerDestinationTile(
              icon: Icons.language_rounded,
              label:
                  '${AppStrings.t(lang, 'language')} / ${AppStrings.t(lang, 'currency')}',
              onTap: () => closeAnd(
                () => showSupplierLanguageCurrencyDialog(context),
              ),
            ),
            _DrawerDestinationTile(
              icon: Icons.storefront_outlined,
              label: AppStrings.t(lang, 'switch_to_customer'),
              onTap: () => closeAnd(
                () => session.setActiveRole(AppRole.customer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LightHeaderSquare extends StatelessWidget {
  final String tooltip;
  final Widget child;
  final int badgeCount;
  final VoidCallback onTap;

  const _LightHeaderSquare({
    required this.tooltip,
    required this.child,
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
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.warmIvory,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
              border: Border.all(color: AppColors.warmHairline),
            ),
            alignment: Alignment.center,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                child,
                if (badgeCount > 0)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Container(
                      constraints: const BoxConstraints(
                        minWidth: 15,
                        minHeight: 15,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        color: AppColors.luxuryBronze,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
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

class _StudioQuickAccessBar extends StatelessWidget {
  final String lang;
  final VoidCallback onAnalytics;
  final VoidCallback onRfqs;
  final VoidCallback onBilling;
  final VoidCallback onProfile;

  const _StudioQuickAccessBar({
    required this.lang,
    required this.onAnalytics,
    required this.onRfqs,
    required this.onBilling,
    required this.onProfile,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.pureWhite,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _StudioPillButton(
              icon: Icons.analytics_outlined,
              label: AppStrings.t(lang, 'supplier_analytics'),
              onTap: onAnalytics,
            ),
            const SizedBox(width: 8),
            _StudioPillButton(
              icon: Icons.request_quote_outlined,
              label: AppStrings.t(lang, 'rfq_board'),
              onTap: onRfqs,
            ),
            const SizedBox(width: 8),
            _StudioPillButton(
              icon: Icons.receipt_long_outlined,
              label: AppStrings.t(lang, 'supplier_billing'),
              onTap: onBilling,
            ),
            const SizedBox(width: 8),
            _StudioPillButton(
              icon: Icons.store_mall_directory_outlined,
              label: AppStrings.t(lang, 'supplier_profile_editorial'),
              onTap: onProfile,
            ),
          ],
        ),
      ),
    );
  }
}

class _StudioPillButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _StudioPillButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.warmIvory,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          border: Border.all(color: AppColors.warmHairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.luxuryBronze),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerDestinationTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final int badgeCount;
  final VoidCallback onTap;

  const _DrawerDestinationTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      selected: selected,
      selectedTileColor: AppColors.accentGoldLight,
      leading: Icon(
        icon,
        size: 20,
        color: selected ? AppColors.luxuryBronze : AppColors.charcoal,
      ),
      title: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 13.5,
          fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          color: selected ? AppColors.luxuryBronze : AppColors.obsidian,
        ),
      ),
      trailing: badgeCount > 0
          ? EditorialStatusBadge.bronze('$badgeCount')
          : null,
      onTap: onTap,
    );
  }
}
