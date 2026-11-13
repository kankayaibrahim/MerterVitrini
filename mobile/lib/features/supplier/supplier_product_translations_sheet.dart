import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/country_flag_icon.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

/// 8-Language AI Product Translations editor modal sheet (`tr, en, ru, ar, de, fr, pl, bg`).
class SupplierProductTranslationsSheet extends StatefulWidget {
  final Product product;

  const SupplierProductTranslationsSheet({super.key, required this.product});

  static Future<bool?> show(
    BuildContext context, {
    required Product product,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.warmIvory,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => SupplierProductTranslationsSheet(product: product),
    );
  }

  @override
  State<SupplierProductTranslationsSheet> createState() =>
      _SupplierProductTranslationsSheetState();
}

class _TranslationFieldControllers {
  final TextEditingController title;
  final TextEditingController shortDescription;
  final TextEditingController description;
  final TextEditingController fabricTerm;
  final TextEditingController colorTerm;

  _TranslationFieldControllers({
    String initialTitle = '',
    String initialShort = '',
    String initialDesc = '',
    String initialFabric = '',
    String initialColor = '',
  }) : title = TextEditingController(text: initialTitle),
       shortDescription = TextEditingController(text: initialShort),
       description = TextEditingController(text: initialDesc),
       fabricTerm = TextEditingController(text: initialFabric),
       colorTerm = TextEditingController(text: initialColor);

  void dispose() {
    title.dispose();
    shortDescription.dispose();
    description.dispose();
    fabricTerm.dispose();
    colorTerm.dispose();
  }
}

class _SupplierProductTranslationsSheetState
    extends State<SupplierProductTranslationsSheet> {
  final Map<String, _TranslationFieldControllers> _ctrls = {};
  final Set<String> _selectedTargets = {
    'en',
    'ru',
    'ar',
    'de',
    'fr',
    'pl',
    'bg',
  };

  String _activeLang = 'tr';
  bool _loading = true;
  bool _translating = false;
  bool _saving = false;
  bool _appendTermsOnTranslate = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    for (final code in AppStrings.supportedCodes) {
      final existing = widget.product.translations[code];
      _ctrls[code] = _TranslationFieldControllers(
        initialTitle: existing?.title ?? (code == 'tr' ? widget.product.title : ''),
        initialShort: existing?.shortDescription ??
            (code == 'tr' ? widget.product.shortDescription : ''),
        initialDesc: existing?.description ??
            (code == 'tr' ? widget.product.description : ''),
        initialFabric: code == 'tr' ? widget.product.fabric : '',
        initialColor: code == 'tr' ? widget.product.color : '',
      );
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadFromServer());
  }

  @override
  void dispose() {
    for (final item in _ctrls.values) {
      item.dispose();
    }
    super.dispose();
  }

  Future<void> _loadFromServer() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final map = await context
          .read<SupplierProvider>()
          .fetchProductTranslations(widget.product.id);
      if (!mounted) return;
      map.translations.forEach((code, entry) {
        final normalized = AppStrings.normalizeCode(code);
        final ctrl = _ctrls[normalized];
        if (ctrl == null) return;
        if (entry.title.isNotEmpty) ctrl.title.text = entry.title;
        if (entry.shortDescription.isNotEmpty) {
          ctrl.shortDescription.text = entry.shortDescription;
        }
        if (entry.description.isNotEmpty) {
          ctrl.description.text = entry.description;
        }
      });
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _runAiTranslate({required bool allTargets}) async {
    final uiLang = context.read<SessionProvider>().languageCode;
    final src = _ctrls['tr']!;
    final fields = <String, String>{};
    if (src.title.text.trim().isNotEmpty) {
      fields['title'] = src.title.text.trim();
    }
    if (src.shortDescription.text.trim().isNotEmpty) {
      fields['short_description'] = src.shortDescription.text.trim();
    }
    if (src.description.text.trim().isNotEmpty) {
      fields['description'] = src.description.text.trim();
    }
    if (src.fabricTerm.text.trim().isNotEmpty) {
      fields['fabric'] = src.fabricTerm.text.trim();
    }
    if (src.colorTerm.text.trim().isNotEmpty) {
      fields['color'] = src.colorTerm.text.trim();
    }

    if (fields.isEmpty) {
      _showMsg(SupplierL10n.t(uiLang, 'wizard_title_required'), isError: true);
      return;
    }

    final targets = allTargets
        ? AppStrings.supportedCodes.where((c) => c != 'tr').toList()
        : _selectedTargets.where((c) => c != 'tr').toList();
    if (targets.isEmpty) {
      _showMsg(AppStrings.t(uiLang, 'err_validation'), isError: true);
      return;
    }

    setState(() => _translating = true);
    try {
      final result = await context
          .read<SupplierProvider>()
          .autoTranslateFields(
            fields,
            sourceLang: 'tr',
            targetLangs: targets,
          );
      if (!mounted) return;

      result.forEach((langCode, values) {
        final ctrl = _ctrls[AppStrings.normalizeCode(langCode)];
        if (ctrl == null) return;
        final tTitle = (values['title'] ?? '').trim();
        final tShort = (values['short_description'] ?? '').trim();
        final tDesc = (values['description'] ?? '').trim();
        final tFabric = (values['fabric'] ?? '').trim();
        final tColor = (values['color'] ?? '').trim();

        if (tTitle.isNotEmpty) ctrl.title.text = tTitle;
        if (tFabric.isNotEmpty) ctrl.fabricTerm.text = tFabric;
        if (tColor.isNotEmpty) ctrl.colorTerm.text = tColor;
        if (tDesc.isNotEmpty) ctrl.description.text = tDesc;

        var mergedShort = tShort;
        if (_appendTermsOnTranslate && (tFabric.isNotEmpty || tColor.isNotEmpty)) {
          final terms = [
            if (tFabric.isNotEmpty) tFabric,
            if (tColor.isNotEmpty) tColor,
          ].join(' · ');
          if (mergedShort.isEmpty) {
            mergedShort = terms;
          } else if (!mergedShort.toLowerCase().contains(terms.toLowerCase())) {
            mergedShort = '$mergedShort · $terms';
          }
        }
        if (mergedShort.isNotEmpty) ctrl.shortDescription.text = mergedShort;
      });

      setState(() => _translating = false);
      _showMsg(AppStrings.t(uiLang, 'success'));
    } catch (e) {
      if (!mounted) return;
      setState(() => _translating = false);
      _showMsg(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _saveAll() async {
    final uiLang = context.read<SessionProvider>().languageCode;
    final payload = <String, SupplierProductTranslationEntry>{};
    _ctrls.forEach((code, c) {
      final title = c.title.text.trim();
      final shortDesc = c.shortDescription.text.trim();
      final desc = c.description.text.trim();
      if (title.isNotEmpty || shortDesc.isNotEmpty || desc.isNotEmpty) {
        payload[code] = SupplierProductTranslationEntry(
          title: title,
          shortDescription: shortDesc,
          description: desc,
        );
      }
    });

    if (payload.isEmpty) {
      _showMsg(SupplierL10n.t(uiLang, 'wizard_title_required'), isError: true);
      return;
    }

    setState(() => _saving = true);
    try {
      await context.read<SupplierProvider>().saveProductTranslations(
        widget.product.id,
        payload,
      );
      if (!mounted) return;
      setState(() => _saving = false);
      _showMsg(AppStrings.t(uiLang, 'translations_saved'));
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      _showMsg(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  void _insertTermsIntoActiveShortDesc() {
    final c = _ctrls[_activeLang]!;
    final parts = [
      if (c.fabricTerm.text.trim().isNotEmpty) c.fabricTerm.text.trim(),
      if (c.colorTerm.text.trim().isNotEmpty) c.colorTerm.text.trim(),
    ];
    if (parts.isEmpty) return;
    final suffix = parts.join(' · ');
    final cur = c.shortDescription.text.trim();
    setState(() {
      c.shortDescription.text = cur.isEmpty ? suffix : '$cur · $suffix';
    });
  }

  void _showMsg(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.emerald,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final uiLang = context.watch<SessionProvider>().languageCode;
    final activeCtrl = _ctrls[_activeLang]!;
    final filledCount = _ctrls.values
        .where((c) => c.title.text.trim().isNotEmpty)
        .length;

    return FractionallySizedBox(
      heightFactor: 0.92,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            _buildHeader(uiLang, filledCount),
            const Divider(height: 1, color: AppColors.warmHairline),
            if (_loading)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(
                    color: AppColors.luxuryBronze,
                  ),
                ),
              )
            else if (_error != null)
              Expanded(
                child: EditorialEmptyState(
                  icon: Icons.translate_rounded,
                  message: _error!,
                  actionLabel: AppStrings.t(uiLang, 'retry'),
                  onAction: _loadFromServer,
                ),
              )
            else
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    14,
                    16,
                    24 + MediaQuery.of(context).viewInsets.bottom,
                  ),
                  children: [
                    _buildAiControlsCard(uiLang),
                    const SizedBox(height: 14),
                    _buildLanguageTabs(uiLang),
                    const SizedBox(height: 14),
                    _buildActiveLanguageForm(uiLang, activeCtrl),
                  ],
                ),
              ),
            _buildFooterBar(uiLang),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String uiLang, int filledCount) {
    final skuLabel = widget.product.customSku.trim().isNotEmpty
        ? widget.product.customSku.trim()
        : widget.product.sku.trim();
    return Container(
      color: AppColors.pureWhite,
      padding: const EdgeInsets.fromLTRB(16, 12, 10, 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.accentGoldLight,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
            ),
            child: const Icon(
              Icons.translate_rounded,
              color: AppColors.luxuryBronze,
              size: 19,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.t(uiLang, 'product_translations_8lang'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
                Text(
                  '${skuLabel.isNotEmpty ? skuLabel : widget.product.title} · $filledCount / 8 ${SupplierL10n.t(uiLang, 'translation_status')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.mutedAccessible,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
    );
  }

  Widget _buildAiControlsCard(String uiLang) {
    final targetLangs = AppStrings.supportedCodes
        .where((c) => c != 'tr')
        .toList();

    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.auto_awesome_rounded,
                size: 17,
                color: AppColors.luxuryBronze,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  SupplierL10n.t(uiLang, 'target_languages'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: targetLangs.map((code) {
              final selected = _selectedTargets.contains(code);
              return FilterChip(
                selected: selected,
                onSelected: (val) {
                  setState(() {
                    if (val) {
                      _selectedTargets.add(code);
                    } else {
                      _selectedTargets.remove(code);
                    }
                  });
                },
                avatar: CountryFlagIcon(code: code, width: 16, height: 11),
                label: Text(code.toUpperCase()),
                selectedColor: AppColors.accentGoldLight,
                backgroundColor: AppColors.warmIvory,
                side: BorderSide(
                  color: selected
                      ? AppColors.luxuryBronze
                      : AppColors.warmHairline,
                ),
                labelStyle: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.luxuryBronze : AppColors.charcoal,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          CheckboxListTile(
            value: _appendTermsOnTranslate,
            onChanged: (v) =>
                setState(() => _appendTermsOnTranslate = v ?? true),
            contentPadding: EdgeInsets.zero,
            dense: true,
            activeColor: AppColors.luxuryBronze,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(
              SupplierL10n.t(uiLang, 'append_terms_short'),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.charcoal,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed: _translating
                    ? null
                    : () => _runAiTranslate(allTargets: true),
                icon: _translating
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 16),
                label: Text(
                  _translating
                      ? AppStrings.t(uiLang, 'ai_translating')
                      : AppStrings.t(uiLang, 'ai_translate_all'),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.luxuryBronze,
                  foregroundColor: AppColors.pureWhite,
                ),
              ),
              OutlinedButton.icon(
                onPressed: _translating || _selectedTargets.isEmpty
                    ? null
                    : () => _runAiTranslate(allTargets: false),
                icon: const Icon(Icons.checklist_rounded, size: 16),
                label: Text(
                  '${SupplierL10n.t(uiLang, 'translate_selected')} (${_selectedTargets.length})',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageTabs(String uiLang) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: AppStrings.supportedCodes.map((code) {
        final selected = _activeLang == code;
        final hasTitle = _ctrls[code]!.title.text.trim().isNotEmpty;
        return InkWell(
          onTap: () => setState(() => _activeLang = code),
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: selected ? AppColors.obsidian : AppColors.pureWhite,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
              border: Border.all(
                color: selected ? AppColors.obsidian : AppColors.warmHairline,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CountryFlagIcon(code: code, width: 16, height: 12),
                const SizedBox(width: 6),
                Text(
                  code.toUpperCase(),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected ? AppColors.pureWhite : AppColors.obsidian,
                  ),
                ),
                const SizedBox(width: 5),
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: hasTitle
                        ? AppColors.emerald
                        : (selected
                              ? Colors.white54
                              : AppColors.warmHairline),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildActiveLanguageForm(
    String uiLang,
    _TranslationFieldControllers ctrl,
  ) {
    final textDir = AppStrings.directionOf(_activeLang);

    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CountryFlagIcon(code: _activeLang, width: 20, height: 14),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  SupplierL10n.languageName(_activeLang),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              if (widget.product.fabric.isNotEmpty ||
                  widget.product.color.isNotEmpty)
                Flexible(
                  child: Text(
                    [
                      if (widget.product.fabric.isNotEmpty)
                        widget.product.fabric,
                      if (widget.product.color.isNotEmpty)
                        widget.product.color,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.luxuryBronze,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Directionality(
            textDirection: textDir,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: ctrl.title,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(uiLang, 'product_title_field'),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: ctrl.fabricTerm,
                        decoration: InputDecoration(
                          labelText:
                              SupplierL10n.t(uiLang, 'fabric_term_field'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: ctrl.colorTerm,
                        decoration: InputDecoration(
                          labelText: SupplierL10n.t(uiLang, 'color_term_field'),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton.icon(
                    onPressed: _insertTermsIntoActiveShortDesc,
                    icon: const Icon(Icons.playlist_add_rounded, size: 17),
                    label: Text(
                      SupplierL10n.t(uiLang, 'append_terms_short'),
                      style: const TextStyle(fontSize: 11.5),
                    ),
                  ),
                ),
                TextField(
                  controller: ctrl.shortDescription,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(uiLang, 'short_desc_field'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: ctrl.description,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(uiLang, 'full_desc_field'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooterBar(String uiLang) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: const BoxDecoration(
        color: AppColors.pureWhite,
        border: Border(top: BorderSide(color: AppColors.warmHairline)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _saving ? null : () => Navigator.pop(context),
              child: Text(AppStrings.t(uiLang, 'cancel')),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: ElevatedButton.icon(
              onPressed: _saving || _loading ? null : _saveAll,
              icon: _saving
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save_outlined, size: 18),
              label: Text(AppStrings.t(uiLang, 'save')),
            ),
          ),
        ],
      ),
    );
  }
}
