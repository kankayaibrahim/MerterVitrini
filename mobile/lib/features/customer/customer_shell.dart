import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/app_update_dialog.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/notifications_sheet.dart';
import '../auth/auth_screen.dart';
import '../chat/chat_rooms_screen.dart';
import 'cart_and_checkout_screen.dart';
import 'catalog_screen.dart';
import 'customer_profile_screen.dart';
import 'home_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _currentIndex = 0;
  String _catalogCategoryId = '';
  String _catalogBrandId = '';
  String _catalogQuery = '';
  int _catalogFilterRevision = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CartProvider>().loadCart();
      context.read<ChatProvider>().loadRoomsForCurrentRole();
      AppUpdateDialog.checkOnStartupIfNeeded(context);
    });
  }

  void _openCatalogFiltered({
    String? categoryId,
    String? brandId,
    String? query,
  }) {
    setState(() {
      _catalogCategoryId = categoryId ?? '';
      _catalogBrandId = brandId ?? '';
      _catalogQuery = query ?? '';
      _catalogFilterRevision++;
      _currentIndex = 1;
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
    final cart = context.watch<CartProvider>();
    final chat = context.watch<ChatProvider>();
    final lang = session.languageCode;

    final pages = <Widget>[
      CustomerHomeScreen(onOpenCatalog: _openCatalogFiltered),
      CustomerCatalogScreen(
        key: ValueKey<int>(_catalogFilterRevision),
        initialCategoryId: _catalogCategoryId,
        initialBrandId: _catalogBrandId,
        initialQuery: _catalogQuery,
      ),
      const CustomerCartScreen(),
      const ChatRoomsScreen(asSupplier: false),
      const CustomerProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(88),
        child: Material(
          color: Colors.white,
          child: SafeArea(
            bottom: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. Luxury Obsidian Top Bar (Wholesale Notice + Country Flag & Currency Selectors)
                Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: const BoxDecoration(
                    color: AppColors.obsidian,
                  ),
                  child: Row(
                    children: [
                      const Text(
                        '◆ ',
                        style: TextStyle(
                          fontSize: 8.5,
                          color: AppColors.champagneGold,
                        ),
                      ),
                      Expanded(
                        child: RichText(
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          text: TextSpan(
                            style: const TextStyle(
                              fontSize: 9,
                              letterSpacing: 0.7,
                              color: Color(0xFFD4D4D4),
                            ),
                            children: [
                              TextSpan(
                                text: AppStrings.tUpper(
                                  lang,
                                  'wholesale_alert',
                                ),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.champagneGold,
                                ),
                              ),
                              TextSpan(
                                text:
                                    ' — ${AppStrings.tUpper(lang, 'alert_desc')}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      _HeaderDropdownPill(
                        selectedValue: lang,
                        label: lang.toUpperCase(),
                        options: const [
                          _DropdownOption('tr', 'TÜRKÇE'),
                          _DropdownOption('en', 'ENGLISH'),
                          _DropdownOption('ar', 'العربية'),
                          _DropdownOption('ru', 'РУССКИЙ'),
                        ],
                        onSelected: session.setLanguage,
                      ),
                      const SizedBox(width: 5),
                      _HeaderDropdownPill(
                        selectedValue: session.currencyCode,
                        label: session.currencyCode,
                        options: const [
                          _DropdownOption('TRY', 'TRY (₺)'),
                          _DropdownOption('USD', 'USD (\$)'),
                          _DropdownOption('EUR', 'EUR (€)'),
                          _DropdownOption('GBP', 'GBP (£)'),
                          _DropdownOption('RUB', 'RUB (₽)'),
                        ],
                        onSelected: session.setCurrency,
                      ),
                    ],
                  ),
                ),

                // 2. Editorial Masthead (Crest + Serif Brand + Studio & Notification Actions)
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(
                        bottom: BorderSide(color: AppColors.cultured),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _currentIndex = 0),
                            highlightColor: Colors.transparent,
                            splashColor: AppColors.editorialIvory,
                            child: Row(
                              children: [
                                const MvEditorialCrest(size: 32),
                                const SizedBox(width: 10),
                                Flexible(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        AppStrings.tUpper(lang, 'app_title'),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: AppColors.serifFontFamily,
                                          fontSize: 16.5,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.9,
                                          color: AppColors.obsidian,
                                          height: 1.05,
                                        ),
                                      ),
                                      const SizedBox(height: 2.5),
                                      Text(
                                        AppStrings.tUpper(
                                          lang,
                                          'brand_subtitle',
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 7.8,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 2.8,
                                          color: AppColors.editorialGold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () {
                            if (session.isSupplierLoggedIn) {
                              session.setActiveRole(AppRole.supplier);
                            } else {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const AuthScreen(
                                    initialRole: AppRole.supplier,
                                  ),
                                ),
                              );
                            }
                          },
                          child: Container(
                            height: 34,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            decoration: BoxDecoration(
                              color: AppColors.editorialIvory,
                              border: Border.all(
                                color: AppColors.champagneGold
                                    .withValues(alpha: 0.55),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const LuxuryIcon(
                                  kind: LuxuryIconKind.studioCamera,
                                  size: 14,
                                  color: AppColors.obsidian,
                                  accentColor: AppColors.champagneGold,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  AppStrings.tUpper(
                                    lang,
                                    'supplier_portal_login',
                                  ),
                                  style: const TextStyle(
                                    fontSize: 9.2,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.9,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Tooltip(
                          message: 'Bildirimler',
                          child: InkWell(
                            onTap: _openNotifications,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                border: Border.all(color: AppColors.cultured),
                              ),
                              alignment: Alignment.center,
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  const LuxuryIcon(
                                    kind: LuxuryIconKind.bell,
                                    size: 17,
                                    color: AppColors.obsidian,
                                    accentColor: AppColors.champagneGold,
                                  ),
                                  if (session.unreadNotificationCount > 0)
                                    Positioned(
                                      top: -5,
                                      right: -6,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 3.5,
                                          vertical: 1.5,
                                        ),
                                        color: AppColors.obsidian,
                                        child: Text(
                                          '${session.unreadNotificationCount}',
                                          style: const TextStyle(
                                            color: Colors.white,
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
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
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
          if (idx == 3) {
            context.read<ChatProvider>().loadRoomsForCurrentRole();
          }
        },
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

class _DropdownOption {
  final String value;
  final String displayLabel;

  const _DropdownOption(this.value, this.displayLabel);
}

class _HeaderDropdownPill extends StatelessWidget {
  final String selectedValue;
  final String label;
  final List<_DropdownOption> options;
  final ValueChanged<String> onSelected;

  const _HeaderDropdownPill({
    required this.selectedValue,
    required this.label,
    required this.options,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      onSelected: onSelected,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        side: BorderSide(color: AppColors.cultured),
      ),
      itemBuilder: (_) => options.map((opt) {
        final isActive =
            opt.value.toLowerCase() == selectedValue.toLowerCase();
        return PopupMenuItem<String>(
          value: opt.value,
          height: 36,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              CountryFlagIcon(
                code: opt.value,
                width: 18,
                height: 13,
              ),
              const SizedBox(width: 8),
              Text(
                opt.displayLabel,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: isActive ? AppColors.editorialGold : AppColors.onyx,
                ),
              ),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.18),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CountryFlagIcon(
              code: selectedValue,
              width: 15,
              height: 11,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9.2,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: AppColors.champagneGold,
              size: 11.5,
            ),
          ],
        ),
      ),
    );
  }
}
