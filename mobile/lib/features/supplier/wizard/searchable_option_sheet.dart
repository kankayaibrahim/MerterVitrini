import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../models/product.dart';

Future<SimpleOptionItem?> showSearchableOptionSheet(
  BuildContext context, {
  required String title,
  required List<SimpleOptionItem> options,
  bool allowClear = false,
}) {
  return showModalBottomSheet<SimpleOptionItem>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
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
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * 0.75,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (allowClear)
                          TextButton(
                            onPressed: () => Navigator.of(sheetCtx).pop(
                              const SimpleOptionItem(id: '', name: ''),
                            ),
                            child: const Text('Temizle'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      onChanged: (v) => setSheetState(() => filter = v),
                      decoration: const InputDecoration(
                        hintText: 'Ara...',
                        prefixIcon: Icon(Icons.search_rounded),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Expanded(
                      child: filtered.isEmpty
                          ? const Center(
                              child: Text('Eşleşen seçenek bulunamadı.'),
                            )
                          : ListView.separated(
                              itemCount: filtered.length,
                              separatorBuilder: (context, index) =>
                                  const Divider(height: 1),
                              itemBuilder: (context, idx) {
                                final item = filtered[idx];
                                return ListTile(
                                  title: Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
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
          );
        },
      );
    },
  );
}

