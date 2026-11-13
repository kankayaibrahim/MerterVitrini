import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/product_card.dart';
import '../auth/auth_screen.dart';
import '../chat/chat_conversation_screen.dart';
import 'direct_inquiry_sheet.dart';
import 'product_detail_screen.dart';

class ManufacturersScreen extends StatefulWidget {
  const ManufacturersScreen({super.key});

  @override
  State<ManufacturersScreen> createState() => _ManufacturersScreenState();
}

class _ManufacturersScreenState extends State<ManufacturersScreen> {
  final _searchCtrl = TextEditingController();
  List<ManufacturerSummary> _all = <ManufacturerSummary>[];
  bool _loading = true;
  String? _error;

  String _query = '';
  String _selectedCity = '';
  bool _fasonOnly = false;
  bool _privateLabelOnly = false;
  String _companyType = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/manufacturers',
            pageTitle: 'Manufacturers Directory',
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
      final list = await context.read<SessionProvider>().api.listManufacturers();
      if (!mounted) return;
      setState(() => _all = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<String> get _cityOptions {
    final set = <String>{};
    for (final m in _all) {
      final addr = m.locationAddress.trim();
      if (addr.isEmpty) continue;
      // Extract meaningful city/district token if comma/slash separated
      final parts = addr.split(RegExp(r'[,/\-]+')).map((e) => e.trim());
      for (final p in parts) {
        if (p.length >= 3 && p.length <= 28) {
          set.add(p);
        }
      }
    }
    final list = set.toList()..sort();
    return list.take(24).toList();
  }

  List<ManufacturerSummary> get _filtered {
    final q = _query.trim().toLowerCase();
    return _all.where((m) {
      if (_fasonOnly && !m.supportsFason) return false;
      if (_privateLabelOnly && !m.supportsPrivateLabel) return false;
      if (_companyType.isNotEmpty &&
          m.companyType.toLowerCase() != _companyType.toLowerCase()) {
        return false;
      }
      if (_selectedCity.isNotEmpty &&
          !m.locationAddress
              .toLowerCase()
              .contains(_selectedCity.toLowerCase())) {
        return false;
      }
      if (q.isEmpty) return true;
      final hay = [
        m.name,
        m.displayName,
        m.slug,
        m.locationAddress,
        m.exportCountries,
        m.description,
      ].join(' ').toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final items = _filtered;
    final cities = _cityOptions;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'manufacturers_directory'),
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
      body: Column(
        children: [
          // Search & Filter Bar
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
                      tr: 'Üretici adı, şehir veya ihracat ülkesi ara...',
                      en: 'Search manufacturer name, city, or export country...',
                      ru: 'Поиск производителя, города или страны экспорта...',
                      ar: 'ابحث عن اسم المصنع أو المدينة أو بلد التصدير...',
                      de: 'Hersteller, Stadt oder Exportland suchen...',
                      fr: 'Rechercher fabricant, ville ou pays d’export...',
                      pl: 'Szukaj producenta, miasta lub kraju eksportu...',
                      bg: 'Търсете производител, град или държава...',
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                            icon: const Icon(Icons.close_rounded, size: 18),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        selected: _fasonOnly,
                        onSelected: (v) => setState(() => _fasonOnly = v),
                        label: Text(AppStrings.t(lang, 'filter_fason')),
                        selectedColor: AppColors.obsidian,
                        labelStyle: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: _fasonOnly ? Colors.white : AppColors.obsidian,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        selected: _privateLabelOnly,
                        onSelected: (v) =>
                            setState(() => _privateLabelOnly = v),
                        label: Text(AppStrings.t(lang, 'filter_private_label')),
                        selectedColor: AppColors.obsidian,
                        labelStyle: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: _privateLabelOnly
                              ? Colors.white
                              : AppColors.obsidian,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusSm),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TypeDropdownPill(
                        lang: lang,
                        value: _companyType,
                        onChanged: (v) =>
                            setState(() => _companyType = v ?? ''),
                      ),
                      if (cities.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                            border: Border.all(color: AppColors.cultured),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: cities.contains(_selectedCity)
                                  ? _selectedCity
                                  : '',
                              isDense: true,
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                              items: [
                                DropdownMenuItem(
                                  value: '',
                                  child: Text(
                                    '${AppStrings.t(lang, 'city_district')}: ${AppStrings.t(lang, 'all_btn')}',
                                  ),
                                ),
                                ...cities.map(
                                  (c) => DropdownMenuItem(
                                    value: c,
                                    child: Text(c),
                                  ),
                                ),
                              ],
                              onChanged: (v) =>
                                  setState(() => _selectedCity = v ?? ''),
                            ),
                          ),
                        ),
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
                            icon: Icons.factory_outlined,
                            title: AppStrings.t(lang, 'no_results'),
                            subtitle: UiText.pick(
                              lang,
                              tr: 'Seçili filtrelere uygun doğrulanmış üretici bulunamadı.',
                              en: 'No verified manufacturers matched your filters.',
                              ru: 'По выбранным фильтрам производители не найдены.',
                              ar: 'لم يتم العثور على مصانع مطابقة للفلاتر المختارة.',
                              de: 'Keine verifizierten Hersteller für diese Filter gefunden.',
                              fr: 'Aucun fabricant vérifié ne correspond à vos filtres.',
                              pl: 'Brak zweryfikowanych producentów dla wybranych filtrów.',
                              bg: 'Няма намерени верифицирани производители по тези филтри.',
                            ),
                            actionLabel: AppStrings.t(lang, 'clear_filters'),
                            onAction: () {
                              _searchCtrl.clear();
                              setState(() {
                                _query = '';
                                _selectedCity = '';
                                _fasonOnly = false;
                                _privateLabelOnly = false;
                                _companyType = '';
                              });
                            },
                          )
                        : RefreshIndicator(
                            color: AppColors.obsidian,
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(14),
                              itemCount: items.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final m = items[index];
                                return _ManufacturerCard(
                                  manufacturer: m,
                                  lang: lang,
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                        builder: (_) => ManufacturerDetailScreen(
                                          slugOrId: m.slug.isNotEmpty
                                              ? m.slug
                                              : m.id,
                                          initialSummary: m,
                                        ),
                                      ),
                                    );
                                  },
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

class _TypeDropdownPill extends StatelessWidget {
  final String lang;
  final String value;
  final ValueChanged<String?> onChanged;

  const _TypeDropdownPill({
    required this.lang,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: AppColors.cultured),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isDense: true,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: AppColors.obsidian,
          ),
          items: [
            DropdownMenuItem(
              value: '',
              child: Text(
                '${AppStrings.t(lang, 'filter_company_type')}: ${AppStrings.t(lang, 'all_btn')}',
              ),
            ),
            DropdownMenuItem(
              value: 'manufacturer',
              child: Text(AppStrings.t(lang, 'company_type_manufacturer')),
            ),
            DropdownMenuItem(
              value: 'wholesaler',
              child: Text(AppStrings.t(lang, 'company_type_wholesaler')),
            ),
            DropdownMenuItem(
              value: 'both',
              child: Text(AppStrings.t(lang, 'company_type_both')),
            ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _ManufacturerCard extends StatelessWidget {
  final ManufacturerSummary manufacturer;
  final String lang;
  final VoidCallback onTap;

  const _ManufacturerCard({
    required this.manufacturer,
    required this.lang,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final m = manufacturer;
    final desc = m.localizedDescription(lang);
    final countries = m.exportCountryList;

    return EditorialCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.warmIvory,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  border: Border.all(
                    color: AppColors.champagneGold.withValues(alpha: 0.5),
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  m.displayName.isNotEmpty
                      ? m.displayName.characters.first.toUpperCase()
                      : 'M',
                  style: const TextStyle(
                    fontFamily: AppColors.serifFontFamily,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (m.isVerified) ...[
                          const Icon(
                            Icons.verified_rounded,
                            size: 16,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 5),
                        ],
                        Expanded(
                          child: Text(
                            m.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      m.locationAddress.isNotEmpty
                          ? m.locationAddress
                          : 'Merter, İstanbul',
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
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.obsidian,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Text(
                  '${m.activeProductCount}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (desc.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              desc,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.2,
                color: AppColors.onyx,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (m.isVerified)
                EditorialBadge(
                  label: AppStrings.t(lang, 'verified_manufacturer'),
                  backgroundColor: AppColors.emeraldLight,
                  textColor: AppColors.emerald,
                  borderColor: AppColors.emerald.withValues(alpha: 0.35),
                  icon: Icons.verified_outlined,
                  languageCode: lang,
                ),
              if (m.supportsFason)
                EditorialBadge(
                  label: AppStrings.t(lang, 'fason_badge'),
                  backgroundColor: AppColors.warmIvory,
                  textColor: AppColors.obsidian,
                  borderColor: AppColors.champagneGold.withValues(alpha: 0.5),
                  languageCode: lang,
                ),
              if (m.supportsPrivateLabel)
                EditorialBadge(
                  label: AppStrings.t(lang, 'private_label_badge'),
                  backgroundColor: AppColors.editorialOffWhite,
                  textColor: AppColors.obsidian,
                  languageCode: lang,
                ),
              if (m.minOrderQuantity > 0)
                EditorialBadge(
                  label:
                      '${AppStrings.t(lang, 'moq')}: ${m.minOrderQuantity} ${AppStrings.t(lang, 'package')}',
                  languageCode: lang,
                ),
              if (countries.isNotEmpty)
                EditorialBadge(
                  label: countries.take(3).join(', '),
                  icon: Icons.public_rounded,
                  languageCode: lang,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class ManufacturerDetailScreen extends StatefulWidget {
  final String slugOrId;
  final ManufacturerSummary? initialSummary;

  const ManufacturerDetailScreen({
    super.key,
    required this.slugOrId,
    this.initialSummary,
  });

  @override
  State<ManufacturerDetailScreen> createState() =>
      _ManufacturerDetailScreenState();
}

class _ManufacturerDetailScreenState extends State<ManufacturerDetailScreen> {
  ManufacturerDetail? _detail;
  List<Product> _products = <Product>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _detail = widget.initialSummary;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    try {
      final detail = await session.api.fetchManufacturerDetail(widget.slugOrId);
      final catalog = await session.api.searchCatalog(
        CatalogFilterParams(
          brandSlug: detail.slug.isNotEmpty ? detail.slug : null,
          brandId: detail.slug.isEmpty ? detail.id : null,
        ),
        limit: 24,
        offset: 0,
        lang: lang,
      );
      await session.telemetry.trackScreenView(
        path: '/brands/${detail.slug.isNotEmpty ? detail.slug : detail.id}',
        pageTitle: detail.displayName,
      );
      await session.telemetry.trackBrandEvent(
        brandId: detail.id,
        eventType: 'profile_view',
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _products = catalog.products;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openWhatsApp(ManufacturerSummary m, String lang) async {
    final session = context.read<SessionProvider>();
    await session.telemetry.trackBrandEvent(
      brandId: m.id,
      eventType: 'whatsapp_click',
    );
    final raw = m.whatsappPhone.isNotEmpty ? m.whatsappPhone : m.phone;
    var digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('0') && digits.length == 11) {
      digits = '90${digits.substring(1)}';
    }
    final msg = UiText.pick(
      lang,
      tr: 'Merhaba ${m.displayName}, Merter Vitrini üzerinden toptan kataloğunuz hakkında görüşmek istiyorum.',
      en: 'Hello ${m.displayName}, contacting you via Merter Vitrini regarding your wholesale catalog.',
      ru: 'Здравствуйте ${m.displayName}, обращаюсь через Merter Vitrini по поводу вашего оптового каталога.',
      ar: 'مرحباً ${m.displayName}، أتواصل معكم عبر مرتر فيتريني بخصوص كتالوج الجملة.',
      de: 'Hallo ${m.displayName}, Anfrage über Merter Vitrini zu Ihrem Großhandelskatalog.',
      fr: 'Bonjour ${m.displayName}, prise de contact via Merter Vitrini pour votre catalogue de gros.',
      pl: 'Dzień dobry ${m.displayName}, kontakt przez Merter Vitrini w sprawie katalogu hurtowego.',
      bg: 'Здравейте ${m.displayName}, свързвам се чрез Merter Vitrini относно каталога ви на едро.',
    );
    final url = digits.isNotEmpty
        ? 'https://wa.me/$digits?text=${Uri.encodeComponent(msg)}'
        : 'https://wa.me/?text=${Uri.encodeComponent(msg)}';
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _startChat(ManufacturerSummary m) async {
    final session = context.read<SessionProvider>();
    if (!session.isMemberLoggedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthScreen()),
      );
      return;
    }
    try {
      final room =
          await context.read<ChatProvider>().startCustomerProductOrBrandChat(
                brandId: m.id,
              );
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatConversationScreen(
            room: room,
            asSupplier: false,
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
    final m = _detail;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          m?.displayName.toUpperCase() ??
              AppStrings.tUpper(lang, 'manufacturer_showcase'),
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
      ),
      body: m == null && _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : m == null && _error != null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : CustomScrollView(
                  slivers: [
                    if (m != null)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Showcase Identity Card
                              EditorialCard(
                                padding: const EdgeInsets.all(18),
                                borderRadius: AppColors.radiusLg,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 54,
                                          height: 54,
                                          decoration: BoxDecoration(
                                            color: AppColors.obsidian,
                                            borderRadius: BorderRadius.circular(
                                              AppColors.radiusMd,
                                            ),
                                          ),
                                          alignment: Alignment.center,
                                          child: Text(
                                            m.displayName.isNotEmpty
                                                ? m.displayName.characters.first
                                                    .toUpperCase()
                                                : 'M',
                                            style: const TextStyle(
                                              fontFamily:
                                                  AppColors.serifFontFamily,
                                              color: AppColors.champagneGold,
                                              fontSize: 22,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  if (m.isVerified) ...[
                                                    const Icon(
                                                      Icons.verified_rounded,
                                                      size: 16,
                                                      color: AppColors.emerald,
                                                    ),
                                                    const SizedBox(width: 5),
                                                  ],
                                                  Expanded(
                                                    child: Text(
                                                      m.displayName,
                                                      maxLines: 2,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontFamily: AppColors
                                                            .serifFontFamily,
                                                        fontSize: 18,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        color:
                                                            AppColors.obsidian,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                m.locationAddress.isNotEmpty
                                                    ? m.locationAddress
                                                    : 'Merter, İstanbul',
                                                style: const TextStyle(
                                                  fontSize: 12.2,
                                                  color: AppColors.sonicSilver,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        if (m.isVerified)
                                          EditorialBadge(
                                            label: AppStrings.t(
                                              lang,
                                              'verified_manufacturer',
                                            ),
                                            backgroundColor:
                                                AppColors.emeraldLight,
                                            textColor: AppColors.emerald,
                                            borderColor: AppColors.emerald
                                                .withValues(alpha: 0.35),
                                            icon: Icons.verified_outlined,
                                            languageCode: lang,
                                          ),
                                        if (m.supportsFason)
                                          EditorialBadge(
                                            label: AppStrings.t(
                                              lang,
                                              'fason_badge',
                                            ),
                                            backgroundColor:
                                                AppColors.warmIvory,
                                            languageCode: lang,
                                          ),
                                        if (m.supportsPrivateLabel)
                                          EditorialBadge(
                                            label: AppStrings.t(
                                              lang,
                                              'private_label_badge',
                                            ),
                                            backgroundColor:
                                                AppColors.warmIvory,
                                            languageCode: lang,
                                          ),
                                        if (m.minOrderQuantity > 0)
                                          EditorialBadge(
                                            label:
                                                '${AppStrings.t(lang, 'min_order_qty')}: ${m.minOrderQuantity}',
                                            languageCode: lang,
                                          ),
                                      ],
                                    ),
                                    if (m.localizedDescription(lang).isNotEmpty) ...[
                                      const SizedBox(height: 12),
                                      Text(
                                        m.localizedDescription(lang),
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: AppColors.onyx,
                                          height: 1.5,
                                        ),
                                      ),
                                    ],
                                    if (m.exportCountryList.isNotEmpty) ...[
                                      const SizedBox(height: 14),
                                      Text(
                                        AppStrings.tUpper(
                                          lang,
                                          'export_countries',
                                        ),
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing:
                                              AppStrings.letterSpacing(
                                            lang,
                                            1.0,
                                          ),
                                          color: AppColors.editorialGold,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: m.exportCountryList
                                            .map(
                                              (c) => EditorialBadge(
                                                label: c,
                                                icon: Icons.public_rounded,
                                                languageCode: lang,
                                              ),
                                            )
                                            .toList(),
                                      ),
                                    ],
                                    const Divider(height: 24),
                                    // Direct B2B Actions
                                    Row(
                                      children: [
                                        Expanded(
                                          child: ElevatedButton.icon(
                                            onPressed: () =>
                                                showDirectInquiryModal(
                                              context,
                                              brandId: m.id,
                                              brandName: m.displayName,
                                            ),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor:
                                                  AppColors.obsidian,
                                              foregroundColor: Colors.white,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                vertical: 12,
                                                horizontal: 10,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                            ),
                                            icon: const Icon(
                                              Icons.mail_outline_rounded,
                                              size: 16,
                                            ),
                                            label: Text(
                                              AppStrings.t(
                                                lang,
                                                'direct_inquiry',
                                              ),
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
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            onPressed: () => _startChat(m),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor:
                                                  AppColors.obsidian,
                                              side: const BorderSide(
                                                color: AppColors.obsidian,
                                              ),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                vertical: 12,
                                                horizontal: 10,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                            ),
                                            icon: const Icon(
                                              Icons.forum_outlined,
                                              size: 16,
                                            ),
                                            label: Text(
                                              AppStrings.t(lang, 'live_chat'),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        if (m.whatsappPhone.isNotEmpty ||
                                            m.phone.isNotEmpty)
                                          ElevatedButton.icon(
                                            onPressed: () =>
                                                _openWhatsApp(m, lang),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor:
                                                  AppColors.emerald,
                                              foregroundColor: Colors.white,
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                            ),
                                            icon: const Icon(
                                              Icons.chat_rounded,
                                              size: 15,
                                            ),
                                            label: Text(
                                              AppStrings.t(
                                                lang,
                                                'whatsapp_direct',
                                              ),
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                        if (m.phone.isNotEmpty)
                                          OutlinedButton.icon(
                                            onPressed: () {
                                              session.telemetry.trackBrandEvent(
                                                brandId: m.id,
                                                eventType: 'phone_click',
                                              );
                                              launchUrl(
                                                Uri.parse('tel:${m.phone}'),
                                              );
                                            },
                                            style: OutlinedButton.styleFrom(
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                            ),
                                            icon: const Icon(
                                              Icons.phone_in_talk_rounded,
                                              size: 15,
                                            ),
                                            label: Text(m.phone),
                                          ),
                                        if (m.website.isNotEmpty)
                                          OutlinedButton.icon(
                                            onPressed: () {
                                              final uri =
                                                  Uri.tryParse(m.website);
                                              if (uri != null) {
                                                launchUrl(
                                                  uri,
                                                  mode: LaunchMode
                                                      .externalApplication,
                                                );
                                              }
                                            },
                                            style: OutlinedButton.styleFrom(
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                            ),
                                            icon: const Icon(
                                              Icons.language_rounded,
                                              size: 15,
                                            ),
                                            label: Text(
                                              AppStrings.t(lang, 'website_url'),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),
                              EditorialSectionHeader(
                                eyebrow: AppStrings.t(lang, 'brands'),
                                title:
                                    '${AppStrings.t(lang, 'all_products')} (${_products.length})',
                                languageCode: lang,
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (_loading && _products.isEmpty)
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ),
                      )
                    else if (_products.isEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Center(
                            child: Text(
                              AppStrings.t(lang, 'no_results'),
                              style:
                                  const TextStyle(color: AppColors.sonicSilver),
                            ),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                        sliver: SliverGrid(
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 14,
                            crossAxisSpacing: 10,
                            childAspectRatio: 0.54,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final p = _products[index];
                              return B2BProductCard(
                                product: p,
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) =>
                                          ProductDetailScreen(productId: p.id),
                                    ),
                                  );
                                },
                              );
                            },
                            childCount: _products.length,
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
