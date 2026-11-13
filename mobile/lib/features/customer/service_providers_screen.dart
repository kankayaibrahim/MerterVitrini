import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/marketplace.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';

class ServiceProvidersScreen extends StatefulWidget {
  const ServiceProvidersScreen({super.key});

  @override
  State<ServiceProvidersScreen> createState() => _ServiceProvidersScreenState();
}

class _ServiceProvidersScreenState extends State<ServiceProvidersScreen> {
  final _searchCtrl = TextEditingController();
  List<ServiceProviderItem> _items = <ServiceProviderItem>[];
  bool _loading = true;
  String? _error;
  String _selectedCategory = '';
  String _query = '';

  static const List<(String, String)> _categories = [
    ('', 'ALL'),
    ('CARGO', 'Cargo & Logistics'),
    ('CUSTOMS', 'Customs & Export'),
    ('PACKAGING', 'Packaging & Labels'),
    ('PHOTOGRAPHY', 'Studio & Photo'),
    ('AGENCY', 'Buying Agency'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/service-providers',
            pageTitle: 'B2B Service Providers',
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
      final list = await context.read<SessionProvider>().api.listServiceProviders(
            category: _selectedCategory,
            query: _query.trim(),
          );
      if (!mounted) return;
      setState(() => _items = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _trackAndLaunch(ServiceProviderItem item, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    context.read<SessionProvider>().api.trackServiceProviderClick(item.id);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openApplicationModal() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => const _ServiceProviderApplySheet(),
    );
    if (ok == true && mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'service_providers'),
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
        onPressed: _openApplicationModal,
        backgroundColor: AppColors.obsidian,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
        ),
        icon: const Icon(Icons.handshake_outlined, size: 18),
        label: Text(
          AppStrings.t(lang, 'apply_service_provider'),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
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
                  onSubmitted: (v) {
                    _query = v;
                    _load();
                  },
                  onChanged: (v) => setState(() => _query = v),
                  decoration: InputDecoration(
                    hintText: UiText.pick(
                      lang,
                      tr: 'Kargo, gümrük, ambalaj veya lojistik ortağı ara...',
                      en: 'Search cargo, customs, packaging, or logistics partner...',
                      ru: 'Поиск карго, таможни, упаковки или логистики...',
                      ar: 'ابحث عن شريك شحن أو جمارك أو تغليف...',
                      de: 'Fracht-, Zoll-, Verpackungs- oder Logistikpartner suchen...',
                      fr: 'Rechercher fret, douane, emballage ou logistique...',
                      pl: 'Szukaj partnera cargo, celnego lub logistycznego...',
                      bg: 'Търсете карго, митница, опаковка или логистика...',
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded, size: 19),
                      onPressed: _load,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _categories.map((pair) {
                      final selected = _selectedCategory == pair.$1;
                      final label = pair.$1.isEmpty
                          ? AppStrings.t(lang, 'all_btn')
                          : pair.$2;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          selected: selected,
                          onSelected: (_) {
                            setState(() => _selectedCategory = pair.$1);
                            _load();
                          },
                          label: Text(label),
                          selectedColor: AppColors.obsidian,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: selected ? Colors.white : AppColors.obsidian,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                          ),
                        ),
                      );
                    }).toList(),
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
                    : _items.isEmpty
                        ? EditorialEmptyState(
                            icon: Icons.local_shipping_outlined,
                            title: AppStrings.t(lang, 'no_results'),
                            subtitle: UiText.pick(
                              lang,
                              tr: 'Seçili kriterlere uygun B2B hizmet ortağı bulunamadı.',
                              en: 'No verified B2B service partners matched your criteria.',
                              ru: 'Подходящих B2B сервис-партнеров не найдено.',
                              ar: 'لم يتم العثور على شركاء خدمات B2B مطابقين.',
                              de: 'Keine B2B-Dienstleistungspartner gefunden.',
                              fr: 'Aucun partenaire B2B trouvé.',
                              pl: 'Nie znaleziono partnerów usługowych B2B.',
                              bg: 'Няма намерени B2B партньори по услуги.',
                            ),
                            actionLabel: AppStrings.t(lang, 'clear_filters'),
                            onAction: () {
                              _searchCtrl.clear();
                              setState(() {
                                _query = '';
                                _selectedCategory = '';
                              });
                              _load();
                            },
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
                              itemCount: _items.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final sp = _items[index];
                                return _ServiceProviderCard(
                                  item: sp,
                                  lang: lang,
                                  onWhatsApp: () {
                                    final raw = sp.whatsappPhone.isNotEmpty
                                        ? sp.whatsappPhone
                                        : sp.phone;
                                    var digits =
                                        raw.replaceAll(RegExp(r'\D'), '');
                                    if (digits.startsWith('0') &&
                                        digits.length == 11) {
                                      digits = '90${digits.substring(1)}';
                                    }
                                    final url = digits.isNotEmpty
                                        ? 'https://wa.me/$digits'
                                        : 'https://wa.me/';
                                    _trackAndLaunch(sp, url);
                                  },
                                  onCall: sp.phone.isEmpty
                                      ? null
                                      : () => _trackAndLaunch(
                                            sp,
                                            'tel:${sp.phone}',
                                          ),
                                  onWebsite: sp.website.isEmpty
                                      ? null
                                      : () => _trackAndLaunch(sp, sp.website),
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

class _ServiceProviderCard extends StatelessWidget {
  final ServiceProviderItem item;
  final String lang;
  final VoidCallback onWhatsApp;
  final VoidCallback? onCall;
  final VoidCallback? onWebsite;

  const _ServiceProviderCard({
    required this.item,
    required this.lang,
    required this.onWhatsApp,
    this.onCall,
    this.onWebsite,
  });

  @override
  Widget build(BuildContext context) {
    final desc = item.localizedShortDescription(lang);
    final loc = [item.district, item.city]
        .where((e) => e.trim().isNotEmpty)
        .join(', ');

    return EditorialCard(
      padding: const EdgeInsets.all(16),
      borderColor: item.isSponsored
          ? AppColors.champagneGold.withValues(alpha: 0.7)
          : AppColors.cultured,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (item.logoUrl.isNotEmpty)
                SmartNetworkImage(
                  imageUrl: item.logoUrl,
                  width: 48,
                  height: 48,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                )
              else
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.warmIvory,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    border: Border.all(color: AppColors.cultured),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.local_shipping_outlined,
                    size: 22,
                    color: AppColors.obsidian,
                  ),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (item.isVerified) ...[
                          const Icon(
                            Icons.verified_rounded,
                            size: 15,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            item.companyName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      loc.isNotEmpty ? loc : item.serviceCategory,
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
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (item.isSponsored)
                EditorialBadge(
                  label: AppStrings.t(lang, 'sponsored_badge'),
                  backgroundColor: AppColors.obsidian,
                  textColor: AppColors.champagneGold,
                  borderColor: AppColors.obsidian,
                  languageCode: lang,
                ),
              if (item.serviceCategory.isNotEmpty)
                EditorialBadge(
                  label: item.serviceCategory,
                  backgroundColor: AppColors.warmIvory,
                  languageCode: lang,
                ),
              if (item.targetCountries.isNotEmpty)
                EditorialBadge(
                  label: item.targetCountries,
                  icon: Icons.public_rounded,
                  languageCode: lang,
                ),
            ],
          ),
          if (desc.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              desc,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.onyx,
                height: 1.45,
              ),
            ),
          ],
          const Divider(height: 20),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (item.whatsappPhone.isNotEmpty || item.phone.isNotEmpty)
                ElevatedButton.icon(
                  onPressed: onWhatsApp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.emerald,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                  ),
                  icon: const Icon(Icons.chat_rounded, size: 15),
                  label: Text(
                    AppStrings.t(lang, 'whatsapp_direct'),
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              if (onCall != null)
                OutlinedButton.icon(
                  onPressed: onCall,
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                  ),
                  icon: const Icon(Icons.phone_in_talk_rounded, size: 15),
                  label: Text(item.phone),
                ),
              if (onWebsite != null)
                OutlinedButton.icon(
                  onPressed: onWebsite,
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                  ),
                  icon: const Icon(Icons.language_rounded, size: 15),
                  label: Text(AppStrings.t(lang, 'website_url')),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ServiceProviderApplySheet extends StatefulWidget {
  const _ServiceProviderApplySheet();

  @override
  State<_ServiceProviderApplySheet> createState() =>
      _ServiceProviderApplySheetState();
}

class _ServiceProviderApplySheetState
    extends State<_ServiceProviderApplySheet> {
  final _formKey = GlobalKey<FormState>();
  final _companyCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _addressCtrl = TextEditingController(text: 'Merter, İstanbul');
  final _shortDescCtrl = TextEditingController();
  final _servicesCtrl = TextEditingController();
  final _countriesCtrl = TextEditingController();

  String _category = 'CARGO';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _companyCtrl.dispose();
    _contactCtrl.dispose();
    _phoneCtrl.dispose();
    _whatsappCtrl.dispose();
    _emailCtrl.dispose();
    _websiteCtrl.dispose();
    _addressCtrl.dispose();
    _shortDescCtrl.dispose();
    _servicesCtrl.dispose();
    _countriesCtrl.dispose();
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
      await session.api.submitServiceProviderApplication(
        ServiceProviderSubmission(
          companyName: _companyCtrl.text.trim(),
          contactName: _contactCtrl.text.trim(),
          serviceCategory: _category,
          shortDescription: _shortDescCtrl.text.trim(),
          servicesOffered: _servicesCtrl.text.trim(),
          targetCountries: _countriesCtrl.text.trim(),
          address: _addressCtrl.text.trim(),
          phone: phoneCheck.normalized,
          whatsappPhone: _whatsappCtrl.text.trim().isNotEmpty
              ? _whatsappCtrl.text.trim()
              : phoneCheck.normalized,
          email: _emailCtrl.text.trim(),
          website: _websiteCtrl.text.trim(),
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'service_providers_apply_success'),
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
                          AppStrings.tUpper(lang, 'apply_service_provider'),
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 15.5,
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
                    controller: _companyCtrl,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'company_name')} *',
                    ),
                    validator: (v) => (v == null || v.trim().length < 2)
                        ? AppStrings.t(lang, 'err_validation')
                        : null,
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _contactCtrl,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'sender_name')} *',
                    ),
                    validator: (v) => (v == null || v.trim().length < 2)
                        ? AppStrings.t(lang, 'err_validation')
                        : null,
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _category,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'service_category'),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'CARGO',
                        child: Text('Cargo & Logistics'),
                      ),
                      DropdownMenuItem(
                        value: 'CUSTOMS',
                        child: Text('Customs & Export'),
                      ),
                      DropdownMenuItem(
                        value: 'PACKAGING',
                        child: Text('Packaging & Labels'),
                      ),
                      DropdownMenuItem(
                        value: 'PHOTOGRAPHY',
                        child: Text('Studio & Photo'),
                      ),
                      DropdownMenuItem(
                        value: 'AGENCY',
                        child: Text('Buying Agency'),
                      ),
                    ],
                    onChanged: (v) => setState(() => _category = v ?? 'CARGO'),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'phone')} *',
                      hintText: '+90 5XX XXX XX XX',
                    ),
                    validator: (v) {
                      final check = PhoneValidator.normalizeAndValidate(
                        v ?? '',
                        lang: lang,
                      );
                      return check.isValid
                          ? null
                          : check.localizedError(lang);
                    },
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'email'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _countriesCtrl,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'export_countries'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _addressCtrl,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'location_address'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _shortDescCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'brand_description'),
                    ),
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
                              AppStrings.tUpper(lang, 'register_submit'),
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
