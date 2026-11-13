import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/marketplace.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

/// 2-tab Billing, Tax Info, Wire Transfers & Payout History screen.
class SupplierBillingPayoutsScreen extends StatefulWidget {
  final int initialTabIndex;

  const SupplierBillingPayoutsScreen({super.key, this.initialTabIndex = 0});

  @override
  State<SupplierBillingPayoutsScreen> createState() =>
      _SupplierBillingPayoutsScreenState();
}

class _SupplierBillingPayoutsScreenState
    extends State<SupplierBillingPayoutsScreen> {
  String? _billingError;
  String? _payoutError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/billing',
          pageTitle: SupplierL10n.t(
            session.languageCode,
            'billing_payouts_title',
          ),
        ),
      );
      _refreshAll();
    });
  }

  Future<void> _refreshAll() async {
    await Future.wait([_loadBilling(), _loadPayouts()]);
  }

  Future<void> _loadBilling() async {
    setState(() => _billingError = null);
    try {
      await context.read<SupplierProvider>().loadBilling();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _billingError = e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _loadPayouts() async {
    setState(() => _payoutError = null);
    try {
      await context.read<SupplierProvider>().loadWalletAndTeam();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _payoutError = e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _openTaxInfoSheet(SupplierSubscriptionItem? sub) async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final companyCtrl = TextEditingController(
      text: sub?.billingCompanyTitle ?? '',
    );
    final taxOfficeCtrl = TextEditingController(text: sub?.taxOffice ?? '');
    final taxNumberCtrl = TextEditingController(text: sub?.taxNumber ?? '');
    final addressCtrl = TextEditingController(text: sub?.billingAddress ?? '');
    final emailCtrl = TextEditingController(text: sub?.billingEmail ?? '');
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              18,
              18,
              18,
              20 + MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  AppStrings.t(lang, 'tax_info'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: companyCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'billing_company_title'),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: taxOfficeCtrl,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'tax_office'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: taxNumberCtrl,
                        decoration: InputDecoration(
                          labelText: AppStrings.t(lang, 'tax_no_tckn'),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'billing_email'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: addressCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'billing_address'),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: saving
                        ? null
                        : () async {
                            if (companyCtrl.text.trim().isEmpty ||
                                taxNumberCtrl.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    AppStrings.t(lang, 'err_validation'),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }
                            setModalState(() => saving = true);
                            try {
                              await sup.updateTaxInfo(
                                SupplierTaxInfoPayload(
                                  billingCompanyTitle: companyCtrl.text.trim(),
                                  taxOffice: taxOfficeCtrl.text.trim(),
                                  taxNumber: taxNumberCtrl.text.trim(),
                                  billingAddress: addressCtrl.text.trim(),
                                  billingEmail: emailCtrl.text.trim(),
                                ),
                              );
                              if (!mounted || !ctx.mounted) return;
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    SupplierL10n.t(lang, 'tax_info_saved'),
                                  ),
                                  backgroundColor: AppColors.emerald,
                                ),
                              );
                            } catch (e) {
                              if (!ctx.mounted) return;
                              setModalState(() => saving = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    e.toString().replaceFirst('Exception: ', ''),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: Text(AppStrings.t(lang, 'save')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    companyCtrl.dispose();
    taxOfficeCtrl.dispose();
    taxNumberCtrl.dispose();
    addressCtrl.dispose();
    emailCtrl.dispose();
  }

  Future<void> _openWirePaymentSheet(
    SupplierBillingOverview overview, {
    String? preselectedPlanCode,
  }) async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final planCodes = overview.plans.map((p) => p.code).toList();
    final defaultPlan = preselectedPlanCode ??
        overview.subscription?.planCode ??
        (planCodes.isNotEmpty ? planCodes.first : 'PRO');
    if (!planCodes.contains(defaultPlan)) planCodes.insert(0, defaultPlan);

    var selectedPlan = defaultPlan;
    final matchingPlan = overview.plans
        .where((p) => p.code == selectedPlan)
        .cast<SubscriptionPlanItem?>()
        .firstOrNull;
    final initialAmount = (overview.subscription?.outstandingBalance ?? 0) > 0
        ? overview.subscription!.outstandingBalance
        : (matchingPlan?.monthlyPrice ?? 0);

    var periodMonths = 1;
    final amountCtrl = TextEditingController(
      text: initialAmount > 0 ? initialAmount.toStringAsFixed(2) : '',
    );
    final senderCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              18,
              18,
              18,
              20 + MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  AppStrings.t(lang, 'submit_wire_payment'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<String>(
                        initialValue: selectedPlan,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(lang, 'plan_code_label'),
                        ),
                        items: planCodes
                            .map(
                              (code) => DropdownMenuItem(
                                value: code,
                                child: Text(code),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) selectedPlan = v;
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: periodMonths,
                        decoration: InputDecoration(
                          labelText:
                              SupplierL10n.t(lang, 'period_months_label'),
                        ),
                        items: const [1, 3, 6, 12]
                            .map(
                              (m) => DropdownMenuItem(
                                value: m,
                                child: Text('$m'),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) periodMonths = v;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'payment_amount'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: senderCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'sender_name'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: refCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'bank_reference'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: notesCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(lang, 'payment_notes_label'),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: submitting
                        ? null
                        : () async {
                            final amt = double.tryParse(
                              amountCtrl.text.trim().replaceAll(',', '.'),
                            );
                            if (amt == null ||
                                amt <= 0 ||
                                senderCtrl.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    AppStrings.t(lang, 'err_validation'),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }
                            setModalState(() => submitting = true);
                            try {
                              await sup.submitSubscriptionPayment(
                                SupplierWirePaymentPayload(
                                  planCode: selectedPlan,
                                  periodMonths: periodMonths,
                                  amount: amt,
                                  senderName: senderCtrl.text.trim(),
                                  bankReference: refCtrl.text.trim(),
                                  notes: notesCtrl.text.trim(),
                                ),
                              );
                              if (!mounted || !ctx.mounted) return;
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    SupplierL10n.t(lang, 'wire_payment_saved'),
                                  ),
                                  backgroundColor: AppColors.emerald,
                                ),
                              );
                            } catch (e) {
                              if (!ctx.mounted) return;
                              setModalState(() => submitting = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    e.toString().replaceFirst('Exception: ', ''),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: Text(AppStrings.t(lang, 'submit_wire_payment')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    amountCtrl.dispose();
    senderCtrl.dispose();
    refCtrl.dispose();
    notesCtrl.dispose();
  }

  Future<void> _openPayoutRequestDialog(double availableBalance, String currency) async {
    final lang = context.read<SessionProvider>().languageCode;
    final sup = context.read<SupplierProvider>();
    final ctrl = TextEditingController(
      text: availableBalance > 0 ? availableBalance.toStringAsFixed(2) : '',
    );
    var submitting = false;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(AppStrings.t(lang, 'request_payout')),
          content: TextField(
            controller: ctrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: '${SupplierL10n.t(lang, 'payout_amount_label')} ($currency)',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(AppStrings.t(lang, 'cancel')),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      final amount = double.tryParse(
                        ctrl.text.trim().replaceAll(',', '.'),
                      );
                      if (amount == null || amount <= 0) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(AppStrings.t(lang, 'err_validation')),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                        return;
                      }
                      setDialogState(() => submitting = true);
                      try {
                        await sup.requestPayout(amount);
                        if (!mounted || !ctx.mounted) return;
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              SupplierL10n.t(lang, 'payout_requested_msg'),
                            ),
                            backgroundColor: AppColors.emerald,
                          ),
                        );
                      } catch (e) {
                        if (!ctx.mounted) return;
                        setDialogState(() => submitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              e.toString().replaceFirst('Exception: ', ''),
                            ),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                      }
                    },
              child: Text(AppStrings.t(lang, 'confirm')),
            ),
          ],
        ),
      ),
    );
    ctrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final sup = context.watch<SupplierProvider>();

    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTabIndex.clamp(0, 1),
      child: Scaffold(
        backgroundColor: AppColors.warmIvory,
        appBar: buildSupplierSubPageAppBar(
          context: context,
          title: SupplierL10n.t(lang, 'billing_payouts_title'),
          actions: [
            IconButton(
              tooltip: AppStrings.t(lang, 'retry'),
              onPressed: _refreshAll,
              icon: const Icon(Icons.refresh_rounded, size: 21),
            ),
          ],
          bottom: TabBar(
            labelColor: AppColors.luxuryBronze,
            unselectedLabelColor: AppColors.mutedAccessible,
            indicatorColor: AppColors.luxuryBronze,
            tabs: [
              Tab(text: SupplierL10n.t(lang, 'tab_subscription_billing')),
              Tab(text: SupplierL10n.t(lang, 'tab_payout_history')),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildBillingTab(lang, sup),
            _buildPayoutsTab(lang, sup),
          ],
        ),
      ),
    );
  }

  Widget _buildBillingTab(String lang, SupplierProvider sup) {
    final overview = sup.billingOverview;
    if (sup.loadingBilling && overview == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.luxuryBronze),
      );
    }
    if (_billingError != null && overview == null) {
      return EditorialEmptyState(
        icon: Icons.receipt_long_outlined,
        message: _billingError!,
        actionLabel: AppStrings.t(lang, 'retry'),
        onAction: _loadBilling,
      );
    }

    final safeOverview = overview ?? const SupplierBillingOverview();
    final sub = safeOverview.subscription;
    final dateFmt = DateFormat('dd.MM.yyyy');

    return RefreshIndicator(
      color: AppColors.luxuryBronze,
      onRefresh: _loadBilling,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          _buildSubscriptionSummaryCard(lang, safeOverview, sub, dateFmt),
          const SizedBox(height: 14),
          if (sub != null) _buildTaxInfoCard(lang, sub),
          if (safeOverview.plans.isNotEmpty) ...[
            const SizedBox(height: 16),
            EditorialSectionHeader(
              lang: lang,
              title: SupplierL10n.t(lang, 'available_plans'),
            ),
            const SizedBox(height: 10),
            ...safeOverview.plans.map(
              (plan) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: EditorialSurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${plan.name} (${plan.code})',
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          Text(
                            CurrencyFormatter.format(
                              plan.monthlyPrice,
                              currency: plan.currency,
                            ),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.luxuryBronze,
                            ),
                          ),
                        ],
                      ),
                      if (plan.description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          plan.description,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.charcoal,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          EditorialStatusBadge.neutral(
                            '${plan.maxProducts} ${AppStrings.t(lang, 'nav_products')}',
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () => _openWirePaymentSheet(
                              safeOverview,
                              preselectedPlanCode: plan.code,
                            ),
                            child: Text(
                              SupplierL10n.t(lang, 'select_plan_pay'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'invoices'),
          ),
          const SizedBox(height: 10),
          if (safeOverview.invoices.isEmpty)
            EditorialSurfaceCard(
              child: Text(
                SupplierL10n.t(lang, 'no_invoices'),
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.mutedAccessible,
                ),
              ),
            )
          else
            ...safeOverview.invoices.map(
              (inv) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: EditorialSurfaceCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              inv.invoiceNumber,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                            Text(
                              '${inv.periodLabel} · ${dateFmt.format(inv.issueDate.toLocal())}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            CurrencyFormatter.format(
                              inv.totalAmount,
                              currency: inv.currency,
                            ),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.obsidian,
                            ),
                          ),
                          const SizedBox(height: 4),
                          EditorialStatusBadge.forBillingOrPayout(
                            lang,
                            inv.status,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 16),
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'submit_wire_payment'),
          ),
          const SizedBox(height: 10),
          if (safeOverview.payments.isEmpty)
            EditorialSurfaceCard(
              child: Text(
                SupplierL10n.t(lang, 'no_payments'),
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.mutedAccessible,
                ),
              ),
            )
          else
            ...safeOverview.payments.map(
              (pay) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: EditorialSurfaceCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${pay.planCode} (${pay.periodMonths}m) · ${pay.senderName}',
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                            Text(
                              [
                                if (pay.bankReference.isNotEmpty)
                                  pay.bankReference,
                                dateFmt.format(pay.paidAt.toLocal()),
                              ].join(' · '),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            CurrencyFormatter.format(
                              pay.amount,
                              currency: pay.currency,
                            ),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.obsidian,
                            ),
                          ),
                          const SizedBox(height: 4),
                          EditorialStatusBadge.forBillingOrPayout(
                            lang,
                            pay.status,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSubscriptionSummaryCard(
    String lang,
    SupplierBillingOverview overview,
    SupplierSubscriptionItem? sub,
    DateFormat dateFmt,
  ) {
    final quotaMax = (sub?.maxProducts ?? 1) > 0 ? sub!.maxProducts : 1;
    final quotaRatio = (sub?.activeProductsCount ?? 0) / quotaMax;

    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.t(lang, 'subscription_plan'),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.mutedAccessible,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sub != null
                          ? '${sub.planName} (${sub.planCode})'
                          : '—',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ],
                ),
              ),
              if (sub != null)
                EditorialStatusBadge.forBillingOrPayout(lang, sub.status),
            ],
          ),
          if (sub != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    SupplierL10n.t(lang, 'plan_quota_label'),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.charcoal,
                    ),
                  ),
                ),
                Text(
                  '${sub.activeProductsCount} / ${sub.maxProducts}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            EditorialBarMeter(ratio: quotaRatio),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppStrings.t(lang, 'outstanding_balance'),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(
                          sub.outstandingBalance,
                          currency: sub.currency,
                        ),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: sub.outstandingBalance > 0
                              ? AppColors.danger
                              : AppColors.emerald,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        SupplierL10n.t(lang, 'total_paid_label'),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(
                          sub.totalPaidAmount,
                          currency: sub.currency,
                        ),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        SupplierL10n.t(lang, 'next_billing_label'),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      Text(
                        dateFmt.format(
                          (sub.nextBillingDate ?? sub.currentPeriodEnd)
                              .toLocal(),
                        ),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed: () => _openWirePaymentSheet(overview),
                icon: const Icon(Icons.account_balance_outlined, size: 16),
                label: Text(AppStrings.t(lang, 'submit_wire_payment')),
              ),
              OutlinedButton.icon(
                onPressed: () => _openTaxInfoSheet(sub),
                icon: const Icon(Icons.edit_note_rounded, size: 17),
                label: Text(SupplierL10n.t(lang, 'edit_tax_info')),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaxInfoCard(String lang, SupplierSubscriptionItem sub) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'tax_info'),
            actionLabel: AppStrings.t(lang, 'edit'),
            onAction: () => _openTaxInfoSheet(sub),
          ),
          const SizedBox(height: 8),
          Text(
            sub.billingCompanyTitle.isNotEmpty
                ? sub.billingCompanyTitle
                : '—',
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            [
              if (sub.taxOffice.isNotEmpty) sub.taxOffice,
              if (sub.taxNumber.isNotEmpty) sub.taxNumber,
              if (sub.billingEmail.isNotEmpty) sub.billingEmail,
            ].join(' · '),
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.charcoal,
            ),
          ),
          if (sub.billingAddress.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              sub.billingAddress,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.mutedAccessible,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPayoutsTab(String lang, SupplierProvider sup) {
    final wallet = sup.wallet;
    final payouts = sup.payouts;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');

    if (sup.loadingWallet && payouts.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.luxuryBronze),
      );
    }
    if (_payoutError != null && payouts.isEmpty) {
      return EditorialEmptyState(
        icon: Icons.account_balance_wallet_outlined,
        message: _payoutError!,
        actionLabel: AppStrings.t(lang, 'retry'),
        onAction: _loadPayouts,
      );
    }

    return RefreshIndicator(
      color: AppColors.luxuryBronze,
      onRefresh: _loadPayouts,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          EditorialSurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            SupplierL10n.t(lang, 'kpi_available_balance'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.mutedAccessible,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            CurrencyFormatter.format(
                              wallet.availableBalance,
                              currency: wallet.currency,
                            ),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: wallet.availableBalance > 0
                          ? () => _openPayoutRequestDialog(
                              wallet.availableBalance,
                              wallet.currency,
                            )
                          : null,
                      icon: const Icon(Icons.payments_outlined, size: 17),
                      label: Text(AppStrings.t(lang, 'request_payout')),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _WalletMiniInfo(
                        label: SupplierL10n.t(lang, 'pending_balance'),
                        value: CurrencyFormatter.format(
                          wallet.pendingBalance,
                          currency: wallet.currency,
                        ),
                      ),
                    ),
                    Expanded(
                      child: _WalletMiniInfo(
                        label: SupplierL10n.t(lang, 'withdrawn_balance'),
                        value: CurrencyFormatter.format(
                          wallet.withdrawnBalance,
                          currency: wallet.currency,
                        ),
                      ),
                    ),
                    Expanded(
                      child: _WalletMiniInfo(
                        label: SupplierL10n.t(lang, 'commission_rate'),
                        value: '%${wallet.commissionRate.toStringAsFixed(1)}',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          EditorialSectionHeader(
            lang: lang,
            title: AppStrings.t(lang, 'payouts'),
          ),
          const SizedBox(height: 10),
          if (payouts.isEmpty)
            EditorialEmptyState(
              icon: Icons.payments_outlined,
              message: SupplierL10n.t(lang, 'no_payouts'),
            )
          else
            ...payouts.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: EditorialSurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              CurrencyFormatter.format(
                                p.amount,
                                currency: p.currency,
                              ),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          EditorialStatusBadge.forBillingOrPayout(
                            lang,
                            p.status,
                            isPayout: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      if (p.accountHolder.isNotEmpty || p.iban.isNotEmpty)
                        Text(
                          [
                            if (p.bankName.isNotEmpty) p.bankName,
                            if (p.accountHolder.isNotEmpty) p.accountHolder,
                            if (p.iban.isNotEmpty) p.iban,
                          ].join(' · '),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.charcoal,
                          ),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        dateFmt.format(
                          (p.processedAt ?? p.createdAt).toLocal(),
                        ),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      if (p.adminNotes.trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          p.adminNotes,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.mutedAccessible,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _WalletMiniInfo extends StatelessWidget {
  final String label;
  final String value;

  const _WalletMiniInfo({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.mutedAccessible,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: AppColors.obsidian,
          ),
        ),
      ],
    );
  }
}
