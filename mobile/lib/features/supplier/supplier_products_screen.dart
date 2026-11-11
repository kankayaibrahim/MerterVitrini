import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/currency_formatter.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/smart_network_image.dart';
import 'supplier_product_wizard_screen.dart';

class SupplierProductsScreen extends StatefulWidget {
  const SupplierProductsScreen({super.key});

  @override
  State<SupplierProductsScreen> createState() => _SupplierProductsScreenState();
}

class _SupplierProductsScreenState extends State<SupplierProductsScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SupplierProvider>().loadProducts();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    await context.read<SupplierProvider>().loadProducts(
          query: _searchCtrl.text,
          status: _statusFilter,
        );
  }

  Future<void> _openBarcodeLookupDialog() async {
    final codeCtrl = TextEditingController();
    final submittedCode = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Barkod / SKU ile Hızlı Bul'),
        content: TextField(
          controller: codeCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Barkod veya Ürün Kodu (SKU)',
            hintText: 'Örn: MV-1042 veya 869...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(codeCtrl.text.trim()),
            child: const Text('Ürünü Aç'),
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
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  Future<void> _openQuickUpdateSheet(Product p) async {
    final priceCtrl = TextEditingController(text: p.price.toStringAsFixed(2));
    final buyingCtrl = TextEditingController(
      text: p.buyingPrice > 0 ? p.buyingPrice.toStringAsFixed(2) : '',
    );
    final seriesStockCtrl = TextEditingController(text: '${p.seriesStock}');
    var active = p.isActive;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        var saving = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final currentSeriesVal =
                int.tryParse(seriesStockCtrl.text.trim()) ?? p.seriesStock;
            return Padding(
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
                    'Hızlı Fiyat & Seri Stoğu Güncelle (${p.customSku})',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
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
                            labelText: 'Birim Satış (${p.currency})',
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
                            labelText: 'Maliyet (${p.currency})',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    children: [25, 50, 100, 250, 500].map((cnt) {
                      return ChoiceChip(
                        visualDensity: VisualDensity.compact,
                        label: Text('$cnt Seri'),
                        selected: currentSeriesVal == cnt,
                        onSelected: (_) =>
                            setSheetState(() => seriesStockCtrl.text = '$cnt'),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: seriesStockCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setSheetState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Eldeki Tahmini Seri Adedi',
                      suffixText: 'Seri',
                    ),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: active,
                    onChanged: (v) => setSheetState(() => active = v),
                    title: const Text('Vitrinde Yayında (Aktif)'),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: saving
                        ? null
                        : () async {
                            setSheetState(() => saving = true);
                            try {
                              final newPrice = double.tryParse(
                                priceCtrl.text.replaceAll(',', '.').trim(),
                              );
                              final newBuy = double.tryParse(
                                buyingCtrl.text.replaceAll(',', '.').trim(),
                              );
                              final newSeriesStock =
                                  int.tryParse(seriesStockCtrl.text.trim());
                              await context
                                  .read<SupplierProvider>()
                                  .quickUpdateProduct(
                                    productId: p.id,
                                    price: newPrice,
                                    buyingPrice: newBuy,
                                    isActive: active,
                                    seriesStock: newSeriesStock,
                                  );
                              if (sheetCtx.mounted) {
                                Navigator.of(sheetCtx).pop();
                              }
                            } catch (err) {
                              setSheetState(() => saving = false);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(err.toString())),
                                );
                              }
                            }
                          },
                    child: Text(saving ? 'Kaydediliyor...' : 'Hızlı Kaydet'),
                  ),
                ],
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

  Future<void> _confirmDelete(Product p) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ürünü Sil'),
        content: Text(
          '"${p.title}" (${p.customSku}) ürününü katalogdan kalıcı olarak silmek istiyor musunuz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Kalıcı Sil'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await context.read<SupplierProvider>().deleteProduct(p.id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final sup = context.watch<SupplierProvider>();

    return Scaffold(
      body: Column(
        children: [
          Container(
            color: AppColors.surface,
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
                          hintText: 'Model adı veya SKU ara...',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: IconButton(
                            onPressed: _reload,
                            icon: const Icon(Icons.arrow_forward_rounded),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      onPressed: _openBarcodeLookupDialog,
                      tooltip: 'Barkod / SKU ile Aç',
                      icon: const Icon(Icons.qr_code_scanner_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (final item in const [
                      ('all', 'Tümü'),
                      ('active', 'Yayında'),
                      ('passive', 'Pasif'),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(item.$2),
                          selected: _statusFilter == item.$1,
                          onSelected: (_) {
                            setState(() => _statusFilter = item.$1);
                            _reload();
                          },
                        ),
                      ),
                    const Spacer(),
                    Text(
                      '${sup.totalProducts} Model',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: sup.loadingProducts && sup.products.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : sup.products.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(28),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.add_a_photo_outlined,
                                size: 54,
                                color: AppColors.textMuted,
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Henüz Ürün Eklenmemiş',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Sağ alttaki Kamera butonuna dokunarak ilk toptan modelinizi çekip vitrine yükleyebilirsiniz.',
                                textAlign: TextAlign.center,
                                style:
                                    TextStyle(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _reload,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 92),
                          itemCount: sup.products.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final p = sup.products[idx];
                            final ratio = p.seriesRatio.isNotEmpty
                                ? p.seriesRatio
                                : p.packingRatio;
                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    SmartNetworkImage(
                                      imageUrl: p.coverImageUrl,
                                      width: 72,
                                      height: 92,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  horizontal: 7,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: p.isActive
                                                      ? AppColors.emeraldLight
                                                      : AppColors.dangerLight,
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  p.isActive
                                                      ? 'YAYINDA'
                                                      : 'PASİF',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w800,
                                                    color: p.isActive
                                                        ? AppColors.emerald
                                                        : AppColors.danger,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  p.customSku,
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    color:
                                                        AppColors.textSecondary,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            p.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 14,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Birim: ${CurrencyFormatter.format(p.effectiveUnitPrice, currency: p.currency)} • ~${p.seriesStock} Seri (${p.stock} ad.) • Beden: ${p.packingRatio.isEmpty ? ratio : p.packingRatio}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 6,
                                            children: [
                                              OutlinedButton.icon(
                                                style: OutlinedButton.styleFrom(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                    horizontal: 10,
                                                    vertical: 6,
                                                  ),
                                                  minimumSize: Size.zero,
                                                ),
                                                onPressed: () =>
                                                    _openQuickUpdateSheet(p),
                                                icon: const Icon(
                                                  Icons.bolt_rounded,
                                                  size: 15,
                                                ),
                                                label: const Text(
                                                  'Hızlı Fiyat/Stok',
                                                  style:
                                                      TextStyle(fontSize: 11.5),
                                                ),
                                              ),
                                              OutlinedButton.icon(
                                                style: OutlinedButton.styleFrom(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                    horizontal: 10,
                                                    vertical: 6,
                                                  ),
                                                  minimumSize: Size.zero,
                                                ),
                                                onPressed: () {
                                                  Navigator.of(context).push(
                                                    MaterialPageRoute<void>(
                                                      builder: (_) =>
                                                          SupplierProductWizardScreen(
                                                        existingProduct: p,
                                                      ),
                                                    ),
                                                  );
                                                },
                                                icon: const Icon(
                                                  Icons.edit_outlined,
                                                  size: 15,
                                                ),
                                                label: const Text(
                                                  'Düzenle',
                                                  style:
                                                      TextStyle(fontSize: 11.5),
                                                ),
                                              ),
                                              IconButton(
                                                visualDensity:
                                                    VisualDensity.compact,
                                                onPressed: () =>
                                                    _confirmDelete(p),
                                                icon: const Icon(
                                                  Icons.delete_outline_rounded,
                                                  size: 18,
                                                  color: AppColors.danger,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.accentGold,
        foregroundColor: Colors.white,
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const SupplierProductWizardScreen(
                autoOpenCamera: true,
              ),
            ),
          );
        },
        icon: const Icon(Icons.camera_alt_rounded),
        label: const Text(
          'Kamerayla Ürün Ekle',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

