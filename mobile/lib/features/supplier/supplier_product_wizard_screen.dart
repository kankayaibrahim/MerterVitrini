import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import 'camera_studio_screen.dart';
import 'wizard/wizard_model_details_card.dart';
import 'wizard/wizard_models.dart';
import 'wizard/wizard_photo_studio_card.dart';
import 'wizard/wizard_pricing_series_card.dart';
import 'wizard/wizard_translations_card.dart';
import 'wizard/wizard_variants_matrix_card.dart';

class SupplierProductWizardScreen extends StatefulWidget {
  final Product? existingProduct;
  final bool autoOpenCamera;

  const SupplierProductWizardScreen({
    super.key,
    this.existingProduct,
    this.autoOpenCamera = false,
  });

  @override
  State<SupplierProductWizardScreen> createState() =>
      _SupplierProductWizardScreenState();
}

class _SupplierProductWizardScreenState
    extends State<SupplierProductWizardScreen> {
  final ImagePicker _galleryPicker = ImagePicker();

  final _titleCtrl = TextEditingController();
  final _shortDescCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _buyingPriceCtrl = TextEditingController();
  final _minOrderCtrl = TextEditingController(text: '1');
  final _seriesStockCtrl = TextEditingController(
    text: '${SeriesStockDistributor.defaultSeriesStock}',
  );

  final List<WizardPhotoItem> _photos = <WizardPhotoItem>[];
  List<String> _selectedSizes = <String>['S', 'M', 'L', 'XL'];
  String _seriesRatio = '1-1-1-1';

  final Map<String, EditableTranslationLanguageSet> _translations = {
    'en': EditableTranslationLanguageSet(),
    'ru': EditableTranslationLanguageSet(),
    'ar': EditableTranslationLanguageSet(),
  };

  String _selectedCategoryId = '';
  String _selectedCategoryLabel = '';
  String? _selectedColorId;
  String _selectedColorLabel = '';
  String? _selectedFabricId;
  String _selectedFabricLabel = '';
  String _gender = 'Kadın';
  String _season = '2026 İlkbahar/Yaz';
  String _currency = 'TRY';
  bool _isActive = true;

  bool _loadingDetail = false;
  bool _saving = false;
  bool _autoTranslating = false;
  String _saveStageLabel = '';

  @override
  void initState() {
    super.initState();
    if (widget.existingProduct != null) {
      _applyProductToForm(widget.existingProduct!);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final supProv = context.read<SupplierProvider>();
      await supProv.ensureCatalogFormMetadataLoaded();
      if (!mounted) return;

      if (widget.existingProduct == null &&
          _selectedCategoryId.isEmpty &&
          supProv.categories.isNotEmpty) {
        setState(() {
          _selectedCategoryId = supProv.categories.first.id;
          _selectedCategoryLabel = supProv.categories.first.name;
        });
      }

      if (widget.existingProduct != null) {
        await _loadFullExistingProduct(widget.existingProduct!.id);
      } else if (widget.autoOpenCamera) {
        await _openCameraStudio();
      }
      _syncOptionLabelsFromMetadata();
    });
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _shortDescCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _buyingPriceCtrl.dispose();
    _minOrderCtrl.dispose();
    _seriesStockCtrl.dispose();
    for (final t in _translations.values) {
      t.dispose();
    }
    super.dispose();
  }

  String _normalizeKnownSize(String raw, Set<String> knownCodes) {
    final trimmed = raw.trim().toUpperCase();
    if (trimmed == 'STANDART' ||
        trimmed == 'STANDART (STD)' ||
        trimmed == 'TEK BEDEN') {
      return 'STD';
    }
    if (trimmed == 'XXL') return '2XL';
    if (trimmed == 'XXXL') return '3XL';
    for (final code in knownCodes) {
      if (code.toUpperCase() == trimmed) {
        return code;
      }
    }
    return '';
  }

  void _applyProductToForm(Product p) {
    _titleCtrl.text = p.title;
    _shortDescCtrl.text = p.shortDescription;
    _descCtrl.text = p.description;
    _priceCtrl.text = p.price > 0 ? p.price.toStringAsFixed(2) : '';
    _buyingPriceCtrl.text =
        p.buyingPrice > 0 ? p.buyingPrice.toStringAsFixed(2) : '';
    _minOrderCtrl.text = '${p.minOrderPackages}';
    _seriesStockCtrl.text = '${p.seriesStock}';
    _selectedCategoryId = p.categoryId;
    _selectedCategoryLabel = p.categoryTitle;
    _selectedColorId =
        (p.colorId != null && p.colorId!.isNotEmpty) ? p.colorId : null;
    _selectedColorLabel = p.color;
    _selectedFabricId =
        (p.fabricId != null && p.fabricId!.isNotEmpty) ? p.fabricId : null;
    _selectedFabricLabel = p.fabric;
    if (p.gender.isNotEmpty) _gender = p.gender;
    if (p.season.isNotEmpty) _season = p.season;
    if (p.currency.isNotEmpty) _currency = p.currency.toUpperCase();
    _isActive = p.isActive;

    _photos.clear();
    for (final img in p.images) {
      if (img.imageUrl.isNotEmpty) {
        _photos.add(WizardPhotoItem.remote(img.imageUrl));
      }
    }

    final supDefs = mounted
        ? context.read<SupplierProvider>().sizeDefinitions
        : const <SizeDefinitionOption>[];
    final defs = supDefs.isNotEmpty
        ? supDefs
        : SeriesStockDistributor.fallbackSizeDefinitions;
    final knownCodes = defs.map((d) => d.code).toSet();
    final extracted = <String>[];

    for (final v in p.variants) {
      final code = _normalizeKnownSize(v.size, knownCodes);
      if (code.isNotEmpty && !extracted.contains(code)) {
        extracted.add(code);
      }
    }
    if (extracted.isEmpty && p.packingRatio.isNotEmpty) {
      for (final token in p.packingRatio.split(',')) {
        final code = _normalizeKnownSize(token, knownCodes);
        if (code.isNotEmpty && !extracted.contains(code)) {
          extracted.add(code);
        }
      }
    }

    _selectedSizes = extracted.isNotEmpty
        ? SeriesStockDistributor.sortSelectedSizes(extracted, defs)
        : <String>['S', 'M', 'L', 'XL'];

    final parsedWeights =
        SeriesStockDistributor.parseRatioWeights(p.seriesRatio);
    if (parsedWeights.length == _selectedSizes.length) {
      _seriesRatio = parsedWeights.join('-');
    } else {
      _seriesRatio = SeriesStockDistributor.buildRatioForAssortment(
        _selectedSizes.length,
        'single',
      );
    }

    for (final lang in ['en', 'ru', 'ar']) {
      final t = p.translations[lang];
      final set = _translations[lang];
      if (set != null && t != null) {
        set.titleCtrl.text = t.title;
        set.shortDescCtrl.text = t.shortDescription;
        set.descCtrl.text = t.description;
      }
    }
  }

  Future<void> _autoTranslateFromTurkish() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      _showSnack('Lütfen önce Türkçe ürün başlığını giriniz.', isError: true);
      return;
    }
    setState(() => _autoTranslating = true);
    try {
      final result = await context
          .read<SupplierProvider>()
          .catalogRepo
          .autoTranslateSupplierFields({
        'title': title,
        'short_description': _shortDescCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
      });
      if (!mounted) return;
      setState(() {
        for (final lang in ['en', 'ru', 'ar']) {
          final map = result[lang];
          final set = _translations[lang];
          if (map != null && set != null) {
            if ((map['title'] ?? '').isNotEmpty) {
              set.titleCtrl.text = map['title']!;
            }
            if ((map['short_description'] ?? '').isNotEmpty) {
              set.shortDescCtrl.text = map['short_description']!;
            }
            if ((map['description'] ?? '').isNotEmpty) {
              set.descCtrl.text = map['description']!;
            }
          }
        }
      });
      _showSnack('EN, RU ve AR çeviriler otomatik oluşturuldu.');
    } catch (e) {
      _showSnack('Otomatik çeviri başarısız: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _autoTranslating = false);
      }
    }
  }

  Future<void> _loadFullExistingProduct(String productId) async {
    setState(() => _loadingDetail = true);
    try {
      final full = await context
          .read<SupplierProvider>()
          .catalogRepo
          .fetchSupplierProductDetail(productId);
      if (!mounted) return;
      setState(() => _applyProductToForm(full));
      _syncOptionLabelsFromMetadata();
    } catch (_) {
      // Keep partial product values if detail fetch fails
    } finally {
      if (mounted) {
        setState(() => _loadingDetail = false);
      }
    }
  }

  void _syncOptionLabelsFromMetadata() {
    if (!mounted) return;
    final sup = context.read<SupplierProvider>();
    setState(() {
      if (_selectedCategoryId.isNotEmpty) {
        for (final c in sup.categories) {
          if (c.id == _selectedCategoryId) {
            _selectedCategoryLabel = c.name;
            break;
          }
        }
      }
      if (_selectedColorId != null) {
        for (final c in sup.colors) {
          if (c.id == _selectedColorId) {
            _selectedColorLabel = c.name;
            break;
          }
        }
      }
      if (_selectedFabricId != null) {
        for (final f in sup.fabrics) {
          if (f.id == _selectedFabricId) {
            _selectedFabricLabel = f.name;
            break;
          }
        }
      }
    });
  }

  Future<void> _openCameraStudio() async {
    final remaining = 10 - _photos.length;
    if (remaining <= 0) {
      _showSnack('En fazla 10 ürün fotoğrafı ekleyebilirsiniz.', isError: true);
      return;
    }

    final captured = await Navigator.of(context).push<List<String>>(
      MaterialPageRoute<List<String>>(
        builder: (_) => CameraStudioScreen(
          allowMultiple: true,
          maxPhotos: remaining,
        ),
      ),
    );

    if (captured != null && captured.isNotEmpty && mounted) {
      setState(() {
        for (final path in captured) {
          if (_photos.length < 10) {
            _photos.add(WizardPhotoItem.local(path));
          }
        }
      });
    }
  }

  Future<void> _pickFromGallery() async {
    final remaining = 10 - _photos.length;
    if (remaining <= 0) {
      _showSnack('En fazla 10 ürün fotoğrafı ekleyebilirsiniz.', isError: true);
      return;
    }

    try {
      final files = await _galleryPicker.pickMultiImage(
        imageQuality: 88,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (files.isNotEmpty && mounted) {
        setState(() {
          for (final xf in files) {
            if (_photos.length < 10) {
              _photos.add(WizardPhotoItem.local(xf.path));
            }
          }
        });
      }
    } catch (e) {
      _showSnack('Galeri seçimi başarısız: $e', isError: true);
    }
  }

  void _makeCoverPhoto(int index) {
    if (index <= 0 || index >= _photos.length) return;
    setState(() {
      final chosen = _photos.removeAt(index);
      _photos.insert(0, chosen);
    });
  }

  void _toggleSelectedSize(String code, List<SizeDefinitionOption> defs) {
    setState(() {
      final exists = _selectedSizes.contains(code);
      if (exists && _selectedSizes.length <= 1) {
        return;
      }
      final currentMode = SeriesStockDistributor.detectAssortmentMode(
        _seriesRatio,
        _selectedSizes.length,
      );
      final updated = List<String>.of(_selectedSizes);
      if (exists) {
        updated.remove(code);
      } else {
        updated.add(code);
      }
      _selectedSizes = SeriesStockDistributor.sortSelectedSizes(updated, defs);
      _seriesRatio = SeriesStockDistributor.buildRatioForAssortment(
        _selectedSizes.length,
        currentMode,
      );
    });
  }

  void _applySeriesTemplate(SeriesTemplateOption tpl) {
    setState(() {
      _selectedSizes = List<String>.of(tpl.sizes);
      _seriesRatio = tpl.seriesRatio;
    });
  }

  void _changeAssortmentMode(String mode) {
    setState(() {
      _seriesRatio = SeriesStockDistributor.buildRatioForAssortment(
        _selectedSizes.length,
        mode,
      );
    });
  }

  List<SimpleOptionItem> _effectiveCategoryOptions(
    SupplierProvider supProv,
    SessionProvider session,
  ) {
    if (supProv.categories.isNotEmpty) {
      return supProv.categories;
    }
    final flattened = <SimpleOptionItem>[];
    void walk(CategoryNode node, String prefix) {
      final label = prefix.isEmpty ? node.title : '$prefix > ${node.title}';
      flattened.add(SimpleOptionItem(id: node.id, name: label));
      for (final child in node.children) {
        walk(child, label);
      }
    }

    for (final root in session.categories) {
      walk(root, '');
    }
    return flattened;
  }

  Future<void> _submitProduct() async {
    final title = _titleCtrl.text.trim();
    final unitPrice =
        double.tryParse(_priceCtrl.text.replaceAll(',', '.').trim()) ?? 0.0;
    final buyingPrice =
        double.tryParse(_buyingPriceCtrl.text.replaceAll(',', '.').trim()) ??
            0.0;
    final minOrderSeries = int.tryParse(_minOrderCtrl.text.trim()) ?? 1;
    final rawSeriesStock = int.tryParse(_seriesStockCtrl.text.trim()) ??
        SeriesStockDistributor.defaultSeriesStock;
    final safeSeriesStock = rawSeriesStock <= 0
        ? SeriesStockDistributor.defaultSeriesStock
        : rawSeriesStock;

    if (_photos.isEmpty) {
      _showSnack(
        'Lütfen kameradan çekerek veya galeriden en az 1 ürün fotoğrafı ekleyiniz.',
        isError: true,
      );
      return;
    }
    if (title.isEmpty) {
      _showSnack('Lütfen ürün model adını giriniz.', isError: true);
      return;
    }
    if (_selectedCategoryId.isEmpty) {
      _showSnack('Lütfen ürün kategorisini seçiniz.', isError: true);
      return;
    }
    if (unitPrice <= 0) {
      _showSnack(
        'Lütfen geçerli bir toptan birim satış fiyatı giriniz.',
        isError: true,
      );
      return;
    }
    if (_selectedSizes.isEmpty) {
      _showSnack(
        'Lütfen beden tanım tablosundan en az 1 beden seçiniz.',
        isError: true,
      );
      return;
    }

    setState(() {
      _saving = true;
      _saveStageLabel = 'Fotoğraflar optimize edilip yükleniyor...';
    });

    try {
      final session = context.read<SessionProvider>();
      final supProv = context.read<SupplierProvider>();
      final catalogRepo = supProv.catalogRepo;

      final localPathsToUpload = _photos
          .where((item) => !item.isRemote && (item.localPath ?? '').isNotEmpty)
          .map((item) => item.localPath!)
          .toList();

      List<String> uploadedUrls = const <String>[];
      if (localPathsToUpload.isNotEmpty) {
        uploadedUrls =
            await catalogRepo.uploadSupplierProductPhotos(localPathsToUpload);
        if (uploadedUrls.length != localPathsToUpload.length) {
          throw Exception('Bazı fotoğraflar sunucuya aktarılamadı.');
        }
      }

      final finalImageUrls = <String>[];
      var uploadCursor = 0;
      for (final item in _photos) {
        finalImageUrls.add(
          item.isRemote ? item.remoteUrl! : uploadedUrls[uploadCursor++],
        );
      }

      if (!mounted) return;
      setState(() {
        _saveStageLabel = 'Ürün ve seri stokları vitrine kaydediliyor...';
      });

      final variantStocks = SeriesStockDistributor.computeVariantStocks(
        variantCount: _selectedSizes.length,
        rawRatio: _seriesRatio,
        packageCount: safeSeriesStock,
      );
      final weights = SeriesStockDistributor.parseRatioWeights(_seriesRatio);
      final normalizedWeights = List<int>.generate(
        _selectedSizes.length,
        (idx) => idx < weights.length ? weights[idx] : 1,
      );
      final unitsPerSeries =
          normalizedWeights.fold<int>(0, (sum, val) => sum + val);
      final safeMinOrderSeries = minOrderSeries <= 0 ? 1 : minOrderSeries;

      final variantsJson = <Map<String, dynamic>>[
        for (var i = 0; i < _selectedSizes.length; i++)
          {
            'size': _selectedSizes[i],
            'barcode': '',
            'stock': variantStocks[i],
            'is_single': false,
          },
      ];

      final payload = <String, dynamic>{
        'title': title,
        'short_description': _shortDescCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'category_id': _selectedCategoryId,
        if (_selectedColorId != null && _selectedColorId!.isNotEmpty)
          'color_id': _selectedColorId,
        if (_selectedFabricId != null && _selectedFabricId!.isNotEmpty)
          'fabric_id': _selectedFabricId,
        'gender': _gender,
        'season': _season,
        'buying_price': buyingPrice,
        'price': unitPrice,
        'currency': _currency,
        'selected_sizes': _selectedSizes,
        'packing_ratio': _selectedSizes.join(','),
        'series_ratio': normalizedWeights.join('-'),
        'series_stock': safeSeriesStock,
        'min_order_series': safeMinOrderSeries,
        'minimum_order_quantity': safeMinOrderSeries * unitsPerSeries,
        'is_active': _isActive,
        'images': finalImageUrls,
        'variants': variantsJson,
        'translations': {
          for (final entry in _translations.entries)
            entry.key: {
              'title': entry.value.titleCtrl.text.trim(),
              'short_description': entry.value.shortDescCtrl.text.trim(),
              'description': entry.value.descCtrl.text.trim(),
            },
        },
      };

      if (widget.existingProduct != null) {
        await catalogRepo.updateSupplierProduct(
          widget.existingProduct!.id,
          payload,
        );
      } else {
        await catalogRepo.createSupplierProduct(payload);
      }

      await supProv.loadProducts();
      await supProv.loadDashboard();
      await session.loadBootstrap();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.existingProduct != null
                ? 'Ürün başarıyla güncellendi.'
                : 'Yeni ürün vitrinde yayına alındı!',
          ),
          backgroundColor: AppColors.emerald,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _saveStageLabel = '';
        });
      }
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : AppColors.navy,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final supProv = context.watch<SupplierProvider>();
    final categoryOptions = _effectiveCategoryOptions(supProv, session);
    final unitPricePreview =
        double.tryParse(_priceCtrl.text.replaceAll(',', '.').trim()) ?? 0.0;

    return Theme(
      data: AppTheme.light(isSupplierMode: true),
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.existingProduct != null
                ? 'Toptan Ürünü Düzenle'
                : 'Hızlı Toptan Ürün Ekle',
          ),
        ),
        body: _loadingDetail
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 32),
                children: [
                  WizardPhotoStudioCard(
                    photos: _photos,
                    saving: _saving,
                    onOpenCamera: _openCameraStudio,
                    onPickGallery: _pickFromGallery,
                    onMakeCover: _makeCoverPhoto,
                    onRemovePhoto: (idx) =>
                        setState(() => _photos.removeAt(idx)),
                  ),
                  const SizedBox(height: 12),
                  WizardModelDetailsCard(
                    titleCtrl: _titleCtrl,
                    priceCtrl: _priceCtrl,
                    categoryOptions: categoryOptions,
                    selectedCategoryLabel: _selectedCategoryLabel,
                    currency: _currency,
                    onCategoryPicked: (picked) {
                      setState(() {
                        _selectedCategoryId = picked.id;
                        _selectedCategoryLabel = picked.name;
                      });
                    },
                    onCurrencyChanged: (v) => setState(() => _currency = v),
                    onPriceEdited: () => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  WizardVariantsMatrixCard(
                    sizeDefinitions: supProv.sizeDefinitions,
                    seriesTemplates: supProv.seriesTemplates,
                    selectedSizes: _selectedSizes,
                    seriesRatio: _seriesRatio,
                    seriesStockCtrl: _seriesStockCtrl,
                    unitPrice: unitPricePreview,
                    currency: _currency,
                    onToggleSize: (code) =>
                        _toggleSelectedSize(code, supProv.sizeDefinitions),
                    onApplyTemplate: _applySeriesTemplate,
                    onAssortmentModeChanged: _changeAssortmentMode,
                    onSeriesStockPresetPicked: (cnt) {
                      setState(() => _seriesStockCtrl.text = '$cnt');
                    },
                    onSeriesStockEdited: () => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  WizardPricingSeriesCard(
                    colorOptions: supProv.colors,
                    fabricOptions: supProv.fabrics,
                    selectedColorLabel: _selectedColorLabel,
                    selectedFabricLabel: _selectedFabricLabel,
                    gender: _gender,
                    season: _season,
                    buyingPriceCtrl: _buyingPriceCtrl,
                    minOrderCtrl: _minOrderCtrl,
                    shortDescCtrl: _shortDescCtrl,
                    descCtrl: _descCtrl,
                    isActive: _isActive,
                    translations: _translations,
                    autoTranslating: _autoTranslating,
                    onColorPicked: (picked) {
                      setState(() {
                        _selectedColorId =
                            picked.id.isEmpty ? null : picked.id;
                        _selectedColorLabel = picked.name;
                      });
                    },
                    onFabricPicked: (picked) {
                      setState(() {
                        _selectedFabricId =
                            picked.id.isEmpty ? null : picked.id;
                        _selectedFabricLabel = picked.name;
                      });
                    },
                    onGenderChanged: (v) => setState(() => _gender = v),
                    onSeasonChanged: (v) => setState(() => _season = v),
                    onActiveChanged: (v) => setState(() => _isActive = v),
                    onAutoTranslate: _autoTranslateFromTurkish,
                  ),
                  const SizedBox(height: 18),
                  if (_saving && _saveStageLabel.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            _saveStageLabel,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.navy,
                            ),
                          ),
                        ],
                      ),
                    ),
                  SizedBox(
                    height: 54,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _submitProduct,
                      icon: const Icon(Icons.cloud_upload_outlined),
                      label: Text(
                        _saving
                            ? 'Yükleniyor...'
                            : widget.existingProduct != null
                                ? 'Değişiklikleri Vitrine Kaydet'
                                : 'Ürünü Vitrine Kaydet & Yayınla',
                        style: const TextStyle(fontSize: 15.5),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
