import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import 'wizard_models.dart';

class WizardVariantsMatrixCard extends StatelessWidget {
  final List<EditableVariantRow> variants;
  final TextEditingController packStockMultiplierCtrl;
  final VoidCallback onAddVariant;
  final ValueChanged<int> onRemoveVariant;
  final void Function(List<String> sizes, String suggestedRatio)
      onApplySizePreset;
  final VoidCallback onDistributeStock;

  const WizardVariantsMatrixCard({
    super.key,
    required this.variants,
    required this.packStockMultiplierCtrl,
    required this.onAddVariant,
    required this.onRemoveVariant,
    required this.onApplySizePreset,
    required this.onDistributeStock,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '4. Beden Varyantları & Stok Matrisi',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14.5,
                  ),
                ),
                TextButton.icon(
                  onPressed: onAddVariant,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Beden Ekle'),
                ),
              ],
            ),
            const Text(
              'Hazır Beden Serisi Şablonları:',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: SeriesStockDistributor.sizePresets.map((preset) {
                return ActionChip(
                  label: Text(
                    preset.$1,
                    style: const TextStyle(fontSize: 11.5),
                  ),
                  onPressed: () => onApplySizePreset(preset.$2, preset.$3),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: packStockMultiplierCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Eldeki Seri Paket Sayısı',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: onDistributeStock,
                  icon: const Icon(Icons.auto_fix_high_rounded, size: 16),
                  label: const Text('Stok Dağıt'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...variants.asMap().entries.map((entry) {
              final idx = entry.key;
              final row = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: row.sizeCtrl,
                        decoration: const InputDecoration(labelText: 'Beden'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: row.stockCtrl,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Adet Stok'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: row.barcodeCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Barkod (Ops.)'),
                      ),
                    ),
                    if (variants.length > 1)
                      IconButton(
                        onPressed: () => onRemoveVariant(idx),
                        icon: const Icon(
                          Icons.remove_circle_outline,
                          color: AppColors.danger,
                        ),
                      ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

