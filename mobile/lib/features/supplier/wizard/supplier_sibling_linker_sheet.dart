import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/app_theme.dart';
import '../../../core/localization.dart';
import '../../../models/product.dart';
import '../../../providers/session_provider.dart';
import '../../../providers/supplier_provider.dart';
import '../../../widgets/smart_network_image.dart';
import '../utils/supplier_l10n.dart';

Future<List<Product>?> showSupplierSiblingLinkerSheet(
  BuildContext context, {
  String? excludeProductId,
  Set<String> alreadyLinkedIds = const <String>{},
  bool singleSelection = false,
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

  return showModalBottomSheet<List<Product>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.pureWhite,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (ctx) => SupplierSiblingLinkerSheet(
      excludeProductId: excludeProductId,
      alreadyLinkedIds: alreadyLinkedIds,
      singleSelection: singleSelection,
      lang: lang,
    ),
  );
}

class SupplierSiblingLinkerSheet extends StatefulWidget {
  final String? excludeProductId;
  final Set<String> alreadyLinkedIds;
  final bool singleSelection;
  final String lang;

  const SupplierSiblingLinkerSheet({
    super.key,
    this.excludeProductId,
    this.alreadyLinkedIds = const <String>{},
    this.singleSelection = false,
    this.lang = 'tr',
  });

  @override
  State<SupplierSiblingLinkerSheet> createState() =>
      _SupplierSiblingLinkerSheetState();
}

class _SupplierSiblingLinkerSheetState
    extends State<SupplierSiblingLinkerSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  Timer? _debounce;

  bool _loading = true;
  String _error = '';
  List<Product> _results = const <Product>[];
  final Map<String, Product> _selectedById = <String, Product>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _search());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final (list, _) = await context
          .read<SupplierProvider>()
          .catalogRepo
          .listSupplierProducts(
            query: _searchCtrl.text.trim(),
            status: 'all',
            limit: 40,
          );
      if (!mounted) return;
      final filtered = list
          .where((p) => p.id != widget.excludeProductId && !p.isArchived)
          .toList();
      setState(() {
        _results = filtered;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _search);
  }

  void _toggleSelection(Product p) {
    if (widget.alreadyLinkedIds.contains(p.id)) return;
    setState(() {
      if (_selectedById.containsKey(p.id)) {
        _selectedById.remove(p.id);
      } else {
        if (widget.singleSelection) {
          _selectedById.clear();
        }
        _selectedById[p.id] = p;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.lang;
    final viewInsets = MediaQuery.of(context).viewInsets;

    return Directionality(
      textDirection: AppStrings.directionOf(lang),
      child: Padding(
        padding: EdgeInsets.only(bottom: viewInsets.bottom),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.78,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 10),
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.warmHairline,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 14, 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              SupplierL10n.t(lang, 'sibling_linker_title'),
                              style: TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: AppStrings.letterSpacing(
                                  lang,
                                  -0.2,
                                ),
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              SupplierL10n.t(lang, 'sibling_linker_sub'),
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(
                          Icons.close_rounded,
                          color: AppColors.charcoal,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: _onQueryChanged,
                    onSubmitted: (_) => _search(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        color: AppColors.mutedAccessible,
                      ),
                      suffixIcon: _searchCtrl.text.isNotEmpty
                          ? IconButton(
                              onPressed: () {
                                _searchCtrl.clear();
                                _search();
                              },
                              icon: const Icon(Icons.clear_rounded, size: 18),
                            )
                          : null,
                      hintText: SupplierL10n.t(lang, 'sibling_search_hint'),
                      filled: true,
                      fillColor: AppColors.warmSurface,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 11,
                      ),
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        borderSide:
                            const BorderSide(color: AppColors.warmHairline),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Divider(height: 1, color: AppColors.warmHairline),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _error.isNotEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(
                                  _error,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            )
                          : _results.isEmpty
                              ? Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Text(
                                      SupplierL10n.t(
                                        lang,
                                        'no_matching_products',
                                      ),
                                      style: const TextStyle(
                                        color: AppColors.mutedAccessible,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                )
                              : ListView.separated(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 10,
                                  ),
                                  itemCount: _results.length,
                                  separatorBuilder: (_, _) =>
                                      const SizedBox(height: 8),
                                  itemBuilder: (context, idx) {
                                    final p = _results[idx];
                                    final alreadyLinked =
                                        widget.alreadyLinkedIds.contains(p.id);
                                    final selected =
                                        _selectedById.containsKey(p.id);
                                    final cover = p.coverImageUrl;

                                    return Material(
                                      color: selected
                                          ? AppColors.accentGoldLight
                                          : (alreadyLinked
                                              ? AppColors.warmSurface
                                              : AppColors.pureWhite),
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusMd,
                                      ),
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(
                                          AppColors.radiusMd,
                                        ),
                                        onTap: alreadyLinked
                                            ? null
                                            : () => _toggleSelection(p),
                                        child: Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                              AppColors.radiusMd,
                                            ),
                                            border: Border.all(
                                              color: selected
                                                  ? AppColors.luxuryBronze
                                                  : AppColors.warmHairline,
                                              width: selected ? 1.5 : 1,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              ClipRRect(
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                                child: SizedBox(
                                                  width: 46,
                                                  height: 58,
                                                  child: cover.isNotEmpty
                                                      ? SmartNetworkImage(
                                                          imageUrl: cover,
                                                          fit: BoxFit.cover,
                                                        )
                                                      : Container(
                                                          color: AppColors
                                                              .warmSurface,
                                                          child: const Icon(
                                                            Icons
                                                                .checkroom_outlined,
                                                            size: 20,
                                                            color: AppColors
                                                                .mutedAccessible,
                                                          ),
                                                        ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      p.title.isNotEmpty
                                                          ? p.title
                                                          : p.customSku,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        fontSize: 13.5,
                                                        color:
                                                            AppColors.obsidian,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 3),
                                                    Wrap(
                                                      spacing: 6,
                                                      runSpacing: 4,
                                                      children: [
                                                        if (p.customSku
                                                            .isNotEmpty)
                                                          Text(
                                                            p.customSku,
                                                            style:
                                                                const TextStyle(
                                                              fontSize: 11.5,
                                                              color: AppColors
                                                                  .mutedAccessible,
                                                            ),
                                                          ),
                                                        if (p.color.isNotEmpty)
                                                          Container(
                                                            padding:
                                                                const EdgeInsets
                                                                    .symmetric(
                                                              horizontal: 6,
                                                              vertical: 2,
                                                            ),
                                                            decoration:
                                                                BoxDecoration(
                                                              color: AppColors
                                                                  .warmSurface,
                                                              borderRadius:
                                                                  BorderRadius
                                                                      .circular(
                                                                6,
                                                              ),
                                                            ),
                                                            child: Text(
                                                              p.color,
                                                              style:
                                                                  const TextStyle(
                                                                fontSize: 10.5,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700,
                                                                color: AppColors
                                                                    .charcoal,
                                                              ),
                                                            ),
                                                          ),
                                                        if (!p.isActive)
                                                          Container(
                                                            padding:
                                                                const EdgeInsets
                                                                    .symmetric(
                                                              horizontal: 6,
                                                              vertical: 2,
                                                            ),
                                                            decoration:
                                                                BoxDecoration(
                                                              color: const Color(
                                                                0xFFFEF3C7,
                                                              ),
                                                              borderRadius:
                                                                  BorderRadius
                                                                      .circular(
                                                                6,
                                                              ),
                                                            ),
                                                            child: Text(
                                                              SupplierL10n.t(
                                                                lang,
                                                                'status_draft',
                                                              ),
                                                              style:
                                                                  const TextStyle(
                                                                fontSize: 10.5,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700,
                                                                color: Color(
                                                                  0xFFB45309,
                                                                ),
                                                              ),
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              if (alreadyLinked)
                                                const Icon(
                                                  Icons.check_circle_rounded,
                                                  color: AppColors.emerald,
                                                  size: 22,
                                                )
                                              else
                                                Icon(
                                                  selected
                                                      ? Icons
                                                          .check_circle_rounded
                                                      : Icons
                                                          .radio_button_unchecked_rounded,
                                                  color: selected
                                                      ? AppColors.luxuryBronze
                                                      : AppColors
                                                          .mutedAccessible,
                                                  size: 22,
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                ),
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                  decoration: const BoxDecoration(
                    color: AppColors.pureWhite,
                    border: Border(
                      top: BorderSide(color: AppColors.warmHairline),
                    ),
                  ),
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.luxuryBronze,
                      foregroundColor: AppColors.pureWhite,
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                      ),
                    ),
                    onPressed: _selectedById.isEmpty
                        ? null
                        : () => Navigator.of(context)
                            .pop(_selectedById.values.toList()),
                    icon: const Icon(Icons.link_rounded, size: 18),
                    label: Text(
                      '${SupplierL10n.t(lang, 'link_selected_count')} (${_selectedById.length})',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
