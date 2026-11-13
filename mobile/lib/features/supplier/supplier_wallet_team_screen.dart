import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_config.dart';
import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import 'supplier_billing_payouts_screen.dart';
import 'supplier_editorial_profile_screen.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

class SupplierWalletTeamScreen extends StatefulWidget {
  const SupplierWalletTeamScreen({super.key});

  @override
  State<SupplierWalletTeamScreen> createState() =>
      _SupplierWalletTeamScreenState();
}

class _SupplierWalletTeamScreenState extends State<SupplierWalletTeamScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      final sup = context.read<SupplierProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/wallet',
          pageTitle: SupplierL10n.t(session.languageCode, 'wallet_team_title'),
        ),
      );
      _refreshAll(sup);
    });
  }

  Future<void> _refreshAll(SupplierProvider sup) async {
    await Future.wait([
      sup.loadWalletAndTeam(),
      if (sup.editorialProfile == null)
        sup.loadEditorialProfile().catchError((_) {}),
    ]);
  }

  Future<void> _openWhatsappDialog() async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    if (sup.editorialProfile == null) {
      try {
        await sup.loadEditorialProfile();
      } catch (_) {}
    }
    if (!mounted) return;
    final currentWa = sup.editorialProfile?.whatsappPhone ?? '';
    final waCtrl = TextEditingController(text: currentWa);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.t(lang, 'whatsapp_direct')),
        content: TextField(
          controller: waCtrl,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: AppStrings.t(lang, 'whatsapp_direct'),
            hintText: '+90 5XX XXX XX XX',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              final nextWa = waCtrl.text.trim();
              if (nextWa.isEmpty) return;
              try {
                final existing = sup.editorialProfile ??
                    const SupplierEditorialProfile(
                      id: '',
                      brandName: '',
                      slug: '',
                      aliasCode: '',
                    );
                await sup.saveEditorialProfile(
                  existing.copyWith(whatsappPhone: nextWa),
                  quickWhatsappOnly: true,
                );
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        e.toString().replaceFirst('Exception: ', ''),
                      ),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                }
              }
            },
            child: Text(AppStrings.t(lang, 'save')),
          ),
        ],
      ),
    );
    waCtrl.dispose();

    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppStrings.t(lang, 'profile_saved')),
          backgroundColor: AppColors.emerald,
        ),
      );
    }
  }

  Future<void> _openIbanDialog() async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final ibanCtrl = TextEditingController(text: sup.wallet.iban);
    final bankCtrl = TextEditingController(text: sup.wallet.bankName);
    final holderCtrl = TextEditingController(
      text: sup.wallet.bankAccountHolder,
    );

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(SupplierL10n.t(lang, 'save_iban')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: holderCtrl,
                decoration: InputDecoration(
                  labelText: AppStrings.t(lang, 'bank_account_holder'),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: bankCtrl,
                decoration: InputDecoration(
                  labelText: AppStrings.t(lang, 'bank_name'),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: ibanCtrl,
                decoration: InputDecoration(
                  labelText: AppStrings.t(lang, 'iban'),
                  hintText: 'TR00 0000 ...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await sup.operationsRepo.updateSupplierIban(
                  iban: ibanCtrl.text,
                  bankName: bankCtrl.text,
                  accountHolder: holderCtrl.text,
                );
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        e.toString().replaceFirst('Exception: ', ''),
                      ),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                }
              }
            },
            child: Text(AppStrings.t(lang, 'save')),
          ),
        ],
      ),
    );

    ibanCtrl.dispose();
    bankCtrl.dispose();
    holderCtrl.dispose();

    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(SupplierL10n.t(lang, 'iban_saved_msg')),
          backgroundColor: AppColors.emerald,
        ),
      );
      await sup.loadWalletAndTeam();
    }
  }

  Future<void> _openPayoutDialog() async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final amtCtrl = TextEditingController(
      text: sup.wallet.availableBalance > 0
          ? sup.wallet.availableBalance.toStringAsFixed(2)
          : '',
    );

    final requested = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.t(lang, 'request_payout')),
        content: TextField(
          controller: amtCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText:
                '${SupplierL10n.t(lang, 'payout_amount_label')} (${sup.wallet.currency})',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              final amt =
                  double.tryParse(amtCtrl.text.replaceAll(',', '.').trim()) ??
                      0.0;
              if (amt <= 0) return;
              try {
                await sup.requestPayout(amt);
                if (ctx.mounted) Navigator.of(ctx).pop(true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        e.toString().replaceFirst('Exception: ', ''),
                      ),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                }
              }
            },
            child: Text(AppStrings.t(lang, 'confirm')),
          ),
        ],
      ),
    );
    amtCtrl.dispose();

    if (requested == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(SupplierL10n.t(lang, 'payout_requested_msg')),
          backgroundColor: AppColors.emerald,
        ),
      );
    }
  }

  Future<void> _openAddTeamMemberSheet() async {
    final uiLang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final titleCtrl = TextEditingController();
    final selectedLangs = <String>{'TR', 'EN'};

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return SafeArea(
              child: Padding(
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
                      Text(
                        SupplierL10n.t(uiLang, 'add_team_member'),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: nameCtrl,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(uiLang, 'full_name'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(uiLang, 'email'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: passCtrl,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText:
                              SupplierL10n.t(uiLang, 'temporary_password'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: phoneCtrl,
                              keyboardType: TextInputType.phone,
                              decoration: InputDecoration(
                                labelText: AppStrings.t(uiLang, 'phone'),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: titleCtrl,
                              decoration: InputDecoration(
                                labelText: SupplierL10n.t(uiLang, 'job_title'),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        SupplierL10n.t(uiLang, 'spoken_languages_hint'),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: AppStrings.supportedCodes.map((code) {
                          final upper = code.toUpperCase();
                          final active = selectedLangs.contains(upper);
                          return FilterChip(
                            label: Text(upper),
                            selected: active,
                            selectedColor: AppColors.accentGoldLight,
                            onSelected: (v) {
                              setSheetState(() {
                                if (v) {
                                  selectedLangs.add(upper);
                                } else if (selectedLangs.length > 1) {
                                  selectedLangs.remove(upper);
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
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        AppStrings.t(uiLang, 'err_validation'),
                                      ),
                                      backgroundColor: AppColors.danger,
                                    ),
                                  );
                                  return;
                                }
                                setSheetState(() => saving = true);
                                try {
                                  await sup.operationsRepo
                                      .createSupplierTeamMember(
                                    contactName: nameCtrl.text.trim(),
                                    email: emailCtrl.text.trim(),
                                    password: passCtrl.text,
                                    phone: phoneCtrl.text.trim(),
                                    jobTitle: titleCtrl.text.trim(),
                                    spokenLanguages: selectedLangs.join(', '),
                                  );
                                  if (sheetCtx.mounted) {
                                    Navigator.of(sheetCtx).pop(true);
                                  }
                                } catch (err) {
                                  if (!ctx.mounted) return;
                                  setSheetState(() => saving = false);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          err.toString().replaceFirst(
                                            'Exception: ',
                                            '',
                                          ),
                                        ),
                                        backgroundColor: AppColors.danger,
                                      ),
                                    );
                                  }
                                }
                              },
                        child: Text(
                          saving
                              ? AppStrings.t(uiLang, 'loading')
                              : AppStrings.t(uiLang, 'add'),
                        ),
                      ),
                    ],
                  ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(SupplierL10n.t(uiLang, 'member_added_msg')),
          backgroundColor: AppColors.emerald,
        ),
      );
      await sup.loadWalletAndTeam();
    }
  }

  Future<void> _confirmDeleteSupplierAccount() async {
    final lang = context.read<SessionProvider>().languageCode;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(SupplierL10n.t(lang, 'delete_account_confirm_title')),
        content: Text(SupplierL10n.t(lang, 'delete_account_confirm_desc')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(AppStrings.t(lang, 'delete_account')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<SessionProvider>().deleteCurrentAccountPermanently(
        reason: 'mobile_supplier_request',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final sup = context.watch<SupplierProvider>();
    final lang = session.languageCode;
    final wallet = sup.wallet;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');
    final whatsapp = sup.editorialProfile?.whatsappPhone ?? '';

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: AppColors.pureWhite,
            child: TabBar(
              labelColor: AppColors.luxuryBronze,
              unselectedLabelColor: AppColors.mutedAccessible,
              indicatorColor: AppColors.luxuryBronze,
              tabs: [
                Tab(text: SupplierL10n.t(lang, 'kpi_available_balance')),
                Tab(text: SupplierL10n.t(lang, 'team_section')),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.warmHairline),
          Expanded(
            child: TabBarView(
              children: [
                RefreshIndicator(
                  color: AppColors.luxuryBronze,
                  onRefresh: () => _refreshAll(sup),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    children: [
                      EditorialSurfaceCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              SupplierL10n.t(lang, 'kpi_available_balance'),
                              style: const TextStyle(
                                color: AppColors.mutedAccessible,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              CurrencyFormatter.format(
                                wallet.availableBalance,
                                currency: wallet.currency,
                              ),
                              style: const TextStyle(
                                color: AppColors.obsidian,
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 14,
                              runSpacing: 6,
                              children: [
                                Text(
                                  '${SupplierL10n.t(lang, 'pending_balance')}: ${CurrencyFormatter.format(wallet.pendingBalance, currency: wallet.currency)}',
                                  style: const TextStyle(
                                    color: AppColors.luxuryBronze,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  '${SupplierL10n.t(lang, 'withdrawn_balance')}: ${CurrencyFormatter.format(wallet.withdrawnBalance, currency: wallet.currency)}',
                                  style: const TextStyle(
                                    color: AppColors.charcoal,
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
                                    onPressed: _openPayoutDialog,
                                    icon: const Icon(
                                      Icons.payments_outlined,
                                      size: 17,
                                    ),
                                    label: Text(
                                      AppStrings.t(lang, 'request_payout'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: _openIbanDialog,
                                    icon: const Icon(
                                      Icons.account_balance_outlined,
                                      size: 17,
                                    ),
                                    label: Text(
                                      SupplierL10n.t(lang, 'save_iban'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      EditorialSurfaceCard(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                const SupplierBillingPayoutsScreen(),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(9),
                              decoration: BoxDecoration(
                                color: AppColors.accentGoldLight,
                                borderRadius: BorderRadius.circular(
                                  AppColors.radiusSm,
                                ),
                              ),
                              child: const Icon(
                                Icons.receipt_long_outlined,
                                color: AppColors.luxuryBronze,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    SupplierL10n.t(
                                      lang,
                                      'billing_payouts_title',
                                    ),
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  Text(
                                    '${AppStrings.t(lang, 'tax_info')} · ${AppStrings.t(lang, 'invoices')} · ${AppStrings.t(lang, 'payouts')}',
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.mutedAccessible,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: AppColors.mutedAccessible,
                            ),
                          ],
                        ),
                      ),
                      if (wallet.iban.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        EditorialSurfaceCard(
                          child: Row(
                            children: [
                              const Icon(
                                Icons.verified_user_outlined,
                                color: AppColors.emerald,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${wallet.bankName} — ${wallet.bankAccountHolder}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13.5,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                    Text(
                                      wallet.iban,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.charcoal,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      EditorialSectionHeader(
                        lang: lang,
                        title: SupplierL10n.t(lang, 'ledger_history'),
                      ),
                      const SizedBox(height: 10),
                      if (sup.ledger.isEmpty)
                        EditorialEmptyState(
                          icon: Icons.account_balance_wallet_outlined,
                          message: SupplierL10n.t(lang, 'no_ledger'),
                        )
                      else
                        ...sup.ledger.map(
                          (entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: EditorialSurfaceCard(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          entry.description.isNotEmpty
                                              ? entry.description
                                              : entry.transactionType,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13,
                                            color: AppColors.obsidian,
                                          ),
                                        ),
                                        Text(
                                          dateFmt.format(
                                            entry.createdAt.toLocal(),
                                          ),
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AppColors.mutedAccessible,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    CurrencyFormatter.format(
                                      entry.amount,
                                      currency: entry.currency,
                                    ),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: entry.amount >= 0
                                          ? AppColors.emerald
                                          : AppColors.danger,
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

                // TAB 2: TEAM, PROFILE & ACCOUNT CONTROLS
                ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                  children: [
                    EditorialSurfaceCard(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              const SupplierEditorialProfileScreen(),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: BoxDecoration(
                              color: AppColors.accentGoldLight,
                              borderRadius: BorderRadius.circular(
                                AppColors.radiusSm,
                              ),
                            ),
                            child: const Icon(
                              Icons.store_mall_directory_outlined,
                              color: AppColors.luxuryBronze,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppStrings.t(
                                    lang,
                                    'supplier_profile_editorial',
                                  ),
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                                Text(
                                  '${AppStrings.t(lang, 'export_countries')} · ${AppStrings.t(lang, 'fason_badge')} · ${AppStrings.t(lang, 'private_label_badge')}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.mutedAccessible,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.mutedAccessible,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    EditorialSurfaceCard(
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: BoxDecoration(
                              color: AppColors.emeraldLight,
                              borderRadius: BorderRadius.circular(
                                AppColors.radiusSm,
                              ),
                            ),
                            child: const Icon(
                              Icons.chat_outlined,
                              color: AppColors.emerald,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppStrings.t(lang, 'whatsapp_direct'),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                                Text(
                                  sup.loadingProfile
                                      ? AppStrings.t(lang, 'loading')
                                      : (whatsapp.isNotEmpty ? whatsapp : '—'),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.charcoal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            onPressed: _openWhatsappDialog,
                            child: Text(
                              whatsapp.isNotEmpty
                                  ? AppStrings.t(lang, 'edit')
                                  : AppStrings.t(lang, 'add'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    EditorialSurfaceCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          EditorialSectionHeader(
                            lang: lang,
                            title: SupplierL10n.t(lang, 'team_section'),
                            actionLabel: session.supplierUser?.isOwner != false
                                ? AppStrings.t(lang, 'add')
                                : null,
                            onAction: session.supplierUser?.isOwner != false
                                ? _openAddTeamMemberSheet
                                : null,
                          ),
                          const SizedBox(height: 10),
                          if (sup.teamMembers.isEmpty)
                            Text(
                              AppStrings.t(lang, 'empty'),
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.mutedAccessible,
                              ),
                            )
                          else
                            ...sup.teamMembers.map(
                              (member) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundColor: AppColors.accentGoldLight,
                                  child: Text(
                                    member.contactName.isNotEmpty
                                        ? member.contactName.characters.first
                                            .toUpperCase()
                                        : 'S',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.luxuryBronze,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  '${member.contactName} (${member.spokenLanguages})',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                                subtitle: Text(
                                  '${member.jobTitle} · ${member.email}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.mutedAccessible,
                                  ),
                                ),
                                trailing: (!member.isOwner &&
                                        session.supplierUser?.isOwner != false)
                                    ? IconButton(
                                        onPressed: () async {
                                          final messenger =
                                              ScaffoldMessenger.of(context);
                                          await sup.operationsRepo
                                              .deleteSupplierTeamMember(
                                            member.id,
                                          );
                                          if (!mounted) return;
                                          messenger.showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                SupplierL10n.t(
                                                  lang,
                                                  'member_removed_msg',
                                                ),
                                              ),
                                              backgroundColor:
                                                  AppColors.emerald,
                                            ),
                                          );
                                          await sup.loadWalletAndTeam();
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
                    const SizedBox(height: 14),
                    EditorialSurfaceCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(
                              Icons.storefront_outlined,
                              color: AppColors.luxuryBronze,
                            ),
                            title: Text(
                              AppStrings.t(lang, 'switch_to_customer'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13.5,
                              ),
                            ),
                            trailing: const Icon(Icons.chevron_right_rounded),
                            onTap: () =>
                                session.setActiveRole(AppRole.customer),
                          ),
                          const Divider(height: 1, color: AppColors.warmHairline),
                          ListTile(
                            leading: const Icon(Icons.privacy_tip_outlined),
                            title: Text(AppStrings.t(lang, 'privacy_policy')),
                            onTap: () => launchUrl(
                              Uri.parse(AppConfig.privacyPolicyUrl),
                              mode: LaunchMode.externalApplication,
                            ),
                          ),
                          const Divider(height: 1, color: AppColors.warmHairline),
                          ListTile(
                            leading: const Icon(
                              Icons.delete_forever_outlined,
                              color: AppColors.danger,
                            ),
                            title: Text(
                              AppStrings.t(lang, 'delete_account'),
                              style: const TextStyle(
                                color: AppColors.danger,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            onTap: _confirmDeleteSupplierAccount,
                          ),
                          const Divider(height: 1, color: AppColors.warmHairline),
                          ListTile(
                            leading: const Icon(Icons.logout_rounded),
                            title: Text(
                              AppStrings.t(lang, 'logout'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
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
