import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../core/currency_formatter.dart';
import '../../../models/product.dart';
import '../utils/supplier_l10n.dart';
import '../widgets/supplier_editorial_widgets.dart';
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
  final String lang;

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
    this.lang = 'tr',
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
    final lang = widget.lang;
    final defs = widget.sizeDefinitions.isNotEmpty
        ? widget.sizeDefinitions
        : SeriesStockDistributor.fallbackSizeDefinitions;
    final templates = widget.seriesTemplates.isNotEmpty
        ? widget.seriesTemplates
        : SeriesStockDistributor.fallbackSeriesTemplates;

    final groupSizes = defs.where((d) => d.sizeGroup == _activeGroup).toList();
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
    final activeMode = SeriesStockDistributor.detectAssortmentMode(
      widget.seriesRatio,
      widget.selectedSizes.length,
    );

    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '3. ${SupplierL10n.t(lang, 'wizard_variants_section')}',
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14.5,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            SupplierL10n.t(lang, 'wizard_variants_desc'),
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.mutedAccessible,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            SupplierL10n.t(lang, 'wizard_series_template'),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: templates.map((tpl) {
              final selected = _isTemplateActive(tpl);
              return ChoiceChip(
                selectedColor: AppColors.obsidian,
                backgroundColor: AppColors.warmSurface,
                side: BorderSide(
                  color:
                      selected ? AppColors.obsidian : AppColors.warmHairline,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                label: Text(
                  tpl.name,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected ? AppColors.pureWhite : AppColors.obsidian,
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
          const Divider(height: 22, color: AppColors.warmHairline),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${SupplierL10n.t(lang, 'wizard_pick_sizes')} *',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  widget.selectedSizes.join(' - '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.luxuryBronze,
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
                  padding: const EdgeInsetsDirectional.only(end: 6),
                  child: ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    selectedColor: AppColors.accentGoldLight,
                    backgroundColor: AppColors.pureWhite,
                    side: BorderSide(
                      color: isCurrent
                          ? AppColors.luxuryBronze
                          : AppColors.warmHairline,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                    label: Text(
                      SupplierL10n.sizeGroupLabel(lang, g.$1),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight:
                            isCurrent ? FontWeight.w800 : FontWeight.w600,
                        color: isCurrent
                            ? AppColors.luxuryBronze
                            : AppColors.obsidian,
                      ),
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
                selectedColor: AppColors.obsidian,
                checkmarkColor: AppColors.pureWhite,
                backgroundColor: AppColors.warmSurface,
                side: BorderSide(
                  color:
                      isPicked ? AppColors.obsidian : AppColors.warmHairline,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                label: Text(
                  sz.label,
                  style: TextStyle(
                    fontWeight: isPicked ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 12,
                    color: isPicked ? AppColors.pureWhite : AppColors.obsidian,
                  ),
                ),
                selected: isPicked,
                onSelected: (_) => widget.onToggleSize(sz.code),
              );
            }).toList(),
          ),
          if (widget.selectedSizes.length > 1) ...[
            const SizedBox(height: 12),
            Text(
              SupplierL10n.t(lang, 'wizard_assortment_title'),
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: AppColors.mutedAccessible,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ChoiceChip(
                  visualDensity: VisualDensity.compact,
                  selectedColor: AppColors.luxuryBronze,
                  backgroundColor: AppColors.warmSurface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  label: Text(
                    '${SupplierL10n.t(lang, 'wizard_assort_single')} (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'single')})',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: activeMode == 'single'
                          ? AppColors.pureWhite
                          : AppColors.obsidian,
                    ),
                  ),
                  selected: activeMode == 'single',
                  onSelected: (_) => widget.onAssortmentModeChanged('single'),
                ),
                if (widget.selectedSizes.length >= 3)
                  ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    selectedColor: AppColors.luxuryBronze,
                    backgroundColor: AppColors.warmSurface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    ),
                    label: Text(
                      '${SupplierL10n.t(lang, 'wizard_assort_middle_double')} (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'middle_double')})',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: activeMode == 'middle_double'
                            ? AppColors.pureWhite
                            : AppColors.obsidian,
                      ),
                    ),
                    selected: activeMode == 'middle_double',
                    onSelected: (_) =>
                        widget.onAssortmentModeChanged('middle_double'),
                  ),
                ChoiceChip(
                  visualDensity: VisualDensity.compact,
                  selectedColor: AppColors.luxuryBronze,
                  backgroundColor: AppColors.warmSurface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  label: Text(
                    '${SupplierL10n.t(lang, 'wizard_assort_double')} (${SeriesStockDistributor.buildRatioForAssortment(widget.selectedSizes.length, 'double')})',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: activeMode == 'double'
                          ? AppColors.pureWhite
                          : AppColors.obsidian,
                    ),
                  ),
                  selected: activeMode == 'double',
                  onSelected: (_) => widget.onAssortmentModeChanged('double'),
                ),
              ],
            ),
          ],
          const Divider(height: 22, color: AppColors.warmHairline),
          Text(
            SupplierL10n.t(lang, 'wizard_est_series_title'),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: AppColors.obsidian,
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
                selectedColor: AppColors.obsidian,
                backgroundColor: AppColors.warmSurface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                label: Text(
                  '$cnt ${SupplierL10n.t(lang, 'series_unit_short')}',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    color: active ? AppColors.pureWhite : AppColors.obsidian,
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
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'wizard_total_series_stock'),
              suffixText: SupplierL10n.t(lang, 'series_unit_short'),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warmSurface,
              borderRadius: BorderRadius.circular(AppColors.radiusLg),
              border: Border.all(color: AppColors.warmHairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        SupplierL10n.seriesPackPriceLabel(lang, unitsPerSeries),
                        style: const TextStyle(
                          color: AppColors.obsidian,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      CurrencyFormatter.format(
                        packagePrice,
                        currency: widget.currency,
                      ),
                      style: const TextStyle(
                        color: AppColors.luxuryBronze,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  SupplierL10n.seriesStockSummaryLabel(
                    lang,
                    safeSeriesCount,
                    totalPieces,
                    widget.selectedSizes.join(', '),
                  ),
                  style: const TextStyle(
                    color: AppColors.mutedAccessible,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
