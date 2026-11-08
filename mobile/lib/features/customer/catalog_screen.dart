import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import '../../widgets/product_card.dart';
import 'product_detail_screen.dart';

class CustomerCatalogScreen extends StatefulWidget {
  final String initialCategoryId;
  final String initialBrandId;
  final String initialQuery;

  const CustomerCatalogScreen({
    super.key,
    this.initialCategoryId = '',
    this.initialBrandId = '',
    this.initialQuery = '',
  });

  @override
  State<CustomerCatalogScreen> createState() => _CustomerCatalogScreenState();
}

class _CustomerCatalogScreenState extends State<CustomerCatalogScreen> {
  late final TextEditingController _searchCtrl;
  final ScrollController _scrollCtrl = ScrollController();

  String _categoryId = '';
  String _brandId = '';
  String _gender = '';
  String _sortBy = 'newest';
  bool _singleColumn = false;

  List<Product> _products = <Product>[];
  int _total = 0;
  bool _loading = false;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.initialCategoryId;
    _brandId = widget.initialBrandId;
    _searchCtrl = TextEditingController(text: widget.initialQuery);
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _fetch(reset: true));
  }

  @override
  void didUpdateWidget(covariant CustomerCatalogScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialCategoryId != widget.initialCategoryId ||
        oldWidget.initialBrandId != widget.initialBrandId ||
        oldWidget.initialQuery != widget.initialQuery) {
      _categoryId = widget.initialCategoryId;
      _brandId = widget.initialBrandId;
      _searchCtrl.text = widget.initialQuery;
      _fetch(reset: true);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  int get _activeFilterCount =>
      (_categoryId.isNotEmpty ? 1 : 0) +
      (_brandId.isNotEmpty ? 1 : 0) +
      (_gender.isNotEmpty ? 1 : 0) +
      (_sortBy != 'newest' ? 1 : 0);

  String _sortShortLabel(String sort) {
    switch (sort) {
      case 'price_asc':
        return 'FİYAT: ARTAN';
      case 'price_desc':
        return 'FİYAT: AZALAN';
      case 'name_asc':
        return 'İSİM: A-Z';
      default:
        return 'EN YENİLER';
    }
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 320 &&
        !_loading &&
        !_loadingMore &&
        _products.length < _total) {
      _fetch(reset: false);
    }
  }

  Future<void> _fetch({required bool reset}) async {
    if (!mounted) return;
    setState(() {
      if (reset) {
        _loading = true;
      } else {
        _loadingMore = true;
      }
    });

    try {
      final api = context.read<SessionProvider>().api;
      final res = await api.searchProducts(
        query: _searchCtrl.text,
        categoryId: _categoryId,
        brandId: _brandId,
        gender: _gender,
        sortBy: _sortBy,
        limit: 24,
        offset: reset ? 0 : _products.length,
      );
      if (!mounted) return;
      setState(() {
        _total = res.total;
        _products = reset ? res.products : [..._products, ...res.products];
      });
    } catch (_) {
      // Keep current list on offline error
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _openFilterSheet() {
    final session = context.read<SessionProvider>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'FİLTRE & SIRALAMA',
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.8,
                            color: AppColors.obsidian,
                          ),
                        ),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () {
                                setModalState(() {
                                  _categoryId = '';
                                  _brandId = '';
                                  _gender = '';
                                  _sortBy = 'newest';
                                });
                              },
                              child: const Text(
                                'SIFIRLA',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.0,
                                  color: AppColors.editorialGold,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(ctx),
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Icons.close_rounded, size: 19),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Divider(height: 18),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: _sortBy,
                      decoration: const InputDecoration(labelText: 'Sıralama'),
                      items: const [
                        DropdownMenuItem(
                          value: 'newest',
                          child: Text('En Yeni Eklenenler'),
                        ),
                        DropdownMenuItem(
                          value: 'price_asc',
                          child: Text('Birim Fiyat: Artan'),
                        ),
                        DropdownMenuItem(
                          value: 'price_desc',
                          child: Text('Birim Fiyat: Azalan'),
                        ),
                        DropdownMenuItem(
                          value: 'name_asc',
                          child: Text('İsme Göre (A-Z)'),
                        ),
                      ],
                      onChanged: (v) =>
                          setModalState(() => _sortBy = v ?? 'newest'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _categoryId,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Kategori'),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Tüm Kategoriler'),
                        ),
                        ...session.categories.map(
                          (c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(
                              c.displayTitle(session.languageCode),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ],
                      onChanged: (v) =>
                          setModalState(() => _categoryId = v ?? ''),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _brandId,
                      isExpanded: true,
                      decoration:
                          const InputDecoration(labelText: 'Üretici Vitrini'),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Tüm Üreticiler'),
                        ),
                        ...session.brands.map(
                          (b) => DropdownMenuItem(
                            value: b.id,
                            child: Text(b.maskedDisplayName),
                          ),
                        ),
                      ],
                      onChanged: (v) => setModalState(() => _brandId = v ?? ''),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration:
                          const InputDecoration(labelText: 'Koleksiyon Grubu'),
                      items: const [
                        DropdownMenuItem(value: '', child: Text('Tümü')),
                        DropdownMenuItem(value: 'Kadın', child: Text('Kadın')),
                        DropdownMenuItem(value: 'Erkek', child: Text('Erkek')),
                        DropdownMenuItem(
                          value: 'Unisex',
                          child: Text('Unisex'),
                        ),
                      ],
                      onChanged: (v) => setModalState(() => _gender = v ?? ''),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          setState(() {});
                          _fetch(reset: true);
                        },
                        child: const Text(
                          'SONUÇLARI UYGULA',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.5,
                          ),
                        ),
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
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final filterCount = _activeFilterCount;

    return Column(
      children: [
        // 1. Editorial Search & Filter Command Bar
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.editorialOffWhite,
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        children: [
                          const LuxuryIcon(
                            kind: LuxuryIconKind.search,
                            size: 15.5,
                            color: AppColors.sonicSilver,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _searchCtrl,
                              textInputAction: TextInputAction.search,
                              onChanged: (_) => setState(() {}),
                              onSubmitted: (_) => _fetch(reset: true),
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.obsidian,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'Model, SKU veya kumaş ara...',
                                hintStyle: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.spanishGray,
                                ),
                                filled: false,
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                isDense: true,
                                contentPadding:
                                    EdgeInsets.symmetric(vertical: 9),
                              ),
                            ),
                          ),
                          if (_searchCtrl.text.isNotEmpty)
                            InkWell(
                              onTap: () {
                                _searchCtrl.clear();
                                setState(() {});
                                _fetch(reset: true);
                              },
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: AppColors.sonicSilver,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: _openFilterSheet,
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      color: AppColors.obsidian,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const LuxuryIcon(
                            kind: LuxuryIconKind.filter,
                            size: 15,
                            color: Colors.white,
                            accentColor: AppColors.champagneGold,
                          ),
                          const SizedBox(width: 7),
                          const Text(
                            'FİLTRE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.1,
                            ),
                          ),
                          if (filterCount > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 1.5,
                              ),
                              color: AppColors.champagneGold,
                              child: Text(
                                '$filterCount',
                                style: const TextStyle(
                                  color: AppColors.obsidian,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (session.categories.isNotEmpty) ...[
                const SizedBox(height: 10),
                SizedBox(
                  height: 31,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _CategoryQuickChip(
                        label: 'TÜMÜ',
                        selected: _categoryId.isEmpty,
                        onTap: () {
                          setState(() => _categoryId = '');
                          _fetch(reset: true);
                        },
                      ),
                      for (final cat in session.categories) ...[
                        const SizedBox(width: 7),
                        _CategoryQuickChip(
                          label: AppStrings.upper(
                            cat.displayTitle(lang),
                            lang,
                          ),
                          selected: _categoryId == cat.id,
                          onTap: () {
                            setState(() => _categoryId = cat.id);
                            _fetch(reset: true);
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),

        // 2. Editorial Count, View Mode Switcher & Sort Bar
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: const BoxDecoration(
            color: AppColors.editorialOffWhite,
            border: Border(
              top: BorderSide(color: AppColors.cultured),
              bottom: BorderSide(color: AppColors.cultured),
            ),
          ),
          child: Row(
            children: [
              Text(
                '$_total MODEL',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: AppColors.sonicSilver,
                ),
              ),
              const Spacer(),
              // 1-Col / 2-Col View Switcher
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: AppColors.cultured),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () => setState(() => _singleColumn = false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        color: !_singleColumn
                            ? AppColors.obsidian
                            : Colors.transparent,
                        child: Icon(
                          Icons.grid_view_sharp,
                          size: 13.5,
                          color: !_singleColumn
                              ? Colors.white
                              : AppColors.sonicSilver,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => setState(() => _singleColumn = true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        color: _singleColumn
                            ? AppColors.obsidian
                            : Colors.transparent,
                        child: Icon(
                          Icons.crop_portrait_sharp,
                          size: 13.5,
                          color: _singleColumn
                              ? Colors.white
                              : AppColors.sonicSilver,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              InkWell(
                onTap: _openFilterSheet,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _sortShortLabel(_sortBy),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.9,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 14,
                      color: AppColors.editorialGold,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // 3. Product Grid
        Expanded(
          child: RefreshIndicator(
            color: AppColors.obsidian,
            onRefresh: () => _fetch(reset: true),
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.obsidian,
                    ),
                  )
                : _products.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 96),
                          Center(
                            child: LuxuryIcon(
                              kind: LuxuryIconKind.collection,
                              size: 40,
                              color: AppColors.spanishGray,
                              accentColor: AppColors.champagneGold,
                            ),
                          ),
                          SizedBox(height: 14),
                          Center(
                            child: Text(
                              'KOLEKSİYON SONUCU BULUNAMADI',
                              style: TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.4,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          SizedBox(height: 6),
                          Center(
                            child: Text(
                              'Filtreleri temizleyerek tüm modelleri inceleyebilirsiniz.',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.sonicSilver,
                              ),
                            ),
                          ),
                        ],
                      )
                    : GridView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.fromLTRB(6, 8, 6, 28),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: _singleColumn
                              ? 1
                              : (MediaQuery.sizeOf(context).width / 210)
                                  .floor()
                                  .clamp(2, 4),
                          mainAxisSpacing: 18,
                          crossAxisSpacing: 6,
                          childAspectRatio: _singleColumn ? 0.64 : 0.54,
                        ),
                        itemCount: _products.length,
                        itemBuilder: (context, index) {
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
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.obsidian : Colors.white,
          border: Border.all(
            color: selected ? AppColors.obsidian : AppColors.cultured,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9.8,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.9,
            color: selected ? Colors.white : AppColors.onyx,
          ),
        ),
      ),
    );
  }
}
