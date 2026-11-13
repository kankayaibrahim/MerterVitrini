import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/currency_formatter.dart';
import '../core/localization.dart';
import '../providers/session_provider.dart';
import 'country_flag_icon.dart';

/// Opens the Corporate Light Luxury Language (8 languages) & Currency selector sheet.
Future<void> showLanguageCurrencyModal(
  BuildContext context, {
  bool initialFocusCurrency = false,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (_) => LanguageCurrencyModal(
      initialFocusCurrency: initialFocusCurrency,
    ),
  );
}

class LanguageCurrencyModal extends StatefulWidget {
  final bool initialFocusCurrency;

  const LanguageCurrencyModal({
    super.key,
    this.initialFocusCurrency = false,
  });

  @override
  State<LanguageCurrencyModal> createState() => _LanguageCurrencyModalState();
}

class _LanguageCurrencyModalState extends State<LanguageCurrencyModal> {
  static const List<String> _supportedCurrencies = <String>[
    'TRY',
    'USD',
    'EUR',
    'GBP',
    'RUB',
  ];

  late int _sectionIndex;

  @override
  void initState() {
    super.initState();
    _sectionIndex = widget.initialFocusCurrency ? 1 : 0;
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final curr = session.currencyCode;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.warmHairline,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${AppStrings.tUpper(lang, 'language')} • ${AppStrings.tUpper(lang, 'currency')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.0),
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close_rounded, size: 20),
                    tooltip: AppStrings.t(lang, 'close'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Clean 2-tab pill switcher
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.editorialOffWhite,
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  border: Border.all(color: AppColors.cultured),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _SegmentPill(
                        label: '${AppStrings.t(lang, 'language')} (${lang.toUpperCase()})',
                        selected: _sectionIndex == 0,
                        onTap: () => setState(() => _sectionIndex = 0),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _SegmentPill(
                        label: '${AppStrings.t(lang, 'currency')} ($curr)',
                        selected: _sectionIndex == 1,
                        onTap: () => setState(() => _sectionIndex = 1),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Flexible(
                child: _sectionIndex == 0
                    ? ListView.separated(
                        shrinkWrap: true,
                        itemCount: AppStrings.supportedCodes.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final code = AppStrings.supportedCodes[index];
                          final selected = lang == code;
                          final label =
                              AppStrings.localeLabels[code] ?? code.toUpperCase();
                          return InkWell(
                            borderRadius: BorderRadius.circular(AppColors.radiusMd),
                            onTap: () async {
                              await session.setLanguage(code);
                              if (!context.mounted) return;
                              Navigator.of(context).pop();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: selected
                                    ? AppColors.warmIvory
                                    : Colors.white,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radiusMd),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.obsidian
                                      : AppColors.cultured,
                                  width: selected ? 1.4 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  CountryFlagIcon(
                                    code: code,
                                    width: 24,
                                    height: 17,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      label,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: selected
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.editorialOffWhite,
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusSm,
                                      ),
                                    ),
                                    child: Text(
                                      code.toUpperCase(),
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.sonicSilver,
                                      ),
                                    ),
                                  ),
                                  if (selected) ...[
                                    const SizedBox(width: 8),
                                    const Icon(
                                      Icons.check_circle_rounded,
                                      size: 18,
                                      color: AppColors.obsidian,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: _supportedCurrencies.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final code = _supportedCurrencies[index];
                          final selected = curr == code;
                          final symbol = CurrencyFormatter.symbols[code] ?? code;
                          return InkWell(
                            borderRadius: BorderRadius.circular(AppColors.radiusMd),
                            onTap: () async {
                              await session.setCurrency(code);
                              if (!context.mounted) return;
                              Navigator.of(context).pop();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: selected
                                    ? AppColors.warmIvory
                                    : Colors.white,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radiusMd),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.obsidian
                                      : AppColors.cultured,
                                  width: selected ? 1.4 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  CountryFlagIcon(
                                    code: code,
                                    width: 24,
                                    height: 17,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      '$code ($symbol)',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: selected
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                  ),
                                  if (selected)
                                    const Icon(
                                      Icons.check_circle_rounded,
                                      size: 18,
                                      color: AppColors.obsidian,
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SegmentPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SegmentPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.obsidian : Colors.transparent,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : AppColors.sonicSilver,
            ),
          ),
        ),
      ),
    );
  }
}
