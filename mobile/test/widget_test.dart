import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mertervitrini_mobile/contracts/catalog_repository.dart';
import 'package:mertervitrini_mobile/contracts/commerce_repository.dart';
import 'package:mertervitrini_mobile/contracts/session_storage.dart';
import 'package:mertervitrini_mobile/core/currency_formatter.dart';
import 'package:mertervitrini_mobile/core/localization.dart';
import 'package:mertervitrini_mobile/core/phone_validator.dart';
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
  Future<CatalogQueryResult> searchCatalog(
    CatalogFilterParams filter, {
    int limit = 24,
    int offset = 0,
    String? lang,
  }) async {
    return CatalogQueryResult(
      products: const <Product>[],
      total: 0,
      offset: offset,
      limit: limit,
    );
  }

  @override
  Future<CatalogQueryResult> searchProducts({
    String query = '',
    String categoryId = '',
    String brandId = '',
    String brandSlug = '',
    String gender = '',
    String season = '',
    bool fason = false,
    bool privateLabel = false,
    String companyType = '',
    String maxMoq = '',
    String exportCountry = '',
    String sortBy = 'newest',
    double? minPrice,
    double? maxPrice,
    String displayCurrency = '',
    Map<String, List<String>> attributeFilters = const {},
    String lang = '',
    int limit = 24,
    int offset = 0,
  }) async {
    return CatalogQueryResult(
      products: const <Product>[],
      total: 0,
      offset: offset,
      limit: limit,
    );
  }

  @override
  Future<Product> fetchProductDetail(String idOrSlug) async {
    throw UnimplementedError();
  }

  @override
  Future<List<CatalogAttributeGroup>> listStoreAttributes() async =>
      const <CatalogAttributeGroup>[];

  @override
  Future<List<ManufacturerSummary>> listManufacturers() async =>
      const <ManufacturerSummary>[];

  @override
  Future<ManufacturerDetail> fetchManufacturerDetail(String slugOrId) async {
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
    String? billingAddressId,
    String? deliveryAddressId,
    String paymentMethod = 'BANK_TRANSFER',
    String customerCurrency = '',
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
    String currency = '',
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

  @override
  Future<void> syncServerCart(List<CartItem> items) async {}

  @override
  Future<Uint8List> exportCartExcel({
    required String lang,
    required String displayCurrency,
    required List<CartItem> items,
  }) async =>
      Uint8List(0);

  @override
  Future<OrderDetailModel> fetchOrderDetail(String orderId) async {
    throw UnimplementedError();
  }

  @override
  Future<void> requestOrderRefund({
    required String orderId,
    required OrderRefundPayload payload,
  }) async {}

  @override
  Future<Uint8List> downloadOrderExcel(String orderId) async => Uint8List(0);

  @override
  Future<Uint8List> downloadOrderImagesZip(String orderId) async =>
      Uint8List(0);
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

    test('Selectable B2B size definitions & default 100 series stock work cleanly', () {
      expect(SeriesStockDistributor.defaultSeriesStock, 100);
      expect(
        SeriesStockDistributor.buildRatioForAssortment(4, 'single'),
        '1-1-1-1',
      );
      expect(
        SeriesStockDistributor.buildRatioForAssortment(4, 'middle_double'),
        '1-2-2-1',
      );
      expect(
        SeriesStockDistributor.buildRatioForAssortment(3, 'double'),
        '2-2-2',
      );
      final sorted = SeriesStockDistributor.sortSelectedSizes(
        ['XL', 'S', 'L', 'M'],
        SeriesStockDistributor.fallbackSizeDefinitions,
      );
      expect(sorted, ['S', 'M', 'L', 'XL']);

      final p = Product.fromJson({
        'id': 'prod-series-default',
        'title': 'Keten Takım',
        'price': 350.0,
        'currency': 'TRY',
      });
      expect(p.seriesStock, 100);
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
      expect(session.canViewPrices, isFalse);
      expect(session.formatPrice(400.0, sourceCurrency: 'TRY'), 'Üyelere Özel');
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
          phone: '+905324819264',
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
      expect(session.canViewPrices, isTrue);
      expect(session.formatPrice(400.0, sourceCurrency: 'TRY'), r'$10.00');

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

  group('Phase 2 Core, i18n, Multi-Currency & DTO Contracts', () {
    test('AppStrings supports all 8 languages, Arabic RTL direction & letterSpacing zeroing', () {
      expect(
        AppStrings.supportedCodes,
        equals(const ['tr', 'en', 'ru', 'ar', 'de', 'fr', 'pl', 'bg']),
      );
      expect(AppStrings.directionOf('ar'), TextDirection.rtl);
      expect(AppStrings.directionOf('tr'), TextDirection.ltr);
      expect(AppStrings.letterSpacing('ar', 1.8), 0.0);
      expect(AppStrings.letterSpacing('en', 1.8), 1.8);

      const sampleKeys = <String>[
        'members_only',
        'err_token_missing',
        'phone_err_required',
        'phone_err_invalid',
        'rfq_board',
        'manufacturer_directory',
        'billing_overview',
        'archive_product',
      ];
      for (final lang in AppStrings.supportedCodes) {
        for (final key in sampleKeys) {
          final translated = AppStrings.t(lang, key);
          expect(
            translated.trim().isNotEmpty,
            isTrue,
            reason: 'Missing translation for ($lang, $key)',
          );
        }
      }
      expect(AppStrings.t('en', 'members_only'), isNot('Üyelere Özel'));
    });

    test('PhoneValidator normalizes Turkish/intl phones and localizes errors cleanly', () {
      final ok = PhoneValidator.normalizeAndValidate('0532 123 45 99', lang: 'en');
      expect(ok.valid, isTrue);
      expect(ok.normalized, '+905321234599');
      expect(ok.errorMessage, isNull);

      final missingEn = PhoneValidator.normalizeAndValidate('', lang: 'en');
      expect(missingEn.valid, isFalse);
      expect(missingEn.errorKey, 'phone_err_required');
      expect(missingEn.localizedError('en'), AppStrings.t('en', 'phone_err_required'));

      final fakeAr = PhoneValidator.normalizeAndValidate('5555555555', lang: 'ar');
      expect(fakeAr.valid, isFalse);
      expect(fakeAr.errorKey, 'phone_err_invalid');
      expect(fakeAr.localizedError('ar'), AppStrings.t('ar', 'phone_err_invalid'));
    });

    test('CartProvider converts mixed-currency lines to TRY and selected display currency', () async {
      SharedPreferences.setMockInitialValues({'mv_lang': 'en'});
      final storage = _InMemorySessionStorage();
      final client = ApiClient();
      final session = SessionProvider(
        apiClient: client,
        sessionStorage: storage,
        catalogRepo: _FakeCatalogRepository(),
        commerceRepo: _FakeCommerceRepository(),
      );
      await session.initialize();

      final cart = CartProvider(
        api: _FakeCommerceRepository(),
        session: session,
      );

      final usdProduct = Product.fromJson({
        'id': 'prod-usd-1',
        'title': 'Cashmere Knitwear',
        'custom_sku': 'MV-USD-1',
        'price': 10.0,
        'series_ratio': '1-2-2-1',
        'currency': 'USD',
        'stock': 60,
        'is_active': true,
      });
      final tryProduct = Product.fromJson({
        'id': 'prod-try-1',
        'title': 'Pamuklu Gömlek',
        'custom_sku': 'MV-TRY-1',
        'price': 400.0,
        'series_ratio': '1',
        'currency': 'TRY',
        'stock': 20,
        'is_active': true,
      });

      await cart.addProductPackages(usdProduct, 1); // 6 * $10 = $60 -> 2400 TRY
      await cart.addProductPackages(tryProduct, 1); // 1 * 400 = 400 TRY

      expect(cart.totalAmountTry, closeTo(2800.0, 0.01));
      expect(cart.totalInCurrency('USD'), closeTo(70.0, 0.01));
      expect(cart.currencyBreakdown['USD'], closeTo(60.0, 0.01));
      expect(cart.currencyBreakdown['TRY'], closeTo(400.0, 0.01));
    });

    test('CustomerAddress.toCreateJson and CatalogFilterParams.toQueryParameters match Go DTOs', () {
      const addr = CustomerAddress(
        id: '',
        userId: 'u-1',
        title: 'Showroom Merter',
        addressType: 'billing',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        recipientName: 'Ahmet Yılmaz',
        companyName: 'Vitrini Tekstil Ltd.',
        phone: '+905321234599',
        countryId: 'TR',
        stateId: '34',
        cityId: '3401',
        addressLine: 'Fatih Cad. No:12',
        city: 'Güngören',
        state: 'İstanbul',
        country: 'Türkiye',
        postalCode: '34173',
        taxNoTCKN: '1234567890',
        taxOffice: 'Merter VD',
        isDefault: true,
      );
      final payload = addr.toCreateJson();
      expect(payload['address_type'], 'billing');
      expect(payload['first_name'], 'Ahmet');
      expect(payload['last_name'], 'Yılmaz');
      expect(payload['country_id'], 'TR');
      expect(payload['state_id'], '34');
      expect(payload['city_id'], '3401');
      expect(payload['tax_no_tckn'], '1234567890');
      expect(payload['tax_office'], 'Merter VD');
      expect(payload['is_default'], isTrue);

      const filter = CatalogFilterParams(
        query: 'elbise',
        sortBy: CatalogSortOption.priceDesc,
        fasonOnly: true,
        privateLabelOnly: true,
        companyType: 'manufacturer',
        maxMoq: 50,
        exportCountry: 'Germany',
        displayCurrency: 'EUR',
        attributeFilters: {
          'Fabric': ['Cotton', 'Silk'],
        },
      );
      final qp = filter.toQueryParameters(limit: 24, offset: 48, lang: 'de');
      expect(qp['q'], 'elbise');
      expect(qp['sort_by'], 'price_desc');
      expect(qp['fason'], 'true');
      expect(qp['private_label'], 'true');
      expect(qp['company_type'], 'manufacturer');
      expect(qp['max_moq'], 50);
      expect(qp['export_country'], 'Germany');
      expect(qp['display_currency'], 'EUR');
      expect(qp['attr_Fabric'], 'Cotton,Silk');
      expect(qp['lang'], 'de');
      expect(qp['offset'], 48);
    });

    test('SessionProvider enforces localized members_only price lock and non-blocking phone gate', () async {
      SharedPreferences.setMockInitialValues({'mv_lang': 'en'});
      final storage = _InMemorySessionStorage()
        ..lang = 'en'
        ..customerToken = 'tok-123'
        ..customer = const CustomerUser(
          id: 'u-1',
          firstName: 'Elena',
          lastName: 'Ivanova',
          email: 'elena@example.com',
          phone: '',
          role: 'customer',
          requiresPhone: true,
        );
      final guestSession = SessionProvider(
        apiClient: ApiClient(),
        sessionStorage: _InMemorySessionStorage()..lang = 'en',
        catalogRepo: _FakeCatalogRepository(),
        commerceRepo: _FakeCommerceRepository(),
      );
      await guestSession.initialize();
      expect(guestSession.canViewPrices, isFalse);
      expect(guestSession.formatPrice(1200), AppStrings.t('en', 'members_only'));

      final memberSession = SessionProvider(
        apiClient: ApiClient(),
        sessionStorage: storage,
        catalogRepo: _FakeCatalogRepository(),
        commerceRepo: _FakeCommerceRepository(),
      );
      await memberSession.initialize();
      expect(memberSession.isCustomerLoggedIn, isTrue);
      expect(memberSession.requiresPhoneCompletion, isTrue);
    });
  });
}
