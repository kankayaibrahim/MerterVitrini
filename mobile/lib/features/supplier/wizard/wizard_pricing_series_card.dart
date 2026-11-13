import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../core/localization.dart';
import '../../../models/product.dart';
import '../utils/supplier_l10n.dart';
import '../widgets/supplier_editorial_widgets.dart';
import 'searchable_option_sheet.dart';
import 'wizard_translations_card.dart';

class WizardPricingSeriesCard extends StatelessWidget {
  final List<SimpleOptionItem> colorOptions;
  final List<SimpleOptionItem> fabricOptions;
  final String selectedColorLabel;
  final String selectedFabricLabel;
  final String gender;
  final String season;
  final TextEditingController buyingPriceCtrl;
  final TextEditingController minOrderCtrl;
  final TextEditingController shortDescCtrl;
  final TextEditingController descCtrl;
  final bool isActive;
  final Map<String, EditableTranslationLanguageSet> translations;
  final bool autoTranslating;
  final ValueChanged<SimpleOptionItem> onColorPicked;
  final ValueChanged<SimpleOptionItem> onFabricPicked;
  final ValueChanged<String> onGenderChanged;
  final ValueChanged<String> onSeasonChanged;
  final ValueChanged<bool> onActiveChanged;
  final VoidCallback onAutoTranslate;
  final String lang;

  const WizardPricingSeriesCard({
    super.key,
    required this.colorOptions,
    required this.fabricOptions,
    required this.selectedColorLabel,
    required this.selectedFabricLabel,
    required this.gender,
    required this.season,
    required this.buyingPriceCtrl,
    required this.minOrderCtrl,
    required this.shortDescCtrl,
    required this.descCtrl,
    required this.isActive,
    required this.translations,
    required this.autoTranslating,
    required this.onColorPicked,
    required this.onFabricPicked,
    required this.onGenderChanged,
    required this.onSeasonChanged,
    required this.onActiveChanged,
    required this.onAutoTranslate,
    this.lang = 'tr',
  });

  static const List<String> _genderValues = [
    'Kadın',
    'Erkek',
    'Unisex',
    'Çocuk',
  ];

  static const List<String> _seasonValues = [
    '2026 İlkbahar/Yaz',
    '2026 Sonbahar/Kış',
    '4 Mevsim',
  ];

  @override
  Widget build(BuildContext context) {
    return EditorialSurfaceCard(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        iconColor: AppColors.obsidian,
        collapsedIconColor: AppColors.mutedAccessible,
        title: Text(
          '4. ${SupplierL10n.t(lang, 'wizard_extras_section')}',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13.5,
            color: AppColors.obsidian,
          ),
        ),
        subtitle: Text(
          SupplierL10n.t(lang, 'wizard_extras_desc'),
          style: const TextStyle(
            fontSize: 11.5,
            color: AppColors.mutedAccessible,
          ),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppColors.radiusLg),
                  onTap: () async {
                    final picked = await showSearchableOptionSheet(
                      context,
                      title: SupplierL10n.t(lang, 'wizard_color_label'),
                      options: colorOptions,
                      allowClear: true,
                      languageCode: lang,
                    );
                    if (picked != null) {
                      onColorPicked(picked);
                    }
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'color'),
                      suffixIcon: const Icon(Icons.palette_outlined, size: 18),
                    ),
                    child: Text(
                      selectedColorLabel.isNotEmpty
                          ? selectedColorLabel
                          : SupplierL10n.t(lang, 'wizard_select_placeholder'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selectedColorLabel.isNotEmpty
                            ? AppColors.obsidian
                            : AppColors.mutedAccessible,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppColors.radiusLg),
                  onTap: () async {
                    final picked = await showSearchableOptionSheet(
                      context,
                      title: SupplierL10n.t(lang, 'wizard_fabric_label'),
                      options: fabricOptions,
                      allowClear: true,
                      languageCode: lang,
                    );
                    if (picked != null) {
                      onFabricPicked(picked);
                    }
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: AppStrings.t(lang, 'fabric'),
                      suffixIcon: const Icon(Icons.texture_rounded, size: 18),
                    ),
                    child: Text(
                      selectedFabricLabel.isNotEmpty
                          ? selectedFabricLabel
                          : SupplierL10n.t(lang, 'wizard_select_placeholder'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selectedFabricLabel.isNotEmpty
                            ? AppColors.obsidian
                            : AppColors.mutedAccessible,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue:
                      _genderValues.contains(gender) ? gender : 'Kadın',
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'gender'),
                  ),
                  items: _genderValues
                      .map(
                        (val) => DropdownMenuItem(
                          value: val,
                          child: Text(
                            SupplierL10n.genderLabel(lang, val),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v != null) onGenderChanged(v);
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _seasonValues.contains(season)
                      ? season
                      : '2026 İlkbahar/Yaz',
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'season'),
                  ),
                  items: _seasonValues
                      .map(
                        (val) => DropdownMenuItem(
                          value: val,
                          child: Text(
                            SupplierL10n.seasonLabel(lang, val),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v != null) onSeasonChanged(v);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: minOrderCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(lang, 'wizard_min_order_series'),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: buyingPriceCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(lang, 'buying_price'),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: shortDescCtrl,
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'short_desc_field'),
              hintText: SupplierL10n.t(lang, 'wizard_short_desc_hint'),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: descCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'full_desc_field'),
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeTrackColor: AppColors.luxuryBronze,
            value: isActive,
            onChanged: onActiveChanged,
            title: Text(
              SupplierL10n.t(lang, 'active_in_storefront'),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
          ),
          WizardTranslationsCard(
            translations: translations,
            autoTranslating: autoTranslating,
            onAutoTranslate: onAutoTranslate,
            lang: lang,
          ),
        ],
      ),
    );
  }
}
