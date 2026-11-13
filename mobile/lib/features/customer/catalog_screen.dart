import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import 'product_detail_screen.dart';

class CatalogScreen extends StatefulWidget {
  final String? initialCategoryId;
  final String? initialBrandId;
  final String? initialBrandSlug;
  final String? initialQuery;
  final int filterVersion;

  const CatalogScreen({
    super.key,
    this.initialCategoryId,
    this.initialBrandId,
    this.initialBrandSlug,
    this.initialQuery,
    this.filterVersion = 0,
  });

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  static const int _pageSize = 24;

  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  List<Product> _products = <Product>[];
  List<CatalogAttributeGroup> _attributeGroups = <CatalogAttributeGroup>[];

  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;

  String? _categoryId;
  String? _brandId;
  String? _brandSlug;
  String _query = '';
  CatalogSortOption _sortBy = CatalogSortOption.newest;

  bool _fasonOnly = false;
  bool _privateLabelOnly = false;
  String? _companyType;
  int? _maxMoq;
  String? _exportCountry;
  double? _minPrice;
  double? _maxPrice;
  String? _displayCurrency;
  Map<String, List<String>> _attributeFilters = <String, List<String>>{};

  @override
  void initState() {
    super.initState();
    _applyInitialFilters();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadAttributeGroups();
      _fetchCatalog(reset: true);
    });
  }

  @override
  void didUpdateWidget(covariant CatalogScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.filterVersion != widget.filterVersion) {
      _applyInitialFilters();
      _fetchCatalog(reset: true);
    }
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _applyInitialFilters() {
    _categoryId = widget.initialCategoryId;
    _brandId = widget.initialBrandId;
    _brandSlug = widget.initialBrandSlug;
    _query = widget.initialQuery ?? '';
    _searchCtrl.text = _query;
  }

  void _onScroll() {
    if (_loading || _loadingMore || !_hasMore || !_scrollCtrl.hasClients) {
      return;
    }
    final pos = _scrollCtrl.position;
    if (pos.pixels >= pos.maxScrollExtent - 320) {
      _fetchCatalog(reset: false);
    }
  }

  Future<void> _loadAttributeGroups() async {
    try {
      final groups =
          await context.read<SessionProvider>().api.listStoreAttributes();
      if (!mounted) return;
      setState(() => _attributeGroups = groups);
    } catch (_) {}
  }

  bool get _hasActiveFilters =>
      (_categoryId != null && _categoryId!.isNotEmpty) ||
      (_brandId != null && _brandId!.isNotEmpty) ||
      (_brandSlug != null && _brandSlug!.isNotEmpty) ||
      _fasonOnly ||
      _privateLabelOnly ||
      (_companyType != null && _companyType!.isNotEmpty) ||
      _maxMoq != null ||
      (_exportCountry != null && _exportCountry!.isNotEmpty) ||
      _minPrice != null ||
      _maxPrice != null ||
      _attributeFilters.values.any((v) => v.isNotEmpty);

  int get _activeFilterBadgeCount {
    var count = 0;
    if (_fasonOnly) count++;
    if (_privateLabelOnly) count++;
    if (_companyType != null && _companyType!.isNotEmpty) count++;
    if (_maxMoq != null) count++;
    if (_exportCountry != null && _exportCountry!.isNotEmpty) count++;
    if (_brandId != null || _brandSlug != null) count++;
    if (_minPrice != null || _maxPrice != null) count++;
    for (final list in _attributeFilters.values) {
      if (list.isNotEmpty) count += list.length;
    }
    return count;
  }

  Future<void> _fetchCatalog({required bool reset}) async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final effectiveSort = (!session.canViewPrices &&
            (_sortBy == CatalogSortOption.priceAsc ||
                _sortBy == CatalogSortOption.priceDesc))
        ? CatalogSortOption.newest
        : _sortBy;

    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _hasMore = true;
      });
    } else {
      if (_loadingMore || !_hasMore) return;
      setState(() => _loadingMore = true);
    }

    final offset = reset ? 0 : _products.length;
    final filter = CatalogFilterParams(
      query: _query.trim().isNotEmpty ? _query.trim() : null,
      categoryId:
          (_categoryId != null && _categoryId!.isNotEmpty) ? _categoryId : null,
      brandId: (_brandId != null && _brandId!.isNotEmpty) ? _brandId : null,
      brandSlug:
          (_brandSlug != null && _brandSlug!.isNotEmpty) ? _brandSlug : null,
      sortBy: effectiveSort,
      fasonOnly: _fasonOnly,
      privateLabelOnly: _privateLabelOnly,
      companyType: _companyType,
      maxMoq: _maxMoq,
      exportCountry: _exportCountry,
      minPrice: session.canViewPrices ? _minPrice : null,
      maxPrice: session.canViewPrices ? _maxPrice : null,
      displayCurrency:
          session.canViewPrices ? (_displayCurrency ?? session.currencyCode) : null,
      attributeFilters: _attributeFilters,
    );

    try {
      final res = await session.api.searchCatalog(
        filter,
        limit: _pageSize,
        offset: offset,
        lang: lang,
      );
      if (!mounted) return;
      setState(() {
        if (reset) {
          _products = res.products;
        } else {
          final existingIds = _products.map((e) => e.id).toSet();
          _products = [
            ..._products,
            ...res.products.where((e) => !existingIds.contains(e.id)),
          ];
        }
        _total = res.total;
        _hasMore =
            res.products.length >= _pageSize && _products.length < res.total;
      });

      if (reset && (_query.trim().isNotEmpty || _hasActiveFilters)) {
        session.telemetry.trackSearchEvent(
          queryText: _query.trim(),
          eventType: 'search_result',
          categorySlug: _categoryId ?? '',
          resultsCount: res.total,
          hasFilters: _hasActiveFilters,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _clearAllFilters() {
    _searchCtrl.clear();
    setState(() {
      _query = '';
      _categoryId = null;
      _brandId = null;
      _brandSlug = null;
      _sortBy = CatalogSortOption.newest;
      _fasonOnly = false;
      _privateLabelOnly = false;
      _companyType = null;
      _maxMoq = null;
      _exportCountry = null;
      _minPrice = null;
      _maxPrice = null;
      _displayCurrency = null;
      _attributeFilters = <String, List<String>>{};
    });
    _fetchCatalog(reset: true);
  }

  String _sortLabel(String lang, CatalogSortOption opt) {
    switch (opt) {
      case CatalogSortOption.newest:
        return AppStrings.t(lang, 'sort_newest');
      case CatalogSortOption.priceAsc:
        return AppStrings.t(lang, 'sort_price_asc');
      case CatalogSortOption.priceDesc:
        return AppStrings.t(lang, 'sort_price_desc');
      case CatalogSortOption.nameAsc:
        return AppStrings.t(lang, 'sort_name_asc');
      case CatalogSortOption.nameDesc:
        return AppStrings.t(lang, 'sort_name_desc');
      case CatalogSortOption.skuAsc:
        return AppStrings.t(lang, 'sort_sku_asc');
      case CatalogSortOption.skuDesc:
        return AppStrings.t(lang, 'sort_sku_desc');
    }
  }

  Future<void> _openSortSheet() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final available = CatalogSortOption.values.where((opt) {
      if (!session.canViewPrices &&
          (opt == CatalogSortOption.priceAsc ||
              opt == CatalogSortOption.priceDesc)) {
        return false;
      }
      return true;
    }).toList();

    final picked = await showModalBottomSheet<CatalogSortOption>(
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
              const SizedBox(height: 12),
              Text(
                AppStrings.tUpper(lang, 'sort_newest'),
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                ),
              ),
              const Divider(height: 16),
              ...available.map((opt) {
                final selected = opt == _sortBy;
                return ListTile(
                  dense: true,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  title: Text(
                    _sortLabel(lang, opt),
                    style: TextStyle(
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                      color: AppColors.obsidian,
                    ),
                  ),
                  trailing: selected
                      ? const Icon(
                          Icons.check_rounded,
                          color: AppColors.obsidian,
                        )
                      : null,
                  onTap: () => Navigator.of(ctx).pop(opt),
                );
              }),
            ],
          ),
        ),
      ),
    );

    if (picked != null && picked != _sortBy && mounted) {
      setState(() => _sortBy = picked);
      await _fetchCatalog(reset: true);
    }
  }

  Future<void> _openFilterSheet() async {
    final session = context.read<SessionProvider>();
    if (_attributeGroups.isEmpty) {
      await _loadAttributeGroups();
      if (!mounted) return;
    }

    var fason = _fasonOnly;
    var privLabel = _privateLabelOnly;
    var compType = _companyType ?? '';
    var brandSlug = _brandSlug ?? '';
    var dispCurr = _displayCurrency ?? session.currencyCode;
    final maxMoqCtrl =
        TextEditingController(text: _maxMoq != null ? '$_maxMoq' : '');
    final countryCtrl = TextEditingController(text: _exportCountry ?? '');
    final minPriceCtrl =
        TextEditingController(text: _minPrice != null ? '$_minPrice' : '');
    final maxPriceCtrl =
        TextEditingController(text: _maxPrice != null ? '$_maxPrice' : '');
    final attrs = <String, List<String>>{
      for (final e in _attributeFilters.entries) e.key: [...e.value],
    };

    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final lang = session.languageCode;
          return SafeArea(
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.86,
              maxChildSize: 0.95,
              minChildSize: 0.5,
              builder: (context, scrollCtrl) => Padding(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(context).viewInsets.bottom,
                ),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 14, 14, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              AppStrings.tUpper(lang, 'filters'),
                              style: TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 15.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing:
                                    AppStrings.letterSpacing(lang, 1.0),
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setSheetState(() {
                                fason = false;
                                privLabel = false;
                                compType = '';
                                brandSlug = '';
                                maxMoqCtrl.clear();
                                countryCtrl.clear();
                                minPriceCtrl.clear();
                                maxPriceCtrl.clear();
                                attrs.clear();
                              });
                            },
                            child: Text(AppStrings.t(lang, 'clear_filters')),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(ctx).pop(false),
                            icon: const Icon(Icons.close_rounded, size: 20),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    Expanded(
                      child: ListView(
                        controller: scrollCtrl,
                        padding: const EdgeInsets.all(18),
                        children: [
                          // Production Capabilities
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              FilterChip(
                                selected: fason,
                                onSelected: (v) =>
                                    setSheetState(() => fason = v),
                                label: Text(AppStrings.t(lang, 'filter_fason')),
                                selectedColor: AppColors.obsidian,
                                labelStyle: TextStyle(
                                  color:
                                      fason ? Colors.white : AppColors.obsidian,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              FilterChip(
                                selected: privLabel,
                                onSelected: (v) =>
                                    setSheetState(() => privLabel = v),
                                label: Text(
                                  AppStrings.t(lang, 'filter_private_label'),
                                ),
                                selectedColor: AppColors.obsidian,
                                labelStyle: TextStyle(
                                  color: privLabel
                                      ? Colors.white
                                      : AppColors.obsidian,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // Company Type Dropdown
                          DropdownButtonFormField<String>(
                            initialValue: compType,
                            decoration: InputDecoration(
                              labelText:
                                  AppStrings.t(lang, 'filter_company_type'),
                            ),
                            items: [
                              DropdownMenuItem(
                                value: '',
                                child: Text(AppStrings.t(lang, 'all_btn')),
                              ),
                              DropdownMenuItem(
                                value: 'manufacturer',
                                child: Text(
                                  AppStrings.t(
                                    lang,
                                    'company_type_manufacturer',
                                  ),
                                ),
                              ),
                              DropdownMenuItem(
                                value: 'wholesaler',
                                child: Text(
                                  AppStrings.t(lang, 'company_type_wholesaler'),
                                ),
                              ),
                              DropdownMenuItem(
                                value: 'both',
                                child: Text(
                                  AppStrings.t(lang, 'company_type_both'),
                                ),
                              ),
                            ],
                            onChanged: (v) =>
                                setSheetState(() => compType = v ?? ''),
                          ),
                          const SizedBox(height: 12),

                          // Brand Slug Dropdown
                          if (session.brands.isNotEmpty) ...[
                            DropdownButtonFormField<String>(
                              initialValue: session.brands
                                      .any((b) => b.slug == brandSlug)
                                  ? brandSlug
                                  : '',
                              isExpanded: true,
                              decoration: InputDecoration(
                                labelText: AppStrings.t(lang, 'brands'),
                              ),
                              items: [
                                DropdownMenuItem(
                                  value: '',
                                  child: Text(AppStrings.t(lang, 'all_btn')),
                                ),
                                ...session.brands.map(
                                  (b) => DropdownMenuItem(
                                    value: b.slug,
                                    child: Text(
                                      b.maskedDisplayName,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                              onChanged: (v) =>
                                  setSheetState(() => brandSlug = v ?? ''),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Max MOQ & Export Country
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: maxMoqCtrl,
                                  keyboardType: TextInputType.number,
                                  decoration: InputDecoration(
                                    labelText:
                                        AppStrings.t(lang, 'filter_max_moq'),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: countryCtrl,
                                  decoration: InputDecoration(
                                    labelText: AppStrings.t(
                                      lang,
                                      'filter_export_country',
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),

                          // Price Range & Display Currency (Gated by canViewPrices!)
                          if (session.canViewPrices) ...[
                            const SizedBox(height: 14),
                            Text(
                              AppStrings.tUpper(lang, 'filter_price_range'),
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.editorialGold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: minPriceCtrl,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                    decoration: const InputDecoration(
                                      labelText: 'Min',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: maxPriceCtrl,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                    decoration: const InputDecoration(
                                      labelText: 'Max',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                SizedBox(
                                  width: 88,
                                  child: DropdownButtonFormField<String>(
                                    initialValue: dispCurr,
                                    decoration: InputDecoration(
                                      labelText: AppStrings.t(lang, 'currency'),
                                    ),
                                    items: const [
                                      DropdownMenuItem(
                                        value: 'TRY',
                                        child: Text('TRY'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'USD',
                                        child: Text('USD'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'EUR',
                                        child: Text('EUR'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'GBP',
                                        child: Text('GBP'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'RUB',
                                        child: Text('RUB'),
                                      ),
                                    ],
                                    onChanged: (v) => setSheetState(
                                      () => dispCurr =
                                          v ?? session.currencyCode,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],

                          // Dynamic Store Attributes
                          if (_attributeGroups.isNotEmpty) ...[
                            const SizedBox(height: 18),
                            Text(
                              AppStrings.tUpper(lang, 'filter_attributes'),
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.editorialGold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ..._attributeGroups.map((group) {
                              final selectedVals =
                                  attrs[group.name] ?? <String>[];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      group.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 12.5,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: group.values.map((val) {
                                        final isSel =
                                            selectedVals.contains(val);
                                        return FilterChip(
                                          selected: isSel,
                                          onSelected: (checked) {
                                            setSheetState(() {
                                              final list = <String>[
                                                ...(attrs[group.name] ??
                                                    <String>[]),
                                              ];
                                              if (checked) {
                                                if (!list.contains(val)) {
                                                  list.add(val);
                                                }
                                              } else {
                                                list.remove(val);
                                              }
                                              if (list.isEmpty) {
                                                attrs.remove(group.name);
                                              } else {
                                                attrs[group.name] = list;
                                              }
                                            });
                                          },
                                          label: Text(val),
                                          selectedColor: AppColors.obsidian,
                                          labelStyle: TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w600,
                                            color: isSel
                                                ? Colors.white
                                                : AppColors.obsidian,
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
                      child: SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(ctx).pop(true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.obsidian,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusMd),
                            ),
                          ),
                          child: Text(
                            AppStrings.tUpper(lang, 'apply_filters'),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing:
                                  AppStrings.letterSpacing(lang, 0.9),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );

    if (applied == true && mounted) {
      setState(() {
        _fasonOnly = fason;
        _privateLabelOnly = privLabel;
        _companyType = compType.isNotEmpty ? compType : null;
        _brandSlug = brandSlug.isNotEmpty ? brandSlug : null;
        if (brandSlug.isNotEmpty) _brandId = null;
        _maxMoq = int.tryParse(maxMoqCtrl.text.trim());
        _exportCountry = countryCtrl.text.trim().isNotEmpty
            ? countryCtrl.text.trim()
            : null;
        _minPrice = double.tryParse(
          minPriceCtrl.text.trim().replaceAll(',', '.'),
        );
        _maxPrice = double.tryParse(
          maxPriceCtrl.text.trim().replaceAll(',', '.'),
        );
        _displayCurrency = dispCurr;
        _attributeFilters = attrs;
      });
      await _fetchCatalog(reset: true);
    }

    maxMoqCtrl.dispose();
    countryCtrl.dispose();
    minPriceCtrl.dispose();
    maxPriceCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final screenWidth = MediaQuery.of(context).size.width;
    final columns = (screenWidth / 210).floor().clamp(2, 4);
    final effectiveSort = (!session.canViewPrices &&
            (_sortBy == CatalogSortOption.priceAsc ||
                _sortBy == CatalogSortOption.priceDesc))
        ? CatalogSortOption.newest
        : _sortBy;

    return Column(
      children: [
        // 1. Search + Filter + Sort Strip
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onSubmitted: (v) {
                        _query = v;
                        _fetchCatalog(reset: true);
                      },
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: AppStrings.t(lang, 'search_hint'),
                        prefixIcon:
                            const Icon(Icons.search_rounded, size: 19),
                        suffixIcon: _searchCtrl.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded, size: 18),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  _query = '';
                                  _fetchCatalog(reset: true);
                                },
                              )
                            : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Filters Button
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: _openFilterSheet,
                    child: Container(
                      height: 46,
                      padding: const EdgeInsets.symmetric(horizontal: 11),
                      decoration: BoxDecoration(
                        color: _activeFilterBadgeCount > 0
                            ? AppColors.obsidian
                            : AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(
                          color: _activeFilterBadgeCount > 0
                              ? AppColors.obsidian
                              : AppColors.cultured,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          LuxuryIcon(
                            kind: LuxuryIconKind.filter,
                            size: 16,
                            color: _activeFilterBadgeCount > 0
                                ? Colors.white
                                : AppColors.obsidian,
                          ),
                          if (_activeFilterBadgeCount > 0) ...[
                            const SizedBox(width: 5),
                            Text(
                              '$_activeFilterBadgeCount',
                              style: const TextStyle(
                                color: AppColors.champagneGold,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  // Sort Button
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    onTap: _openSortSheet,
                    child: Container(
                      height: 46,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: AppColors.editorialOffWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.swap_vert_rounded,
                            size: 18,
                            color: AppColors.obsidian,
                          ),
                          const SizedBox(width: 4),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 74),
                            child: Text(
                              _sortLabel(lang, effectiveSort),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (session.categories.isNotEmpty) ...[
                const SizedBox(height: 9),
                SizedBox(
                  height: 34,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _CategoryQuickChip(
                        label: AppStrings.t(lang, 'all_btn'),
                        selected:
                            _categoryId == null || _categoryId!.isEmpty,
                        onTap: () {
                          setState(() => _categoryId = null);
                          _fetchCatalog(reset: true);
                        },
                      ),
                      ...session.categories.map(
                        (c) => Padding(
                          padding: const EdgeInsets.only(left: 7),
                          child: _CategoryQuickChip(
                            label: c.displayTitle(lang),
                            selected: _categoryId == c.id,
                            onTap: () {
                              setState(() => _categoryId = c.id);
                              _fetchCatalog(reset: true);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const Divider(height: 1),

        // 2. Results Count Strip
        if (!_loading && _products.isNotEmpty)
          Container(
            width: double.infinity,
            color: AppColors.warmIvory,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '$_total ${AppStrings.t(lang, 'nav_products')}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                ),
                if (_hasActiveFilters || _query.isNotEmpty)
                  InkWell(
                    onTap: _clearAllFilters,
                    child: Text(
                      AppStrings.t(lang, 'clear_filters'),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
              ],
            ),
          ),

        // 3. Infinite Scroll Grid
        Expanded(
          child: _loading && _products.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.obsidian,
                  ),
                )
              : _error != null && _products.isEmpty
                  ? EditorialEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: AppStrings.t(lang, 'error'),
                      subtitle: _error!,
                      actionLabel: AppStrings.t(lang, 'retry'),
                      onAction: () => _fetchCatalog(reset: true),
                    )
                  : _products.isEmpty
                      ? EditorialEmptyState(
                          icon: Icons.inventory_2_outlined,
                          title: AppStrings.t(lang, 'no_results'),
                          subtitle: AppStrings.t(lang, 'clear_filters'),
                          actionLabel: AppStrings.t(lang, 'clear_filters'),
                          onAction: _clearAllFilters,
                        )
                      : RefreshIndicator(
                          color: AppColors.obsidian,
                          onRefresh: () => _fetchCatalog(reset: true),
                          child: CustomScrollView(
                            controller: _scrollCtrl,
                            slivers: [
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(
                                  10,
                                  10,
                                  10,
                                  18,
                                ),
                                sliver: SliverGrid(
                                  gridDelegate:
                                      SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: columns,
                                    mainAxisSpacing: 12,
                                    crossAxisSpacing: 10,
                                    childAspectRatio: 0.54,
                                  ),
                                  delegate: SliverChildBuilderDelegate(
                                    (context, index) {
                                      final p = _products[index];
                                      return B2BProductCard(
                                        product: p,
                                        onTap: () {
                                          if (_query.trim().isNotEmpty) {
                                            session.telemetry.trackSearchEvent(
                                              queryText: _query.trim(),
                                              eventType: 'search_click',
                                              clickedProductId: p.id,
                                              resultsCount: _total,
                                              hasFilters: _hasActiveFilters,
                                            );
                                          }
                                          Navigator.of(context).push(
                                            MaterialPageRoute<void>(
                                              builder: (_) =>
                                                  ProductDetailScreen(
                                                productId: p.id,
                                              ),
                                            ),
                                          );
                                        },
                                      );
                                    },
                                    childCount: _products.length,
                                  ),
                                ),
                              ),
                              if (_loadingMore)
                                const SliverToBoxAdapter(
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(vertical: 18),
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
        ),
      ],
    );
  }
}

class _CategoryQuickChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryQuickChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.obsidian : Colors.white,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            border: Border.all(
              color: selected ? AppColors.obsidian : AppColors.cultured,
            ),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : AppColors.obsidian,
            ),
          ),
        ),
      ),
    );
  }
}
