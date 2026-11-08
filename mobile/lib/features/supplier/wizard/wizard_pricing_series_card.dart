import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../core/currency_formatter.dart';
import 'wizard_models.dart';

class WizardPricingSeriesCard extends StatelessWidget {
  final TextEditingController priceCtrl;
  final TextEditingController buyingPriceCtrl;
  final TextEditingController seriesRatioCtrl;
  final TextEditingController minOrderCtrl;
  final String currency;
  final bool isActive;
  final VoidCallback onPreviewChanged;
  final ValueChanged<String> onCurrencyChanged;
  final ValueChanged<String> onSeriesPresetSelected;
  final ValueChanged<bool> onActiveChanged;

  const WizardPricingSeriesCard({
    super.key,
    required this.priceCtrl,
    required this.buyingPriceCtrl,
    required this.seriesRatioCtrl,
    required this.minOrderCtrl,
    required this.currency,
    required this.isActive,
    required this.onPreviewChanged,
    required this.onCurrencyChanged,
    required this.onSeriesPresetSelected,
    required this.onActiveChanged,
  });

  @override
  Widget build(BuildContext context) {
    final unitPricePreview =
        double.tryParse(priceCtrl.text.replaceAll(',', '.').trim()) ?? 0.0;
    final unitsPerPkgPreview =
        CurrencyFormatter.parseUnitsPerPackage(seriesRatioCtrl.text);
    final packTotalPreview = unitPricePreview * unitsPerPkgPreview;
    final sym = CurrencyFormatter.symbols[currency] ?? currency;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '3. Toptan Fiyat & Seri Paket Dağılımı',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14.5,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: priceCtrl,
                    onChanged: (_) => onPreviewChanged(),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Toptan Birim Fiyat *',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: buyingPriceCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Maliyet (Opsiyonel)',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    initialValue: ['TRY', 'USD', 'EUR'].contains(currency)
                        ? currency
                        : 'TRY',
                    decoration: const InputDecoration(labelText: 'Döviz'),
                    items: const [
                      DropdownMenuItem(value: 'TRY', child: Text('TRY')),
                      DropdownMenuItem(value: 'USD', child: Text('USD')),
                      DropdownMenuItem(value: 'EUR', child: Text('EUR')),
                    ],
                    onChanged: (v) {
                      if (v != null) onCurrencyChanged(v);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: seriesRatioCtrl,
                    onChanged: (_) => onPreviewChanged(),
                    decoration: const InputDecoration(
                      labelText: 'Seri Oranı (Asorti) *',
                      hintText: '1-2-2-1',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: minOrderCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Min. Paket'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: SeriesStockDistributor.seriesPresets.map((ratio) {
                final active = seriesRatioCtrl.text.trim() == ratio;
                return ActionChip(
                  backgroundColor: active
                      ? AppColors.accentGoldLight
                      : AppColors.background,
                  label: Text(
                    ratio,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                  onPressed: () => onSeriesPresetSelected(ratio),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.navy,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '1 Seri Paket ($unitsPerPkgPreview Adet) Toplamı:',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '$sym${packTotalPreview.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: AppColors.accentGoldLight,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: isActive,
              onChanged: onActiveChanged,
              title: const Text(
                'Kaydedildiğinde Vitrinde Aktif Yayınla',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

