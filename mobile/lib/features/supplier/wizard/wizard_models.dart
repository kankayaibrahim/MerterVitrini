import '../../../models/product.dart';

class WizardPhotoItem {
  final String? remoteUrl;
  final String? localPath;

  const WizardPhotoItem.remote(this.remoteUrl) : localPath = null;
  const WizardPhotoItem.local(this.localPath) : remoteUrl = null;

  bool get isRemote => remoteUrl != null && remoteUrl!.isNotEmpty;
}

/// Pure B2B domain calculator & predefined size catalog for Merter wholesale series.
class SeriesStockDistributor {
  const SeriesStockDistributor._();

  static const int defaultSeriesStock = 100;

  static const List<int> seriesStockPresets = [25, 50, 100, 250, 500];

  static const List<String> seriesPresets = [
    '1-2-2-1',
    '2-2-2',
    '1-1-1-1',
    '2-2-2-2',
    '1-2-2-2-1',
    '1',
  ];

  static const List<(String, List<String>, String)> sizePresets = [
    ('S-M-L-XL', ['S', 'M', 'L', 'XL'], '1-1-1-1'),
    ('S-M-L', ['S', 'M', 'L'], '1-1-1'),
    ('M-L-XL-2XL', ['M', 'L', 'XL', '2XL'], '1-1-1-1'),
    ('36-38-40-42', ['36', '38', '40', '42'], '1-1-1-1'),
    ('36-38-40-42-44', ['36', '38', '40', '42', '44'], '1-2-2-2-1'),
    ('42-44-46-48', ['42', '44', '46', '48'], '1-1-1-1'),
    ('28-30-32-34-36', ['28', '30', '32', '34', '36'], '1-1-1-1-1'),
    ('STANDART', ['STD'], '1'),
  ];

  static const List<(String, String)> sizeGroups = [
    ('letter', 'Harf (XS-5XL)'),
    ('numeric_eu', 'Sayısal (34-54)'),
    ('combo', 'İkili Kalıp'),
    ('jeans', 'Kot / Jean'),
    ('kids', 'Çocuk / Yaş'),
    ('shoes', 'Ayakkabı'),
    ('standard', 'Tek Beden'),
  ];

  static const List<SizeDefinitionOption> fallbackSizeDefinitions = [
    SizeDefinitionOption(id: 'sz-xs', code: 'XS', label: 'XS', sizeGroup: 'letter', sortOrder: 10),
    SizeDefinitionOption(id: 'sz-s', code: 'S', label: 'S', sizeGroup: 'letter', sortOrder: 20),
    SizeDefinitionOption(id: 'sz-m', code: 'M', label: 'M', sizeGroup: 'letter', sortOrder: 30),
    SizeDefinitionOption(id: 'sz-l', code: 'L', label: 'L', sizeGroup: 'letter', sortOrder: 40),
    SizeDefinitionOption(id: 'sz-xl', code: 'XL', label: 'XL', sizeGroup: 'letter', sortOrder: 50),
    SizeDefinitionOption(id: 'sz-2xl', code: '2XL', label: '2XL', sizeGroup: 'letter', sortOrder: 60),
    SizeDefinitionOption(id: 'sz-3xl', code: '3XL', label: '3XL', sizeGroup: 'letter', sortOrder: 70),
    SizeDefinitionOption(id: 'sz-4xl', code: '4XL', label: '4XL', sizeGroup: 'letter', sortOrder: 80),
    SizeDefinitionOption(id: 'sz-5xl', code: '5XL', label: '5XL', sizeGroup: 'letter', sortOrder: 90),
    SizeDefinitionOption(id: 'sz-sm', code: 'S-M', label: 'S-M', sizeGroup: 'combo', sortOrder: 110),
    SizeDefinitionOption(id: 'sz-ml', code: 'M-L', label: 'M-L', sizeGroup: 'combo', sortOrder: 120),
    SizeDefinitionOption(id: 'sz-lxl', code: 'L-XL', label: 'L-XL', sizeGroup: 'combo', sortOrder: 130),
    SizeDefinitionOption(id: 'sz-2xl3xl', code: '2XL-3XL', label: '2XL-3XL', sizeGroup: 'combo', sortOrder: 140),
    SizeDefinitionOption(id: 'sz-34', code: '34', label: '34', sizeGroup: 'numeric_eu', sortOrder: 200),
    SizeDefinitionOption(id: 'sz-36', code: '36', label: '36', sizeGroup: 'numeric_eu', sortOrder: 210),
    SizeDefinitionOption(id: 'sz-38', code: '38', label: '38', sizeGroup: 'numeric_eu', sortOrder: 220),
    SizeDefinitionOption(id: 'sz-40', code: '40', label: '40', sizeGroup: 'numeric_eu', sortOrder: 230),
    SizeDefinitionOption(id: 'sz-42', code: '42', label: '42', sizeGroup: 'numeric_eu', sortOrder: 240),
    SizeDefinitionOption(id: 'sz-44', code: '44', label: '44', sizeGroup: 'numeric_eu', sortOrder: 250),
    SizeDefinitionOption(id: 'sz-46', code: '46', label: '46', sizeGroup: 'numeric_eu', sortOrder: 260),
    SizeDefinitionOption(id: 'sz-48', code: '48', label: '48', sizeGroup: 'numeric_eu', sortOrder: 270),
    SizeDefinitionOption(id: 'sz-50', code: '50', label: '50', sizeGroup: 'numeric_eu', sortOrder: 280),
    SizeDefinitionOption(id: 'sz-52', code: '52', label: '52', sizeGroup: 'numeric_eu', sortOrder: 290),
    SizeDefinitionOption(id: 'sz-j28', code: '28', label: '28', sizeGroup: 'jeans', sortOrder: 310),
    SizeDefinitionOption(id: 'sz-j29', code: '29', label: '29', sizeGroup: 'jeans', sortOrder: 315),
    SizeDefinitionOption(id: 'sz-j30', code: '30', label: '30', sizeGroup: 'jeans', sortOrder: 320),
    SizeDefinitionOption(id: 'sz-j31', code: '31', label: '31', sizeGroup: 'jeans', sortOrder: 325),
    SizeDefinitionOption(id: 'sz-j32', code: '32', label: '32', sizeGroup: 'jeans', sortOrder: 330),
    SizeDefinitionOption(id: 'sz-j33', code: '33', label: '33', sizeGroup: 'jeans', sortOrder: 335),
    SizeDefinitionOption(id: 'sz-j34', code: '34', label: '34', sizeGroup: 'jeans', sortOrder: 340),
    SizeDefinitionOption(id: 'sz-j36', code: '36', label: '36', sizeGroup: 'jeans', sortOrder: 350),
    SizeDefinitionOption(id: 'sz-k34', code: '3-4 Yaş', label: '3-4 Yaş', sizeGroup: 'kids', sortOrder: 410),
    SizeDefinitionOption(id: 'sz-k56', code: '5-6 Yaş', label: '5-6 Yaş', sizeGroup: 'kids', sortOrder: 420),
    SizeDefinitionOption(id: 'sz-k78', code: '7-8 Yaş', label: '7-8 Yaş', sizeGroup: 'kids', sortOrder: 430),
    SizeDefinitionOption(id: 'sz-k910', code: '9-10 Yaş', label: '9-10 Yaş', sizeGroup: 'kids', sortOrder: 440),
    SizeDefinitionOption(id: 'sz-k1112', code: '11-12 Yaş', label: '11-12 Yaş', sizeGroup: 'kids', sortOrder: 450),
    SizeDefinitionOption(id: 'sz-sh36', code: '36', label: '36', sizeGroup: 'shoes', sortOrder: 500),
    SizeDefinitionOption(id: 'sz-sh37', code: '37', label: '37', sizeGroup: 'shoes', sortOrder: 510),
    SizeDefinitionOption(id: 'sz-sh38', code: '38', label: '38', sizeGroup: 'shoes', sortOrder: 520),
    SizeDefinitionOption(id: 'sz-sh39', code: '39', label: '39', sizeGroup: 'shoes', sortOrder: 530),
    SizeDefinitionOption(id: 'sz-sh40', code: '40', label: '40', sizeGroup: 'shoes', sortOrder: 540),
    SizeDefinitionOption(id: 'sz-std', code: 'STD', label: 'Standart (Tek Beden)', sizeGroup: 'standard', sortOrder: 600),
  ];

  static const List<SeriesTemplateOption> fallbackSeriesTemplates = [
    SeriesTemplateOption(
      id: 'tpl-s-xl-4',
      templateKey: 's_xl_4',
      name: "S-M-L-XL (4'lü)",
      categoryHint: 'Üst Giyim',
      sizes: ['S', 'M', 'L', 'XL'],
      seriesRatio: '1-1-1-1',
      unitsPerSeries: 4,
      sortOrder: 10,
    ),
    SeriesTemplateOption(
      id: 'tpl-s-l-3',
      templateKey: 's_l_3',
      name: "S-M-L (3'lü)",
      categoryHint: 'Kadın',
      sizes: ['S', 'M', 'L'],
      seriesRatio: '1-1-1',
      unitsPerSeries: 3,
      sortOrder: 20,
    ),
    SeriesTemplateOption(
      id: 'tpl-s-xl-6',
      templateKey: 's_xl_6',
      name: "S-M-L-XL (6'lı Asorti)",
      categoryHint: 'Tişört / Triko',
      sizes: ['S', 'M', 'L', 'XL'],
      seriesRatio: '1-2-2-1',
      unitsPerSeries: 6,
      sortOrder: 30,
    ),
    SeriesTemplateOption(
      id: 'tpl-36-42',
      templateKey: 'eu_36_42',
      name: "36-38-40-42 (4'lü)",
      categoryHint: 'Elbise / Takım',
      sizes: ['36', '38', '40', '42'],
      seriesRatio: '1-1-1-1',
      unitsPerSeries: 4,
      sortOrder: 40,
    ),
    SeriesTemplateOption(
      id: 'tpl-42-48',
      templateKey: 'plus_42_48',
      name: '42-44-46-48 (Büyük)',
      categoryHint: 'Büyük Beden',
      sizes: ['42', '44', '46', '48'],
      seriesRatio: '1-1-1-1',
      unitsPerSeries: 4,
      sortOrder: 50,
    ),
    SeriesTemplateOption(
      id: 'tpl-combo',
      templateKey: 'combo_sm_lxl',
      name: 'S-M / L-XL (İkili)',
      categoryHint: 'Oversize',
      sizes: ['S-M', 'L-XL'],
      seriesRatio: '2-2',
      unitsPerSeries: 4,
      sortOrder: 60,
    ),
    SeriesTemplateOption(
      id: 'tpl-jeans',
      templateKey: 'jeans_28_36',
      name: '28-30-32-34-36',
      categoryHint: 'Jean',
      sizes: ['28', '30', '32', '34', '36'],
      seriesRatio: '1-1-1-1-1',
      unitsPerSeries: 5,
      sortOrder: 70,
    ),
    SeriesTemplateOption(
      id: 'tpl-std',
      templateKey: 'std_1',
      name: 'Standart (STD)',
      categoryHint: 'Tek Beden',
      sizes: ['STD'],
      seriesRatio: '1',
      unitsPerSeries: 1,
      sortOrder: 80,
    ),
  ];

  static String buildRatioForAssortment(int sizeCount, String mode) {
    final safeCount = sizeCount <= 0 ? 1 : sizeCount;
    if (mode == 'double') {
      return List<String>.filled(safeCount, '2').join('-');
    }
    if (mode == 'middle_double' && safeCount >= 3) {
      return List<String>.generate(safeCount, (idx) {
        final isEdge = idx == 0 || idx == safeCount - 1;
        return isEdge ? '1' : '2';
      }).join('-');
    }
    return List<String>.filled(safeCount, '1').join('-');
  }

  static String detectAssortmentMode(String rawRatio, int sizeCount) {
    final weights = parseRatioWeights(rawRatio);
    if (weights.length != sizeCount || sizeCount <= 0) {
      return 'single';
    }
    if (weights.every((w) => w == 2)) {
      return 'double';
    }
    if (sizeCount >= 3 &&
        weights.first == 1 &&
        weights.last == 1 &&
        weights.any((w) => w == 2)) {
      return 'middle_double';
    }
    return 'single';
  }

  static List<String> sortSelectedSizes(
    List<String> sizes,
    List<SizeDefinitionOption> definitions,
  ) {
    final defs =
        definitions.isNotEmpty ? definitions : fallbackSizeDefinitions;
    final orderMap = <String, int>{};
    for (final d in defs) {
      final prev = orderMap[d.code];
      if (prev == null || d.sortOrder < prev) {
        orderMap[d.code] = d.sortOrder;
      }
    }
    final sorted = List<String>.of(sizes);
    sorted.sort((a, b) {
      final oa = orderMap[a] ?? 9999;
      final ob = orderMap[b] ?? 9999;
      if (oa != ob) return oa.compareTo(ob);
      return a.compareTo(b);
    });
    return sorted;
  }

  /// Parses a series ratio string (e.g. `1-2-2-1`) into positive integer weights.
  static List<int> parseRatioWeights(String rawRatio) {
    final trimmed = rawRatio.trim();
    if (trimmed.isEmpty) {
      return const <int>[1];
    }
    final weights = trimmed
        .split(RegExp(r'[-,/+\s:]+'))
        .where((part) => part.trim().isNotEmpty)
        .map((part) {
          final parsed = int.tryParse(part.trim());
          return (parsed == null || parsed <= 0) ? 1 : parsed;
        })
        .toList();
    return weights.isEmpty ? const <int>[1] : weights;
  }

  /// Computes per-variant unit stocks for [variantCount] sizes given [rawRatio]
  /// and [packageCount] wholesale series packages.
  static List<int> computeVariantStocks({
    required int variantCount,
    required String rawRatio,
    required int packageCount,
  }) {
    if (variantCount <= 0) {
      return const <int>[];
    }
    final effectivePacks = packageCount <= 0 ? 1 : packageCount;
    final weights = parseRatioWeights(rawRatio);
    return List<int>.generate(variantCount, (idx) {
      final weight = idx < weights.length ? weights[idx] : 1;
      return weight * effectivePacks;
    });
  }
}
