import 'package:flutter/foundation.dart';

import '../contracts/supplier_catalog_repository.dart';
import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/marketplace.dart';
import '../models/product.dart';
import '../models/user.dart';

class SupplierProvider extends ChangeNotifier {
  final ISupplierCatalogRepository catalogRepo;
  final ISupplierOperationsRepository operationsRepo;

  SupplierProvider({
    required this.catalogRepo,
    required this.operationsRepo,
  });

  bool _loadingDashboard = false;
  bool _loadingProducts = false;
  bool _loadingOrders = false;
  bool _loadingWallet = false;
  bool _loadingAnalytics = false;
  bool _loadingProfile = false;
  bool _loadingBilling = false;
  bool _loadingRfqs = false;

  Map<String, dynamic> _kpis = const <String, dynamic>{};
  SupplierWallet _wallet = const SupplierWallet(
    currency: 'TRY',
    pendingBalance: 0,
    availableBalance: 0,
    withdrawnBalance: 0,
    commissionRate: 5,
    iban: '',
    bankName: '',
    bankAccountHolder: '',
  );
  List<SupplierLedgerEntry> _ledger = const <SupplierLedgerEntry>[];
  List<SupplierSubOrder> _recentOrders = const <SupplierSubOrder>[];
  List<Map<String, dynamic>> _lowStockProducts = const <Map<String, dynamic>>[];

  List<Product> _products = const <Product>[];
  int _totalProducts = 0;

  List<SimpleOptionItem> _categories = const <SimpleOptionItem>[];
  List<SimpleOptionItem> _colors = const <SimpleOptionItem>[];
  List<SimpleOptionItem> _fabrics = const <SimpleOptionItem>[];
  List<SizeDefinitionOption> _sizeDefinitions = const <SizeDefinitionOption>[];
  List<SeriesTemplateOption> _seriesTemplates = const <SeriesTemplateOption>[];

  List<SupplierSubOrder> _subOrders = const <SupplierSubOrder>[];
  List<SupplierAgent> _teamMembers = const <SupplierAgent>[];

  SupplierEditorialProfile? _editorialProfile;
  SupplierAnalyticsOverview? _analyticsOverview;
  String _analyticsPeriod = '30d';
  SupplierBillingOverview? _billingOverview;
  List<SupplierPayoutItem> _payouts = const <SupplierPayoutItem>[];
  List<RfqItem> _rfqs = const <RfqItem>[];

  bool get loadingDashboard => _loadingDashboard;
  bool get loadingProducts => _loadingProducts;
  bool get loadingOrders => _loadingOrders;
  bool get loadingWallet => _loadingWallet;
  bool get loadingAnalytics => _loadingAnalytics;
  bool get loadingProfile => _loadingProfile;
  bool get loadingBilling => _loadingBilling;
  bool get loadingRfqs => _loadingRfqs;

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
  List<SizeDefinitionOption> get sizeDefinitions => _sizeDefinitions;
  List<SeriesTemplateOption> get seriesTemplates => _seriesTemplates;

  List<SupplierSubOrder> get subOrders => _subOrders;
  List<SupplierAgent> get teamMembers => _teamMembers;

  SupplierEditorialProfile? get editorialProfile => _editorialProfile;
  SupplierAnalyticsOverview? get analyticsOverview => _analyticsOverview;
  String get analyticsPeriod => _analyticsPeriod;
  SupplierBillingOverview? get billingOverview => _billingOverview;
  List<SupplierPayoutItem> get payouts => _payouts;
  List<RfqItem> get rfqs => _rfqs;

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
      if (data['recent_orders'] is List) {
        _recentOrders = (data['recent_orders'] as List)
            .whereType<Map<String, dynamic>>()
            .map(SupplierSubOrder.fromJson)
            .toList();
      }
      if (data['low_stock_products'] is List) {
        _lowStockProducts = (data['low_stock_products'] as List)
            .whereType<Map<String, dynamic>>()
            .toList();
      }
    } finally {
      _loadingDashboard = false;
      notifyListeners();
    }
  }

  Future<void> loadProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
    int limit = 50,
    int offset = 0,
  }) async {
    _loadingProducts = true;
    notifyListeners();
    try {
      final (list, total) = await catalogRepo.listSupplierProducts(
        query: query,
        status: status,
        categoryId: categoryId,
        limit: limit,
        offset: offset,
      );
      _products = offset > 0 ? [..._products, ...list] : list;
      _totalProducts = total;
    } finally {
      _loadingProducts = false;
      notifyListeners();
    }
  }

  Future<void> ensureCatalogFormMetadataLoaded() async {
    if (_categories.isNotEmpty && _sizeDefinitions.isNotEmpty) {
      return;
    }
    try {
      final cats = await catalogRepo.fetchSupplierCategories();
      final bundle = await catalogRepo.fetchSupplierAttributeBundle();
      _categories = cats;
      _colors = bundle.colors;
      _fabrics = bundle.fabrics;
      _sizeDefinitions = bundle.sizes;
      _seriesTemplates = bundle.seriesTemplates;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> quickUpdateProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
    int? seriesStock,
  }) async {
    await catalogRepo.quickUpdateSupplierProduct(
      productId: productId,
      price: price,
      buyingPrice: buyingPrice,
      isActive: isActive,
      stock: stock,
      seriesStock: seriesStock,
    );
    await loadProducts();
  }

  Future<void> deleteProduct(String productId) async {
    await catalogRepo.deleteSupplierProduct(productId);
    _products = _products.where((p) => p.id != productId).toList();
    notifyListeners();
  }

  Future<void> toggleArchiveProduct({
    required String productId,
    required bool isArchived,
    bool restoreActive = false,
  }) async {
    await catalogRepo.toggleArchiveProduct(
      productId: productId,
      isArchived: isArchived,
      restoreActive: restoreActive,
    );
    await loadProducts();
  }

  Future<int> bulkArchiveProducts({
    List<String> productIds = const [],
    bool isArchived = true,
    bool restoreActive = false,
    String season = '',
    int? olderThanDays,
    bool zeroStockOnly = false,
  }) async {
    final affected = await catalogRepo.bulkArchiveProducts(
      productIds: productIds,
      isArchived: isArchived,
      restoreActive: restoreActive,
      season: season,
      olderThanDays: olderThanDays,
      zeroStockOnly: zeroStockOnly,
    );
    await loadProducts();
    return affected;
  }

  Future<SupplierProductTranslationMap> fetchProductTranslations(
    String productId,
  ) =>
      catalogRepo.fetchSupplierProductTranslations(productId);

  Future<void> saveProductTranslations(
    String productId,
    Map<String, SupplierProductTranslationEntry> translations,
  ) =>
      catalogRepo.updateSupplierProductTranslations(productId, translations);

  Future<Map<String, Map<String, String>>> autoTranslateFields(
    Map<String, String> fields, {
    String sourceLang = 'tr',
    List<String>? targetLangs,
  }) =>
      catalogRepo.autoTranslateSupplierFields(
        fields,
        sourceLang: sourceLang,
        targetLangs: targetLangs,
      );

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
  }

  Future<void> loadWalletAndTeam() async {
    _loadingWallet = true;
    notifyListeners();
    try {
      final (w, l) = await operationsRepo.fetchSupplierWallet();
      _wallet = w;
      _ledger = l;
      _teamMembers = await operationsRepo.listSupplierTeam();
      try {
        _payouts = await operationsRepo.listSupplierPayoutRequests();
      } catch (_) {}
    } finally {
      _loadingWallet = false;
      notifyListeners();
    }
  }

  Future<void> requestPayout(double amount) async {
    await operationsRepo.requestSupplierPayout(amount);
    await loadWalletAndTeam();
  }

  Future<void> loadEditorialProfile() async {
    _loadingProfile = true;
    notifyListeners();
    try {
      _editorialProfile = await operationsRepo.fetchSupplierEditorialProfile();
    } finally {
      _loadingProfile = false;
      notifyListeners();
    }
  }

  Future<void> saveEditorialProfile(
    SupplierEditorialProfile profile, {
    bool quickWhatsappOnly = false,
  }) async {
    _loadingProfile = true;
    notifyListeners();
    try {
      await operationsRepo.updateSupplierEditorialProfile(
        profile,
        quickWhatsappOnly: quickWhatsappOnly,
      );
      _editorialProfile = await operationsRepo.fetchSupplierEditorialProfile();
    } finally {
      _loadingProfile = false;
      notifyListeners();
    }
  }

  Future<void> loadAnalytics({String period = '30d'}) async {
    _loadingAnalytics = true;
    _analyticsPeriod = period;
    notifyListeners();
    try {
      _analyticsOverview = await operationsRepo.fetchSupplierAnalytics(
        period: period,
      );
    } finally {
      _loadingAnalytics = false;
      notifyListeners();
    }
  }

  Future<void> loadBilling() async {
    _loadingBilling = true;
    notifyListeners();
    try {
      _billingOverview = await operationsRepo.fetchSupplierBilling();
    } finally {
      _loadingBilling = false;
      notifyListeners();
    }
  }

  Future<void> updateTaxInfo(SupplierTaxInfoPayload payload) async {
    await operationsRepo.updateSupplierBillingTaxInfo(payload);
    await loadBilling();
  }

  Future<void> submitSubscriptionPayment(
    SupplierWirePaymentPayload payload,
  ) async {
    await operationsRepo.submitSupplierSubscriptionPayment(payload);
    await loadBilling();
  }

  Future<void> loadRfqs() async {
    _loadingRfqs = true;
    notifyListeners();
    try {
      _rfqs = await operationsRepo.listSupplierRfqs();
    } finally {
      _loadingRfqs = false;
      notifyListeners();
    }
  }

  Future<RfqOfferItem> submitRfqOffer({
    required String rfqId,
    required SubmitRfqOfferPayload payload,
  }) async {
    final offer = await operationsRepo.submitSupplierRfqOffer(
      rfqId: rfqId,
      payload: payload,
    );
    await loadRfqs();
    return offer;
  }
}
