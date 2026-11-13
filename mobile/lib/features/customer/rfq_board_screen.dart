import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/marketplace.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../auth/auth_screen.dart';

class RfqBoardScreen extends StatefulWidget {
  const RfqBoardScreen({super.key});

  @override
  State<RfqBoardScreen> createState() => _RfqBoardScreenState();
}

class _RfqBoardScreenState extends State<RfqBoardScreen> {
  final _searchCtrl = TextEditingController();
  List<RfqItem> _items = <RfqItem>[];
  bool _loading = true;
  String? _error;
  String _query = '';
  String _productionFilter = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/rfqs',
            pageTitle: 'B2B RFQ Board',
          );
      _load();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await context.read<SessionProvider>().api.listPublicRfqs();
      if (!mounted) return;
      setState(() => _items = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreateRfqSheet() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    if (!session.isCustomerLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'rfq_auth_required'),
            style: const TextStyle(color: Colors.white),
          ),
          action: SnackBarAction(
            label: AppStrings.t(lang, 'login'),
            textColor: AppColors.champagneGold,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) =>
                      const AuthScreen(initialRole: AppRole.customer),
                ),
              );
            },
          ),
        ),
      );
      return;
    }

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => const _CreateRfqModal(),
    );

    if (created == true && mounted) {
      await _load();
    }
  }

  List<RfqItem> get _filtered {
    final q = _query.trim().toLowerCase();
    return _items.where((r) {
      if (_productionFilter.isNotEmpty &&
          r.productionType.toUpperCase() != _productionFilter) {
        return false;
      }
      if (q.isEmpty) return true;
      final hay = [
        r.title,
        r.categoryName,
        r.buyerCompany,
        r.buyerCountry,
        r.description,
        r.rfqNumber,
      ].join(' ').toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final items = _filtered;
    final dateFmt = DateFormat('dd.MM.yyyy');

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'rfq_board'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateRfqSheet,
        backgroundColor: AppColors.obsidian,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
        ),
        icon: const Icon(Icons.add_rounded, size: 19),
        label: Text(
          AppStrings.t(lang, 'post_rfq'),
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
        ),
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              children: [
                TextField(
                  controller: _searchCtrl,
                  onChanged: (v) => setState(() => _query = v),
                  decoration: InputDecoration(
                    hintText: UiText.pick(
                      lang,
                      tr: 'Alım talebi, kategori veya ülke ara...',
                      en: 'Search buying request, category, or country...',
                      ru: 'Поиск запроса RFQ, категории или страны...',
                      ar: 'ابحث عن طلب شراء أو فئة أو دولة...',
                      de: 'Anfrage, Kategorie oder Land suchen...',
                      fr: 'Rechercher demande RFQ, catégorie ou pays...',
                      pl: 'Szukaj zapytania RFQ, kategorii lub kraju...',
                      bg: 'Търсете RFQ заявка, категория или държава...',
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final opt in [
                        ('', AppStrings.t(lang, 'all_btn')),
                        ('READY_STOCK', 'Ready Stock'),
                        (
                          'PRIVATE_LABEL',
                          AppStrings.t(lang, 'private_label_badge')
                        ),
                        ('FASON', AppStrings.t(lang, 'fason_badge')),
                      ]) ...[
                        ChoiceChip(
                          selected: _productionFilter == opt.$1,
                          onSelected: (_) =>
                              setState(() => _productionFilter = opt.$1),
                          label: Text(opt.$2),
                          selectedColor: AppColors.obsidian,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: _productionFilter == opt.$1
                                ? Colors.white
                                : AppColors.obsidian,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.obsidian,
                    ),
                  )
                : _error != null
                    ? EditorialEmptyState(
                        icon: Icons.error_outline_rounded,
                        title: AppStrings.t(lang, 'error'),
                        subtitle: _error!,
                        actionLabel: AppStrings.t(lang, 'retry'),
                        onAction: _load,
                      )
                    : items.isEmpty
                        ? EditorialEmptyState(
                            icon: Icons.request_quote_outlined,
                            title: AppStrings.t(lang, 'no_results'),
                            subtitle: UiText.pick(
                              lang,
                              tr: 'Henüz aktif alım talebi bulunmuyor. İlk talebi siz oluşturabilirsiniz.',
                              en: 'No active buying requests yet. Be the first to post a B2B RFQ.',
                              ru: 'Активных запросов пока нет. Опубликуйте первый RFQ.',
                              ar: 'لا توجد طلبات شراء نشطة حالياً. كن أول من ينشر طلب عرض سعر.',
                              de: 'Noch keine aktiven Kaufanfragen. Veröffentlichen Sie die erste RFQ.',
                              fr: 'Aucune demande d’achat active. Publiez la première demande RFQ.',
                              pl: 'Brak aktywnych zapytań RFQ. Dodaj pierwsze zapytanie.',
                              bg: 'Все още няма активни RFQ заявки. Бъдете първи.',
                            ),
                            actionLabel: AppStrings.t(lang, 'post_rfq'),
                            onAction: _openCreateRfqSheet,
                          )
                        : RefreshIndicator(
                            color: AppColors.obsidian,
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(
                                14,
                                14,
                                14,
                                88,
                              ),
                              itemCount: items.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final rfq = items[index];
                                return EditorialCard(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          if (rfq.rfqNumber.isNotEmpty)
                                            EditorialBadge(
                                              label: rfq.rfqNumber,
                                              backgroundColor:
                                                  AppColors.warmIvory,
                                              languageCode: lang,
                                            ),
                                          const SizedBox(width: 6),
                                          if (rfq.productionType.isNotEmpty)
                                            EditorialBadge(
                                              label: rfq.productionType,
                                              languageCode: lang,
                                            ),
                                          const Spacer(),
                                          Text(
                                            dateFmt.format(
                                              rfq.createdAt.toLocal(),
                                            ),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.mutedAccessible,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        rfq.title,
                                        style: const TextStyle(
                                          fontFamily: AppColors.serifFontFamily,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                      if (rfq.description.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          rfq.description,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            color: AppColors.onyx,
                                            height: 1.45,
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 12),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 6,
                                        children: [
                                          EditorialBadge(
                                            label:
                                                '${rfq.targetQuantity} ${rfq.unitType}',
                                            icon: Icons.inventory_2_outlined,
                                            languageCode: lang,
                                          ),
                                          if (rfq.targetPrice != null &&
                                              rfq.targetPrice! > 0)
                                            EditorialBadge(
                                              label:
                                                  '${rfq.targetPrice!.toStringAsFixed(2)} ${rfq.currency}',
                                              icon: Icons.sell_outlined,
                                              backgroundColor:
                                                  AppColors.warmIvory,
                                              languageCode: lang,
                                            ),
                                          if (rfq.categoryName.isNotEmpty)
                                            EditorialBadge(
                                              label: rfq.categoryName,
                                              languageCode: lang,
                                            ),
                                          if (rfq.buyerCountry.isNotEmpty)
                                            EditorialBadge(
                                              label: rfq.buyerCountry,
                                              icon: Icons.public_rounded,
                                              languageCode: lang,
                                            ),
                                          EditorialBadge(
                                            label:
                                                '${rfq.offerCount} ${AppStrings.t(lang, 'rfq_offers_count')}',
                                            backgroundColor:
                                                AppColors.emeraldLight,
                                            textColor: AppColors.emerald,
                                            borderColor: AppColors.emerald
                                                .withValues(alpha: 0.35),
                                            languageCode: lang,
                                          ),
                                        ],
                                      ),
                                      if (rfq.buyerCompany.isNotEmpty) ...[
                                        const Divider(height: 20),
                                        Row(
                                          children: [
                                            const Icon(
                                              Icons.business_outlined,
                                              size: 14,
                                              color: AppColors.sonicSilver,
                                            ),
                                            const SizedBox(width: 6),
                                            Expanded(
                                              child: Text(
                                                rfq.buyerCompany,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.sonicSilver,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _CreateRfqModal extends StatefulWidget {
  const _CreateRfqModal();

  @override
  State<_CreateRfqModal> createState() => _CreateRfqModalState();
}

class _CreateRfqModalState extends State<_CreateRfqModal> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController(text: '100');
  final _targetPriceCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _buyerNameCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _countryCtrl = TextEditingController(text: 'Turkey');
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  String _unitType = 'SERIES';
  String _currency = 'USD';
  String _productionType = 'READY_STOCK';
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final session = context.read<SessionProvider>();
    _currency = session.currencyCode;
    final user = session.customerUser;
    if (user != null) {
      _buyerNameCtrl.text = user.fullName;
      _phoneCtrl.text = user.phone;
      _emailCtrl.text = user.email;
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _categoryCtrl.dispose();
    _qtyCtrl.dispose();
    _targetPriceCtrl.dispose();
    _descriptionCtrl.dispose();
    _buyerNameCtrl.dispose();
    _companyCtrl.dispose();
    _countryCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
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
      final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 100;
      final price = double.tryParse(
        _targetPriceCtrl.text.trim().replaceAll(',', '.'),
      );
      await session.api.createPublicRfq(
        CreateRfqPayload(
          title: _titleCtrl.text.trim(),
          categoryName: _categoryCtrl.text.trim(),
          targetQuantity: qty,
          unitType: _unitType,
          targetPrice: price,
          currency: _currency,
          productionType: _productionType,
          description: _descriptionCtrl.text.trim(),
          buyerName: _buyerNameCtrl.text.trim(),
          buyerCompany: _companyCtrl.text.trim(),
          buyerCountry: _countryCtrl.text.trim(),
          buyerPhone: phoneCheck.normalized,
          buyerWhatsapp: phoneCheck.normalized,
          buyerEmail: _emailCtrl.text.trim(),
        ),
      );
      await session.telemetry.trackMemberEvent(eventType: 'rfq_created');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            UiText.pick(
              lang,
              tr: 'Alım talebiniz (RFQ) yayınlandı!',
              en: 'Your buying request (RFQ) has been published!',
              ru: 'Ваш оптовый запрос (RFQ) опубликован!',
              ar: 'تم نشر طلب الشراء (RFQ) بنجاح!',
              de: 'Ihre Kaufanfrage (RFQ) wurde veröffentlicht!',
              fr: 'Votre demande d’achat (RFQ) a été publiée !',
              pl: 'Twoje zapytanie ofertowe (RFQ) zostało opublikowane!',
              bg: 'Вашата RFQ заявка беше публикувана!',
            ),
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
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.88,
          maxChildSize: 0.95,
          minChildSize: 0.55,
          builder: (context, scrollCtrl) => SingleChildScrollView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: Form(
              key: _formKey,
              child: Column(
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          AppStrings.tUpper(lang, 'post_rfq'),
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            letterSpacing: AppStrings.letterSpacing(lang, 0.8),
                            color: AppColors.obsidian,
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
                  TextFormField(
                    controller: _titleCtrl,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'rfq_title')} *',
                    ),
                    validator: (v) => (v == null || v.trim().length < 4)
                        ? AppStrings.t(lang, 'err_validation')
                        : null,
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _categoryCtrl,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'categories'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _qtyCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'rfq_target_qty')} *',
                          ),
                          validator: (v) => (int.tryParse(v ?? '') ?? 0) <= 0
                              ? AppStrings.t(lang, 'err_validation')
                              : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _unitType,
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'rfq_unit_type'),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'SERIES',
                              child: Text('SERIES'),
                            ),
                            DropdownMenuItem(
                              value: 'PIECE',
                              child: Text('PIECE'),
                            ),
                          ],
                          onChanged: (v) =>
                              setState(() => _unitType = v ?? 'SERIES'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _targetPriceCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'rfq_target_price'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _currency,
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'currency'),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'USD', child: Text('USD')),
                            DropdownMenuItem(value: 'EUR', child: Text('EUR')),
                            DropdownMenuItem(value: 'TRY', child: Text('TRY')),
                            DropdownMenuItem(value: 'GBP', child: Text('GBP')),
                            DropdownMenuItem(value: 'RUB', child: Text('RUB')),
                          ],
                          onChanged: (v) =>
                              setState(() => _currency = v ?? 'USD'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _productionType,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'rfq_production_type'),
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: 'READY_STOCK',
                        child: Text('Ready Stock'),
                      ),
                      DropdownMenuItem(
                        value: 'PRIVATE_LABEL',
                        child: Text(AppStrings.t(lang, 'private_label_badge')),
                      ),
                      DropdownMenuItem(
                        value: 'FASON',
                        child: Text(AppStrings.t(lang, 'fason_badge')),
                      ),
                    ],
                    onChanged: (v) =>
                        setState(() => _productionType = v ?? 'READY_STOCK'),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _descriptionCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'brand_description'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _buyerNameCtrl,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'sender_name')} *',
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? AppStrings.t(lang, 'err_validation')
                              : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _companyCtrl,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'rfq_buyer_company')} *',
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? AppStrings.t(lang, 'err_validation')
                              : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _countryCtrl,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'rfq_buyer_country')} *',
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? AppStrings.t(lang, 'err_validation')
                              : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _phoneCtrl,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(
                            labelText: '${AppStrings.t(lang, 'phone')} *',
                          ),
                          validator: (v) {
                            final c = PhoneValidator.normalizeAndValidate(
                              v ?? '',
                              lang: lang,
                            );
                            return c.isValid ? null : c.localizedError(lang);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'email')} *',
                    ),
                    validator: (v) => (v == null || !v.contains('@'))
                        ? AppStrings.t(lang, 'err_validation')
                        : null,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.dangerLight,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.obsidian,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusMd),
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
                          : Text(
                              AppStrings.tUpper(lang, 'post_rfq'),
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing:
                                    AppStrings.letterSpacing(lang, 0.9),
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
