import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../services/app_update_service.dart';
import '../../widgets/app_update_dialog.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/language_currency_modal.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import '../auth/auth_screen.dart';
import '../auth/phone_completion_sheet.dart';
import '../auth/supplier_application_screen.dart';
import 'address_book_screen.dart';
import 'blog_and_cms_screen.dart';
import 'customer_orders_screen.dart';
import 'manufacturers_screen.dart';
import 'product_detail_screen.dart';
import 'rfq_board_screen.dart';
import 'service_providers_screen.dart';

class CustomerProfileScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigateTab;

  const CustomerProfileScreen({super.key, this.onNavigateTab});

  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen> {
  bool _resendingVerification = false;

  Future<void> _resendVerification(String email) async {
    if (_resendingVerification) return;
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    setState(() => _resendingVerification = true);
    try {
      await session.resendEmailVerification(email: email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'verification_sent_success'),
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
      if (mounted) setState(() => _resendingVerification = false);
    }
  }

  Future<void> _openEditProfileSheet(CustomerUser user) async {
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => _EditProfileSheet(user: user),
    );
  }

  Future<void> _openWishlistSheet() async {
    final session = context.read<SessionProvider>();
    await session.refreshWishlist();
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
      builder: (ctx) {
        final s = ctx.watch<SessionProvider>();
        final lang = s.languageCode;
        final items = s.wishlistProducts;
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.80,
          maxChildSize: 0.94,
          minChildSize: 0.5,
          builder: (context, scrollCtrl) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${AppStrings.tUpper(lang, 'wishlist')} (${items.length})',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
                            color: AppColors.obsidian,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.close_rounded, size: 19),
                      ),
                    ],
                  ),
                  const Divider(height: 14),
                  Expanded(
                    child: items.isEmpty
                        ? EditorialEmptyState(
                            icon: Icons.favorite_border_rounded,
                            title: AppStrings.t(lang, 'wishlist'),
                            subtitle: AppStrings.t(lang, 'empty'),
                          )
                        : GridView.builder(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.only(top: 8),
                            itemCount: items.length,
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 10,
                              childAspectRatio: 0.54,
                            ),
                            itemBuilder: (context, idx) {
                              final p = items[idx];
                              return B2BProductCard(
                                product: p,
                                onTap: () {
                                  Navigator.of(ctx).pop();
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) =>
                                          ProductDetailScreen(productId: p.id),
                                    ),
                                  );
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _confirmPermanentAccountDeletion() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final reasonCtrl = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        title: Text(
          AppStrings.t(lang, 'delete_account'),
          style: const TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              UiText.pick(
                lang,
                tr: 'Hesabınız ve ilişkili profil verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.',
                en: 'Your account and associated profile data will be permanently deleted. This action cannot be undone.',
                ru: 'Ваш аккаунт и связанные данные профиля будут удалены безвозвратно.',
                ar: 'سيتم حذف حسابك وبيانات ملفك الشخصي بشكل دائم. لا يمكن التراجع عن هذا الإجراء.',
                de: 'Ihr Konto und die zugehörigen Profildaten werden dauerhaft gelöscht.',
                fr: 'Votre compte et vos données de profil seront définitivement supprimés.',
                pl: 'Twoje konto i powiązane dane zostaną trwale usunięte.',
                bg: 'Вашият акаунт и данните на профила ще бъдат изтрити завинаги.',
              ),
              style: const TextStyle(fontSize: 12.5, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: InputDecoration(
                labelText: AppStrings.t(lang, 'refund_reason'),
              ),
            ),
          ],
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
            child: Text(AppStrings.t(lang, 'delete_account')),
          ),
        ],
      ),
    );

    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();

    if (confirmed != true || !mounted) return;
    try {
      await session.deleteCurrentAccountPermanently(reason: reason);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.t(lang, 'success'))),
      );
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
    final user = session.customerUser;

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        // 1. Customer Identity Card (or Guest Onboarding Card)
        EditorialCard(
          padding: const EdgeInsets.all(18),
          borderRadius: AppColors.radiusLg,
          child: session.isCustomerLoggedIn && user != null
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.obsidian,
                            borderRadius: BorderRadius.circular(
                              AppColors.radiusMd,
                            ),
                            border: Border.all(
                              color: AppColors.champagneGold
                                  .withValues(alpha: 0.65),
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            user.fullName.isNotEmpty
                                ? user.fullName.characters.first.toUpperCase()
                                : 'B',
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                AppStrings.tUpper(lang, 'customer_store'),
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing:
                                      AppStrings.letterSpacing(lang, 1.1),
                                  color: AppColors.editorialGold,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                user.fullName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: AppColors.serifFontFamily,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                user.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => _openEditProfileSheet(user),
                          tooltip: AppStrings.t(lang, 'edit_profile'),
                          icon: const Icon(
                            Icons.edit_outlined,
                            size: 20,
                            color: AppColors.obsidian,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        EditorialBadge(
                          label: user.emailVerified
                              ? AppStrings.t(lang, 'already_verified')
                              : AppStrings.t(lang, 'email_verification_pending'),
                          backgroundColor: user.emailVerified
                              ? AppColors.emeraldLight
                              : AppColors.warmIvory,
                          textColor: user.emailVerified
                              ? AppColors.emerald
                              : AppColors.editorialGold,
                          icon: user.emailVerified
                              ? Icons.verified_outlined
                              : Icons.mark_email_unread_outlined,
                          languageCode: lang,
                        ),
                        if (user.phone.trim().isNotEmpty)
                          EditorialBadge(
                            label: user.phone,
                            icon: Icons.phone_outlined,
                            languageCode: lang,
                          ),
                      ],
                    ),
                    if (!user.emailVerified) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _resendingVerification
                            ? null
                            : () => _resendVerification(user.email),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.obsidian,
                          side: const BorderSide(color: AppColors.obsidian),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                          ),
                        ),
                        icon: _resendingVerification
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.send_outlined, size: 15),
                        label: Text(AppStrings.t(lang, 'resend_verification')),
                      ),
                    ],
                    if (session.requiresPhoneCompletion) ...[
                      const SizedBox(height: 8),
                      ElevatedButton.icon(
                        onPressed: () => showPhoneCompletionModal(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                          ),
                        ),
                        icon: const Icon(Icons.phone_iphone_rounded, size: 16),
                        label: Text(
                          AppStrings.t(lang, 'phone_completion_action'),
                        ),
                      ),
                    ],
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      AppStrings.tUpper(lang, 'guest_buyer_label'),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.2),
                        color: AppColors.editorialGold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AppStrings.t(lang, 'members_only'),
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AppStrings.t(lang, 'guest_price_lock_subtitle'),
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.sonicSilver,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const AuthScreen(
                                    initialRole: AppRole.customer,
                                  ),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.obsidian,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  AppColors.radiusSm,
                                ),
                              ),
                            ),
                            child: Text(AppStrings.tUpper(lang, 'login')),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const AuthScreen(
                                    initialRole: AppRole.customer,
                                    initialRegisterMode: true,
                                  ),
                                ),
                              );
                            },
                            style: OutlinedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  AppColors.radiusSm,
                                ),
                              ),
                            ),
                            child: Text(AppStrings.tUpper(lang, 'register')),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),

        // 2. Language (8 Languages) & Currency Selector Card
        EditorialCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${AppStrings.tUpper(lang, 'language')} & ${AppStrings.tUpper(lang, 'currency')}',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                        color: AppColors.editorialGold,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => showLanguageCurrencyModal(context),
                    child: Text(AppStrings.t(lang, 'edit')),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      onTap: () => showLanguageCurrencyModal(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warmIvory,
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusSm,
                          ),
                          border: Border.all(color: AppColors.cultured),
                        ),
                        child: Row(
                          children: [
                            CountryFlagIcon(code: lang, width: 20, height: 14),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                AppStrings.localeLabels[lang] ??
                                    lang.toUpperCase(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      onTap: () => showLanguageCurrencyModal(
                        context,
                        initialFocusCurrency: true,
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warmIvory,
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusSm,
                          ),
                          border: Border.all(color: AppColors.cultured),
                        ),
                        child: Row(
                          children: [
                            CountryFlagIcon(
                              code: session.currencyCode,
                              width: 20,
                              height: 14,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                session.currencyCode,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
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
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 3. Supplier Studio Switch / Become a Supplier Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.obsidian,
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
            border: Border.all(
              color: AppColors.champagneGold.withValues(alpha: 0.55),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const LuxuryIcon(
                    kind: LuxuryIconKind.studioCamera,
                    size: 20,
                    color: AppColors.champagneGold,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      AppStrings.t(lang, 'supplier_panel'),
                      style: const TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
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
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.champagneGold,
                        foregroundColor: AppColors.pureBlack,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusSm,
                          ),
                        ),
                      ),
                      child: Text(
                        session.isSupplierLoggedIn
                            ? AppStrings.t(lang, 'switch_to_supplier')
                            : AppStrings.t(lang, 'supplier_portal_login'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const SupplierApplicationScreen(),
                        ),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: AppColors.champagneGold.withValues(alpha: 0.7),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                    ),
                    child: Text(
                      AppStrings.t(lang, 'supplier_apply'),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 4. Orders, Wishlist, Addresses & Portal Directories
        EditorialCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _MenuRow(
                icon: Icons.receipt_long_outlined,
                title: AppStrings.t(lang, 'orders'),
                onTap: () {
                  if (!session.isCustomerLoggedIn) {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            const AuthScreen(initialRole: AppRole.customer),
                      ),
                    );
                    return;
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const CustomerOrdersScreen(),
                    ),
                  );
                },
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.favorite_border_rounded,
                title:
                    '${AppStrings.t(lang, 'wishlist')} (${session.wishlistIds.length})',
                onTap: _openWishlistSheet,
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.location_on_outlined,
                title: AppStrings.t(lang, 'address_book'),
                onTap: () {
                  if (!session.isCustomerLoggedIn) {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            const AuthScreen(initialRole: AppRole.customer),
                      ),
                    );
                    return;
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const AddressBookScreen(),
                    ),
                  );
                },
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.factory_outlined,
                title: AppStrings.t(lang, 'manufacturers_directory'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const ManufacturersScreen(),
                  ),
                ),
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.request_quote_outlined,
                title: AppStrings.t(lang, 'rfq_board'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const RfqBoardScreen(),
                  ),
                ),
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.local_shipping_outlined,
                title: AppStrings.t(lang, 'service_providers'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const ServiceProvidersScreen(),
                  ),
                ),
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.article_outlined,
                title:
                    '${AppStrings.t(lang, 'blog_title')} & ${AppStrings.t(lang, 'legal_policies')}',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const BlogAndCmsScreen(),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 5. System, App Update, Legal Policies & Account Controls
        EditorialCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              FutureBuilder<InstalledAppInfo>(
                future: const AppUpdateService().getInstalledAppInfo(),
                builder: (context, snapshot) {
                  final ver = snapshot.hasData
                      ? 'v${snapshot.data!.version} (#${snapshot.data!.buildNumber})'
                      : '';
                  return _MenuRow(
                    icon: Icons.system_update_outlined,
                    title: AppStrings.t(lang, 'settings'),
                    subtitle: ver.isNotEmpty ? ver : null,
                    onTap: () => AppUpdateDialog.checkManually(context),
                  );
                },
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.shield_outlined,
                title: AppStrings.t(lang, 'privacy_policy'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'privacy_policy'),
                      policyType: 'privacy',
                    ),
                  ),
                ),
              ),
              const Divider(height: 1),
              _MenuRow(
                icon: Icons.description_outlined,
                title: AppStrings.t(lang, 'terms_of_service'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'terms_of_service'),
                      policyType: 'terms',
                    ),
                  ),
                ),
              ),
              if (session.isCustomerLoggedIn) ...[
                const Divider(height: 1),
                _MenuRow(
                  icon: Icons.delete_outline_rounded,
                  title: AppStrings.t(lang, 'delete_account'),
                  textColor: AppColors.danger,
                  onTap: _confirmPermanentAccountDeletion,
                ),
                const Divider(height: 1),
                _MenuRow(
                  icon: Icons.logout_rounded,
                  title: AppStrings.t(lang, 'logout'),
                  onTap: () => session.logoutCurrentRole(),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color textColor;
  final VoidCallback onTap;

  const _MenuRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.textColor = AppColors.obsidian,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, size: 20, color: textColor),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.sonicSilver,
              ),
            )
          : null,
      trailing: const Icon(
        Icons.chevron_right_rounded,
        size: 19,
        color: AppColors.sonicSilver,
      ),
      onTap: onTap,
    );
  }
}

class _EditProfileSheet extends StatefulWidget {
  final CustomerUser user;

  const _EditProfileSheet({required this.user});

  @override
  State<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<_EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _firstCtrl;
  late final TextEditingController _lastCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _taxCtrl;
  late final TextEditingController _igCtrl;
  late String _prefLang;
  late String _prefCurrency;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final u = widget.user;
    _firstCtrl = TextEditingController(text: u.firstName);
    _lastCtrl = TextEditingController(text: u.lastName);
    _phoneCtrl = TextEditingController(text: u.phone);
    _taxCtrl = TextEditingController(text: u.taxNoTCKN);
    _igCtrl = TextEditingController(text: u.instagramUsername);
    _prefLang = AppStrings.normalizeCode(u.preferredLang);
    _prefCurrency = u.preferredCurrency.isNotEmpty ? u.preferredCurrency : 'TRY';
  }

  @override
  void dispose() {
    _firstCtrl.dispose();
    _lastCtrl.dispose();
    _phoneCtrl.dispose();
    _taxCtrl.dispose();
    _igCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final phoneCheck = PhoneValidator.normalizeAndValidate(
      _phoneCtrl.text,
      lang: lang,
    );
    if (!phoneCheck.isValid) {
      setState(() => _error = phoneCheck.localizedError(lang));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await session.updateCustomerProfile(
        firstName: _firstCtrl.text.trim(),
        lastName: _lastCtrl.text.trim(),
        phone: phoneCheck.normalized,
        preferredLang: _prefLang,
        preferredCurrency: _prefCurrency,
        taxNoTCKN: _taxCtrl.text.trim(),
        instagramUsername: _igCtrl.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'profile_saved'),
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
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppStrings.tUpper(lang, 'edit_profile'),
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
                const Divider(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _firstCtrl,
                        decoration: InputDecoration(
                          labelText: '${AppStrings.t(lang, 'first_name')} *',
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? AppStrings.t(lang, 'err_validation')
                            : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _lastCtrl,
                        decoration: InputDecoration(
                          labelText: '${AppStrings.t(lang, 'last_name')} *',
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? AppStrings.t(lang, 'err_validation')
                            : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t(lang, 'phone')} *',
                  ),
                  validator: (v) {
                    final check = PhoneValidator.normalizeAndValidate(
                      v ?? '',
                      lang: lang,
                    );
                    return check.isValid ? null : check.localizedError(lang);
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _prefLang,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'preferred_language'),
                        ),
                        items: AppStrings.supportedCodes
                            .map(
                              (code) => DropdownMenuItem(
                                value: code,
                                child: Text(
                                  AppStrings.localeLabels[code] ??
                                      code.toUpperCase(),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _prefLang = v ?? _prefLang),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: const [
                          'TRY',
                          'USD',
                          'EUR',
                          'GBP',
                          'RUB',
                        ].contains(_prefCurrency)
                            ? _prefCurrency
                            : 'TRY',
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'preferred_currency'),
                        ),
                        items: const ['TRY', 'USD', 'EUR', 'GBP', 'RUB']
                            .map(
                              (c) => DropdownMenuItem(value: c, child: Text(c)),
                            )
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _prefCurrency = v ?? _prefCurrency),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _taxCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'tax_no_tckn'),
                  ),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _igCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'instagram_handle'),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
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
                        : Text(AppStrings.tUpper(lang, 'save_profile')),
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
