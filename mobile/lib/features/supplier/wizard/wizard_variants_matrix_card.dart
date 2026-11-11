import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../core/currency_formatter.dart';
import '../../../models/product.dart';
import 'wizard_models.dart';

class WizardVariantsMatrixCard extends StatefulWidget {
  final List<SizeDefinitionOption> sizeDefinitions;
  final List<SeriesTemplateOption> seriesTemplates;
  final List<String> selectedSizes;
  final String seriesRatio;
  final TextEditingController seriesStockCtrl;
  final double unitPrice;
  final String currency;
  final ValueChanged<String> onToggleSize;
  final ValueChanged<SeriesTemplateOption> onApplyTemplate;
  final ValueChanged<String> onAssortmentModeChanged;
  final ValueChanged<int> onSeriesStockPresetPicked;
  final VoidCallback onSeriesStockEdited;

  const WizardVariantsMatrixCard({
    super.key,
    required this.sizeDefinitions,
    required this.seriesTemplates,
    required this.selectedSizes,
    required this.seriesRatio,
    required this.seriesStockCtrl,
    required this.unitPrice,
    required this.currency,
    required this.onToggleSize,
    required this.onApplyTemplate,
    required this.onAssortmentModeChanged,
    required this.onSeriesStockPresetPicked,
    required this.onSeriesStockEdited,
  });

  @override
  State<WizardVariantsMatrixCard> createState() =>
      _WizardVariantsMatrixCardState();
}

class _WizardVariantsMatrixCardState extends State<WizardVariantsMatrixCard> {
  String _activeGroup = 'letter';

  @override
  void initState() {
    super.initState();
    _syncGroupWithSelection();
  }

  void _syncGroupWithSelection() {
    if (widget.selectedSizes.isEmpty) return;
    final defs = widget.sizeDefinitions.isNotEmpty
        ? widget.sizeDefinitions
        : SeriesStockDistributor.fallbackSizeDefinitions;
    final first = widget.selectedSizes.first;
    for (final d in defs) {
      if (d.code == first) {
        _activeGroup = d.sizeGroup;
        return;
      }
    }
  }

  bool _isTemplateActive(SeriesTemplateOption tpl) {
    if (tpl.sizes.length != widget.selectedSizes.length) return false;
    if (tpl.seriesRatio != widget.seriesRatio) return false;
    for (var i = 0; i < tpl.sizes.length; i++) {
      if (tpl.sizes[i] != widget.selectedSizes[i]) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final defs = widget.sizeDefinitions.isNotEmpty
        ? widget.sizeDefinitions
        : SeriesStockDistributor.fallbackSizeDefinitions;
    final templates = widget.seriesTemplates.isNotEmpty
        ? widget.seriesTemplates
        : SeriesStockDistributor.fallbackSeriesTemplates;

    final groupSizes =
        defs.where((d) => d.sizeGroup == _activeGroup).toList();
    final weights = SeriesStockDistributor.parseRatioWeights(widget.seriesRatio);
    var unitsPerSeries = 0;
    for (var i = 0; i < widget.selectedSizes.length; i++) {
      unitsPerSeries += i < weights.length ? weights[i] : 1;
    }
    if (unitsPerSeries <= 0) unitsPerSeries = 1;

    final seriesCount = int.tryParse(widget.seriesStockCtrl.text.trim()) ??
        SeriesStockDistributor.defaultSeriesStock;
    final safeSeriesCount = seriesCount <= 0
        ? SeriesStockDistributor.defaultSeriesStock
        : seriesCount;
    final totalPieces = unitsPerSeries * safeSeriesCount;
    final packagePrice = widget.unitPrice * unitsPerSeries;
    final sym =
        CurrencyFormatter.symbols[widget.currency] ?? widget.currency;
    final activeMode = SeriesStockDistributor.detectAssortmentMode(
      widget.seriesRatio,
      widget.selectedSizes.length,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '3. Seçmeli Beden Serisi & Eldeki Tahmini Seri',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14.5,
              ),
            ),
            const SizedBox(height: 3),
            const Text(
              'Beden yazmanıza veya tek tek adet girmenize gerek yoktur; şablondan ya da listeden seçin.',
              style: TextStyle(
                fontSize: 11.5,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),

            // 1-Tap Series Templates
            const Text(
              'Hazır Merter Seri Şablonları (Tek Dokunuşla Seç):',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: templates.map((tpl) {
                final selected = _isTemplateActive(tpl);
                return ChoiceChip(
                  label: Text(
                    tpl.name,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight:
                          selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                  selected: selected,
                  onSelected: (_) {
                    widget.onApplyTemplate(tpl);
                    setState(_syncGroupWithSelection);
                  },
                );
              }).toList(),
            ),

            const Divider(height: 22),

            // Predefined Size Definitions Picker (Zero Free-Text)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Beden Tanım Tablosundan Seçin *',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Flexible(
                  child: Text(
                    widget.selectedSizes.join(' - '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.accentGold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: SeriesStockDistributor.sizeGroups.map((g) {
                  final isCurrent = _activeGroup == g.$1;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      visualDensity: VisualDensity.compact,
                      label: Text(
                        g.$2,
                        style: const TextStyle(fontSize: 11),
                      ),
                      selected: isCurrent,
                      onSelected: (_) => setState(() => _activeGroup = g.$1),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: groupSizes.map((sz) {
                final isPicked = widget.selectedSizes.contains(sz.code);
                return FilterChip(
                  label: Text(
                    sz.label,
                    style: TextStyle(
                      fontWeight:
                          isPicked ? FontWeight.w800 : FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  selected: isPicked,
                  onSelected: (_) => widget.onToggleSize(sz.code),
                );
              }).toList(),
            ),

            if (widget.selectedSizes.length > 1) ...[
              const SizedBox(height: 12),
              const Text(
                '1 Serideki Beden Dağılımı (Asorti):',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      "Her Beden 1'er (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'single')})",
                      style: const TextStyle(fontSize: 11),
                    ),
                    selected: activeMode == 'single',
                    onSelected: (_) =>
                        widget.onAssortmentModeChanged('single'),
                  ),
                  if (widget.selectedSizes.length >= 3)
                    ChoiceChip(
                      visualDensity: VisualDensity.compact,
                      label: Text(
                        'Orta Çift (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'middle_double')})',
                        style: const TextStyle(fontSize: 11),
                      ),
                      selected: activeMode == 'middle_double',
                      onSelected: (_) =>
                          widget.onAssortmentModeChanged('middle_double'),
                    ),
                  ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      "Çiftli Seri (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'double')})",
                      style: const TextStyle(fontSize: 11),
                    ),
                    selected: activeMode == 'double',
                    onSelected: (_) =>
                        widget.onAssortmentModeChanged('double'),
                  ),
                ],
              ),
            ],

            const Divider(height: 22),

            // Estimated Series Count (Default 100 Series)
            const Text(
              'Eldeki Tahmini Seri Adedi (Varsayılan: 100 Seri):',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: SeriesStockDistributor.seriesStockPresets.map((cnt) {
                final active = safeSeriesCount == cnt;
                return ChoiceChip(
                  visualDensity: VisualDensity.compact,
                  label: Text(
                    '$cnt Seri',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                  selected: active,
                  onSelected: (_) => widget.onSeriesStockPresetPicked(cnt),
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: widget.seriesStockCtrl,
              keyboardType: TextInputType.number,
              onChanged: (_) => widget.onSeriesStockEdited(),
              decoration: const InputDecoration(
                labelText: 'Eldeki Tahmini Seri Sayısı',
                suffixText: 'Seri',
              ),
            ),

            const SizedBox(height: 12),

            // Live Series & Stock Summary Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.navy,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '1 Seri ($unitsPerSeries Adet) Paket Fiyatı:',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '$sym${packagePrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: AppColors.accentGoldLight,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Stok Özeti: ~$safeSeriesCount Seri • Toplam $totalPieces Adet (${widget.selectedSizes.join(", ")})',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
