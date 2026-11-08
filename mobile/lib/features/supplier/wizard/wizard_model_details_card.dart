import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../models/product.dart';
import 'searchable_option_sheet.dart';

class WizardModelDetailsCard extends StatelessWidget {
  final TextEditingController titleCtrl;
  final TextEditingController shortDescCtrl;
  final TextEditingController descCtrl;
  final List<SimpleOptionItem> categoryOptions;
  final List<SimpleOptionItem> colorOptions;
  final List<SimpleOptionItem> fabricOptions;
  final String selectedCategoryLabel;
  final String selectedColorLabel;
  final String selectedFabricLabel;
  final String gender;
  final String season;
  final ValueChanged<SimpleOptionItem> onCategoryPicked;
  final ValueChanged<SimpleOptionItem> onColorPicked;
  final ValueChanged<SimpleOptionItem> onFabricPicked;
  final ValueChanged<String> onGenderChanged;
  final ValueChanged<String> onSeasonChanged;

  const WizardModelDetailsCard({
    super.key,
    required this.titleCtrl,
    required this.shortDescCtrl,
    required this.descCtrl,
    required this.categoryOptions,
    required this.colorOptions,
    required this.fabricOptions,
    required this.selectedCategoryLabel,
    required this.selectedColorLabel,
    required this.selectedFabricLabel,
    required this.gender,
    required this.season,
    required this.onCategoryPicked,
    required this.onColorPicked,
    required this.onFabricPicked,
    required this.onGenderChanged,
    required this.onSeasonChanged,
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
              '2. Model Bilgileri, Kategori & Kumaş',
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
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: ['Kadın', 'Erkek', 'Unisex', 'Çocuk']
                            .contains(gender)
                        ? gender
                        : 'Kadın',
                    decoration: const InputDecoration(labelText: 'Cinsiyet'),
                    items: const [
                      DropdownMenuItem(value: 'Kadın', child: Text('Kadın')),
                      DropdownMenuItem(value: 'Erkek', child: Text('Erkek')),
                      DropdownMenuItem(value: 'Unisex', child: Text('Unisex')),
                      DropdownMenuItem(value: 'Çocuk', child: Text('Çocuk')),
                    ],
                    onChanged: (v) {
                      if (v != null) onGenderChanged(v);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: [
                      '2026 İlkbahar/Yaz',
                      '2026 Sonbahar/Kış',
                      '4 Mevsim',
                    ].contains(season)
                        ? season
                        : '2026 İlkbahar/Yaz',
                    decoration: const InputDecoration(labelText: 'Sezon'),
                    items: const [
                      DropdownMenuItem(
                        value: '2026 İlkbahar/Yaz',
                        child: Text('İlkbahar/Yaz'),
                      ),
                      DropdownMenuItem(
                        value: '2026 Sonbahar/Kış',
                        child: Text('Sonbahar/Kış'),
                      ),
                      DropdownMenuItem(
                        value: '4 Mevsim',
                        child: Text('4 Mevsim'),
                      ),
                    ],
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
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      final picked = await showSearchableOptionSheet(
                        context,
                        title: 'Renk Seçiniz',
                        options: colorOptions,
                        allowClear: true,
                      );
                      if (picked != null) {
                        onColorPicked(picked);
                      }
                    },
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Renk',
                        suffixIcon: Icon(Icons.palette_outlined, size: 18),
                      ),
                      child: Text(
                        selectedColorLabel.isNotEmpty
                            ? selectedColorLabel
                            : 'Seçiniz',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      final picked = await showSearchableOptionSheet(
                        context,
                        title: 'Kumaş Tipi Seçiniz',
                        options: fabricOptions,
                        allowClear: true,
                      );
                      if (picked != null) {
                        onFabricPicked(picked);
                      }
                    },
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Kumaş',
                        suffixIcon: Icon(Icons.texture_rounded, size: 18),
                      ),
                      child: Text(
                        selectedFabricLabel.isNotEmpty
                            ? selectedFabricLabel
                            : 'Seçiniz',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: shortDescCtrl,
              decoration: const InputDecoration(
                labelText: 'Kısa Özet (Kalıp / Kumaş Oranı)',
                hintText: 'Örn: %100 Pamuk, Tam Kalıp',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Detaylı Ürün Açıklaması',
                hintText:
                    'Model ölçüleri, yıkama talimatı ve ihracat paket detayları...',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

