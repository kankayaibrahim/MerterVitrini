import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../core/localization.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';
import 'camera_studio_screen.dart';
import 'supplier_product_translations_sheet.dart';
import 'supplier_product_wizard_screen.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';
import 'wizard/supplier_sibling_linker_sheet.dart';
import 'wizard/wizard_draft_storage.dart';

class SupplierProductsScreen extends StatefulWidget {
  const SupplierProductsScreen({super.key});

  @override
  State<SupplierProductsScreen> createState() => _SupplierProductsScreenState();
}

class _SupplierProductsScreenState extends State<SupplierProductsScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final ImagePicker _batchPicker = ImagePicker();
  String _statusFilter = 'all';
  bool _multiSelectMode = false;
  bool _batchDrafting = false;
  final Set<String> _selectedIds = <String>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/products',
          pageTitle: AppStrings.t(session.languageCode, 'nav_products'),
        ),
      );
      _reload();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    await context.read<SupplierProvider>().loadProducts(
      query: _searchCtrl.text.trim(),
      status: _statusFilter,
    );
    if (!mounted) return;
    final visibleIds = context
        .read<SupplierProvider>()
        .products
        .map((p) => p.id)
        .toSet();
    setState(() {
      _selectedIds.removeWhere((id) => !visibleIds.contains(id));
    });
  }

  void _toggleSelectItem(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
        if (_selectedIds.isEmpty) _multiSelectMode = false;
      } else {
        _multiSelectMode = true;
        _selectedIds.add(id);
      }
    });
  }

  Future<void> _openBarcodeLookupDialog() async {
    final lang = context.read<SessionProvider>().languageCode;
    final codeCtrl = TextEditingController();
    final submittedCode = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(SupplierL10n.t(lang, 'barcode_find_title')),
        content: TextField(
          controller: codeCtrl,
          autofocus: true,
          decoration: InputDecoration(
            labelText: SupplierL10n.t(lang, 'barcode_find_label'),
            hintText: 'MV-1042 / 869...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(codeCtrl.text.trim()),
            child: Text(SupplierL10n.t(lang, 'open_product')),
          ),
        ],
      ),
    );
    codeCtrl.dispose();

    if (submittedCode == null || submittedCode.isEmpty || !mounted) return;

    try {
      final api = context.read<SessionProvider>().api;
      final productId = await api.findSupplierProductByCode(submittedCode);
      final detail = await api.fetchSupplierProductDetail(productId);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => SupplierProductWizardScreen(existingProduct: detail),
        ),
      );
      if (mounted) _reload();
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _openQuickUpdateSheet(Product p) async {
    final lang = context.read<SessionProvider>().languageCode;
    final priceCtrl = TextEditingController(text: p.price.toStringAsFixed(2));
    final buyingCtrl = TextEditingController(
      text: p.buyingPrice > 0 ? p.buyingPrice.toStringAsFixed(2) : '',
    );
    final seriesStockCtrl = TextEditingController(text: '${p.seriesStock}');
    var active = p.isActive;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final currentSeriesVal =
                int.tryParse(seriesStockCtrl.text.trim()) ?? p.seriesStock;
            final sku = p.customSku.trim().isNotEmpty ? p.customSku : p.sku;
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 18,
                  right: 18,
                  top: 16,
                  bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '${SupplierL10n.t(lang, 'quick_edit_title')} ($sku)',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: priceCtrl,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              labelText:
                                  '${SupplierL10n.t(lang, 'selling_price')} (${p.currency})',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: buyingCtrl,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              labelText:
                                  '${SupplierL10n.t(lang, 'buying_price')} (${p.currency})',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [25, 50, 100, 250, 500].map((cnt) {
                        return ChoiceChip(
                          visualDensity: VisualDensity.compact,
                          label: Text(
                            '$cnt ${SupplierL10n.t(lang, 'series_unit_short')}',
                          ),
                          selected: currentSeriesVal == cnt,
                          selectedColor: AppColors.accentGoldLight,
                          onSelected: (_) => setSheetState(
                            () => seriesStockCtrl.text = '$cnt',
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: seriesStockCtrl,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        labelText: SupplierL10n.t(lang, 'series_stock'),
                        suffixText: SupplierL10n.t(lang, 'series_unit_short'),
                      ),
                    ),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      activeTrackColor: AppColors.luxuryBronze,
                      value: active,
                      onChanged: (v) => setSheetState(() => active = v),
                      title: Text(
                        SupplierL10n.t(lang, 'active_in_storefront'),
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: saving
                          ? null
                          : () async {
                              final parsedPrice = double.tryParse(
                                priceCtrl.text.trim().replaceAll(',', '.'),
                              );
                              final parsedBuying = double.tryParse(
                                buyingCtrl.text.trim().replaceAll(',', '.'),
                              );
                              final parsedSeries = int.tryParse(
                                seriesStockCtrl.text.trim(),
                              );
                              setSheetState(() => saving = true);
                              try {
                                await context
                                    .read<SupplierProvider>()
                                    .quickUpdateProduct(
                                      productId: p.id,
                                      price: parsedPrice,
                                      buyingPrice: parsedBuying,
                                      isActive: active,
                                      seriesStock: parsedSeries,
                                    );
                                if (!sheetCtx.mounted || !mounted) return;
                                Navigator.of(sheetCtx).pop();
                                await _reload();
                              } catch (e) {
                                if (!ctx.mounted) return;
                                setSheetState(() => saving = false);
                                _showToast(
                                  e.toString().replaceFirst('Exception: ', ''),
                                  isError: true,
                                );
                              }
                            },
                      child: Text(AppStrings.t(lang, 'save')),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    priceCtrl.dispose();
    buyingCtrl.dispose();
    seriesStockCtrl.dispose();
  }

  Future<void> _toggleArchiveSingle(Product p) async {
    final lang = context.read<SessionProvider>().languageCode;
    final archive = !p.isArchived;
    try {
      await context.read<SupplierProvider>().toggleArchiveProduct(
        productId: p.id,
        isArchived: archive,
        restoreActive: !archive,
      );
      if (!mounted) return;
      _showToast(
        archive
            ? SupplierL10n.t(lang, 'product_archived_msg')
            : SupplierL10n.t(lang, 'product_restored_msg'),
      );
      await _reload();
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _bulkArchiveSelected({required bool archive}) async {
    final lang = context.read<SessionProvider>().languageCode;
    if (_selectedIds.isEmpty) return;
    try {
      final affected = await context
          .read<SupplierProvider>()
          .bulkArchiveProducts(
            productIds: _selectedIds.toList(),
            isArchived: archive,
            restoreActive: !archive,
          );
      if (!mounted) return;
      setState(() {
        _selectedIds.clear();
        _multiSelectMode = false;
      });
      _showToast('${SupplierL10n.t(lang, 'affected_products')} $affected');
      await _reload();
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _openSmartBulkArchiveSheet() async {
    final lang = context.read<SessionProvider>().languageCode;
    final seasonCtrl = TextEditingController();
    final daysCtrl = TextEditingController(text: '180');
    var zeroStockOnly = true;
    var running = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              18,
              18,
              20 + MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  SupplierL10n.t(lang, 'smart_bulk_archive'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.obsidian,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  SupplierL10n.t(lang, 'bulk_archive_desc'),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedAccessible,
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: seasonCtrl,
                  decoration: InputDecoration(
                    labelText: SupplierL10n.t(lang, 'season_filter_optional'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: daysCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'older_than_days'),
                  ),
                ),
                const SizedBox(height: 6),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  activeTrackColor: AppColors.luxuryBronze,
                  value: zeroStockOnly,
                  onChanged: (v) => setModalState(() => zeroStockOnly = v),
                  title: Text(
                    AppStrings.t(lang, 'zero_stock_only'),
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: running
                        ? null
                        : () async {
                            final days = int.tryParse(daysCtrl.text.trim());
                            setModalState(() => running = true);
                            try {
                              final affected = await context
                                  .read<SupplierProvider>()
                                  .bulkArchiveProducts(
                                    isArchived: true,
                                    season: seasonCtrl.text.trim(),
                                    olderThanDays: days,
                                    zeroStockOnly: zeroStockOnly,
                                  );
                              if (!mounted || !ctx.mounted) return;
                              Navigator.pop(ctx);
                              _showToast(
                                '${SupplierL10n.t(lang, 'affected_products')} $affected',
                              );
                              await _reload();
                            } catch (e) {
                              if (!ctx.mounted) return;
                              setModalState(() => running = false);
                              _showToast(
                                e.toString().replaceFirst('Exception: ', ''),
                                isError: true,
                              );
                            }
                          },
                    icon: const Icon(Icons.archive_outlined, size: 18),
                    label: Text(SupplierL10n.t(lang, 'apply_bulk_archive')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    seasonCtrl.dispose();
    daysCtrl.dispose();
  }

  Future<void> _openTranslationsSheet(Product p) async {
    final saved = await SupplierProductTranslationsSheet.show(
      context,
      product: p,
    );
    if (saved == true && mounted) {
      await _reload();
    }
  }

  Future<void> _confirmDelete(Product p) async {
    final lang = context.read<SessionProvider>().languageCode;
    final title = p.localizedTitle(lang);
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(SupplierL10n.t(lang, 'delete_product_title')),
        content: Text(
          '$title — ${SupplierL10n.t(lang, 'delete_product_confirm')}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(AppStrings.t(lang, 'delete')),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await context.read<SupplierProvider>().deleteProduct(p.id);
      if (!mounted) return;
      _showToast(SupplierL10n.t(lang, 'product_deleted_msg'));
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  void _showToast(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : AppColors.emerald,
      ),
    );
  }

  Future<void> _openBatchDraftFromPhotosSheet() async {
    if (_batchDrafting) return;
    final lang = context.read<SessionProvider>().languageCode;
    var selectedMode = 'per_photo';

    final pickedPaths = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.pureWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            Widget modeTile({
              required String value,
              required IconData icon,
              required String title,
              required String subtitle,
            }) {
              final selected = selectedMode == value;
              return InkWell(
                borderRadius: BorderRadius.circular(AppColors.radiusMd),
                onTap: () => setSheetState(() => selectedMode = value),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.accentGoldLight
                        : AppColors.warmSurface,
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    border: Border.all(
                      color: selected
                          ? AppColors.luxuryBronze
                          : AppColors.warmHairline,
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        icon,
                        size: 20,
                        color: selected
                            ? AppColors.luxuryBronze
                            : AppColors.charcoal,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppColors.obsidian,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.mutedAccessible,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        selected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_off_rounded,
                        size: 20,
                        color: selected
                            ? AppColors.luxuryBronze
                            : AppColors.mutedAccessible,
                      ),
                    ],
                  ),
                ),
              );
            }

            return Directionality(
              textDirection: AppStrings.directionOf(lang),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.warmHairline,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        SupplierL10n.t(lang, 'batch_draft_title'),
                        style: TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: AppStrings.letterSpacing(lang, -0.2),
                          color: AppColors.obsidian,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        SupplierL10n.t(lang, 'batch_draft_sub'),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                      const SizedBox(height: 12),
                      modeTile(
                        value: 'per_photo',
                        icon: Icons.photo_library_outlined,
                        title: SupplierL10n.t(lang, 'batch_mode_per_photo'),
                        subtitle:
                            SupplierL10n.t(lang, 'batch_mode_per_photo_sub'),
                      ),
                      const SizedBox(height: 8),
                      modeTile(
                        value: 'color_siblings',
                        icon: Icons.palette_outlined,
                        title:
                            SupplierL10n.t(lang, 'batch_mode_color_siblings'),
                        subtitle: SupplierL10n.t(
                          lang,
                          'batch_mode_color_siblings_sub',
                        ),
                      ),
                      const SizedBox(height: 8),
                      modeTile(
                        value: 'single_product',
                        icon: Icons.collections_bookmark_outlined,
                        title:
                            SupplierL10n.t(lang, 'batch_mode_single_product'),
                        subtitle: SupplierL10n.t(
                          lang,
                          'batch_mode_single_product_sub',
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.obsidian,
                                side: const BorderSide(
                                  color: AppColors.warmHairline,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 8,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusMd,
                                  ),
                                ),
                              ),
                              onPressed: () async {
                                try {
                                  final files =
                                      await _batchPicker.pickMultiImage(
                                    imageQuality: 88,
                                    maxWidth: 1600,
                                    maxHeight: 1600,
                                  );
                                  if (!ctx.mounted) return;
                                  Navigator.of(ctx).pop(
                                    files
                                        .map((f) => f.path)
                                        .where((p) => p.isNotEmpty)
                                        .toList(),
                                  );
                                } catch (_) {
                                  if (ctx.mounted) Navigator.of(ctx).pop();
                                }
                              },
                              icon: const Icon(
                                Icons.photo_library_outlined,
                                size: 18,
                              ),
                              label: Text(
                                SupplierL10n.t(lang, 'batch_source_gallery'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.luxuryBronze,
                                foregroundColor: AppColors.pureWhite,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 8,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusMd,
                                  ),
                                ),
                              ),
                              onPressed: () async {
                                final captured =
                                    await Navigator.of(ctx).push<List<String>>(
                                  MaterialPageRoute<List<String>>(
                                    builder: (_) => const CameraStudioScreen(
                                      allowMultiple: true,
                                      maxPhotos: 10,
                                    ),
                                  ),
                                );
                                if (!ctx.mounted) return;
                                Navigator.of(ctx).pop(captured);
                              },
                              icon: const Icon(
                                Icons.camera_alt_outlined,
                                size: 18,
                              ),
                              label: Text(
                                SupplierL10n.t(lang, 'batch_source_camera'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
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

    if (!mounted || pickedPaths == null || pickedPaths.isEmpty) return;

    setState(() => _batchDrafting = true);
    try {
      final sup = context.read<SupplierProvider>();
      final defaults = await WizardDraftStorage.loadDefaults();
      final uploadedUrls =
          await sup.catalogRepo.uploadSupplierProductPhotos(pickedPaths);
      if (uploadedUrls.isEmpty) {
        throw Exception(SupplierL10n.t(lang, 'wizard_photo_upload_err'));
      }
      final created = await sup.batchCreateDraftProducts(
        imageUrls: uploadedUrls,
        mode: selectedMode,
        categoryId: defaults.categoryId,
        currency: defaults.currency,
        selectedSizes: defaults.selectedSizes,
        seriesRatio: defaults.seriesRatio,
        seriesStock: defaults.seriesStock,
        reloadProducts: false,
      );
      if (!mounted) return;
      setState(() {
        _statusFilter = 'passive';
        _selectedIds.clear();
      });
      await _reload();
      if (!mounted) return;
      _showToast(
        '$created ${SupplierL10n.t(lang, 'batch_drafts_created')}',
      );
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    } finally {
      if (mounted) {
        setState(() => _batchDrafting = false);
      }
    }
  }

  Future<void> _quickPublishDraft(Product p) async {
    final lang = context.read<SessionProvider>().languageCode;
    final canQuickPublish = p.price > 0 &&
        p.coverImageUrl.isNotEmpty &&
        p.title.trim().isNotEmpty;
    if (!canQuickPublish) {
      _showToast(
        SupplierL10n.t(lang, 'complete_draft_to_publish'),
        isError: true,
      );
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => SupplierProductWizardScreen(existingProduct: p),
        ),
      );
      if (mounted) await _reload();
      return;
    }

    try {
      final sup = context.read<SupplierProvider>();
      await sup.quickUpdateProduct(productId: p.id, isActive: true);
      await sup.loadDashboard();
      if (!mounted) return;
      await _reload();
      if (!mounted) return;
      _showToast(SupplierL10n.t(lang, 'published_ok'));
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _openNewColorWizardForProduct(Product p) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SupplierProductWizardScreen(
          cloneFromProduct: p,
          linkWithProductId: p.id,
        ),
      ),
    );
    if (mounted) await _reload();
  }

  Future<void> _openSiblingLinkerForProduct(Product p) async {
    final lang = context.read<SessionProvider>().languageCode;
    final alreadyLinked = p.supplierSiblings.map((s) => s.id).toSet();
    final picked = await showSupplierSiblingLinkerSheet(
      context,
      excludeProductId: p.id,
      alreadyLinkedIds: alreadyLinked,
      languageCode: lang,
    );
    if (!mounted || picked == null || picked.isEmpty) return;

    try {
      await context.read<SupplierProvider>().linkProductSiblings(
            productId: p.id,
            targetProductIds: picked.map((e) => e.id).toList(),
          );
      if (!mounted) return;
      await _reload();
      if (!mounted) return;
      _showToast(SupplierL10n.t(lang, 'siblings_linked_ok'));
    } catch (e) {
      if (!mounted) return;
      _showToast(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final sup = context.watch<SupplierProvider>();
    final products = sup.products;

    final filters = [
      ('all', SupplierL10n.t(lang, 'filter_all')),
      ('active', SupplierL10n.t(lang, 'status_active')),
      (
        'passive',
        sup.draftProductsCount > 0
            ? '${SupplierL10n.t(lang, 'status_drafts')} (${sup.draftProductsCount})'
            : SupplierL10n.t(lang, 'status_drafts'),
      ),
      ('archived', AppStrings.t(lang, 'archived_status')),
    ];

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      body: Column(
        children: [
          Container(
            color: AppColors.pureWhite,
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        onSubmitted: (_) => _reload(),
                        decoration: InputDecoration(
                          hintText: SupplierL10n.t(lang, 'search_model_sku'),
                          prefixIcon: const Icon(Icons.search_rounded, size: 20),
                          suffixIcon: IconButton(
                            onPressed: _reload,
                            icon: const Icon(Icons.arrow_forward_rounded, size: 20),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: _openBarcodeLookupDialog,
                      tooltip: SupplierL10n.t(lang, 'barcode_find_title'),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.warmSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusMd,
                          ),
                        ),
                      ),
                      icon: const Icon(
                        Icons.qr_code_scanner_rounded,
                        color: AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(width: 6),
                    IconButton(
                      onPressed: () {
                        setState(() {
                          _multiSelectMode = !_multiSelectMode;
                          if (!_multiSelectMode) _selectedIds.clear();
                        });
                      },
                      tooltip: SupplierL10n.t(lang, 'multi_select'),
                      style: IconButton.styleFrom(
                        backgroundColor: _multiSelectMode
                            ? AppColors.accentGoldLight
                            : AppColors.warmSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusMd,
                          ),
                        ),
                      ),
                      icon: Icon(
                        Icons.checklist_rounded,
                        color: _multiSelectMode
                            ? AppColors.luxuryBronze
                            : AppColors.obsidian,
                      ),
                    ),
                    const SizedBox(width: 6),
                    IconButton(
                      onPressed:
                          _batchDrafting ? null : _openBatchDraftFromPhotosSheet,
                      tooltip: SupplierL10n.t(lang, 'batch_draft_btn'),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.accentGoldLight,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusMd,
                          ),
                        ),
                      ),
                      icon: _batchDrafting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.luxuryBronze,
                              ),
                            )
                          : const Icon(
                              Icons.add_photo_alternate_outlined,
                              color: AppColors.luxuryBronze,
                            ),
                    ),
                    const SizedBox(width: 6),
                    IconButton(
                      onPressed: _openSmartBulkArchiveSheet,
                      tooltip: SupplierL10n.t(lang, 'smart_bulk_archive'),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.warmSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppColors.radiusMd,
                          ),
                        ),
                      ),
                      icon: const Icon(
                        Icons.inventory_2_outlined,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      InkWell(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusMd),
                        onTap: _batchDrafting
                            ? null
                            : _openBatchDraftFromPhotosSheet,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accentGoldLight,
                            borderRadius: BorderRadius.circular(
                              AppColors.radiusMd,
                            ),
                            border: Border.all(
                              color: AppColors.luxuryBronze
                                  .withValues(alpha: 0.45),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.add_a_photo_outlined,
                                size: 15,
                                color: AppColors.luxuryBronze,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                SupplierL10n.t(lang, 'batch_draft_btn'),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.luxuryBronze,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: filters.map((item) {
                            final selected = _statusFilter == item.$1;
                            return Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(item.$2),
                                selected: selected,
                                selectedColor: AppColors.accentGoldLight,
                                backgroundColor: AppColors.warmIvory,
                                side: BorderSide(
                                  color: selected
                                      ? AppColors.luxuryBronze
                                      : AppColors.warmHairline,
                                ),
                                labelStyle: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? AppColors.luxuryBronze
                                      : AppColors.charcoal,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusSm,
                                  ),
                                ),
                                onSelected: (_) {
                                  setState(() {
                                    _statusFilter = item.$1;
                                    _selectedIds.clear();
                                  });
                                  _reload();
                                },
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${sup.totalProducts}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.obsidian,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.warmHairline),
          if (_multiSelectMode) _buildMultiSelectBar(lang, products),
          Expanded(
            child: sup.loadingProducts && products.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(
                      color: AppColors.luxuryBronze,
                    ),
                  )
                : products.isEmpty
                ? RefreshIndicator(
                    color: AppColors.luxuryBronze,
                    onRefresh: _reload,
                    child: ListView(
                      children: [
                        const SizedBox(height: 50),
                        EditorialEmptyState(
                          icon: Icons.checkroom_outlined,
                          message: SupplierL10n.t(lang, 'no_products_found'),
                          actionLabel: AppStrings.t(lang, 'retry'),
                          onAction: _reload,
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    color: AppColors.luxuryBronze,
                    onRefresh: _reload,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 88),
                      itemCount: products.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, idx) {
                        final p = products[idx];
                        return _ProductStudioCard(
                          lang: lang,
                          product: p,
                          multiSelectMode: _multiSelectMode,
                          selected: _selectedIds.contains(p.id),
                          onToggleSelect: () => _toggleSelectItem(p.id),
                          onPublishDraft: (!p.isActive && !p.isArchived)
                              ? () => _quickPublishDraft(p)
                              : null,
                          onAddNewColor: () => _openNewColorWizardForProduct(p),
                          onLinkSiblings: () => _openSiblingLinkerForProduct(p),
                          onQuickEdit: () => _openQuickUpdateSheet(p),
                          onTranslations: () => _openTranslationsSheet(p),
                          onToggleArchive: () => _toggleArchiveSingle(p),
                          onEditWizard: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => SupplierProductWizardScreen(
                                  existingProduct: p,
                                ),
                              ),
                            );
                            if (mounted) _reload();
                          },
                          onDelete: () => _confirmDelete(p),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.obsidian,
        foregroundColor: AppColors.pureWhite,
        onPressed: () async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) =>
                  const SupplierProductWizardScreen(autoOpenCamera: true),
            ),
          );
          if (mounted) _reload();
        },
        icon: const Icon(Icons.camera_alt_outlined, size: 19),
        label: Text(
          AppStrings.t(lang, 'camera_add_product'),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildMultiSelectBar(String lang, List<Product> products) {
    final showRestore = _statusFilter == 'archived';
    return Container(
      width: double.infinity,
      color: AppColors.accentGoldLight,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            '${_selectedIds.length} ${SupplierL10n.t(lang, 'selected_count')}',
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: AppColors.obsidian,
            ),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                if (_selectedIds.length == products.length) {
                  _selectedIds.clear();
                } else {
                  _selectedIds
                    ..clear()
                    ..addAll(products.map((e) => e.id));
                }
              });
            },
            child: Text(SupplierL10n.t(lang, 'select_all')),
          ),
          if (_selectedIds.isNotEmpty)
            ElevatedButton.icon(
              onPressed: () => _bulkArchiveSelected(archive: !showRestore),
              icon: Icon(
                showRestore
                    ? Icons.unarchive_outlined
                    : Icons.archive_outlined,
                size: 16,
              ),
              label: Text(
                showRestore
                    ? SupplierL10n.t(lang, 'bulk_restore')
                    : AppStrings.t(lang, 'bulk_archive'),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.luxuryBronze,
                foregroundColor: AppColors.pureWhite,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
              ),
            ),
          TextButton(
            onPressed: () {
              setState(() {
                _selectedIds.clear();
                _multiSelectMode = false;
              });
            },
            child: Text(SupplierL10n.t(lang, 'clear_selection')),
          ),
        ],
      ),
    );
  }
}

class _ProductStudioCard extends StatelessWidget {
  final String lang;
  final Product product;
  final bool multiSelectMode;
  final bool selected;
  final VoidCallback onToggleSelect;
  final VoidCallback? onPublishDraft;
  final VoidCallback onAddNewColor;
  final VoidCallback onLinkSiblings;
  final VoidCallback onQuickEdit;
  final VoidCallback onTranslations;
  final VoidCallback onToggleArchive;
  final VoidCallback onEditWizard;
  final VoidCallback onDelete;

  const _ProductStudioCard({
    required this.lang,
    required this.product,
    required this.multiSelectMode,
    required this.selected,
    required this.onToggleSelect,
    this.onPublishDraft,
    required this.onAddNewColor,
    required this.onLinkSiblings,
    required this.onQuickEdit,
    required this.onTranslations,
    required this.onToggleArchive,
    required this.onEditWizard,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final p = product;
    final title = p.localizedTitle(lang);
    final sku = p.customSku.trim().isNotEmpty ? p.customSku : p.sku;

    return EditorialSurfaceCard(
      borderColor: selected ? AppColors.luxuryBronze : AppColors.warmHairline,
      backgroundColor: selected ? AppColors.warmIvory : AppColors.pureWhite,
      onLongPress: onToggleSelect,
      onTap: multiSelectMode ? onToggleSelect : null,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (multiSelectMode) ...[
            Checkbox(
              value: selected,
              activeColor: AppColors.luxuryBronze,
              onChanged: (_) => onToggleSelect(),
            ),
          ],
          SmartNetworkImage(
            imageUrl: p.coverImageUrl,
            width: 72,
            height: 92,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        p.isArchived
                            ? EditorialStatusBadge.neutral(
                                AppStrings.t(lang, 'archived_status'),
                              )
                            : (p.isActive
                                  ? EditorialStatusBadge.positive(
                                      SupplierL10n.t(lang, 'status_active'),
                                    )
                                  : EditorialStatusBadge.warning(
                                      SupplierL10n.t(lang, 'status_draft'),
                                    )),
                        if (p.siblingCount > 0) ...[
                          const SizedBox(height: 4),
                          EditorialStatusBadge.bronze(
                            '${p.siblingCount + 1} ${SupplierL10n.t(lang, 'colors_badge_suffix')}',
                            icon: Icons.palette_outlined,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (sku.isNotEmpty) sku,
                    if (p.color.isNotEmpty) p.color,
                    '${p.seriesStock} ${SupplierL10n.t(lang, 'series_unit_short')}',
                    '${p.stock} ${SupplierL10n.t(lang, 'unit_pcs_short')}',
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.mutedAccessible,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      CurrencyFormatter.format(
                        p.effectiveUnitPrice,
                        currency: p.currency,
                      ),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.obsidian,
                      ),
                    ),
                    if (p.hasDiscount) ...[
                      const SizedBox(width: 6),
                      Text(
                        CurrencyFormatter.format(
                          p.price,
                          currency: p.currency,
                        ),
                        style: const TextStyle(
                          fontSize: 12,
                          decoration: TextDecoration.lineThrough,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (onPublishDraft != null)
                      _MiniActionChip(
                        icon: Icons.rocket_launch_outlined,
                        label: SupplierL10n.t(lang, 'publish_chip'),
                        highlight: true,
                        onTap: onPublishDraft!,
                      ),
                    _MiniActionChip(
                      icon: Icons.palette_outlined,
                      label: SupplierL10n.t(lang, 'new_color_chip'),
                      onTap: onAddNewColor,
                    ),
                    _MiniActionChip(
                      icon: Icons.link_rounded,
                      label: SupplierL10n.t(lang, 'link_sibling_chip'),
                      onTap: onLinkSiblings,
                    ),
                    _MiniActionChip(
                      icon: Icons.bolt_outlined,
                      label: SupplierL10n.t(lang, 'quick_price_stock'),
                      onTap: onQuickEdit,
                    ),
                    _MiniActionChip(
                      icon: Icons.translate_rounded,
                      label: '8-Lang AI',
                      highlight: true,
                      onTap: onTranslations,
                    ),
                    _MiniActionChip(
                      icon: p.isArchived
                          ? Icons.unarchive_outlined
                          : Icons.archive_outlined,
                      label: p.isArchived
                          ? AppStrings.t(lang, 'restore_product')
                          : AppStrings.t(lang, 'archive_product'),
                      onTap: onToggleArchive,
                    ),
                    _MiniActionChip(
                      icon: Icons.edit_outlined,
                      label: AppStrings.t(lang, 'edit'),
                      onTap: onEditWizard,
                    ),
                    _MiniActionChip(
                      icon: Icons.delete_outline_rounded,
                      label: AppStrings.t(lang, 'delete'),
                      danger: true,
                      onTap: onDelete,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlight;
  final bool danger;

  const _MiniActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlight = false,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = danger
        ? AppColors.danger
        : (highlight ? AppColors.luxuryBronze : AppColors.charcoal);
    final bg = danger
        ? AppColors.dangerLight
        : (highlight ? AppColors.accentGoldLight : AppColors.warmIvory);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          border: Border.all(color: AppColors.warmHairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13.5, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
