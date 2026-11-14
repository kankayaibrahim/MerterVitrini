import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import 'camera_studio_screen.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';
import 'wizard/searchable_option_sheet.dart';
import 'wizard/supplier_sibling_linker_sheet.dart';
import 'wizard/wizard_draft_storage.dart';
import 'wizard/wizard_model_details_card.dart';
import 'wizard/wizard_models.dart';
import 'wizard/wizard_photo_studio_card.dart';
import 'wizard/wizard_pricing_series_card.dart';
import 'wizard/wizard_sibling_variants_card.dart';
import 'wizard/wizard_translations_card.dart';
import 'wizard/wizard_variants_matrix_card.dart';

enum _WizardSubmitIntent { draft, publish, saveAndNextColor }

class SupplierProductWizardScreen extends StatefulWidget {
  final Product? existingProduct;
  final bool autoOpenCamera;
  final Product? cloneFromProduct;
  final String? linkWithProductId;

  const SupplierProductWizardScreen({
    super.key,
    this.existingProduct,
    this.autoOpenCamera = false,
    this.cloneFromProduct,
    this.linkWithProductId,
  });

  @override
  State<SupplierProductWizardScreen> createState() =>
      _SupplierProductWizardScreenState();
}

class _SupplierProductWizardScreenState
    extends State<SupplierProductWizardScreen> {
  static const List<String> _targetLangCodes = [
    'en',
    'ru',
    'ar',
    'de',
    'fr',
    'pl',
    'bg',
  ];

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
    for (final code in _targetLangCodes) code: EditableTranslationLanguageSet(),
  };

  String? _editingProductId;
  String? _linkWithProductId;
  String _sourceProductGroupId = '';
  String? _pendingLinkParentLabel;
  String? _pendingLinkParentImageUrl;

  List<SiblingProduct> _linkedSiblings = <SiblingProduct>[];
  final List<WizardAdditionalColorDraft> _extraColorDrafts =
      <WizardAdditionalColorDraft>[];

  late bool _expressMode;
  WizardUnsavedDraft? _pendingRestoreDraft;
  Timer? _draftAutoSaveTimer;
  bool _suppressAutoSave = false;

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
  bool _linkingSiblings = false;
  String? _unlinkingSiblingId;
  bool _autoTranslating = false;
  String _saveStageKey = '';

  String _lang() {
    if (!mounted) return 'tr';
    try {
      return Provider.of<SessionProvider>(context, listen: false).languageCode;
    } catch (_) {
      return 'tr';
    }
  }

  @override
  void initState() {
    super.initState();
    _editingProductId = widget.existingProduct?.id;
    _linkWithProductId = widget.linkWithProductId ?? widget.cloneFromProduct?.id;
    _expressMode = widget.existingProduct == null;

    if (widget.existingProduct != null) {
      _applyProductToForm(widget.existingProduct!);
    } else if (widget.cloneFromProduct != null) {
      final parent = widget.cloneFromProduct!;
      _applyProductToForm(parent, isClone: true);
      _pendingLinkParentLabel =
          parent.title.isNotEmpty ? parent.title : parent.customSku;
      _pendingLinkParentImageUrl = parent.coverImageUrl;
    }

    _titleCtrl.addListener(_scheduleDraftAutoSave);
    _priceCtrl.addListener(_scheduleDraftAutoSave);
    _buyingPriceCtrl.addListener(_scheduleDraftAutoSave);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final supProv = context.read<SupplierProvider>();
      await supProv.ensureCatalogFormMetadataLoaded();
      if (!mounted) return;

      if (_editingProductId == null && widget.cloneFromProduct == null) {
        await _loadSmartDefaultsAndDraft(supProv);
      }

      if (_editingProductId == null &&
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

  Future<void> _loadSmartDefaultsAndDraft(SupplierProvider supProv) async {
    final defaults = await WizardDraftStorage.loadDefaults();
    final draft = await WizardDraftStorage.loadUnsavedDraft();
    if (!mounted) return;

    _suppressAutoSave = true;
    try {
      setState(() {
        if (defaults.categoryId.isNotEmpty && _selectedCategoryId.isEmpty) {
          _selectedCategoryId = defaults.categoryId;
        }
        if (defaults.currency.isNotEmpty) {
          _currency = defaults.currency;
        }
        if (defaults.selectedSizes.isNotEmpty) {
          _selectedSizes = List<String>.of(defaults.selectedSizes);
        }
        if (defaults.seriesRatio.isNotEmpty) {
          _seriesRatio = defaults.seriesRatio;
        }
        if (defaults.seriesStock > 0) {
          _seriesStockCtrl.text = '${defaults.seriesStock}';
        }
        if (defaults.gender.isNotEmpty) {
          _gender = defaults.gender;
        }
        if (defaults.season.isNotEmpty) {
          _season = defaults.season;
        }
        if (defaults.fabricId != null && _selectedFabricId == null) {
          _selectedFabricId = defaults.fabricId;
        }
        if (draft != null && draft.isMeaningful) {
          _pendingRestoreDraft = draft;
        }
      });
      _syncOptionLabelsFromMetadata();
    } finally {
      _suppressAutoSave = false;
    }
  }

  void _scheduleDraftAutoSave() {
    if (_suppressAutoSave ||
        _editingProductId != null ||
        widget.cloneFromProduct != null) {
      return;
    }
    _draftAutoSaveTimer?.cancel();
    _draftAutoSaveTimer = Timer(const Duration(milliseconds: 650), () {
      if (!mounted || _editingProductId != null || _saving) return;
      final rawStock = int.tryParse(_seriesStockCtrl.text.trim()) ??
          SeriesStockDistributor.defaultSeriesStock;
      final draft = WizardUnsavedDraft(
        title: _titleCtrl.text,
        priceText: _priceCtrl.text,
        buyingPriceText: _buyingPriceCtrl.text,
        currency: _currency,
        categoryId: _selectedCategoryId,
        colorId: _selectedColorId,
        fabricId: _selectedFabricId,
        photoItems: List<WizardPhotoItem>.of(_photos),
        selectedSizes: List<String>.of(_selectedSizes),
        seriesRatio: _seriesRatio,
        seriesStock: rawStock > 0
            ? rawStock
            : SeriesStockDistributor.defaultSeriesStock,
        linkWithProductId: _linkWithProductId,
      );
      WizardDraftStorage.saveUnsavedDraft(draft);
    });
  }

  void _restorePendingDraft() {
    final draft = _pendingRestoreDraft;
    if (draft == null) return;
    _suppressAutoSave = true;
    try {
      setState(() {
        _titleCtrl.text = draft.title;
        _priceCtrl.text = draft.priceText;
        _buyingPriceCtrl.text = draft.buyingPriceText;
        _currency = draft.currency;
        _selectedCategoryId = draft.categoryId;
        _selectedColorId = draft.colorId;
        _selectedFabricId = draft.fabricId;
        _photos
          ..clear()
          ..addAll(
            draft.photoItems.where(
              (item) => item.isRemote || File(item.localPath ?? '').existsSync(),
            ),
          );
        if (draft.selectedSizes.isNotEmpty) {
          _selectedSizes = List<String>.of(draft.selectedSizes);
        }
        if (draft.seriesRatio.isNotEmpty) {
          _seriesRatio = draft.seriesRatio;
        }
        if (draft.seriesStock > 0) {
          _seriesStockCtrl.text = '${draft.seriesStock}';
        }
        if (draft.linkWithProductId != null &&
            draft.linkWithProductId!.isNotEmpty) {
          _linkWithProductId = draft.linkWithProductId;
        }
        _pendingRestoreDraft = null;
      });
      _syncOptionLabelsFromMetadata();
    } finally {
      _suppressAutoSave = false;
    }
  }

  Future<void> _discardPendingDraft() async {
    await WizardDraftStorage.clearUnsavedDraft();
    if (!mounted) return;
    setState(() => _pendingRestoreDraft = null);
  }

  @override
  void dispose() {
    _draftAutoSaveTimer?.cancel();
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

  void _applyProductToForm(Product p, {bool isClone = false}) {
    _suppressAutoSave = true;
    try {
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
      if (!isClone) {
        _selectedColorId =
            (p.colorId != null && p.colorId!.isNotEmpty) ? p.colorId : null;
        _selectedColorLabel = p.color;
        _sourceProductGroupId = p.sourceProductGroupId;
        _linkedSiblings = List<SiblingProduct>.of(p.supplierSiblings);
      } else {
        _selectedColorId = null;
        _selectedColorLabel = '';
      }
      _selectedFabricId =
          (p.fabricId != null && p.fabricId!.isNotEmpty) ? p.fabricId : null;
      _selectedFabricLabel = p.fabric;
      if (p.gender.isNotEmpty) _gender = p.gender;
      if (p.season.isNotEmpty) _season = p.season;
      if (p.currency.isNotEmpty) _currency = p.currency.toUpperCase();
      _isActive = isClone ? true : p.isActive;

      if (!isClone) {
        _photos.clear();
        for (final img in p.images) {
          if (img.imageUrl.isNotEmpty) {
            _photos.add(WizardPhotoItem.remote(img.imageUrl));
          }
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

      for (final lang in _targetLangCodes) {
        final t = p.translations[lang];
        final set = _translations[lang];
        if (set != null && t != null) {
          set.titleCtrl.text = t.title;
          set.shortDescCtrl.text = t.shortDescription;
          set.descCtrl.text = t.description;
        }
      }
    } finally {
      _suppressAutoSave = false;
    }
  }

  Future<void> _autoTranslateFromTurkish() async {
    final lang = _lang();
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      _showSnack(
        SupplierL10n.t(lang, 'wizard_title_required'),
        isError: true,
      );
      return;
    }
    setState(() => _autoTranslating = true);
    try {
      final result = await context
          .read<SupplierProvider>()
          .catalogRepo
          .autoTranslateSupplierFields(
        {
          'title': title,
          'short_description': _shortDescCtrl.text.trim(),
          'description': _descCtrl.text.trim(),
        },
        sourceLang: 'tr',
        targetLangs: _targetLangCodes,
      );
      if (!mounted) return;
      setState(() {
        for (final code in _targetLangCodes) {
          final map = result[code];
          final set = _translations[code];
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
      _showSnack(SupplierL10n.t(lang, 'wizard_auto_translate_done'));
    } catch (e) {
      _showSnack(
        '${SupplierL10n.t(lang, 'wizard_auto_translate_err')}: $e',
        isError: true,
      );
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
    final lang = _lang();
    final remaining = 10 - _photos.length;
    if (remaining <= 0) {
      _showSnack(
        '${SupplierL10n.t(lang, 'camera_max_photos')} (10)',
        isError: true,
      );
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
      _scheduleDraftAutoSave();
    }
  }

  Future<void> _pickFromGallery() async {
    final lang = _lang();
    final remaining = 10 - _photos.length;
    if (remaining <= 0) {
      _showSnack(
        '${SupplierL10n.t(lang, 'camera_max_photos')} (10)',
        isError: true,
      );
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
        _scheduleDraftAutoSave();
      }
    } catch (e) {
      _showSnack(
        '${SupplierL10n.t(lang, 'wizard_gallery_error')}: $e',
        isError: true,
      );
    }
  }

  void _makeCoverPhoto(int index) {
    if (index <= 0 || index >= _photos.length) return;
    setState(() {
      final chosen = _photos.removeAt(index);
      _photos.insert(0, chosen);
    });
    _scheduleDraftAutoSave();
  }

  void _reorderPhoto(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= _photos.length) return;
    setState(() {
      final moved = _photos.removeAt(oldIndex);
      final target = newIndex.clamp(0, _photos.length);
      _photos.insert(target, moved);
    });
    _scheduleDraftAutoSave();
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
    _scheduleDraftAutoSave();
  }

  void _applySeriesTemplate(SeriesTemplateOption tpl) {
    setState(() {
      _selectedSizes = List<String>.of(tpl.sizes);
      _seriesRatio = tpl.seriesRatio;
    });
    _scheduleDraftAutoSave();
  }

  void _applyExpressSizePreset(List<String> sizes, String ratio) {
    final defs = context.read<SupplierProvider>().sizeDefinitions;
    final effectiveDefs =
        defs.isNotEmpty ? defs : SeriesStockDistributor.fallbackSizeDefinitions;
    setState(() {
      _selectedSizes =
          SeriesStockDistributor.sortSelectedSizes(sizes, effectiveDefs);
      _seriesRatio = ratio;
    });
    _scheduleDraftAutoSave();
  }

  void _changeAssortmentMode(String mode) {
    setState(() {
      _seriesRatio = SeriesStockDistributor.buildRatioForAssortment(
        _selectedSizes.length,
        mode,
      );
    });
    _scheduleDraftAutoSave();
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

  Future<void> _openSiblingLinkerSheet() async {
    final lang = _lang();
    final picked = await showSupplierSiblingLinkerSheet(
      context,
      excludeProductId: _editingProductId,
      alreadyLinkedIds: _linkedSiblings.map((s) => s.id).toSet(),
      singleSelection: _editingProductId == null,
      languageCode: lang,
    );
    if (!mounted || picked == null || picked.isEmpty) return;

    if (_editingProductId == null) {
      final parent = picked.first;
      setState(() {
        _linkWithProductId = parent.id;
        _pendingLinkParentLabel =
            parent.title.isNotEmpty ? parent.title : parent.customSku;
        _pendingLinkParentImageUrl = parent.coverImageUrl;
      });
      _scheduleDraftAutoSave();
      _showSnack(SupplierL10n.t(lang, 'select_parent_product_ok'));
      return;
    }

    setState(() => _linkingSiblings = true);
    try {
      final updated =
          await context.read<SupplierProvider>().linkProductSiblings(
                productId: _editingProductId!,
                targetProductIds: picked.map((e) => e.id).toList(),
              );
      if (!mounted) return;
      setState(() => _linkedSiblings = updated);
      _showSnack(SupplierL10n.t(lang, 'siblings_linked_ok'));
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    } finally {
      if (mounted) {
        setState(() => _linkingSiblings = false);
      }
    }
  }

  Future<void> _unlinkSibling(SiblingProduct sibling) async {
    if (_editingProductId == null) return;
    final lang = _lang();
    setState(() => _unlinkingSiblingId = sibling.id);
    try {
      final updated =
          await context.read<SupplierProvider>().unlinkProductSibling(
                productId: _editingProductId!,
                targetProductId: sibling.id,
              );
      if (!mounted) return;
      setState(() => _linkedSiblings = updated);
      _showSnack(SupplierL10n.t(lang, 'sibling_unlinked_ok'));
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    } finally {
      if (mounted) {
        setState(() => _unlinkingSiblingId = null);
      }
    }
  }

  Future<List<String>> _uploadPhotoList(
    SupplierProvider supProv,
    List<WizardPhotoItem> items,
    String lang,
  ) async {
    final localPaths = items
        .where((item) => !item.isRemote && (item.localPath ?? '').isNotEmpty)
        .map((item) => item.localPath!)
        .toList();

    List<String> uploadedUrls = const <String>[];
    if (localPaths.isNotEmpty) {
      uploadedUrls =
          await supProv.catalogRepo.uploadSupplierProductPhotos(localPaths);
      if (uploadedUrls.length != localPaths.length) {
        throw Exception(SupplierL10n.t(lang, 'wizard_photo_upload_err'));
      }
    }

    final urls = <String>[];
    var cursor = 0;
    for (final item in items) {
      urls.add(item.isRemote ? item.remoteUrl! : uploadedUrls[cursor++]);
    }
    return urls;
  }

  Future<void> _submitWithIntent(_WizardSubmitIntent intent) async {
    final lang = _lang();
    final session = context.read<SessionProvider>();
    final supProv = context.read<SupplierProvider>();
    final categoryOptions = _effectiveCategoryOptions(supProv, session);

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

    final bool isPublishing;
    if (intent == _WizardSubmitIntent.draft) {
      isPublishing = false;
      if (_photos.isEmpty && title.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'err_draft_photo_or_title'),
          isError: true,
        );
        return;
      }
    } else if (intent == _WizardSubmitIntent.publish) {
      isPublishing = true;
      if (_photos.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'wizard_enter_photo_err'),
          isError: true,
        );
        return;
      }
      if (title.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'wizard_title_required'),
          isError: true,
        );
        return;
      }
      if (_selectedCategoryId.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'wizard_category_required'),
          isError: true,
        );
        return;
      }
      if (unitPrice <= 0) {
        _showSnack(
          SupplierL10n.t(lang, 'wizard_price_required'),
          isError: true,
        );
        return;
      }
      if (_selectedSizes.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'wizard_sizes_required'),
          isError: true,
        );
        return;
      }
    } else {
      // saveAndNextColor: require at least a photo or title; auto-publish if complete, else save draft cleanly
      if (_photos.isEmpty && title.isEmpty) {
        _showSnack(
          SupplierL10n.t(lang, 'err_draft_photo_or_title'),
          isError: true,
        );
        return;
      }
      isPublishing = _photos.isNotEmpty &&
          title.isNotEmpty &&
          _selectedCategoryId.isNotEmpty &&
          unitPrice > 0 &&
          _selectedSizes.isNotEmpty;
    }

    final effectiveCategoryId = _selectedCategoryId.isNotEmpty
        ? _selectedCategoryId
        : (categoryOptions.isNotEmpty ? categoryOptions.first.id : '');
    final effectiveSizes =
        _selectedSizes.isNotEmpty ? _selectedSizes : const <String>['STD'];

    setState(() {
      _saving = true;
      _saveStageKey = 'wizard_save_uploading_photos';
    });

    try {
      final finalImageUrls = await _uploadPhotoList(supProv, _photos, lang);

      final additionalColorPayloads = <Map<String, dynamic>>[];
      for (final extra in _extraColorDrafts) {
        final extraUrls = await _uploadPhotoList(supProv, extra.photos, lang);
        additionalColorPayloads.add({
          if (extra.colorId != null && extra.colorId!.isNotEmpty)
            'color_id': extra.colorId,
          'color': extra.colorName,
          'color_name': extra.colorName,
          'images': extraUrls,
        });
      }

      if (!mounted) return;
      setState(() {
        _saveStageKey = intent == _WizardSubmitIntent.draft
            ? 'wizard_saving_draft'
            : 'wizard_save_committing';
      });

      final variantStocks = SeriesStockDistributor.computeVariantStocks(
        variantCount: effectiveSizes.length,
        rawRatio: _seriesRatio,
        packageCount: safeSeriesStock,
      );
      final weights = SeriesStockDistributor.parseRatioWeights(_seriesRatio);
      final normalizedWeights = List<int>.generate(
        effectiveSizes.length,
        (idx) => idx < weights.length ? weights[idx] : 1,
      );
      final unitsPerSeries =
          normalizedWeights.fold<int>(0, (sum, val) => sum + val);
      final safeMinOrderSeries = minOrderSeries <= 0 ? 1 : minOrderSeries;

      final variantsJson = <Map<String, dynamic>>[
        for (var i = 0; i < effectiveSizes.length; i++)
          {
            'size': effectiveSizes[i],
            'barcode': '',
            'stock': variantStocks[i],
            'is_single': false,
          },
      ];

      final payload = <String, dynamic>{
        'title': title,
        'short_description': _shortDescCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        if (effectiveCategoryId.isNotEmpty) 'category_id': effectiveCategoryId,
        if (_selectedColorId != null && _selectedColorId!.isNotEmpty)
          'color_id': _selectedColorId,
        if (_selectedFabricId != null && _selectedFabricId!.isNotEmpty)
          'fabric_id': _selectedFabricId,
        'gender': _gender,
        'season': _season,
        'buying_price': buyingPrice,
        'price': unitPrice,
        'currency': _currency,
        'selected_sizes': effectiveSizes,
        'packing_ratio': effectiveSizes.join(','),
        'series_ratio': normalizedWeights.join('-'),
        'series_stock': safeSeriesStock,
        'min_order_series': safeMinOrderSeries,
        'minimum_order_quantity': safeMinOrderSeries * unitsPerSeries,
        'is_active': isPublishing,
        'is_draft': !isPublishing,
        if (_sourceProductGroupId.isNotEmpty)
          'source_product_group_id': _sourceProductGroupId,
        if (_linkWithProductId != null && _linkWithProductId!.isNotEmpty)
          'link_with_product_id': _linkWithProductId,
        'images': finalImageUrls,
        'variants': variantsJson,
        if (additionalColorPayloads.isNotEmpty)
          'additional_color_variants': additionalColorPayloads,
        'translations': {
          for (final entry in _translations.entries)
            entry.key: {
              'title': entry.value.titleCtrl.text.trim(),
              'short_description': entry.value.shortDescCtrl.text.trim(),
              'description': entry.value.descCtrl.text.trim(),
            },
        },
      };

      final String savedProductId;
      if (_editingProductId != null) {
        savedProductId = _editingProductId!;
        await supProv.catalogRepo.updateSupplierProduct(
          savedProductId,
          payload,
        );
      } else {
        savedProductId =
            await supProv.catalogRepo.createSupplierProduct(payload);
      }

      await WizardDraftStorage.saveDefaults(
        WizardSmartDefaults(
          categoryId: effectiveCategoryId,
          currency: _currency,
          selectedSizes: effectiveSizes,
          seriesRatio: normalizedWeights.join('-'),
          seriesStock: safeSeriesStock,
          gender: _gender,
          season: _season,
          fabricId: _selectedFabricId,
        ),
      );
      await WizardDraftStorage.clearUnsavedDraft();

      await supProv.loadProducts();
      await supProv.loadDashboard();
      await session.loadBootstrap();

      if (!mounted) return;

      if (intent == _WizardSubmitIntent.saveAndNextColor) {
        _suppressAutoSave = true;
        try {
          setState(() {
            _editingProductId = null;
            _linkWithProductId = savedProductId;
            _pendingLinkParentLabel = title.isNotEmpty
                ? title
                : SupplierL10n.t(lang, 'wizard_clone_new_color_title');
            _pendingLinkParentImageUrl =
                finalImageUrls.isNotEmpty ? finalImageUrls.first : null;
            _photos.clear();
            _selectedColorId = null;
            _selectedColorLabel = '';
            _extraColorDrafts.clear();
            _linkedSiblings = [];
            _isActive = isPublishing;
          });
        } finally {
          _suppressAutoSave = false;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(SupplierL10n.t(lang, 'saved_next_color_ready')),
            backgroundColor: AppColors.emerald,
          ),
        );
        return;
      }

      final String successMsg;
      if (!isPublishing) {
        successMsg = SupplierL10n.t(lang, 'saved_as_draft_ok');
      } else if (_editingProductId != null) {
        successMsg = SupplierL10n.t(lang, 'wizard_updated_msg');
      } else {
        successMsg = SupplierL10n.t(lang, 'wizard_published_msg');
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMsg),
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
          _saveStageKey = '';
        });
      }
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : AppColors.obsidian,
      ),
    );
  }

  Widget _buildModeSegmentedBar(String lang) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.pureWhite,
        borderRadius: BorderRadius.circular(AppColors.radiusLg),
        border: Border.all(color: AppColors.warmHairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ModeSegmentButton(
              icon: Icons.bolt_rounded,
              label: SupplierL10n.t(lang, 'quick_mode'),
              active: _expressMode,
              onTap: () => setState(() => _expressMode = true),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: _ModeSegmentButton(
              icon: Icons.tune_rounded,
              label: SupplierL10n.t(lang, 'detailed_mode'),
              active: !_expressMode,
              onTap: () => setState(() => _expressMode = false),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRestoreDraftBanner(String lang) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(AppColors.radiusLg),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.restore_rounded,
            size: 20,
            color: Color(0xFFB45309),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              SupplierL10n.t(lang, 'restore_draft_title'),
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
          ),
          TextButton(
            style: TextButton.styleFrom(
              foregroundColor: AppColors.mutedAccessible,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: _saving ? null : _discardPendingDraft,
            child: Text(
              SupplierL10n.t(lang, 'discard_draft_btn'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 4),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFB45309),
              foregroundColor: AppColors.pureWhite,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
            ),
            onPressed: _saving ? null : _restorePendingDraft,
            child: Text(
              SupplierL10n.t(lang, 'restore_draft_btn'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpressInfoCard(
    BuildContext context, {
    required String lang,
    required SupplierProvider supProv,
    required List<SimpleOptionItem> categoryOptions,
  }) {
    final quickColorPreview = supProv.colors.take(8).toList();
    final activeStockText = _seriesStockCtrl.text.trim();

    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '2. ${SupplierL10n.t(lang, 'express_info_title')}',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14.5,
              letterSpacing: AppStrings.letterSpacing(lang, -0.1),
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            SupplierL10n.t(lang, 'express_info_sub'),
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.mutedAccessible,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _titleCtrl,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'wizard_sku_label'),
              hintText: SupplierL10n.t(lang, 'wizard_title_hint'),
              filled: true,
              fillColor: AppColors.warmSurface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusMd),
                borderSide: const BorderSide(color: AppColors.warmHairline),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusMd),
                borderSide: const BorderSide(color: AppColors.warmHairline),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _priceCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(
                      lang,
                      'wizard_unit_wholesale_price',
                    ),
                    filled: true,
                    fillColor: AppColors.warmSurface,
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      borderSide:
                          const BorderSide(color: AppColors.warmHairline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      borderSide:
                          const BorderSide(color: AppColors.warmHairline),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Wrap(
                spacing: 4,
                children: ['TRY', 'USD', 'EUR'].map((curr) {
                  final selected = _currency == curr;
                  return ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    label: Text(
                      curr,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color:
                            selected ? AppColors.pureWhite : AppColors.obsidian,
                      ),
                    ),
                    selected: selected,
                    selectedColor: AppColors.obsidian,
                    backgroundColor: AppColors.warmSurface,
                    onSelected: (_) {
                      setState(() => _currency = curr);
                      _scheduleDraftAutoSave();
                    },
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  onTap: () async {
                    final picked = await showSearchableOptionSheet(
                      context,
                      title: SupplierL10n.t(lang, 'primary_color_label'),
                      options: supProv.colors,
                      allowClear: true,
                      languageCode: lang,
                    );
                    if (picked == null || !mounted) return;
                    setState(() {
                      _selectedColorId = picked.id.isEmpty ? null : picked.id;
                      _selectedColorLabel = picked.name;
                    });
                    _scheduleDraftAutoSave();
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: SupplierL10n.t(lang, 'primary_color_label'),
                      filled: true,
                      fillColor: AppColors.warmSurface,
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _selectedColorLabel.isNotEmpty
                                ? _selectedColorLabel
                                : SupplierL10n.t(
                                    lang,
                                    'wizard_select_placeholder',
                                  ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: _selectedColorLabel.isNotEmpty
                                  ? AppColors.obsidian
                                  : AppColors.mutedAccessible,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: AppColors.mutedAccessible,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  onTap: () async {
                    final picked = await showSearchableOptionSheet(
                      context,
                      title: SupplierL10n.t(lang, 'wizard_category_label'),
                      options: categoryOptions,
                      languageCode: lang,
                    );
                    if (picked == null || !mounted) return;
                    setState(() {
                      _selectedCategoryId = picked.id;
                      _selectedCategoryLabel = picked.name;
                    });
                    _scheduleDraftAutoSave();
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: SupplierL10n.t(lang, 'wizard_category_field'),
                      filled: true,
                      fillColor: AppColors.warmSurface,
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _selectedCategoryLabel.isNotEmpty
                                ? _selectedCategoryLabel
                                : SupplierL10n.t(
                                    lang,
                                    'wizard_tap_category',
                                  ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: _selectedCategoryLabel.isNotEmpty
                                  ? AppColors.obsidian
                                  : AppColors.mutedAccessible,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: AppColors.mutedAccessible,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (quickColorPreview.isNotEmpty) ...[
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: quickColorPreview.map((c) {
                  final active = _selectedColorId == c.id;
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(end: 6),
                    child: ChoiceChip(
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      label: Text(
                        c.name,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight:
                              active ? FontWeight.w800 : FontWeight.w600,
                        ),
                      ),
                      selected: active,
                      selectedColor: AppColors.accentGoldLight,
                      onSelected: (_) {
                        setState(() {
                          _selectedColorId = c.id;
                          _selectedColorLabel = c.name;
                        });
                        _scheduleDraftAutoSave();
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            SupplierL10n.t(lang, 'size_templates_quick'),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.charcoal,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _ExpressTemplateChip(
                label: 'S-M-L-XL',
                selected: _selectedSizes.join('-') == 'S-M-L-XL',
                onTap: () => _applyExpressSizePreset(
                  const ['S', 'M', 'L', 'XL'],
                  '1-1-1-1',
                ),
              ),
              _ExpressTemplateChip(
                label: '36-42',
                selected: _selectedSizes.join('-') == '36-38-40-42',
                onTap: () => _applyExpressSizePreset(
                  const ['36', '38', '40', '42'],
                  '1-1-1-1',
                ),
              ),
              _ExpressTemplateChip(
                label: 'STD',
                selected: _selectedSizes.length == 1 &&
                    _selectedSizes.first.toUpperCase() == 'STD',
                onTap: () => _applyExpressSizePreset(const ['STD'], '1'),
              ),
              _ExpressTemplateChip(
                label: 'M-L-XL-2XL',
                selected: _selectedSizes.join('-') == 'M-L-XL-2XL',
                onTap: () => _applyExpressSizePreset(
                  const ['M', 'L', 'XL', '2XL'],
                  '1-1-1-1',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            SupplierL10n.t(lang, 'stock_presets_quick'),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.charcoal,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [25, 50, 100, 250].map((preset) {
              final selected = activeStockText == '$preset';
              return ChoiceChip(
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                label: Text(
                  '$preset ${SupplierL10n.t(lang, 'series_unit_short')}',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected ? AppColors.pureWhite : AppColors.obsidian,
                  ),
                ),
                selected: selected,
                selectedColor: AppColors.luxuryBronze,
                backgroundColor: AppColors.warmSurface,
                onSelected: (_) {
                  setState(() => _seriesStockCtrl.text = '$preset');
                  _scheduleDraftAutoSave();
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStickyBottomBar(String lang) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.pureWhite,
        border: const Border(top: BorderSide(color: AppColors.warmHairline)),
        boxShadow: [
          BoxShadow(
            color: AppColors.obsidian.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_saving && _saveStageKey.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          SupplierL10n.t(lang, _saveStageKey),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.obsidian,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: SizedBox(
                      height: 46,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.obsidian,
                          side:
                              const BorderSide(color: AppColors.warmHairline),
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                          ),
                        ),
                        onPressed: _saving
                            ? null
                            : () => _submitWithIntent(
                                  _WizardSubmitIntent.draft,
                                ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.edit_note_rounded, size: 17),
                              const SizedBox(width: 4),
                              Text(
                                SupplierL10n.t(lang, 'save_draft_btn'),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    flex: 4,
                    child: SizedBox(
                      height: 46,
                      child: FilledButton.tonal(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.accentGoldLight,
                          foregroundColor: AppColors.luxuryBronze,
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                          ),
                        ),
                        onPressed: _saving
                            ? null
                            : () => _submitWithIntent(
                                  _WizardSubmitIntent.saveAndNextColor,
                                ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.bolt_rounded, size: 17),
                              const SizedBox(width: 4),
                              Text(
                                SupplierL10n.t(
                                  lang,
                                  'save_and_next_color_btn',
                                ),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    flex: 4,
                    child: SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.obsidian,
                          foregroundColor: AppColors.pureWhite,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                          ),
                        ),
                        onPressed: _saving
                            ? null
                            : () => _submitWithIntent(
                                  _WizardSubmitIntent.publish,
                                ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.check_circle_outline_rounded,
                                size: 17,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                SupplierL10n.t(lang, 'publish_btn'),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final supProv = context.watch<SupplierProvider>();
    final lang = session.languageCode;
    final categoryOptions = _effectiveCategoryOptions(supProv, session);
    final unitPricePreview =
        double.tryParse(_priceCtrl.text.replaceAll(',', '.').trim()) ?? 0.0;

    final String appBarTitle;
    if (_editingProductId != null) {
      appBarTitle = SupplierL10n.t(lang, 'wizard_edit_title');
    } else if (widget.cloneFromProduct != null || _linkWithProductId != null) {
      appBarTitle = SupplierL10n.t(lang, 'wizard_clone_new_color_title');
    } else {
      appBarTitle = SupplierL10n.t(lang, 'wizard_new_title');
    }

    return Theme(
      data: AppTheme.light(isSupplierMode: true, languageCode: lang),
      child: Directionality(
        textDirection: AppStrings.directionOf(lang),
        child: Scaffold(
          backgroundColor: AppColors.warmIvory,
          appBar: buildSupplierSubPageAppBar(
            context: context,
            title: appBarTitle,
            subtitle: SupplierL10n.t(lang, 'wizard_upload_notice'),
          ),
          bottomNavigationBar:
              _loadingDetail ? null : _buildStickyBottomBar(lang),
          body: _loadingDetail
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                  children: [
                    _buildModeSegmentedBar(lang),
                    const SizedBox(height: 12),
                    if (_pendingRestoreDraft != null)
                      _buildRestoreDraftBanner(lang),
                    WizardPhotoStudioCard(
                      photos: _photos,
                      saving: _saving,
                      onOpenCamera: _openCameraStudio,
                      onPickGallery: _pickFromGallery,
                      onMakeCover: _makeCoverPhoto,
                      onRemovePhoto: (idx) {
                        setState(() => _photos.removeAt(idx));
                        _scheduleDraftAutoSave();
                      },
                      onReorderPhoto: _reorderPhoto,
                      lang: lang,
                    ),
                    const SizedBox(height: 12),
                    if (_expressMode) ...[
                      _buildExpressInfoCard(
                        context,
                        lang: lang,
                        supProv: supProv,
                        categoryOptions: categoryOptions,
                      ),
                      const SizedBox(height: 12),
                      WizardSiblingVariantsCard(
                        lang: lang,
                        linkedSiblings: _linkedSiblings,
                        pendingLinkParentLabel: _pendingLinkParentLabel,
                        pendingLinkParentImageUrl: _pendingLinkParentImageUrl,
                        onClearPendingLinkParent: () {
                          setState(() {
                            _linkWithProductId = null;
                            _pendingLinkParentLabel = null;
                            _pendingLinkParentImageUrl = null;
                          });
                          _scheduleDraftAutoSave();
                        },
                        availableColors: supProv.colors,
                        extraColorDrafts: _extraColorDrafts,
                        onUnlinkSibling: _unlinkSibling,
                        onOpenLinkerSheet: _openSiblingLinkerSheet,
                        onAddExtraColorDraft: (draft) {
                          setState(() => _extraColorDrafts.add(draft));
                        },
                        onRemoveExtraColorDraft: (idx) {
                          setState(() => _extraColorDrafts.removeAt(idx));
                        },
                        saving: _saving,
                        linkingSiblings: _linkingSiblings,
                        unlinkingSiblingId: _unlinkingSiblingId,
                      ),
                    ] else ...[
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
                          _scheduleDraftAutoSave();
                        },
                        onCurrencyChanged: (v) {
                          setState(() => _currency = v);
                          _scheduleDraftAutoSave();
                        },
                        onPriceEdited: () {
                          setState(() {});
                          _scheduleDraftAutoSave();
                        },
                        lang: lang,
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
                          _scheduleDraftAutoSave();
                        },
                        onSeriesStockEdited: () {
                          setState(() {});
                          _scheduleDraftAutoSave();
                        },
                        lang: lang,
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
                          _scheduleDraftAutoSave();
                        },
                        onFabricPicked: (picked) {
                          setState(() {
                            _selectedFabricId =
                                picked.id.isEmpty ? null : picked.id;
                            _selectedFabricLabel = picked.name;
                          });
                          _scheduleDraftAutoSave();
                        },
                        onGenderChanged: (v) => setState(() => _gender = v),
                        onSeasonChanged: (v) => setState(() => _season = v),
                        onActiveChanged: (v) => setState(() => _isActive = v),
                        onAutoTranslate: _autoTranslateFromTurkish,
                        lang: lang,
                      ),
                      const SizedBox(height: 12),
                      WizardSiblingVariantsCard(
                        lang: lang,
                        linkedSiblings: _linkedSiblings,
                        pendingLinkParentLabel: _pendingLinkParentLabel,
                        pendingLinkParentImageUrl: _pendingLinkParentImageUrl,
                        onClearPendingLinkParent: () {
                          setState(() {
                            _linkWithProductId = null;
                            _pendingLinkParentLabel = null;
                            _pendingLinkParentImageUrl = null;
                          });
                          _scheduleDraftAutoSave();
                        },
                        availableColors: supProv.colors,
                        extraColorDrafts: _extraColorDrafts,
                        onUnlinkSibling: _unlinkSibling,
                        onOpenLinkerSheet: _openSiblingLinkerSheet,
                        onAddExtraColorDraft: (draft) {
                          setState(() => _extraColorDrafts.add(draft));
                        },
                        onRemoveExtraColorDraft: (idx) {
                          setState(() => _extraColorDrafts.removeAt(idx));
                        },
                        saving: _saving,
                        linkingSiblings: _linkingSiblings,
                        unlinkingSiblingId: _unlinkingSiblingId,
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class _ModeSegmentButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _ModeSegmentButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppColors.radiusMd),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.obsidian : Colors.transparent,
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: active ? AppColors.pureWhite : AppColors.charcoal,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: active ? AppColors.pureWhite : AppColors.obsidian,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpressTemplateChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ExpressTemplateChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          color: selected ? AppColors.pureWhite : AppColors.obsidian,
        ),
      ),
      selected: selected,
      selectedColor: AppColors.obsidian,
      backgroundColor: AppColors.warmSurface,
      onSelected: (_) => onTap(),
    );
  }
}
