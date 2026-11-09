import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_config.dart';
import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';

class SupplierWalletTeamScreen extends StatefulWidget {
  const SupplierWalletTeamScreen({super.key});

  @override
  State<SupplierWalletTeamScreen> createState() =>
      _SupplierWalletTeamScreenState();
}

class _SupplierWalletTeamScreenState extends State<SupplierWalletTeamScreen> {
  String _supplierWhatsapp = '';
  bool _loadingProfile = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SupplierProvider>().loadWalletAndTeam();
      _loadSupplierWhatsappProfile();
    });
  }

  Future<void> _loadSupplierWhatsappProfile() async {
    if (!mounted) return;
    setState(() => _loadingProfile = true);
    try {
      final resp = await context
          .read<SessionProvider>()
          .apiClient
          .dio
          .get<dynamic>('/api/v1/supplier/profile');
      final data = resp.data;
      if (data is Map<String, dynamic> && mounted) {
        setState(() {
          _supplierWhatsapp =
              (data['whatsapp_phone'] ?? data['phone'] ?? '').toString();
        });
      }
    } catch (_) {
      // Ignore quietly if offline
    } finally {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  Future<void> _openWhatsappDialog() async {
    final dio = context.read<SessionProvider>().apiClient.dio;
    final waCtrl = TextEditingController(text: _supplierWhatsapp);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Doğrudan Müşteri WhatsApp Hattım'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Vitrindeki tüm ürünlerinizde alıcıların tek tıkla size doğrudan ulaşacağı WhatsApp sipariş numaranızı girin.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: waCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'WhatsApp Numaranız *',
                  hintText: '+90 5XX XXX XX XX',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (waCtrl.text.trim().isEmpty) return;
              try {
                await dio.put<dynamic>(
                  '/api/v1/supplier/profile',
                  data: <String, dynamic>{
                    'whatsapp_phone': waCtrl.text.trim(),
                    'quick_whatsapp_only': true,
                  },
                );
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString())),
                  );
                }
              }
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );

    final updatedVal = waCtrl.text.trim();
    waCtrl.dispose();

    if (saved == true && mounted) {
      setState(() => _supplierWhatsapp = updatedVal);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'WhatsApp hattınız güncellendi! Müşteriler artık doğrudan size ulaşabilir.',
          ),
        ),
      );
    }
  }

  Future<void> _openIbanDialog() async {
    final sup = context.read<SupplierProvider>();
    final api = context.read<SessionProvider>().api;
    final ibanCtrl = TextEditingController(text: sup.wallet.iban);
    final bankCtrl = TextEditingController(text: sup.wallet.bankName);
    final holderCtrl =
        TextEditingController(text: sup.wallet.bankAccountHolder);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hakediş IBAN Bilgileri'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: holderCtrl,
                decoration: const InputDecoration(
                  labelText: 'Hesap Sahibi / Firma Unvanı *',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: bankCtrl,
                decoration: const InputDecoration(labelText: 'Banka Adı *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: ibanCtrl,
                decoration: const InputDecoration(
                  labelText: 'TR IBAN *',
                  hintText: 'TR00 0000 ...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await api.updateSupplierIban(
                  iban: ibanCtrl.text,
                  bankName: bankCtrl.text,
                  accountHolder: holderCtrl.text,
                );
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString())),
                  );
                }
              }
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );

    ibanCtrl.dispose();
    bankCtrl.dispose();
    holderCtrl.dispose();

    if (saved == true && mounted) {
      await context.read<SupplierProvider>().loadWalletAndTeam();
    }
  }

  Future<void> _openPayoutDialog() async {
    final sup = context.read<SupplierProvider>();
    final api = context.read<SessionProvider>().api;
    final amtCtrl = TextEditingController(
      text: sup.wallet.availableBalance > 0
          ? sup.wallet.availableBalance.toStringAsFixed(2)
          : '',
    );

    final requested = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ödeme / Hakediş Çekim Talebi'),
        content: TextField(
          controller: amtCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: 'Çekilecek Tutar (${sup.wallet.currency})',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () async {
              final amt =
                  double.tryParse(amtCtrl.text.replaceAll(',', '.').trim()) ??
                      0.0;
              if (amt <= 0) return;
              try {
                await api.requestSupplierPayout(amt);
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString())),
                  );
                }
              }
            },
            child: const Text('Talep Oluştur'),
          ),
        ],
      ),
    );
    amtCtrl.dispose();

    if (requested == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ödeme çekim talebiniz finans onayına iletildi.'),
          backgroundColor: AppColors.emerald,
        ),
      );
      await context.read<SupplierProvider>().loadWalletAndTeam();
    }
  }

  Future<void> _openAddTeamMemberSheet() async {
    final api = context.read<SessionProvider>().api;
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final titleCtrl = TextEditingController(text: 'İhracat Satış Temsilcisi');
    final selectedLangs = <String>{'TR', 'EN'};

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Yeni Satış Temsilcisi / Alt Kullanıcı Ekle',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Ad Soyad *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Giriş E-Posta Adresi *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: passCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Geçici Giriş Şifresi (En az 6 karakter) *',
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: phoneCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Telefon',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: titleCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Unvan',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Konuştuğu Diller (Müşteri sohbetinde görünür):',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      children: ['TR', 'EN', 'RU', 'AR'].map((lang) {
                        final active = selectedLangs.contains(lang);
                        return FilterChip(
                          label: Text(lang),
                          selected: active,
                          onSelected: (v) {
                            setSheetState(() {
                              if (v) {
                                selectedLangs.add(lang);
                              } else if (selectedLangs.length > 1) {
                                selectedLangs.remove(lang);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: saving
                          ? null
                          : () async {
                              if (nameCtrl.text.trim().isEmpty ||
                                  emailCtrl.text.trim().isEmpty ||
                                  passCtrl.text.length < 6) {
                                return;
                              }
                              setSheetState(() => saving = true);
                              try {
                                await api.createSupplierTeamMember(
                                  contactName: nameCtrl.text,
                                  email: emailCtrl.text,
                                  password: passCtrl.text,
                                  phone: phoneCtrl.text,
                                  jobTitle: titleCtrl.text,
                                  spokenLanguages: selectedLangs.join(', '),
                                );
                                if (sheetCtx.mounted) {
                                  Navigator.of(sheetCtx).pop(true);
                                }
                              } catch (err) {
                                setSheetState(() => saving = false);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(err.toString())),
                                  );
                                }
                              }
                            },
                      child: Text(
                        saving ? 'Ekleniyor...' : 'Temsilciyi Oluştur',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    nameCtrl.dispose();
    emailCtrl.dispose();
    passCtrl.dispose();
    phoneCtrl.dispose();
    titleCtrl.dispose();

    if (created == true && mounted) {
      await context.read<SupplierProvider>().loadWalletAndTeam();
    }
  }

  Future<void> _confirmDeleteSupplierAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tedarikçi Hesabını Pasifleştir & Sil'),
        content: const Text(
          'Tedarikçi kullanıcı erişiminiz kapatılacak ve kişisel bilgileriniz anonimleştirilecektir. Devam etmek istiyor musunuz?',
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
    if (confirmed != true || !mounted) return;
    try {
      await context
          .read<SessionProvider>()
          .deleteCurrentAccountPermanently(reason: 'Mobil tedarikçi talebi');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final sup = context.watch<SupplierProvider>();
    final wallet = sup.wallet;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: AppColors.surface,
            child: const TabBar(
              labelColor: AppColors.navy,
              indicatorColor: AppColors.accentGold,
              tabs: [
                Tab(text: 'Hakediş & Cüzdan'),
                Tab(text: 'Satış Ekibi & Hesap'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                // TAB 1: WALLET & LEDGER
                RefreshIndicator(
                  onRefresh: sup.loadWalletAndTeam,
                  child: ListView(
                    padding: const EdgeInsets.all(14),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: AppColors.navy,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Çekilebilir Net Hakediş Bakiyesi',
                              style: TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 12.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              CurrencyFormatter.format(
                                wallet.availableBalance,
                                currency: wallet.currency,
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Provizyonda: ${CurrencyFormatter.format(wallet.pendingBalance, currency: wallet.currency)}',
                                  style: const TextStyle(
                                    color: AppColors.accentGoldLight,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  'Çekilen: ${CurrencyFormatter.format(wallet.withdrawnBalance, currency: wallet.currency)}',
                                  style: const TextStyle(
                                    color: Color(0xFFCBD5E1),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.accentGold,
                                      foregroundColor: Colors.white,
                                    ),
                                    onPressed: _openPayoutDialog,
                                    icon: const Icon(
                                      Icons.payments_outlined,
                                      size: 18,
                                    ),
                                    label: const Text('Ödeme Talebi'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: const BorderSide(
                                        color: Colors.white38,
                                      ),
                                    ),
                                    onPressed: _openIbanDialog,
                                    icon: const Icon(
                                      Icons.account_balance_outlined,
                                      size: 18,
                                    ),
                                    label: const Text('IBAN Güncelle'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (wallet.iban.isNotEmpty)
                        Card(
                          child: ListTile(
                            leading: const Icon(
                              Icons.verified_user_outlined,
                              color: AppColors.emerald,
                            ),
                            title: Text(
                              '${wallet.bankName} — ${wallet.bankAccountHolder}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13.5,
                              ),
                            ),
                            subtitle: Text(
                              wallet.iban,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                      const SizedBox(height: 14),
                      const Text(
                        'Hesap Hareketleri (Ledger)',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (sup.ledger.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Center(
                              child: Text('Henüz cüzdan hareketi bulunmuyor.'),
                            ),
                          ),
                        )
                      else
                        ...sup.ledger.map(
                          (entry) => Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              title: Text(
                                entry.description.isNotEmpty
                                    ? entry.description
                                    : entry.transactionType,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              subtitle: Text(
                                dateFmt.format(entry.createdAt.toLocal()),
                                style: const TextStyle(fontSize: 11.5),
                              ),
                              trailing: Text(
                                CurrencyFormatter.format(
                                  entry.amount,
                                  currency: entry.currency,
                                ),
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: entry.amount >= 0
                                      ? AppColors.emerald
                                      : AppColors.danger,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                // TAB 2: SALES REPS TEAM & ACCOUNT
                ListView(
                  padding: const EdgeInsets.all(14),
                  children: [
                    Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: AppColors.emerald,
                          child: Icon(
                            Icons.chat_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                        title: const Text(
                          'Doğrudan Müşteri & Sipariş WhatsApp Hattım',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                        subtitle: Text(
                          _loadingProfile
                              ? 'Yükleniyor...'
                              : (_supplierWhatsapp.isNotEmpty
                                  ? 'Aktif Hat: $_supplierWhatsapp (Müşteriler doğrudan size yazabilir)'
                                  : 'Henüz WhatsApp numaranızı eklemediniz. Hemen ekleyin!'),
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.emerald,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                          onPressed: _openWhatsappDialog,
                          child: Text(
                            _supplierWhatsapp.isNotEmpty ? 'Düzenle' : 'Ekle',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
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
                                  'Müşteri Temsilcileri & Satış Ekibi',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14.5,
                                  ),
                                ),
                                if (session.supplierUser?.isOwner != false)
                                  TextButton.icon(
                                    onPressed: _openAddTeamMemberSheet,
                                    icon: const Icon(
                                      Icons.person_add_alt_1_rounded,
                                      size: 18,
                                    ),
                                    label: const Text('Ekle'),
                                  ),
                              ],
                            ),
                            const Text(
                              'Müşteriler ürün sayfasından sohbet başlatırken konuştuğu dile göre temsilcilerinizi doğrudan seçebilir.',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ...sup.teamMembers.map(
                              (member) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundColor: AppColors.accentGoldLight,
                                  child: Text(
                                    member.contactName.isNotEmpty
                                        ? member.contactName.characters.first
                                            .toUpperCase()
                                        : 'T',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.navy,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  '${member.contactName} (${member.spokenLanguages})',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                  ),
                                ),
                                subtitle: Text(
                                  '${member.jobTitle} • ${member.email}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: (!member.isOwner &&
                                        session.supplierUser?.isOwner != false)
                                    ? IconButton(
                                        onPressed: () async {
                                          await session.api
                                              .deleteSupplierTeamMember(
                                            member.id,
                                          );
                                          if (mounted) {
                                            await sup.loadWalletAndTeam();
                                          }
                                        },
                                        icon: const Icon(
                                          Icons.delete_outline_rounded,
                                          color: AppColors.danger,
                                        ),
                                      )
                                    : null,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(
                              Icons.storefront_rounded,
                              color: AppColors.primary,
                            ),
                            title: const Text(
                              'Müşteri Mağaza Moduna Geç',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            trailing: const Icon(Icons.chevron_right_rounded),
                            onTap: () =>
                                session.setActiveRole(AppRole.customer),
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.privacy_tip_outlined),
                            title: const Text('Gizlilik Politikası ve KVKK'),
                            onTap: () => launchUrl(
                              Uri.parse(AppConfig.privacyPolicyUrl),
                              mode: LaunchMode.externalApplication,
                            ),
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(
                              Icons.delete_forever_outlined,
                              color: AppColors.danger,
                            ),
                            title: const Text(
                              'Tedarikçi Hesabımı Kalıcı Olarak Sil',
                              style: TextStyle(
                                color: AppColors.danger,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            onTap: _confirmDeleteSupplierAccount,
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.logout_rounded),
                            title: const Text(
                              'Tedarikçi Oturumunu Kapat',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            onTap: () => session.logoutCurrentRole(),
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
  }
}

