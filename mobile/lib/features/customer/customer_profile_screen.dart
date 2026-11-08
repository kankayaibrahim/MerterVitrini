import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_config.dart';
import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../services/app_update_service.dart';
import '../../widgets/app_update_dialog.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import '../auth/auth_screen.dart';
import '../auth/supplier_application_screen.dart';
import 'customer_orders_screen.dart';
import 'product_detail_screen.dart';

class CustomerProfileScreen extends StatefulWidget {
  const CustomerProfileScreen({super.key});

  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen> {
  Future<void> _openExternalUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openWishlistSheet() async {
    final session = context.read<SessionProvider>();
    await session.refreshWishlist();
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) {
        final s = ctx.watch<SessionProvider>();
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'FAVORİ MODELLERİM (${items.length})',
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.6,
                          color: AppColors.obsidian,
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
                        ? const Center(
                            child: Text(
                              'Henüz favorilerinize model eklemediniz.',
                              style: TextStyle(color: AppColors.sonicSilver),
                            ),
                          )
                        : GridView.builder(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.only(top: 8),
                            itemCount: items.length,
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  mainAxisSpacing: 14,
                                  crossAxisSpacing: 12,
                                  childAspectRatio: 0.49,
                                ),
                            itemBuilder: (context, idx) {
                              final p = items[idx];
                              return B2BProductCard(
                                product: p,
                                onTap: () {
                                  Navigator.of(ctx).pop();
                                  Navigator.of(this.context).push(
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

  Future<void> _openAddressBookSheet() async {
    final session = context.read<SessionProvider>();
    if (!session.isCustomerLoggedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const AuthScreen(initialRole: AppRole.customer),
        ),
      );
      return;
    }

    List<CustomerAddress> addresses = <CustomerAddress>[];
    try {
      addresses = await session.api.listCustomerAddresses();
    } catch (_) {}
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(),
      builder: (sheetCtx) {
        final titleCtrl = TextEditingController(text: 'Merkez Mağaza');
        final recCtrl = TextEditingController(
          text: session.customerUser?.fullName ?? '',
        );
        final phoneCtrl = TextEditingController(
          text: session.customerUser?.phone ?? '',
        );
        final lineCtrl = TextEditingController();
        final cityCtrl = TextEditingController();
        final countryCtrl = TextEditingController(text: 'Türkiye');
        var addingNew = addresses.isEmpty;
        var saving = false;

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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'TESLİMAT ADRESLERİM',
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.5,
                            color: AppColors.obsidian,
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () =>
                              setSheetState(() => addingNew = !addingNew),
                          icon: Icon(
                            addingNew ? Icons.list_rounded : Icons.add_rounded,
                            size: 16,
                            color: AppColors.editorialGold,
                          ),
                          label: Text(
                            addingNew ? 'LİSTEYE DÖN' : 'YENİ EKLE',
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.9,
                              color: AppColors.editorialGold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(),
                    const SizedBox(height: 10),
                    if (!addingNew) ...[
                      if (addresses.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 28),
                          child: Center(
                            child: Text('Kayıtlı adres bulunamadı.'),
                          ),
                        )
                      else
                        ...addresses.map(
                          (a) => Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: AppColors.editorialOffWhite,
                              border: Border.all(color: AppColors.cultured),
                            ),
                            child: ListTile(
                              leading: const LuxuryIcon(
                                kind: LuxuryIconKind.location,
                                size: 18,
                                color: AppColors.obsidian,
                                accentColor: AppColors.champagneGold,
                              ),
                              title: Text(
                                '${a.title} — ${a.recipientName}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13.5,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              subtitle: Text(
                                '${a.addressLine}, ${a.city} / ${a.country}\n${a.phone}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ] else ...[
                      TextField(
                        controller: titleCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Adres Başlığı (Örn: Depo / Mağaza)',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: recCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Alıcı Ad Soyad / Firma *',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Telefon *',
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: cityCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Şehir *',
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: countryCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Ülke *',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: lineCtrl,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Açık Adres *',
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        height: 46,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.obsidian,
                          ),
                          onPressed: saving
                              ? null
                              : () async {
                                  if (recCtrl.text.trim().isEmpty ||
                                      lineCtrl.text.trim().isEmpty ||
                                      cityCtrl.text.trim().isEmpty) {
                                    return;
                                  }
                                  setSheetState(() => saving = true);
                                  try {
                                    await session.api.createCustomerAddress(
                                      title: titleCtrl.text.trim(),
                                      recipientName: recCtrl.text.trim(),
                                      phone: phoneCtrl.text.trim(),
                                      addressLine: lineCtrl.text.trim(),
                                      city: cityCtrl.text.trim(),
                                      state: cityCtrl.text.trim(),
                                      country: countryCtrl.text.trim(),
                                    );
                                    final refreshed = await session.api
                                        .listCustomerAddresses();
                                    setSheetState(() {
                                      addresses = refreshed;
                                      addingNew = false;
                                      saving = false;
                                    });
                                  } catch (_) {
                                    setSheetState(() => saving = false);
                                  }
                                },
                          child: Text(
                            saving ? 'KAYDEDİLİYOR...' : 'ADRESİ KAYDET',
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _confirmPermanentAccountDeletion() async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hesabı Kalıcı Olarak Sil'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bu işlem geri alınamaz. Profil verileriniz, kayıtlı cihazlarınız ve kişisel bilgileriniz kalıcı olarak silinecek/anonimleştirilecektir.',
              style: TextStyle(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Silme nedeni (İsteğe bağlı)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Kalıcı Olarak Sil'),
          ),
        ],
      ),
    );

    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();

    if (confirmed != true || !mounted) return;

    try {
      await context.read<SessionProvider>().deleteCurrentAccountPermanently(
        reason: reason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hesabınız ve kişisel verileriniz kalıcı olarak silindi.',
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final user = session.customerUser;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 1. Executive Customer Identity Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.cultured),
          ),
          child: session.isCustomerLoggedIn && user != null
              ? Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.obsidian,
                        border: Border.all(
                          color: AppColors.champagneGold.withValues(
                            alpha: 0.65,
                          ),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        user.fullName.characters.first.toUpperCase(),
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
                          const Text(
                            'B2B ALICI HESABI',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.5,
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            user.fullName,
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.obsidian,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user.email,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.sonicSilver,
                            ),
                          ),
                          if (user.phone.isNotEmpty)
                            Text(
                              user.phone,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.spanishGray,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Row(
                      children: [
                        MvEditorialCrest(size: 36),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'B2B ALICI KULÜBÜ',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.6,
                                  color: AppColors.editorialGold,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Müşteri Hesabınıza Giriş Yapın',
                                style: TextStyle(
                                  fontFamily: AppColors.serifFontFamily,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.obsidian,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Toptan sepetinizi tüm cihazlarda senkronize etmek, sipariş takibi yapmak ve tedarikçi özel seri tekliflerini yönetmek için oturum açın.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.sonicSilver,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                        ),
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const AuthScreen(
                                initialRole: AppRole.customer,
                              ),
                            ),
                          );
                        },
                        child: Text(
                          AppStrings.t(lang, 'login').toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 14),

        // 2. Luxury Obsidian Dual-Role Supplier Studio Banner
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.obsidian,
            border: Border.all(
              color: AppColors.champagneGold.withValues(alpha: 0.55),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      border: Border.all(
                        color: AppColors.champagneGold.withValues(alpha: 0.55),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const LuxuryIcon(
                      kind: LuxuryIconKind.studioCamera,
                      size: 18,
                      color: Colors.white,
                      accentColor: AppColors.champagneGold,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ÜRETİCİ & TEDARİKÇİ PORTALI',
                          style: TextStyle(
                            fontSize: 8.8,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.6,
                            color: AppColors.champagneGold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          session.isSupplierLoggedIn
                              ? 'Stüdyo Hazır: ${session.supplierUser!.displayBrand}'
                              : 'Merter Üretici & Tedarikçi Stüdyosu',
                          style: const TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Tedarikçi hesabınızla kameradan doğrudan ürün çekip vitrine yükleyin, müşteri mesajlarına özel seri fiyat teklifi gönderin ve hakedişlerinizi yönetin.',
                style: TextStyle(
                  color: Color(0xFFD4D4D4),
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 8,
                children: [
                  InkWell(
                    onTap: () {
                      if (session.isSupplierLoggedIn) {
                        session.setActiveRole(AppRole.supplier);
                      } else {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                const AuthScreen(initialRole: AppRole.supplier),
                          ),
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 11,
                      ),
                      color: AppColors.champagneGold,
                      child: Text(
                        (session.isSupplierLoggedIn
                                ? 'TEDARİKÇİ MODUNA GEÇ'
                                : 'TEDARİKÇİ GİRİŞİ YAP')
                            .toUpperCase(),
                        style: const TextStyle(
                          color: AppColors.obsidian,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ),
                  ),
                  if (!session.isSupplierLoggedIn)
                    InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const SupplierApplicationScreen(),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.32),
                          ),
                        ),
                        child: Text(
                          AppStrings.t(lang, 'supplier_apply').toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 3. Preferences: Currency & Language (Architectural Flag Tiles)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.cultured),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'BÖLGE, DİL & DÖVİZ TERCİHLERİ',
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontWeight: FontWeight.w800,
                  fontSize: 12.5,
                  letterSpacing: 1.4,
                  color: AppColors.obsidian,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'GÖSTERİM PARA BİRİMİ (TCMB CANLI KUR)',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.0,
                  color: AppColors.sonicSilver,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: ['TRY', 'USD', 'EUR', 'GBP', 'RUB'].map((code) {
                  return _PreferenceFlagTile(
                    flagCode: code,
                    label: code,
                    selected: session.currencyCode == code,
                    onTap: () => session.setCurrency(code),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              const Text(
                'UYGULAMA DİLİ',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.0,
                  color: AppColors.sonicSilver,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    const [
                      ('tr', 'TÜRKÇE'),
                      ('en', 'ENGLISH'),
                      ('ar', 'العربية'),
                      ('ru', 'РУССКИЙ'),
                    ].map((pair) {
                      return _PreferenceFlagTile(
                        flagCode: pair.$1,
                        label: pair.$2,
                        selected: session.languageCode == pair.$1,
                        onTap: () => session.setLanguage(pair.$1),
                      );
                    }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 4. Quick B2B Operations Card
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.cultured),
          ),
          child: Column(
            children: [
              _ProfileMenuRow(
                icon: LuxuryIconKind.orders,
                title: 'Toptan Siparişlerim & Ödeme Bildirimi',
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
              _ProfileMenuRow(
                icon: LuxuryIconKind.heart,
                title: 'Favori Modellerim (${session.wishlistIds.length})',
                onTap: _openWishlistSheet,
              ),
              const Divider(height: 1),
              _ProfileMenuRow(
                icon: LuxuryIconKind.location,
                title: 'Kayıtlı Teslimat Adreslerim',
                onTap: _openAddressBookSheet,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 5. System, OTA Self-Update & Legal Card
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.cultured),
          ),
          child: Column(
            children: [
              FutureBuilder<InstalledAppInfo>(
                future: const AppUpdateService().getInstalledAppInfo(),
                builder: (context, snapshot) {
                  final verText = snapshot.hasData
                      ? 'Aktif Sürüm: v${snapshot.data!.version} (Yapı #${snapshot.data!.buildNumber})'
                      : 'Yeni sürüm var mı kontrol et ve indir';
                  return _ProfileMenuRow(
                    icon: LuxuryIconKind.update,
                    title: 'Uygulama Güncellemelerini Kontrol Et',
                    subtitle: verText,
                    trailingIcon: Icons.sync_rounded,
                    onTap: () => AppUpdateDialog.checkManually(context),
                  );
                },
              ),
              const Divider(height: 1),
              _ProfileMenuRow(
                icon: LuxuryIconKind.shield,
                title: 'Gizlilik Politikası ve KVKK',
                trailingIcon: Icons.arrow_outward_rounded,
                onTap: () => _openExternalUrl(AppConfig.privacyPolicyUrl),
              ),
              const Divider(height: 1),
              _ProfileMenuRow(
                icon: LuxuryIconKind.document,
                title: 'Kullanım Koşulları & B2B Sözleşmesi',
                trailingIcon: Icons.arrow_outward_rounded,
                onTap: () => _openExternalUrl(AppConfig.termsUrl),
              ),
              if (session.isCustomerLoggedIn) ...[
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 2,
                  ),
                  leading: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.dangerLight.withValues(alpha: 0.45),
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.25),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.delete_outline_rounded,
                      size: 17,
                      color: AppColors.danger,
                    ),
                  ),
                  title: Text(
                    AppStrings.t(lang, 'delete_account'),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                  onTap: _confirmPermanentAccountDeletion,
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 2,
                  ),
                  leading: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.editorialOffWhite,
                      border: Border.all(color: AppColors.cultured),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.logout_rounded,
                      size: 17,
                      color: AppColors.obsidian,
                    ),
                  ),
                  title: Text(
                    AppStrings.t(lang, 'logout'),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.obsidian,
                    ),
                  ),
                  onTap: () => session.logoutCurrentRole(),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _PreferenceFlagTile extends StatelessWidget {
  final String flagCode;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PreferenceFlagTile({
    required this.flagCode,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.obsidian : AppColors.editorialOffWhite,
          border: Border.all(
            color: selected ? AppColors.obsidian : AppColors.cultured,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CountryFlagIcon(code: flagCode, width: 17, height: 12),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.7,
                color: selected ? Colors.white : AppColors.obsidian,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileMenuRow extends StatelessWidget {
  final LuxuryIconKind icon;
  final String title;
  final String? subtitle;
  final IconData trailingIcon;
  final VoidCallback onTap;

  const _ProfileMenuRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailingIcon = Icons.chevron_right_rounded,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
      leading: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: AppColors.editorialOffWhite,
          border: Border.all(color: AppColors.cultured),
        ),
        alignment: Alignment.center,
        child: LuxuryIcon(
          kind: icon,
          size: 16.5,
          color: AppColors.obsidian,
          accentColor: AppColors.champagneGold,
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 13.2,
          fontWeight: FontWeight.w700,
          color: AppColors.obsidian,
        ),
      ),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 11.2,
                color: AppColors.sonicSilver,
              ),
            ),
      trailing: Icon(trailingIcon, size: 17, color: AppColors.sonicSilver),
    );
  }
}
