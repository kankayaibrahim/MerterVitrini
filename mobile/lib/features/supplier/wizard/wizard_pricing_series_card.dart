import 'package:flutter/material.dart';

import '../../../models/product.dart';
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
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        title: const Text(
          '4. Ek Detaylar, Renk/Kumaş & Çeviri (Opsiyonel)',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13.5,
          ),
        ),
        subtitle: const Text(
          'Renk, kumaş, açıklama ve yabancı dil ayarları',
          style: TextStyle(fontSize: 11.5),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        children: [
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
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue:
                      ['Kadın', 'Erkek', 'Unisex', 'Çocuk'].contains(gender)
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
                child: TextField(
                  controller: minOrderCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Min. Sipariş (Seri)',
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
                  decoration: const InputDecoration(
                    labelText: 'Maliyet (Gizli)',
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
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Detaylı Ürün Açıklaması',
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: isActive,
            onChanged: onActiveChanged,
            title: const Text(
              'Kaydedildiğinde Vitrinde Aktif Yayınla',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          WizardTranslationsCard(
            translations: translations,
            autoTranslating: autoTranslating,
            onAutoTranslate: onAutoTranslate,
          ),
        ],
      ),
    );
  }
}
