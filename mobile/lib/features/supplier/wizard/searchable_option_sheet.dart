import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_theme.dart';
import '../../../core/localization.dart';
import '../../../models/product.dart';
import '../../../providers/session_provider.dart';
import '../utils/supplier_l10n.dart';

Future<SimpleOptionItem?> showSearchableOptionSheet(
  BuildContext context, {
  required String title,
  required List<SimpleOptionItem> options,
  bool allowClear = false,
  String? languageCode,
}) {
  var lang = languageCode ?? '';
  if (lang.isEmpty) {
    try {
      lang = Provider.of<SessionProvider>(context, listen: false).languageCode;
    } catch (_) {
      lang = 'tr';
    }
  }

  return showModalBottomSheet<SimpleOptionItem>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.pureWhite,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (sheetCtx) {
      var filter = '';
      return StatefulBuilder(
        builder: (ctx, setSheetState) {
          final filtered = options.where((o) {
            if (filter.trim().isEmpty) return true;
            return o.name.toLowerCase().contains(filter.trim().toLowerCase());
          }).toList();

          return SafeArea(
            child: Directionality(
              textDirection: AppStrings.directionOf(lang),
              child: SizedBox(
                height: MediaQuery.of(ctx).size.height * 0.75,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  child: Column(
                    children: [
                      Container(
                        width: 38,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.warmHairline,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          if (allowClear)
                            TextButton(
                              onPressed: () => Navigator.of(sheetCtx).pop(
                                const SimpleOptionItem(id: '', name: ''),
                              ),
                              style: TextButton.styleFrom(
                                foregroundColor: AppColors.luxuryBronze,
                              ),
                              child: Text(
                                AppStrings.t(lang, 'clear_filters'),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        onChanged: (v) => setSheetState(() => filter = v),
                        decoration: InputDecoration(
                          hintText: SupplierL10n.t(lang, 'search_option_hint'),
                          prefixIcon: const Icon(Icons.search_rounded),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Expanded(
                        child: filtered.isEmpty
                            ? Center(
                                child: Text(
                                  SupplierL10n.t(lang, 'no_matching_options'),
                                  style: const TextStyle(
                                    color: AppColors.mutedAccessible,
                                  ),
                                ),
                              )
                            : ListView.separated(
                                itemCount: filtered.length,
                                separatorBuilder: (_, _) => const Divider(
                                  height: 1,
                                  color: AppColors.warmHairline,
                                ),
                                itemBuilder: (_, idx) {
                                  final item = filtered[idx];
                                  return ListTile(
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    title: Text(
                                      item.name,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                    trailing: const Icon(
                                      Icons.chevron_right_rounded,
                                      size: 18,
                                      color: AppColors.mutedAccessible,
                                    ),
                                    onTap: () =>
                                        Navigator.of(sheetCtx).pop(item),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      );
    },
  );
}
