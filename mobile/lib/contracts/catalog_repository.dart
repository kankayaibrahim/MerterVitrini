import '../models/product.dart';

export '../models/product.dart' show CatalogQueryResult;

class BootstrapPayload {
  final Map<String, dynamic> appConfig;
  final Map<String, dynamic> settings;
  final List<Map<String, dynamic>> languages;
  final Map<String, double> exchangeRates;
  final List<CategoryNode> categories;
  final List<BrandSummary> brands;
  final List<Product> newestProducts;
  final List<Product> featuredProducts;

  const BootstrapPayload({
    this.appConfig = const {},
    required this.settings,
    this.languages = const [],
    required this.exchangeRates,
    required this.categories,
    required this.brands,
    required this.newestProducts,
    required this.featuredProducts,
  });

  String get formChallengeToken =>
      (appConfig['form_challenge_token'] ?? '').toString().trim();
}

/// ISP Contract: Public Catalog & Storefront Discovery.
abstract interface class ICatalogRepository {
  Future<BootstrapPayload> fetchBootstrap();

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
  });

  Future<CatalogQueryResult> searchCatalog(
    CatalogFilterParams filter, {
    int limit = 24,
    int offset = 0,
    String? lang,
  });

  Future<Product> fetchProductDetail(String idOrSlug);

  Future<List<CatalogAttributeGroup>> listStoreAttributes();

  Future<List<ManufacturerSummary>> listManufacturers();

  Future<ManufacturerDetail> fetchManufacturerDetail(String slugOrId);
}
