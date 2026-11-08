import '../models/product.dart';

class BootstrapPayload {
  final Map<String, dynamic> settings;
  final Map<String, double> exchangeRates;
  final List<CategoryNode> categories;
  final List<BrandSummary> brands;
  final List<Product> newestProducts;
  final List<Product> featuredProducts;

  const BootstrapPayload({
    required this.settings,
    required this.exchangeRates,
    required this.categories,
    required this.brands,
    required this.newestProducts,
    required this.featuredProducts,
  });
}

class CatalogQueryResult {
  final List<Product> products;
  final int total;

  const CatalogQueryResult({required this.products, required this.total});
}

/// ISP Contract: Public Storefront Bootstrap & Product Catalog queries.
abstract interface class ICatalogRepository {
  Future<BootstrapPayload> fetchBootstrap();

  Future<CatalogQueryResult> searchProducts({
    String query = '',
    String categoryId = '',
    String brandId = '',
    String gender = '',
    String season = '',
    String sortBy = 'newest',
    int limit = 24,
    int offset = 0,
  });

  Future<Product> fetchProductDetail(String idOrSlug);
}

