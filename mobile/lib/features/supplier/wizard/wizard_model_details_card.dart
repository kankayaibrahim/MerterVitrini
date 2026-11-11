import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../models/product.dart';
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
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '2. Model Adı, Kategori & Toptan Birim Fiyatı',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14.5,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Ürün Model Adı *',
                hintText: 'Örn: Kruvaze Yaka Keten Takım',
              ),
            ),
            const SizedBox(height: 10),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                final picked = await showSearchableOptionSheet(
                  context,
                  title: 'Kategori Seçiniz',
                  options: categoryOptions,
                );
                if (picked != null && picked.id.isNotEmpty) {
                  onCategoryPicked(picked);
                }
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Kategori *',
                  suffixIcon: Icon(Icons.keyboard_arrow_down_rounded),
                ),
                child: Text(
                  selectedCategoryLabel.isNotEmpty
                      ? selectedCategoryLabel
                      : 'Kategori seçmek için dokunun...',
                  style: TextStyle(
                    color: selectedCategoryLabel.isNotEmpty
                        ? AppColors.textPrimary
                        : AppColors.textMuted,
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
                      labelText: 'Tekil Toptan Fiyat ($currency) *',
                      hintText: '0.00',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 5,
                  child: Wrap(
                    spacing: 4,
                    children: ['TRY', 'USD', 'EUR'].map((curr) {
                      final active = currency == curr;
                      return ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        label: Text(
                          curr,
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight:
                                active ? FontWeight.w800 : FontWeight.w600,
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
      ),
    );
  }
}
