import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/language_currency_modal.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/notifications_sheet.dart';
import '../auth/auth_screen.dart';
import '../auth/phone_completion_sheet.dart';
import '../auth/supplier_application_screen.dart';
import '../chat/chat_rooms_screen.dart';
import 'blog_and_cms_screen.dart';
import 'cart_and_checkout_screen.dart';
import 'catalog_screen.dart';
import 'customer_profile_screen.dart';
import 'home_screen.dart';
import 'manufacturers_screen.dart';
import 'rfq_board_screen.dart';
import 'service_providers_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _tabIndex = 0;

  String? _catalogCategoryId;
  String? _catalogBrandId;
  String? _catalogBrandSlug;
  String? _catalogQuery;
  int _catalogFilterVersion = 0;

  static const List<String> _tabPaths = <String>[
    '/',
    '/catalog',
    '/cart',
    '/messages',
    '/profile',
  ];

  void _openCatalog({
    String? categoryId,
    String? brandId,
    String? brandSlug,
    String? query,
  }) {
    setState(() {
      _catalogCategoryId = categoryId;
      _catalogBrandId = brandId;
      _catalogBrandSlug = brandSlug;
      _catalogQuery = query;
      _catalogFilterVersion++;
      _tabIndex = 1;
    });
    context.read<SessionProvider>().telemetry.trackScreenView(
          path: '/catalog',
          pageTitle: 'Wholesale Catalog',
        );
  }

  void _selectTab(int idx) {
    if (idx == _tabIndex) return;
    setState(() => _tabIndex = idx);
    final path = idx < _tabPaths.length ? _tabPaths[idx] : '/';
    context.read<SessionProvider>().telemetry.trackScreenView(
          path: path,
          pageTitle: 'Customer Tab $idx',
        );
  }

  Future<void> _openNotifications() async {
    final session = context.read<SessionProvider>();
    await session.refreshNotifications();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => const NotificationsBottomSheet(),
    );
  }

  Future<void> _openB2bDirectoryMenu() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.warmHairline,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'B2B PORTAL',
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: AppStrings.letterSpacing(lang, 1.1),
                  color: AppColors.obsidian,
                ),
              ),
              const Divider(height: 18),
              _HubMenuTile(
                icon: Icons.factory_outlined,
                title: AppStrings.t(lang, 'manufacturers_directory'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const ManufacturersScreen(),
                    ),
                  );
                },
              ),
              _HubMenuTile(
                icon: Icons.request_quote_outlined,
                title: AppStrings.t(lang, 'rfq_board'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const RfqBoardScreen(),
                    ),
                  );
                },
              ),
              _HubMenuTile(
                icon: Icons.local_shipping_outlined,
                title: AppStrings.t(lang, 'service_providers'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const ServiceProvidersScreen(),
                    ),
                  );
                },
              ),
              _HubMenuTile(
                icon: Icons.article_outlined,
                title:
                    '${AppStrings.t(lang, 'blog_title')} & ${AppStrings.t(lang, 'legal_policies')}',
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const BlogAndCmsScreen(),
                    ),
                  );
                },
              ),
              _HubMenuTile(
                icon: Icons.verified_user_outlined,
                title: AppStrings.t(lang, 'supplier_apply'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const SupplierApplicationScreen(),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final cart = context.watch<CartProvider>();
    final chat = context.watch<ChatProvider>();
    final lang = session.languageCode;

    final pages = <Widget>[
      CustomerHomeScreen(
        onOpenCatalog: _openCatalog,
        onNavigateTab: _selectTab,
      ),
      CatalogScreen(
        initialCategoryId: _catalogCategoryId,
        initialBrandId: _catalogBrandId,
        initialBrandSlug: _catalogBrandSlug,
        initialQuery: _catalogQuery,
        filterVersion: _catalogFilterVersion,
      ),
      CustomerCartScreen(
        onBrowseCatalog: () => _selectTab(1),
      ),
      const ChatRoomsScreen(asSupplier: false),
      CustomerProfileScreen(onNavigateTab: _selectTab),
    ];

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(62),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.cultured)),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  const MvEditorialCrest(size: 30),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'MERTER VİTRİNİ',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: AppStrings.letterSpacing(lang, 1.3),
                            color: AppColors.obsidian,
                            height: 1.05,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'B2B WHOLESALE',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: AppStrings.letterSpacing(lang, 1.5),
                            color: AppColors.editorialGold,
                            height: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // 8-Language & Currency Quick Pill
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: () => showLanguageCurrencyModal(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CountryFlagIcon(code: lang, width: 17, height: 12),
                          const SizedBox(width: 5),
                          Text(
                            '${lang.toUpperCase()} • ${session.currencyCode}',
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
                  const SizedBox(width: 6),
                  // B2B Portal Hub Shortcut Button
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: _openB2bDirectoryMenu,
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.apps_rounded,
                        size: 18,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  // Notification Center
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: _openNotifications,
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      alignment: Alignment.center,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          const LuxuryIcon(
                            kind: LuxuryIconKind.bell,
                            size: 16,
                            color: AppColors.obsidian,
                          ),
                          if (session.unreadNotificationCount > 0)
                            Positioned(
                              right: -4,
                              top: -4,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: AppColors.discountRed,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (!session.isCustomerLoggedIn) ...[
                    const SizedBox(width: 6),
                    InkWell(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                const AuthScreen(initialRole: AppRole.customer),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.obsidian,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                        ),
                        child: Text(
                          AppStrings.tUpper(lang, 'login'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          const PhoneCompletionBanner(),
          Expanded(
            child: IndexedStack(index: _tabIndex, children: pages),
          ),
        ],
      ),
      bottomNavigationBar: EditorialBottomNavBar(
        selectedIndex: _tabIndex,
        languageCode: lang,
        onTap: _selectTab,
        items: [
          EditorialNavItem(
            icon: LuxuryIconKind.showroom,
            label: AppStrings.t(lang, 'nav_home'),
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.collection,
            label: AppStrings.t(lang, 'nav_catalog'),
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.bag,
            label: AppStrings.t(lang, 'nav_cart'),
            badgeCount: cart.totalPackages,
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.concierge,
            label: AppStrings.t(lang, 'nav_messages'),
            badgeCount: chat.totalCustomerUnread,
          ),
          EditorialNavItem(
            icon: LuxuryIconKind.account,
            label: AppStrings.t(lang, 'nav_profile'),
          ),
        ],
      ),
    );
  }
}

class _HubMenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _HubMenuTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.warmIvory,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 19, color: AppColors.obsidian),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: AppColors.serifFontFamily,
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.obsidian,
        ),
      ),
      trailing: const Icon(Icons.chevron_right_rounded, size: 18),
      onTap: onTap,
    );
  }
}
