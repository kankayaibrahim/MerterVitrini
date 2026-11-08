import 'package:flutter/foundation.dart';

import '../contracts/supplier_catalog_repository.dart';
import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/product.dart';

/// ISP + DIP Compliant Supplier State Manager:
/// Depends strictly on [ISupplierCatalogRepository] & [ISupplierOperationsRepository].
class SupplierProvider extends ChangeNotifier {
  final ISupplierCatalogRepository catalogRepo;
  final ISupplierOperationsRepository operationsRepo;

  bool _loadingDashboard = false;
  bool _loadingProducts = false;
  bool _loadingOrders = false;
  bool _loadingWallet = false;

  Map<String, dynamic> _kpis = <String, dynamic>{};
  SupplierWallet _wallet = const SupplierWallet();
  List<SupplierLedgerEntry> _ledger = const <SupplierLedgerEntry>[];
  List<SupplierSubOrder> _recentOrders = const <SupplierSubOrder>[];
  List<Map<String, dynamic>> _lowStockProducts = const <Map<String, dynamic>>[];

  List<Product> _products = <Product>[];
  int _totalProducts = 0;

  List<SimpleOptionItem> _categories = const <SimpleOptionItem>[];
  List<SimpleOptionItem> _colors = const <SimpleOptionItem>[];
  List<SimpleOptionItem> _fabrics = const <SimpleOptionItem>[];

  List<SupplierSubOrder> _subOrders = <SupplierSubOrder>[];
  List<SupplierAgent> _teamMembers = <SupplierAgent>[];

  SupplierProvider({
    required this.catalogRepo,
    required this.operationsRepo,
  });

  bool get loadingDashboard => _loadingDashboard;
  bool get loadingProducts => _loadingProducts;
  bool get loadingOrders => _loadingOrders;
  bool get loadingWallet => _loadingWallet;

  Map<String, dynamic> get kpis => _kpis;
  SupplierWallet get wallet => _wallet;
  List<SupplierLedgerEntry> get ledger => _ledger;
  List<SupplierSubOrder> get recentOrders => _recentOrders;
  List<Map<String, dynamic>> get lowStockProducts => _lowStockProducts;

  List<Product> get products => _products;
  int get totalProducts => _totalProducts;
  List<SimpleOptionItem> get categories => _categories;
  List<SimpleOptionItem> get colors => _colors;
  List<SimpleOptionItem> get fabrics => _fabrics;
  List<SupplierSubOrder> get subOrders => _subOrders;
  List<SupplierAgent> get teamMembers => _teamMembers;

  Future<void> loadDashboard() async {
    _loadingDashboard = true;
    notifyListeners();
    try {
      final data = await operationsRepo.fetchSupplierDashboard();
      if (data['kpis'] is Map<String, dynamic>) {
        _kpis = data['kpis'] as Map<String, dynamic>;
      }
      if (data['wallet'] is Map<String, dynamic>) {
        _wallet = SupplierWallet.fromJson(
          data['wallet'] as Map<String, dynamic>,
        );
      }
      final recOrders = <SupplierSubOrder>[];
      if (data['recent_orders'] is List) {
        for (final o in data['recent_orders'] as List) {
          if (o is Map<String, dynamic>) {
            recOrders.add(SupplierSubOrder.fromJson(o));
          }
        }
      }
      _recentOrders = recOrders;

      final lowStock = <Map<String, dynamic>>[];
      if (data['low_stock_products'] is List) {
        for (final item in data['low_stock_products'] as List) {
          if (item is Map<String, dynamic>) {
            lowStock.add(item);
          }
        }
      }
      _lowStockProducts = lowStock;
    } finally {
      _loadingDashboard = false;
      notifyListeners();
    }
  }

  Future<void> loadProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
  }) async {
    _loadingProducts = true;
    notifyListeners();
    try {
      final (list, total) = await catalogRepo.listSupplierProducts(
        query: query,
        status: status,
        categoryId: categoryId,
        limit: 60,
      );
      _products = list;
      _totalProducts = total;
    } finally {
      _loadingProducts = false;
      notifyListeners();
    }
  }

  Future<void> ensureCatalogFormMetadataLoaded() async {
    if (_categories.isNotEmpty && _colors.isNotEmpty) {
      return;
    }
    try {
      final cats = await catalogRepo.fetchSupplierCategories();
      final (cols, fabs) = await catalogRepo.fetchSupplierAttributes();
      _categories = cats;
      _colors = cols;
      _fabrics = fabs;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> quickUpdateProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
  }) async {
    await catalogRepo.quickUpdateSupplierProduct(
      productId: productId,
      price: price,
      buyingPrice: buyingPrice,
      isActive: isActive,
      stock: stock,
    );
    await loadProducts();
    await loadDashboard();
  }

  Future<void> deleteProduct(String productId) async {
    await catalogRepo.deleteSupplierProduct(productId);
    _products.removeWhere((p) => p.id == productId);
    notifyListeners();
    await loadDashboard();
  }

  Future<void> loadSubOrders({String status = 'ALL'}) async {
    _loadingOrders = true;
    notifyListeners();
    try {
      _subOrders = await operationsRepo.listSupplierSubOrders(status: status);
    } finally {
      _loadingOrders = false;
      notifyListeners();
    }
  }

  Future<void> updateSubOrderStatus({
    required String subOrderId,
    required String status,
    String trackingCompany = '',
    String trackingNumber = '',
    String notes = '',
  }) async {
    await operationsRepo.updateSupplierSubOrderStatus(
      subOrderId: subOrderId,
      status: status,
      trackingCompany: trackingCompany,
      trackingNumber: trackingNumber,
      notes: notes,
    );
    await loadSubOrders();
    await loadDashboard();
  }

  Future<void> loadWalletAndTeam() async {
    _loadingWallet = true;
    notifyListeners();
    try {
      final (w, l) = await operationsRepo.fetchSupplierWallet();
      _wallet = w;
      _ledger = l;
      _teamMembers = await operationsRepo.listSupplierTeam();
    } finally {
      _loadingWallet = false;
      notifyListeners();
    }
  }
}
