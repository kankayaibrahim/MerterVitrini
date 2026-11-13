import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../core/localization.dart';
import '../../../widgets/country_flag_icon.dart';
import '../utils/supplier_l10n.dart';

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
  final String lang;

  const WizardTranslationsCard({
    super.key,
    required this.translations,
    required this.autoTranslating,
    required this.onAutoTranslate,
    this.lang = 'tr',
  });

  @override
  State<WizardTranslationsCard> createState() => _WizardTranslationsCardState();
}

class _WizardTranslationsCardState extends State<WizardTranslationsCard> {
  static const List<String> targetCodes = [
    'en',
    'ru',
    'ar',
    'de',
    'fr',
    'pl',
    'bg',
  ];

  String _activeLang = 'en';

  @override
  Widget build(BuildContext context) {
    final uiLang = widget.lang;
    final activeSet = widget.translations[_activeLang];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warmSurface,
        borderRadius: BorderRadius.circular(AppColors.radiusLg),
        border: Border.all(color: AppColors.warmHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.translate_rounded,
                size: 18,
                color: AppColors.luxuryBronze,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '5. ${SupplierL10n.t(uiLang, 'wizard_lang_section_title')}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              TextButton.icon(
                onPressed:
                    widget.autoTranslating ? null : widget.onAutoTranslate,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.luxuryBronze,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: widget.autoTranslating
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 15),
                label: Text(
                  widget.autoTranslating
                      ? AppStrings.t(uiLang, 'ai_translating')
                      : AppStrings.t(uiLang, 'ai_translate_all'),
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            SupplierL10n.t(uiLang, 'wizard_lang_desc'),
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.mutedAccessible,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: targetCodes.map((code) {
              final selected = _activeLang == code;
              final set = widget.translations[code];
              final hasContent =
                  set != null && set.titleCtrl.text.trim().isNotEmpty;
              return ChoiceChip(
                visualDensity: VisualDensity.compact,
                selectedColor: AppColors.obsidian,
                backgroundColor: AppColors.pureWhite,
                side: BorderSide(
                  color: selected
                      ? AppColors.obsidian
                      : hasContent
                          ? AppColors.emerald
                          : AppColors.warmHairline,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CountryFlagIcon(code: code, width: 16, height: 11),
                    const SizedBox(width: 5),
                    Text(
                      code.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color:
                            selected ? AppColors.pureWhite : AppColors.obsidian,
                      ),
                    ),
                    if (hasContent && !selected) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.check_circle_rounded,
                        size: 12,
                        color: AppColors.emerald,
                      ),
                    ],
                  ],
                ),
                selected: selected,
                onSelected: (_) => setState(() => _activeLang = code),
              );
            }).toList(),
          ),
          if (activeSet != null) ...[
            const SizedBox(height: 12),
            Directionality(
              textDirection: AppStrings.directionOf(_activeLang),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.pureWhite,
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  border: Border.all(color: AppColors.warmHairline),
                ),
                child: Column(
                  children: [
                    TextField(
                      controller: activeSet.titleCtrl,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText:
                            '${SupplierL10n.t(uiLang, 'product_title_field')} (${_activeLang.toUpperCase()})',
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: activeSet.shortDescCtrl,
                      decoration: InputDecoration(
                        labelText:
                            '${SupplierL10n.t(uiLang, 'short_desc_field')} (${_activeLang.toUpperCase()})',
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: activeSet.descCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText:
                            '${SupplierL10n.t(uiLang, 'full_desc_field')} (${_activeLang.toUpperCase()})',
                        isDense: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
