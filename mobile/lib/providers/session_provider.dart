import 'package:flutter/foundation.dart';

import '../contracts/auth_repository.dart';
import '../contracts/catalog_repository.dart';
import '../contracts/commerce_repository.dart';
import '../contracts/session_storage.dart';
import '../core/currency_formatter.dart';
import '../core/localization.dart';
import '../core/phone_validator.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import '../models/user.dart';
import '../repositories/secure_session_storage.dart';
import '../services/api_client.dart';
import '../services/mobile_api_service.dart';
import '../services/mobile_telemetry_service.dart';

class SessionProvider extends ChangeNotifier {
  final ApiClient apiClient;
  late final MobileApiService api;
  late final MobileTelemetryService telemetry;
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
  bool _requiresPhoneCompletion = false;

  SupplierUser? _supplierUser;
  String? _supplierToken;
  String? _supplierRefreshToken;

  Map<String, dynamic> _appConfig = const <String, dynamic>{};
  Map<String, dynamic> _storeSettings = <String, dynamic>{
    'show_prices_to_guests': false,
    'show_single_price': false,
  };
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
  Set<String> _wishlistIds = <String>{};
  List<Product> _wishlistProducts = const <Product>[];
  List<MobileNotificationItem> _notifications = const <MobileNotificationItem>[];
  int _unreadNotificationCount = 0;

  factory SessionProvider({
    required ApiClient apiClient,
    MobileApiService? apiService,
    ISessionStorage? sessionStorage,
    ICatalogRepository? catalogRepo,
    IAuthRepository? authRepo,
    ICommerceRepository? commerceRepo,
    MobileTelemetryService? telemetryService,
  }) {
    final resolvedApi = apiService ?? MobileApiService(apiClient);
    return SessionProvider._internal(
      apiClient,
      resolvedApi,
      sessionStorage ?? const SecureSessionStorage(),
      catalogRepo ?? resolvedApi.catalog,
      authRepo ?? resolvedApi.auth,
      commerceRepo ?? resolvedApi.commerce,
      telemetryService,
    );
  }

  SessionProvider._internal(
    this.apiClient,
    this.api,
    this._storage,
    this._catalogRepo,
    this._authRepo,
    this._commerceRepo,
    MobileTelemetryService? telemetryService,
  ) {
    apiClient.getCustomerToken = () async => _customerToken;
    apiClient.getSupplierToken = () async => _supplierToken;
    apiClient.getActiveRole = () => _activeRole;
    apiClient.getGuestCustomerId = () => effectiveChatCustomerId;
    apiClient.getCustomerDisplayName = () => effectiveCustomerDisplayName;
    apiClient.getLanguageCode = () => _languageCode;
    apiClient.onRefreshToken = _handleAutoRefresh;

    telemetry =
        telemetryService ??
        MobileTelemetryService(apiClient, getCurrency: () => _currencyCode);
  }

  bool get initialized => _initialized;
  bool get loadingBootstrap => _loadingBootstrap;
  AppRole get activeRole => _activeRole;
  bool get isSupplierMode => _activeRole == AppRole.supplier;

  String get languageCode => _languageCode;
  String get currencyCode => _currencyCode;
  String get visitorId => apiClient.visitorId;

  CustomerUser? get customerUser => _customerUser;
  SupplierUser? get supplierUser => _supplierUser;

  bool get isCustomerLoggedIn =>
      _customerToken != null &&
      _customerToken!.isNotEmpty &&
      _customerUser != null;

  bool get isCustomerAuthenticated => isCustomerLoggedIn;

  bool get isSupplierLoggedIn =>
      _supplierToken != null &&
      _supplierToken!.isNotEmpty &&
      _supplierUser != null;

  bool get isMemberLoggedIn => isCustomerLoggedIn || isSupplierLoggedIn;

  bool get requiresPhoneCompletion =>
      isCustomerLoggedIn &&
      (_requiresPhoneCompletion || (_customerUser?.requiresPhone ?? false));

  bool get hasPendingPhoneCompletion => requiresPhoneCompletion;

  bool get showPricesToGuests =>
      _storeSettings['show_prices_to_guests'] == true;
  bool get canViewPrices => isMemberLoggedIn || showPricesToGuests;

  String get effectiveChatCustomerId =>
      isCustomerLoggedIn ? _customerUser!.id : _guestCustomerId;

  String get effectiveCustomerDisplayName => isCustomerLoggedIn
      ? _customerUser!.fullName
      : AppStrings.t(_languageCode, 'guest_buyer_label');

  Map<String, dynamic> get appConfig => _appConfig;
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
      return AppStrings.t(_languageCode, 'members_only');
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
    _languageCode = AppStrings.normalizeCode(snap.languageCode);
    ApiClient.defaultLanguageCode = _languageCode;
    _currencyCode = snap.currencyCode.toUpperCase();
    _guestCustomerId = snap.guestCustomerId;
    await apiClient.ensureVisitorId();

    if (snap.customerToken != null &&
        snap.customerToken!.isNotEmpty &&
        snap.customerUser != null) {
      _customerToken = snap.customerToken;
      _customerRefreshToken = snap.customerRefreshToken;
      _customerUser = snap.customerUser;
      _requiresPhoneCompletion = snap.customerUser!.requiresPhone;
    }

    if (snap.supplierToken != null &&
        snap.supplierToken!.isNotEmpty &&
        snap.supplierUser != null) {
      _supplierToken = snap.supplierToken;
      _supplierRefreshToken = snap.supplierRefreshToken;
      _supplierUser = snap.supplierUser;
    }

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
      await refreshCustomerProfile();
    }
    if (isMemberLoggedIn) {
      await refreshNotifications();
    }
  }

  Future<void> loadBootstrap() async {
    _loadingBootstrap = true;
    notifyListeners();
    try {
      final payload = await _catalogRepo.fetchBootstrap();
      if (payload.appConfig.isNotEmpty) {
        _appConfig = payload.appConfig;
      }
      if (payload.settings.isNotEmpty) {
        _storeSettings = payload.settings;
      }
      if (payload.exchangeRates.isNotEmpty) {
        _exchangeRates = {..._exchangeRates, ...payload.exchangeRates};
      }
      _categories = payload.categories;
      _brands = payload.brands;
      _newestProducts = payload.newestProducts;
      _featuredProducts = payload.featuredProducts;
    } catch (_) {
      // Keep cached/default values gracefully when offline.
    } finally {
      _loadingBootstrap = false;
      notifyListeners();
    }
  }

  Future<void> setLanguage(String code) async {
    final normalized = AppStrings.normalizeCode(code);
    _languageCode = normalized;
    ApiClient.defaultLanguageCode = normalized;
    notifyListeners();
    await _storage.saveLanguageCode(normalized);
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
      throw ApiException(AppStrings.t(_languageCode, 'err_token_missing'));
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

    final rawUser = data['user'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(data['user'] as Map<String, dynamic>)
        : <String, dynamic>{
            'id': '',
            'first_name': email.split('@').first,
            'last_name': '',
            'email': email,
            'phone': '',
            'role': 'customer',
          };
    if (data.containsKey('requires_phone')) {
      rawUser['requires_phone'] = data['requires_phone'] == true;
    }

    final custUser = CustomerUser.fromJson(rawUser);
    _customerUser = custUser;
    _customerToken = token;
    _customerRefreshToken = refreshToken;
    _requiresPhoneCompletion =
        data['requires_phone'] == true || custUser.requiresPhone;
    _activeRole = AppRole.customer;

    await _storage.saveCustomerSession(
      user: custUser,
      token: token,
      refreshToken: refreshToken,
    );

    notifyListeners();
    await refreshWishlist();
    await refreshNotifications();
    await refreshCustomerProfile();
    return AppRole.customer;
  }

  Future<void> registerCustomerAccount({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  }) async {
    final challenge = _appConfig['form_challenge_token']?.toString() ?? '';
    final resp = await _authRepo.registerCustomer(
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: password,
      challengeToken: challenge,
    );

    final token = (resp['token'] ?? '').toString();
    if (token.isNotEmpty && resp['user'] is Map<String, dynamic>) {
      final user = CustomerUser.fromJson(resp['user'] as Map<String, dynamic>);
      _customerUser = user;
      _customerToken = token;
      _requiresPhoneCompletion =
          resp['requires_phone'] == true || user.requiresPhone;
      _activeRole = AppRole.customer;
      await _storage.saveCustomerSession(user: user, token: token);
      notifyListeners();
      await refreshWishlist();
      await refreshNotifications();
    } else {
      await login(email: email, password: password, role: 'customer');
    }
  }

  Future<CustomerUser?> refreshCustomerProfile() async {
    if (!isCustomerLoggedIn) return null;
    try {
      final profile = await _authRepo.fetchCustomerProfile();
      final merged = (_customerUser ?? profile).copyWith(
        id: profile.id.isNotEmpty ? profile.id : null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email.isNotEmpty ? profile.email : null,
        phone: profile.phone,
        preferredLang: profile.preferredLang,
        preferredCurrency: profile.preferredCurrency,
        billingAddress: profile.billingAddress,
        deliveryAddress: profile.deliveryAddress,
        taxNoTCKN: profile.taxNoTCKN,
        instagramUsername: profile.instagramUsername,
        emailVerified: profile.emailVerified,
        requiresPhone: profile.phone.trim().isEmpty,
      );
      _customerUser = merged;
      _requiresPhoneCompletion = merged.requiresPhone;
      if (_customerToken != null && _customerToken!.isNotEmpty) {
        await _storage.saveCustomerSession(
          user: merged,
          token: _customerToken!,
          refreshToken: _customerRefreshToken ?? '',
        );
      }
      notifyListeners();
      return merged;
    } catch (_) {
      return _customerUser;
    }
  }

  Future<CustomerUser> updateCustomerProfile({
    required String firstName,
    required String lastName,
    required String phone,
    String? preferredLang,
    String? preferredCurrency,
    String? billingAddress,
    String? deliveryAddress,
    String? taxNoTCKN,
    String? instagramUsername,
  }) async {
    final normalizedPhone = PhoneValidator.normalizeAndValidate(
      phone,
      lang: _languageCode,
    );
    if (!normalizedPhone.isValid) {
      throw ApiException(
        normalizedPhone.localizedError(_languageCode),
        statusCode: 400,
      );
    }

    final current = _customerUser;
    final updated = await _authRepo.updateCustomerProfile(
      firstName: firstName,
      lastName: lastName,
      phone: normalizedPhone.normalized,
      preferredLang: preferredLang ?? _languageCode,
      preferredCurrency: preferredCurrency ?? _currencyCode,
      billingAddress: billingAddress ?? current?.billingAddress ?? '',
      deliveryAddress: deliveryAddress ?? current?.deliveryAddress ?? '',
      taxNoTCKN: taxNoTCKN ?? current?.taxNoTCKN ?? '',
      instagramUsername: instagramUsername ?? current?.instagramUsername ?? '',
    );

    _customerUser = updated.copyWith(
      role: current?.role ?? 'customer',
      requiresPhone: false,
    );
    _requiresPhoneCompletion = false;
    if (_customerToken != null && _customerToken!.isNotEmpty) {
      await _storage.saveCustomerSession(
        user: _customerUser!,
        token: _customerToken!,
        refreshToken: _customerRefreshToken ?? '',
      );
    }
    notifyListeners();
    return _customerUser!;
  }

  /// Completes a missing customer phone after non-blocking Keycloak/social login.
  Future<void> completeCustomerPhone(String rawPhone) async {
    final current = _customerUser;
    await updateCustomerProfile(
      firstName: current?.firstName ?? '',
      lastName: current?.lastName ?? '',
      phone: rawPhone,
    );
  }

  Future<void> resendEmailVerification({String? email}) {
    return _authRepo.resendEmailVerification(
      email: email ?? _customerUser?.email,
    );
  }

  Future<String?> _handleAutoRefresh(AppRole role) async {
    try {
      final refTok = role == AppRole.supplier
          ? _supplierRefreshToken
          : _customerRefreshToken;
      if (refTok == null || refTok.isEmpty) {
        return null;
      }

      final activeTok = role == AppRole.supplier
          ? _supplierToken
          : _customerToken;

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
        if (newRef.isNotEmpty) {
          _supplierRefreshToken = newRef;
        }
        await _storage.updateSupplierTokens(
          token: newTok,
          refreshToken: newRef,
        );
      } else {
        _customerToken = newTok;
        if (newRef.isNotEmpty) {
          _customerRefreshToken = newRef;
        }
        await _storage.updateCustomerTokens(
          token: newTok,
          refreshToken: newRef,
        );
      }
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
      _requiresPhoneCompletion = false;
      _wishlistIds = <String>{};
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
      throw ApiException(AppStrings.t(_languageCode, 'err_no_active_session'));
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
        _wishlistProducts = _wishlistProducts
            .where((p) => p.id != product.id)
            .toList();
      } else {
        _wishlistIds.add(product.id);
        _wishlistProducts = [product, ..._wishlistProducts];
      }
      notifyListeners();
      return;
    }

    final existed = _wishlistIds.contains(product.id);
    if (existed) {
      _wishlistIds.remove(product.id);
      _wishlistProducts = _wishlistProducts
          .where((p) => p.id != product.id)
          .toList();
    } else {
      _wishlistIds.add(product.id);
      _wishlistProducts = [product, ..._wishlistProducts];
    }
    notifyListeners();

    try {
      if (existed) {
        await _commerceRepo.removeWishlist(product.id);
      } else {
        await _commerceRepo.addWishlist(product.id);
        telemetry.trackMemberEvent(
          eventType: 'wishlist_add',
          entityType: 'product',
          entityId: product.id,
          title: product.title,
        );
      }
    } catch (_) {
      await refreshWishlist();
    }
  }

  Future<void> refreshNotifications() async {
    if (!isCustomerLoggedIn && !isSupplierLoggedIn) {
      _notifications = const <MobileNotificationItem>[];
      _unreadNotificationCount = 0;
      notifyListeners();
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
    _notifications = _notifications
        .map(
          (n) => MobileNotificationItem(
            id: n.id,
            title: n.title,
            body: n.body,
            notificationType: n.notificationType,
            isRead: true,
            createdAt: n.createdAt,
            metadata: n.metadata,
          ),
        )
        .toList();
    notifyListeners();
    await _commerceRepo.markAllNotificationsRead();
  }
}
