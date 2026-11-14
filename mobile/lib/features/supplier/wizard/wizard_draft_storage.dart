import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'wizard_models.dart';

/// Persisted supplier defaults remembered across product creations
/// (category, currency, series ratio/sizes/stock, gender, season, fabric).
class WizardSmartDefaults {
  final String categoryId;
  final String currency;
  final List<String> selectedSizes;
  final String seriesRatio;
  final int seriesStock;
  final String gender;
  final String season;
  final String? fabricId;

  const WizardSmartDefaults({
    this.categoryId = '',
    this.currency = 'TRY',
    this.selectedSizes = const ['S', 'M', 'L', 'XL'],
    this.seriesRatio = '1-1-1-1',
    this.seriesStock = SeriesStockDistributor.defaultSeriesStock,
    this.gender = 'Kadın',
    this.season = '2026 İlkbahar/Yaz',
    this.fabricId,
  });

  Map<String, dynamic> toJson() => {
        'category_id': categoryId,
        'currency': currency,
        'selected_sizes': selectedSizes,
        'series_ratio': seriesRatio,
        'series_stock': seriesStock,
        'gender': gender,
        'season': season,
        if (fabricId != null && fabricId!.isNotEmpty) 'fabric_id': fabricId,
      };

  factory WizardSmartDefaults.fromJson(Map<String, dynamic> json) {
    final rawSizes = (json['selected_sizes'] as List?)
            ?.map((e) => e.toString().trim())
            .where((s) => s.isNotEmpty)
            .toList() ??
        const <String>[];
    final rawCurrency = (json['currency'] ?? 'TRY').toString().trim();
    final rawRatio = (json['series_ratio'] ?? '1-1-1-1').toString().trim();
    final rawStock = (json['series_stock'] as num?)?.toInt() ??
        SeriesStockDistributor.defaultSeriesStock;
    final rawGender = (json['gender'] ?? 'Kadın').toString().trim();
    final rawSeason =
        (json['season'] ?? '2026 İlkbahar/Yaz').toString().trim();
    final rawFabric = (json['fabric_id'] ?? '').toString().trim();
    return WizardSmartDefaults(
      categoryId: (json['category_id'] ?? '').toString().trim(),
      currency: rawCurrency.isEmpty ? 'TRY' : rawCurrency,
      selectedSizes:
          rawSizes.isNotEmpty ? rawSizes : const ['S', 'M', 'L', 'XL'],
      seriesRatio: rawRatio.isEmpty ? '1-1-1-1' : rawRatio,
      seriesStock: rawStock > 0
          ? rawStock
          : SeriesStockDistributor.defaultSeriesStock,
      gender: rawGender.isEmpty ? 'Kadın' : rawGender,
      season: rawSeason.isEmpty ? '2026 İlkbahar/Yaz' : rawSeason,
      fabricId: rawFabric.isEmpty ? null : rawFabric,
    );
  }
}

/// Auto-saved in-progress new product draft persisted locally until saved.
class WizardUnsavedDraft {
  final String title;
  final String priceText;
  final String buyingPriceText;
  final String currency;
  final String categoryId;
  final String? colorId;
  final String? fabricId;
  final List<WizardPhotoItem> photoItems;
  final List<String> selectedSizes;
  final String seriesRatio;
  final int seriesStock;
  final String? linkWithProductId;
  final String updatedAtIso;

  const WizardUnsavedDraft({
    this.title = '',
    this.priceText = '',
    this.buyingPriceText = '',
    this.currency = 'TRY',
    this.categoryId = '',
    this.colorId,
    this.fabricId,
    this.photoItems = const [],
    this.selectedSizes = const [],
    this.seriesRatio = '',
    this.seriesStock = SeriesStockDistributor.defaultSeriesStock,
    this.linkWithProductId,
    this.updatedAtIso = '',
  });

  bool get isMeaningful =>
      title.trim().isNotEmpty ||
      priceText.trim().isNotEmpty ||
      buyingPriceText.trim().isNotEmpty ||
      photoItems.isNotEmpty ||
      categoryId.isNotEmpty ||
      colorId != null ||
      (linkWithProductId != null && linkWithProductId!.trim().isNotEmpty);

  Map<String, dynamic> toJson() => {
        'title': title,
        'price_text': priceText,
        'buying_price_text': buyingPriceText,
        'currency': currency,
        'category_id': categoryId,
        if (colorId != null && colorId!.isNotEmpty) 'color_id': colorId,
        if (fabricId != null && fabricId!.isNotEmpty) 'fabric_id': fabricId,
        'photo_items': photoItems.map((p) => p.toJson()).toList(),
        'selected_sizes': selectedSizes,
        'series_ratio': seriesRatio,
        'series_stock': seriesStock,
        if (linkWithProductId != null && linkWithProductId!.isNotEmpty)
          'link_with_product_id': linkWithProductId,
        'updated_at': updatedAtIso.isNotEmpty
            ? updatedAtIso
            : DateTime.now().toUtc().toIso8601String(),
      };

  factory WizardUnsavedDraft.fromJson(Map<String, dynamic> json) {
    final photos = <WizardPhotoItem>[];
    if (json['photo_items'] is List) {
      for (final raw in json['photo_items'] as List) {
        if (raw is Map) {
          final item = WizardPhotoItem.fromJson(
            raw.map((k, v) => MapEntry(k.toString(), v)),
          );
          if (item != null) photos.add(item);
        }
      }
    }
    final sizes = (json['selected_sizes'] as List?)
            ?.map((e) => e.toString().trim())
            .where((s) => s.isNotEmpty)
            .toList() ??
        const <String>[];
    final rawColor = (json['color_id'] ?? '').toString().trim();
    final rawFabric = (json['fabric_id'] ?? '').toString().trim();
    final rawLink = (json['link_with_product_id'] ?? '').toString().trim();
    final rawCurrency = (json['currency'] ?? 'TRY').toString().trim();
    final rawStock = (json['series_stock'] as num?)?.toInt() ??
        SeriesStockDistributor.defaultSeriesStock;

    return WizardUnsavedDraft(
      title: (json['title'] ?? '').toString(),
      priceText: (json['price_text'] ?? '').toString(),
      buyingPriceText: (json['buying_price_text'] ?? '').toString(),
      currency: rawCurrency.isEmpty ? 'TRY' : rawCurrency,
      categoryId: (json['category_id'] ?? '').toString().trim(),
      colorId: rawColor.isEmpty ? null : rawColor,
      fabricId: rawFabric.isEmpty ? null : rawFabric,
      photoItems: photos,
      selectedSizes: sizes,
      seriesRatio: (json['series_ratio'] ?? '').toString().trim(),
      seriesStock: rawStock > 0
          ? rawStock
          : SeriesStockDistributor.defaultSeriesStock,
      linkWithProductId: rawLink.isEmpty ? null : rawLink,
      updatedAtIso: (json['updated_at'] ?? '').toString(),
    );
  }
}

/// SharedPreferences helper for smart wizard defaults and auto-saved drafts.
class WizardDraftStorage {
  WizardDraftStorage._();

  static const String defaultsKey = 'mv_supplier_wizard_smart_defaults_v1';
  static const String unsavedDraftKey = 'mv_supplier_wizard_unsaved_draft_v1';

  static Future<WizardSmartDefaults> loadDefaults({
    SharedPreferences? prefs,
  }) async {
    try {
      final store = prefs ?? await SharedPreferences.getInstance();
      final raw = store.getString(defaultsKey);
      if (raw == null || raw.trim().isEmpty) {
        return const WizardSmartDefaults();
      }
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return WizardSmartDefaults.fromJson(
          decoded.map((k, v) => MapEntry(k.toString(), v)),
        );
      }
    } catch (_) {}
    return const WizardSmartDefaults();
  }

  static Future<void> saveDefaults(
    WizardSmartDefaults defaults, {
    SharedPreferences? prefs,
  }) async {
    try {
      final store = prefs ?? await SharedPreferences.getInstance();
      await store.setString(defaultsKey, jsonEncode(defaults.toJson()));
    } catch (_) {}
  }

  static Future<WizardUnsavedDraft?> loadUnsavedDraft({
    SharedPreferences? prefs,
  }) async {
    try {
      final store = prefs ?? await SharedPreferences.getInstance();
      final raw = store.getString(unsavedDraftKey);
      if (raw == null || raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final draft = WizardUnsavedDraft.fromJson(
          decoded.map((k, v) => MapEntry(k.toString(), v)),
        );
        return draft.isMeaningful ? draft : null;
      }
    } catch (_) {}
    return null;
  }

  static Future<void> saveUnsavedDraft(
    WizardUnsavedDraft draft, {
    SharedPreferences? prefs,
  }) async {
    try {
      if (!draft.isMeaningful) return;
      final store = prefs ?? await SharedPreferences.getInstance();
      await store.setString(unsavedDraftKey, jsonEncode(draft.toJson()));
    } catch (_) {}
  }

  static Future<void> clearUnsavedDraft({SharedPreferences? prefs}) async {
    try {
      final store = prefs ?? await SharedPreferences.getInstance();
      await store.remove(unsavedDraftKey);
    } catch (_) {}
  }
}
