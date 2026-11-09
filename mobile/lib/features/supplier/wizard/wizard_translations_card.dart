import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';

class EditableTranslationLanguageSet {
  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController shortDescCtrl = TextEditingController();
  final TextEditingController descCtrl = TextEditingController();

  void dispose() {
    titleCtrl.dispose();
    shortDescCtrl.dispose();
    descCtrl.dispose();
  }
}

class WizardTranslationsCard extends StatefulWidget {
  final Map<String, EditableTranslationLanguageSet> translations;
  final bool autoTranslating;
  final VoidCallback onAutoTranslate;

  const WizardTranslationsCard({
    super.key,
    required this.translations,
    required this.autoTranslating,
    required this.onAutoTranslate,
  });

  @override
  State<WizardTranslationsCard> createState() => _WizardTranslationsCardState();
}

class _WizardTranslationsCardState extends State<WizardTranslationsCard> {
  String _activeLang = 'en';

  static const _langs = <({String code, String label, bool rtl})>[
    (code: 'en', label: '🇬🇧 EN', rtl: false),
    (code: 'ru', label: '🇷🇺 RU', rtl: false),
    (code: 'ar', label: '🇸🇦 AR (RTL)', rtl: true),
  ];

  @override
  Widget build(BuildContext context) {
    final activeSet = widget.translations[_activeLang];
    final isRtl = _activeLang == 'ar';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.translate_rounded,
                  size: 18, color: AppColors.navy),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  '5. Çok Dilli Çeviriler (EN / RU / AR)',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed:
                    widget.autoTranslating ? null : widget.onAutoTranslate,
                icon: widget.autoTranslating
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 15),
                label: Text(
                  widget.autoTranslating ? 'Çevriliyor...' : 'Otomatik Çevir',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Türkçe ürün başlığı ve açıklamasını tek dokunuşla İngilizce, Rusça ve Arapça\'ya çevirebilir veya elle düzenleyebilirsiniz.',
            style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: _langs.map((l) {
              final selected = _activeLang == l.code;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: ChoiceChip(
                    label: Text(
                      l.label,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: selected ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    selected: selected,
                    selectedColor: AppColors.navy,
                    onSelected: (_) => setState(() => _activeLang = l.code),
                  ),
                ),
              );
            }).toList(),
          ),
          if (activeSet != null) ...[
            const SizedBox(height: 10),
            Directionality(
              textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
              child: Column(
                children: [
                  TextField(
                    controller: activeSet.titleCtrl,
                    decoration: InputDecoration(
                      labelText:
                          'Ürün Başlığı (${_activeLang.toUpperCase()})',
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: activeSet.shortDescCtrl,
                    decoration: InputDecoration(
                      labelText:
                          'Kısa Açıklama (${_activeLang.toUpperCase()})',
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: activeSet.descCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText:
                          'Detaylı Açıklama (${_activeLang.toUpperCase()})',
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

