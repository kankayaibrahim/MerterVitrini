import 'package:flutter/material.dart';

class WizardPhotoItem {
  final String? remoteUrl;
  final String? localPath;

  const WizardPhotoItem.remote(this.remoteUrl) : localPath = null;
  const WizardPhotoItem.local(this.localPath) : remoteUrl = null;

  bool get isRemote => remoteUrl != null && remoteUrl!.isNotEmpty;
}

class EditableVariantRow {
  final TextEditingController sizeCtrl;
  final TextEditingController stockCtrl;
  final TextEditingController barcodeCtrl;
  bool isSingle;

  EditableVariantRow({
    required String size,
    int stock = 12,
    String barcode = '',
    this.isSingle = false,
  })  : sizeCtrl = TextEditingController(text: size),
        stockCtrl = TextEditingController(text: '$stock'),
        barcodeCtrl = TextEditingController(text: barcode);

  Map<String, dynamic> toPayloadJson() => {
        'size': sizeCtrl.text.trim().toUpperCase(),
        'stock': int.tryParse(stockCtrl.text.trim()) ?? 0,
        'barcode': barcodeCtrl.text.trim(),
        'is_single': isSingle,
      };

  void dispose() {
    sizeCtrl.dispose();
    stockCtrl.dispose();
    barcodeCtrl.dispose();
  }
}

/// Pure B2B domain calculator for Merter wholesale series assortment ratios.
/// Handles patterns such as `1-2-2-1`, `2-2-2`, `1,2,2,2,1`, or single `1`.
class SeriesStockDistributor {
  const SeriesStockDistributor._();

  static const List<String> seriesPresets = [
    '1-2-2-1',
    '2-2-2',
    '1-1-1-1',
    '2-2-2-2',
    '1-2-2-2-1',
    '1',
  ];

  static const List<(String, List<String>, String)> sizePresets = [
    ('S-M-L-XL', ['S', 'M', 'L', 'XL'], '1-2-2-1'),
    ('S-M-L', ['S', 'M', 'L'], '2-2-2'),
    ('M-L-XL-2XL', ['M', 'L', 'XL', '2XL'], '1-2-2-1'),
    ('36-38-40-42', ['36', '38', '40', '42'], '1-2-2-1'),
    ('36-38-40-42-44', ['36', '38', '40', '42', '44'], '1-2-2-2-1'),
    ('42-44-46-48', ['42', '44', '46', '48'], '1-2-2-1'),
    ('28-30-32-34-36', ['28', '30', '32', '34', '36'], '1-2-2-2-1'),
    ('STANDART', ['STD'], '1'),
  ];

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

