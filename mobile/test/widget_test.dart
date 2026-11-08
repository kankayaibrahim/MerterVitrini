import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mertervitrini_mobile/contracts/catalog_repository.dart';
import 'package:mertervitrini_mobile/contracts/commerce_repository.dart';
import 'package:mertervitrini_mobile/contracts/session_storage.dart';
import 'package:mertervitrini_mobile/core/currency_formatter.dart';
import 'package:mertervitrini_mobile/core/localization.dart';
import 'package:mertervitrini_mobile/features/supplier/wizard/wizard_models.dart';
import 'package:mertervitrini_mobile/main.dart';
import 'package:mertervitrini_mobile/models/cart_and_order.dart';
import 'package:mertervitrini_mobile/models/chat.dart';
import 'package:mertervitrini_mobile/models/product.dart';
import 'package:mertervitrini_mobile/models/user.dart';
import 'package:mertervitrini_mobile/providers/cart_provider.dart';
import 'package:mertervitrini_mobile/providers/session_provider.dart';
import 'package:mertervitrini_mobile/services/api_client.dart';
import 'package:mertervitrini_mobile/services/app_update_service.dart';
import 'package:mertervitrini_mobile/widgets/country_flag_icon.dart';
import 'package:mertervitrini_mobile/widgets/luxury_icons.dart';

class _InMemorySessionStorage implements ISessionStorage {
  String lang = 'tr';
  String currency = 'USD';
  AppRole role = AppRole.customer;
  CustomerUser? customer;
  String? customerToken;

  @override
  Future<SavedSessionSnapshot> loadSnapshot() async {
    return SavedSessionSnapshot(
      languageCode: lang,
      currencyCode: currency,
      guestCustomerId: 'guest-test-001',
      savedRole: role == AppRole.supplier ? 'supplier' : 'customer',
      customerToken: customerToken,
      customerUser: customer,
    );
  }

  @override
  Future<void> saveLanguageCode(String code) async => lang = code;

  @override
  Future<void> saveCurrencyCode(String code) async => currency = code;

  @override
  Future<void> saveActiveRole(AppRole r) async => role = r;

  @override
  Future<void> saveCustomerSession({
    required CustomerUser user,
    required String token,
    String refreshToken = '',
  }) async {
    customer = user;
    customerToken = token;
  }

  @override
  Future<void> updateCustomerTokens({
    required String token,
    String refreshToken = '',
  }) async {
    customerToken = token;
  }

  @override
  Future<void> clearCustomerSession() async {
    customer = null;
    customerToken = null;
  }

  @override
  Future<void> saveSupplierSession({
    required SupplierUser user,
    required String token,
    String refreshToken = '',
  }) async {}

  @override
  Future<void> updateSupplierTokens({
    required String token,
    String refreshToken = '',
  }) async {}

  @override
  Future<void> clearSupplierSession() async {}
}

class _FakeCatalogRepository implements ICatalogRepository {
  @override
  Future<BootstrapPayload> fetchBootstrap() async {
    return BootstrapPayload(
      settings: const {'site_name': 'Merter Vitrini B2B'},
      exchangeRates: const {'TRY': 1.0, 'USD': 40.0, 'EUR': 44.0},
      categories: const <CategoryNode>[],
      brands: const <BrandSummary>[],
      newestProducts: <Product>[
        Product.fromJson({
          'id': 'prod-solid-1',
          'title': 'İpek Karışımlı Gömlek',
          'custom_sku': 'MV-9001',
          'price': 400.0,
          'series_ratio': '1-2-2-1',
          'currency': 'TRY',
          'stock': 60,
          'is_active': true,
        }),
      ],
      featuredProducts: const <Product>[],
    );
  }

  @override
  Future<CatalogQueryResult> searchProducts({
    String query = '',
    String categoryId = '',
    String brandId = '',
    String gender = '',
    String season = '',
    String sortBy = 'newest',
    int limit = 24,
    int offset = 0,
  }) async {
    return const CatalogQueryResult(products: <Product>[], total: 0);
  }

  @override
  Future<Product> fetchProductDetail(String idOrSlug) async {
    throw UnimplementedError();
  }
}

class _FakeCommerceRepository implements ICommerceRepository {
  final List<CartItem> serverItems = <CartItem>[];

  @override
  Future<List<CartItem>> fetchServerCart() async => List.of(serverItems);

  @override
  Future<void> addServerCartItem({
    required String productId,
    required int totalUnitsQuantity,
  }) async {
    serverItems.add(
      CartItem(
        id: 'ci-$productId',
        productId: productId,
        title: 'Server Item',
        customSku: 'MV-100',
        color: 'Siyah',
        imageUrl: '',
        pricePerUnit: 200.0,
        weightPerUnit: 0.35,
        currency: 'TRY',
        slug: 'server-item',
        unitsPerPackage: 6,
        packagesQty: (totalUnitsQuantity / 6).round(),
      ),
    );
  }

  @override
  Future<void> updateServerCartItem({
    required String itemId,
    required int totalUnitsQuantity,
  }) async {}

  @override
  Future<void> removeServerCartItem(String itemId) async {
    serverItems.removeWhere((e) => e.id == itemId);
  }

  @override
  Future<void> clearServerCart() async => serverItems.clear();

  @override
  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String paymentMethod = 'BANK_TRANSFER',
  }) async =>
      const {'order_number': 'MV-ORD-1'};

  @override
  Future<List<CustomerOrder>> listCustomerOrders() async =>
      const <CustomerOrder>[];

  @override
  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String notes = '',
  }) async {}

  @override
  Future<void> cancelCustomerOrder(String orderId) async {}

  @override
  Future<List<Product>> fetchWishlist() async => const <Product>[];

  @override
  Future<void> addWishlist(String productId) async {}

  @override
  Future<void> removeWishlist(String productId) async {}

  @override
  Future<(List<MobileNotificationItem>, int)> fetchNotifications() async =>
      (const <MobileNotificationItem>[], 0);

  @override
  Future<void> markAllNotificationsRead() async {}
}

void main() {
  group('B2B Wholesale Series & Currency Logic', () {
    test('parseUnitsPerPackage parses Merter series ratios accurately', () {
      expect(CurrencyFormatter.parseUnitsPerPackage('1-2-2-1'), 6);
      expect(CurrencyFormatter.parseUnitsPerPackage('2-2-2'), 6);
      expect(CurrencyFormatter.parseUnitsPerPackage('1,2,2,2,1'), 8);
      expect(CurrencyFormatter.parseUnitsPerPackage('S-M-L-XL'), 4);
      expect(CurrencyFormatter.parseUnitsPerPackage(''), 1);
      expect(CurrencyFormatter.parseUnitsPerPackage(null), 1);
    });

    test('SeriesStockDistributor distributes package stocks across variants', () {
      final stocks = SeriesStockDistributor.computeVariantStocks(
        variantCount: 4,
        rawRatio: '1-2-2-1',
        packageCount: 10,
      );
      expect(stocks, [10, 20, 20, 10]);

      final fallbackStocks = SeriesStockDistributor.computeVariantStocks(
        variantCount: 3,
        rawRatio: '2-2',
        packageCount: 5,
      );
      expect(fallbackStocks, [10, 10, 5]);
    });

    test('CurrencyFormatter converts TRY <-> USD/EUR via TCMB rates', () {
      const rates = {'TRY': 1.0, 'USD': 40.0, 'EUR': 44.0};
      expect(
        CurrencyFormatter.convert(
          amount: 400.0,
          sourceCurrency: 'TRY',
          displayCurrency: 'USD',
          ratesToTry: rates,
        ),
        closeTo(10.0, 0.001),
      );
      expect(
        CurrencyFormatter.convert(
          amount: 10.0,
          sourceCurrency: 'USD',
          displayCurrency: 'TRY',
          ratesToTry: rates,
        ),
        closeTo(400.0, 0.001),
      );
    });

    test('Product computes B2B package total price from unit price & series', () {
      final p = Product.fromJson({
        'id': 'prod-1',
        'title': 'Kruvaze Keten Takım',
        'custom_sku': 'FLORA-L6MV',
        'price': 1141.66,
        'discounted_price': 1141.66,
        'series_ratio': '2-2-2',
        'packing_ratio': 'S,M,L',
        'minimum_order_quantity': 6,
        'currency': 'TRY',
        'stock': 60,
        'is_active': true,
      });

      expect(p.effectiveUnitPrice, 1141.66);
      expect(p.unitsPerPackage, 6);
      expect(p.minOrderPackages, 1);
      expect(p.minOrderUnits, 6);
      expect(p.packageTotalPrice, closeTo(6849.96, 0.01));
    });

    test('ChatOfferMetadata computes total B2B custom offer price', () {
      final meta = ChatOfferMetadata.fromJson({
        'product_id': 'prod-1',
        'title': 'Triko Kazak',
        'units_per_package': 6,
        'packages_qty': 5,
        'offered_unit_price': 250.0,
        'currency': 'TRY',
      });

      expect(meta.totalOfferPrice, 7500.0);
    });

    test('AppStrings returns RTL for Arabic and LTR for TR/EN/RU', () {
      expect(AppStrings.directionOf('ar'), TextDirection.rtl);
      expect(AppStrings.directionOf('tr'), TextDirection.ltr);
      expect(AppStrings.directionOf('ru'), TextDirection.ltr);
      expect(AppStrings.t('tr', 'nav_home'), 'Ana Sayfa');
    });

    test('Product.maskedBrandName returns open wholesale supplier name directly', () {
      final p = Product.fromJson({
        'id': 'prod-flora-1',
        'title': 'Zames Sim Detaylı Elbise',
        'custom_sku': 'FLORA-L6MV',
        'brand_name': 'ETIKA FASHION TOPTAN',
        'price': 1141.66,
        'series_ratio': '2-2-2',
        'currency': 'TRY',
        'stock': 0,
        'is_active': true,
      });

      expect(p.maskedBrandName, 'ETIKA FASHION TOPTAN');
    });

    test('CountryFlagIcon maps language and currency codes to crisp vector country flags', () {
      expect(CountryFlagIcon.normalizeCountryKey('tr'), 'tr');
      expect(CountryFlagIcon.normalizeCountryKey('TRY'), 'tr');
      expect(CountryFlagIcon.normalizeCountryKey('en'), 'gb');
      expect(CountryFlagIcon.normalizeCountryKey('GBP'), 'gb');
      expect(CountryFlagIcon.normalizeCountryKey('USD'), 'us');
      expect(CountryFlagIcon.normalizeCountryKey('EUR'), 'eu');
      expect(CountryFlagIcon.normalizeCountryKey('ar'), 'sa');
      expect(CountryFlagIcon.normalizeCountryKey('RUB'), 'ru');
    });
  });

  group('SOLID Dependency Inversion (DIP & ISP) Provider Tests', () {
    test('SessionProvider initializes from injected ISessionStorage & ICatalogRepository',
        () async {
      final storage = _InMemorySessionStorage();
      final catalog = _FakeCatalogRepository();
      final commerce = _FakeCommerceRepository();

      final session = SessionProvider(
        apiClient: ApiClient(),
        sessionStorage: storage,
        catalogRepo: catalog,
        commerceRepo: commerce,
      );

      await session.initialize();

      expect(session.initialized, isTrue);
      expect(session.currencyCode, 'USD');
      expect(session.newestProducts.length, 1);
      expect(session.formatPrice(400.0, sourceCurrency: 'TRY'), r'$10.00');
    });

    test('CartProvider operates against segregated ICommerceRepository', () async {
      SharedPreferences.setMockInitialValues({});
      final storage = _InMemorySessionStorage()
        ..customerToken = 'jwt-token'
        ..customer = const CustomerUser(
          id: 'cust-1',
          email: 'buyer@merter.com',
          firstName: 'Ahmet',
          lastName: 'Kaya',
          phone: '5550000000',
          role: 'customer',
        );
      final commerce = _FakeCommerceRepository();
      final session = SessionProvider(
        apiClient: ApiClient(),
        sessionStorage: storage,
        catalogRepo: _FakeCatalogRepository(),
        commerceRepo: commerce,
      );
      await session.initialize();

      final cart = CartProvider(api: commerce, session: session);
      final product = Product.fromJson({
        'id': 'prod-99',
        'title': 'Toptan Keten Pantolon',
        'custom_sku': 'MV-99',
        'price': 200.0,
        'series_ratio': '1-2-2-1',
        'currency': 'TRY',
        'stock': 120,
        'is_active': true,
      });

      await cart.addProductPackages(product, 3);
      expect(cart.totalPackages, 3);
      expect(cart.totalUnits, 18);
      expect(cart.totalAmountTry, 3600.0);
    });

    test('AppUpdateService compares semantic versions & build numbers accurately',
        () {
      expect(
        AppUpdateService.isRemoteNewer(
          localVersion: '1.0.0',
          localBuild: 1,
          remoteVersion: '1.0.0',
          remoteBuild: 2,
        ),
        isTrue,
      );
      expect(
        AppUpdateService.isRemoteNewer(
          localVersion: '1.0.0',
          localBuild: 2,
          remoteVersion: '1.0.1',
          remoteBuild: 2,
        ),
        isTrue,
      );
      expect(
        AppUpdateService.isRemoteNewer(
          localVersion: '1.0.2',
          localBuild: 4,
          remoteVersion: '1.0.2',
          remoteBuild: 4,
        ),
        isFalse,
      );

      final manifest = AppReleaseInfo.fromJson(const {
        'version': '1.0.3',
        'build_number': 5,
        'min_build_number': 2,
        'force_update': false,
        'apk_available': true,
        'file_size_bytes': 31457280,
        'sha256': 'ABCDEF123456',
        'release_notes': {'tr': 'Hız iyileştirmesi'},
      });
      expect(manifest.version, '1.0.3');
      expect(manifest.buildNumber, 5);
      expect(manifest.sha256, 'abcdef123456');
      expect(manifest.formattedSize, '30.0 MB');
      expect(manifest.localizedNotes('tr'), 'Hız iyileştirmesi');
    });
  });

  testWidgets('MerterVitriniMobileApp boots splash and dual-role shell cleanly',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({'mv_lang': 'tr'});
    await tester.pumpWidget(const MerterVitriniMobileApp());
    expect(find.text('MERTER VİTRİNİ'), findsOneWidget);
  });

  testWidgets('EditorialBottomNavBar renders bespoke LuxuryIcons, badges, and dispatches taps',
      (WidgetTester tester) async {
    int tappedIndex = -1;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: EditorialBottomNavBar(
            selectedIndex: 0,
            onTap: (idx) => tappedIndex = idx,
            items: const [
              EditorialNavItem(icon: LuxuryIconKind.showroom, label: 'Vitrin'),
              EditorialNavItem(icon: LuxuryIconKind.collection, label: 'Katalog'),
              EditorialNavItem(
                icon: LuxuryIconKind.bag,
                label: 'Sepet',
                badgeCount: 6,
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('VİTRİN'), findsOneWidget);
    expect(find.text('KATALOG'), findsOneWidget);
    expect(find.text('SEPET'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);

    await tester.tap(find.text('KATALOG'));
    await tester.pump();
    expect(tappedIndex, 1);
  });
}
