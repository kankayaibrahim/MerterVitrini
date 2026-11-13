import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../models/product.dart';
import '../utils/supplier_l10n.dart';
import '../widgets/supplier_editorial_widgets.dart';
import 'searchable_option_sheet.dart';

class WizardModelDetailsCard extends StatelessWidget {
  final TextEditingController titleCtrl;
  final TextEditingController priceCtrl;
  final List<SimpleOptionItem> categoryOptions;
  final String selectedCategoryLabel;
  final String currency;
  final ValueChanged<SimpleOptionItem> onCategoryPicked;
  final ValueChanged<String> onCurrencyChanged;
  final VoidCallback onPriceEdited;
  final String lang;

  const WizardModelDetailsCard({
    super.key,
    required this.titleCtrl,
    required this.priceCtrl,
    required this.categoryOptions,
    required this.selectedCategoryLabel,
    required this.currency,
    required this.onCategoryPicked,
    required this.onCurrencyChanged,
    required this.onPriceEdited,
    this.lang = 'tr',
  });

  @override
  Widget build(BuildContext context) {
    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '2. ${SupplierL10n.t(lang, 'wizard_model_section')}',
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14.5,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: titleCtrl,
            decoration: InputDecoration(
              labelText: '${SupplierL10n.t(lang, 'product_title_field')} *',
              hintText: SupplierL10n.t(lang, 'wizard_title_hint'),
            ),
          ),
          const SizedBox(height: 10),
          InkWell(
            borderRadius: BorderRadius.circular(AppColors.radiusLg),
            onTap: () async {
              final picked = await showSearchableOptionSheet(
                context,
                title: SupplierL10n.t(lang, 'wizard_category_label'),
                options: categoryOptions,
                languageCode: lang,
              );
              if (picked != null && picked.id.isNotEmpty) {
                onCategoryPicked(picked);
              }
            },
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: '${SupplierL10n.t(lang, 'wizard_category_field')} *',
                suffixIcon: const Icon(Icons.keyboard_arrow_down_rounded),
              ),
              child: Text(
                selectedCategoryLabel.isNotEmpty
                    ? selectedCategoryLabel
                    : SupplierL10n.t(lang, 'wizard_tap_category'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selectedCategoryLabel.isNotEmpty
                      ? AppColors.obsidian
                      : AppColors.mutedAccessible,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: 5,
                child: TextField(
                  controller: priceCtrl,
                  onChanged: (_) => onPriceEdited(),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText:
                        '${SupplierL10n.t(lang, 'wizard_unit_wholesale_price')} ($currency) *',
                    hintText: '0.00',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 5,
                child: Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: ['TRY', 'USD', 'EUR'].map((curr) {
                    final active = currency == curr;
                    return ChoiceChip(
                      visualDensity: VisualDensity.compact,
                      selectedColor: AppColors.obsidian,
                      backgroundColor: AppColors.warmSurface,
                      side: BorderSide(
                        color: active
                            ? AppColors.obsidian
                            : AppColors.warmHairline,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      label: Text(
                        curr,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight:
                              active ? FontWeight.w800 : FontWeight.w600,
                          color:
                              active ? AppColors.pureWhite : AppColors.obsidian,
                        ),
                      ),
                      selected: active,
                      onSelected: (_) => onCurrencyChanged(curr),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
