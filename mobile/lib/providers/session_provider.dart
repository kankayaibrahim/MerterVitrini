import 'package:flutter/foundation.dart';

import '../contracts/session_storage.dart';
import '../core/currency_formatter.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import '../models/user.dart';
import '../repositories/secure_session_storage.dart';
import '../services/api_client.dart';
import '../services/mobile_api_service.dart';

class SessionProvider extends ChangeNotifier {
  final ApiClient apiClient;
  final MobileApiService api;
  final ISessionStorage _storage;
  final ICatalogRepository _catalogRepo;
  final IAuthRepository _authRepo;
  final ICommerceRepository _commerceRepo;

  bool _initialized = false;
  bool _loadingBootstrap = false;
  AppRole _activeRole = AppRole.customer;
  String _languageCode = 'tr';
  String _currencyCode = 'TRY';
  String _guestCustomerId = '';

  CustomerUser? _customerUser;
  String? _customerToken;
  String? _customerRefreshToken;

  SupplierUser? _supplierUser;
  String? _supplierToken;
  String? _supplierRefreshToken;

  Map<String, dynamic> _storeSettings = <String, dynamic>{};
  Map<String, double> _exchangeRates = <String, double>{
    'TRY': 1.0,
    'USD': 36.50,
    'EUR': 39.80,
    'RUB': 0.40,
  };
  List<CategoryNode> _categories = const <CategoryNode>[];
  List<BrandSummary> _brands = const <BrandSummary>[];
  List<Product> _newestProducts = const <Product>[];
  List<Product> _featuredProducts = const <Product>[];

  final Set<String> _wishlistIds = <String>{};
  List<Product> _wishlistProducts = const <Product>[];
  List<MobileNotificationItem> _notifications =
      const <MobileNotificationItem>[];
  int _unreadNotificationCount = 0;

  factory SessionProvider({
    required ApiClient apiClient,
    MobileApiService? apiService,
    ISessionStorage? sessionStorage,
    ICatalogRepository? catalogRepo,
    IAuthRepository? authRepo,
    ICommerceRepository? commerceRepo,
  }) {
    final resolvedApi = apiService ?? MobileApiService(apiClient);
    return SessionProvider._internal(
      apiClient,
      resolvedApi,
      sessionStorage ?? const SecureSessionStorage(),
      catalogRepo ?? resolvedApi.catalog,
      authRepo ?? resolvedApi.auth,
      commerceRepo ?? resolvedApi.commerce,
    );
  }

  SessionProvider._internal(
    this.apiClient,
    this.api,
    this._storage,
    this._catalogRepo,
    this._authRepo,
    this._commerceRepo,
  ) {
    apiClient.getCustomerToken = () => _customerToken;
    apiClient.getSupplierToken = () => _supplierToken;
    apiClient.getActiveRole = () => _activeRole;
    apiClient.getGuestCustomerId = () => effectiveChatCustomerId;
    apiClient.getCustomerDisplayName = () => effectiveCustomerDisplayName;
    apiClient.onRefreshToken = _handleAutoRefresh;
  }

  bool get initialized => _initialized;
  bool get loadingBootstrap => _loadingBootstrap;
  AppRole get activeRole => _activeRole;
  bool get isSupplierMode => _activeRole == AppRole.supplier;

  String get languageCode => _languageCode;
  String get currencyCode => _currencyCode;

  CustomerUser? get customerUser => _customerUser;
  SupplierUser? get supplierUser => _supplierUser;
  bool get isCustomerLoggedIn =>
      _customerToken != null &&
      _customerToken!.isNotEmpty &&
      _customerUser != null;
  bool get isSupplierLoggedIn =>
      _supplierToken != null &&
      _supplierToken!.isNotEmpty &&
      _supplierUser != null;
  bool get isMemberLoggedIn => isCustomerLoggedIn || isSupplierLoggedIn;
  bool get showPricesToGuests =>
      _storeSettings['show_prices_to_guests'] == true;
  bool get canViewPrices => isMemberLoggedIn || showPricesToGuests;

  String get effectiveChatCustomerId =>
      isCustomerLoggedIn ? _customerUser!.id : _guestCustomerId;

  String get effectiveCustomerDisplayName =>
      isCustomerLoggedIn ? _customerUser!.fullName : 'Mobil B2B Alıcı';

  Map<String, dynamic> get storeSettings => _storeSettings;
  Map<String, double> get exchangeRates => _exchangeRates;
  List<CategoryNode> get categories => _categories;
  List<BrandSummary> get brands => _brands;
  List<Product> get newestProducts => _newestProducts;
  List<Product> get featuredProducts => _featuredProducts;
  Set<String> get wishlistIds => _wishlistIds;
  List<Product> get wishlistProducts => _wishlistProducts;
  List<MobileNotificationItem> get notifications => _notifications;
  int get unreadNotificationCount => _unreadNotificationCount;

  String formatPrice(double amount, {String sourceCurrency = 'TRY'}) {
    if (!canViewPrices) {
      return 'Üyelere Özel';
    }
    return CurrencyFormatter.format(
      amount,
      currency: _currencyCode,
      ratesToTry: _exchangeRates,
      sourceCurrency: sourceCurrency,
    );
  }

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }
    final snap = await _storage.loadSnapshot();
    _languageCode = snap.languageCode;
    _currencyCode = snap.currencyCode;
    _guestCustomerId = snap.guestCustomerId;
    _customerToken = snap.customerToken;
    _customerRefreshToken = snap.customerRefreshToken;
    _customerUser = snap.customerUser;
    _supplierToken = snap.supplierToken;
    _supplierRefreshToken = snap.supplierRefreshToken;
    _supplierUser = snap.supplierUser;

    if (snap.savedRole == 'supplier' && isSupplierLoggedIn) {
      _activeRole = AppRole.supplier;
    } else {
      _activeRole = AppRole.customer;
    }

    _initialized = true;
    notifyListeners();

    await loadBootstrap();
    if (isCustomerLoggedIn) {
      await refreshWishlist();
    }
    if (isCustomerLoggedIn || isSupplierLoggedIn) {
      await refreshNotifications();
    }
  }

  Future<void> loadBootstrap() async {
    _loadingBootstrap = true;
    notifyListeners();
    try {
      final payload = await _catalogRepo.fetchBootstrap();
      _storeSettings = payload.settings;
      if (payload.exchangeRates.isNotEmpty) {
        _exchangeRates = {..._exchangeRates, ...payload.exchangeRates};
      }
      _categories = payload.categories;
      _brands = payload.brands;
      _newestProducts = payload.newestProducts;
      _featuredProducts = payload.featuredProducts;
    } catch (_) {
      // Keep cached/default values gracefully when offline
    } finally {
      _loadingBootstrap = false;
      notifyListeners();
    }
  }

  Future<void> setLanguage(String code) async {
    _languageCode = code;
    notifyListeners();
    await _storage.saveLanguageCode(code);
  }

  Future<void> setCurrency(String code) async {
    _currencyCode = code.toUpperCase();
    notifyListeners();
    await _storage.saveCurrencyCode(_currencyCode);
  }

  Future<void> setActiveRole(AppRole role) async {
    if (role == AppRole.supplier && !isSupplierLoggedIn) {
      return;
    }
    _activeRole = role;
    notifyListeners();
    await _storage.saveActiveRole(role);
    await refreshNotifications();
  }

  Future<AppRole> login({
    required String email,
    required String password,
    required String role,
  }) async {
    final data = await _authRepo.mobileLogin(
      email: email,
      password: password,
      role: role,
    );

    final resolvedRole = (data['role'] ?? role).toString();
    final token = (data['token'] ?? '').toString();
    final refreshToken = (data['refresh_token'] ?? '').toString();

    if (token.isEmpty) {
      throw const ApiException('Oturum anahtarı alınamadı.');
    }

    if (resolvedRole == 'supplier' &&
        data['supplier_user'] is Map<String, dynamic>) {
      final supUser = SupplierUser.fromJson(
        data['supplier_user'] as Map<String, dynamic>,
      );
      _supplierUser = supUser;
      _supplierToken = token;
      _supplierRefreshToken = refreshToken;
      _activeRole = AppRole.supplier;

      await _storage.saveSupplierSession(
        user: supUser,
        token: token,
        refreshToken: refreshToken,
      );
      notifyListeners();
      await refreshNotifications();
      return AppRole.supplier;
    }

    final custUser = data['user'] is Map<String, dynamic>
        ? CustomerUser.fromJson(data['user'] as Map<String, dynamic>)
        : CustomerUser(
            id: '',
            firstName: email.split('@').first,
            lastName: '',
            email: email,
            phone: '',
            role: 'customer',
          );

    _customerUser = custUser;
    _customerToken = token;
    _customerRefreshToken = refreshToken;
    _activeRole = AppRole.customer;

    await _storage.saveCustomerSession(
      user: custUser,
      token: token,
      refreshToken: refreshToken,
    );

    notifyListeners();
    await refreshWishlist();
    await refreshNotifications();
    return AppRole.customer;
  }

  Future<void> registerCustomerAccount({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  }) async {
    final resp = await _authRepo.registerCustomer(
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: password,
    );

    final token = (resp['token'] ?? '').toString();
    if (token.isNotEmpty && resp['user'] is Map<String, dynamic>) {
      final user = CustomerUser.fromJson(resp['user'] as Map<String, dynamic>);
      _customerUser = user;
      _customerToken = token;
      _activeRole = AppRole.customer;
      await _storage.saveCustomerSession(user: user, token: token);
      notifyListeners();
    } else {
      await login(email: email, password: password, role: 'customer');
    }
  }

  Future<String?> _handleAutoRefresh(AppRole role) async {
    try {
      final refTok = role == AppRole.supplier
          ? (_supplierRefreshToken ?? '')
          : (_customerRefreshToken ?? '');
      final activeTok =
          role == AppRole.supplier ? _supplierToken : _customerToken;

      final data = await _authRepo.refreshAuthToken(
        refreshToken: refTok,
        activeBearerToken: activeTok,
      );
      final newTok = (data['token'] ?? '').toString();
      final newRef = (data['refresh_token'] ?? '').toString();
      if (newTok.isEmpty) {
        return null;
      }

      if (role == AppRole.supplier) {
        _supplierToken = newTok;
        if (newRef.isNotEmpty) _supplierRefreshToken = newRef;
        await _storage.updateSupplierTokens(
          token: newTok,
          refreshToken: newRef,
        );
      } else {
        _customerToken = newTok;
        if (newRef.isNotEmpty) _customerRefreshToken = newRef;
        await _storage.updateCustomerTokens(
          token: newTok,
          refreshToken: newRef,
        );
      }
      notifyListeners();
      return newTok;
    } catch (_) {
      return null;
    }
  }

  Future<void> logoutCurrentRole() async {
    if (_activeRole == AppRole.supplier) {
      _supplierUser = null;
      _supplierToken = null;
      _supplierRefreshToken = null;
      await _storage.clearSupplierSession();
      _activeRole = AppRole.customer;
      await _storage.saveActiveRole(AppRole.customer);
    } else {
      _customerUser = null;
      _customerToken = null;
      _customerRefreshToken = null;
      _wishlistIds.clear();
      _wishlistProducts = const <Product>[];
      await _storage.clearCustomerSession();
      if (isSupplierLoggedIn) {
        _activeRole = AppRole.supplier;
        await _storage.saveActiveRole(AppRole.supplier);
      }
    }
    notifyListeners();
  }

  Future<void> deleteCurrentAccountPermanently({String reason = ''}) async {
    final bearer =
        _activeRole == AppRole.supplier ? _supplierToken : _customerToken;
    if (bearer == null || bearer.isEmpty) {
      throw const ApiException('Silinecek aktif bir oturum bulunamadı.');
    }
    await _authRepo.deleteAccountPermanently(
      bearerToken: bearer,
      reason: reason,
    );
    await logoutCurrentRole();
  }

  bool isWishlisted(String productId) => _wishlistIds.contains(productId);

  Future<void> refreshWishlist() async {
    if (!isCustomerLoggedIn) {
      return;
    }
    try {
      final prods = await _commerceRepo.fetchWishlist();
      _wishlistProducts = prods;
      _wishlistIds
        ..clear()
        ..addAll(prods.map((e) => e.id));
      notifyListeners();
    } catch (_) {}
  }

  Future<void> toggleWishlist(Product product) async {
    if (!isCustomerLoggedIn) {
      if (_wishlistIds.contains(product.id)) {
        _wishlistIds.remove(product.id);
        _wishlistProducts =
            _wishlistProducts.where((p) => p.id != product.id).toList();
      } else {
        _wishlistIds.add(product.id);
        _wishlistProducts = [product, ..._wishlistProducts];
      }
      notifyListeners();
      return;
    }

    final exists = _wishlistIds.contains(product.id);
    if (exists) {
      _wishlistIds.remove(product.id);
      _wishlistProducts =
          _wishlistProducts.where((p) => p.id != product.id).toList();
      notifyListeners();
      await _commerceRepo.removeWishlist(product.id);
    } else {
      _wishlistIds.add(product.id);
      _wishlistProducts = [product, ..._wishlistProducts];
      notifyListeners();
      await _commerceRepo.addWishlist(product.id);
    }
  }

  Future<void> refreshNotifications() async {
    if (!isCustomerLoggedIn && !isSupplierLoggedIn) {
      return;
    }
    try {
      final (items, unread) = await _commerceRepo.fetchNotifications();
      _notifications = items;
      _unreadNotificationCount = unread;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAllNotificationsRead() async {
    _unreadNotificationCount = 0;
    notifyListeners();
    await _commerceRepo.markAllNotificationsRead();
  }
}
