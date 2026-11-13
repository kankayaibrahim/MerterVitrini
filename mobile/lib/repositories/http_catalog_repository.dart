import '../contracts/catalog_repository.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

class HttpCatalogRepository implements ICatalogRepository {
  final ApiClient _client;

  const HttpCatalogRepository(this._client);

  @override
  Future<BootstrapPayload> fetchBootstrap() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/mobile/bootstrap',
      );
      final data = resp.data ?? <String, dynamic>{};
      return BootstrapPayload(
        appConfig: HttpRepoHelpers.asMap(data['app_config']),
        settings: HttpRepoHelpers.asMap(data['settings']),
        languages: HttpRepoHelpers.parseList(
          data['languages'],
          (m) => m,
        ),
        exchangeRates: HttpRepoHelpers.parseExchangeRates(
          data['exchange_rates'],
        ),
        categories: HttpRepoHelpers.parseList(
          data['categories'],
          CategoryNode.fromJson,
        ),
        brands: HttpRepoHelpers.parseList(data['brands'], BrandSummary.fromJson),
        newestProducts: HttpRepoHelpers.parseList(
          data['newest_products'],
          Product.fromJson,
        ),
        featuredProducts: HttpRepoHelpers.parseList(
          data['featured_products'],
          Product.fromJson,
        ),
      );
    } catch (_) {
      // Fallback to existing live /api/v1/store/* endpoints if /api/v1/mobile/bootstrap fails.
      final results = await Future.wait<dynamic>([
        _safeGet('/api/v1/store/products', const {
          'limit': 12,
          'sort_by': 'newest',
        }),
        _safeGet('/api/v1/store/products', const {
          'limit': 12,
          'sort_by': 'price_asc',
        }),
        _safeGet('/api/v1/store/categories'),
        _safeGet('/api/v1/store/brands'),
        _safeGet('/api/v1/store/exchange-rates'),
        _safeGet('/api/v1/store/settings'),
        _safeGet('/api/v1/store/languages'),
      ]);

      final newestMap = results[0];
      final featuredMap = results[1];
      final newestList = newestMap is Map<String, dynamic>
          ? HttpRepoHelpers.parseList(newestMap['products'], Product.fromJson)
          : <Product>[];
      var featuredList = featuredMap is Map<String, dynamic>
          ? HttpRepoHelpers.parseList(featuredMap['products'], Product.fromJson)
          : <Product>[];
      if (featuredList.isEmpty) {
        featuredList = newestList;
      }

      return BootstrapPayload(
        settings: results[5] is Map<String, dynamic>
            ? results[5] as Map<String, dynamic>
            : <String, dynamic>{'show_prices_to_guests': false},
        languages: HttpRepoHelpers.parseList(results[6], (m) => m),
        exchangeRates: HttpRepoHelpers.parseExchangeRates(results[4]),
        categories: HttpRepoHelpers.parseList(
          results[2],
          CategoryNode.fromJson,
        ),
        brands: HttpRepoHelpers.parseList(results[3], BrandSummary.fromJson),
        newestProducts: newestList,
        featuredProducts: featuredList,
      );
    }
  }

  Future<dynamic> _safeGet(
    String path, [
    Map<String, dynamic>? queryParameters,
  ]) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
      );
      return resp.data;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<CatalogQueryResult> searchCatalog(
    CatalogFilterParams filter, {
    int limit = 24,
    int offset = 0,
    String? lang,
  }) async {
    try {
      final params = filter.toQueryParameters(
        limit: limit,
        offset: offset,
        lang: lang ?? _client.activeLanguageCode,
      );
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/products',
        queryParameters: params,
      );
      final data = HttpRepoHelpers.asMap(resp.data);
      final list = HttpRepoHelpers.parseList(
        data['products'],
        Product.fromJson,
      );
      final total = (data['total'] as num?)?.toInt() ?? list.length;
      final facets = data['facets'] is Map
          ? CatalogFacets.fromJson(HttpRepoHelpers.asMap(data['facets']))
          : const CatalogFacets();
      return CatalogQueryResult(
        products: list,
        total: total,
        offset: offset,
        limit: limit,
        facets: facets,
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
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
  }) {
    final parsedMoq = int.tryParse(maxMoq.trim());
    return searchCatalog(
      CatalogFilterParams(
        query: query.trim().isEmpty ? null : query.trim(),
        categoryId: categoryId.trim().isEmpty ? null : categoryId.trim(),
        brandId: brandId.trim().isEmpty ? null : brandId.trim(),
        brandSlug: brandSlug.trim().isEmpty ? null : brandSlug.trim(),
        gender: gender.trim().isEmpty ? null : gender.trim(),
        season: season.trim().isEmpty ? null : season.trim(),
        fasonOnly: fason,
        privateLabelOnly: privateLabel,
        companyType: companyType.trim().isEmpty ? null : companyType.trim(),
        maxMoq: parsedMoq,
        exportCountry: exportCountry.trim().isEmpty
            ? null
            : exportCountry.trim(),
        minPrice: minPrice,
        maxPrice: maxPrice,
        displayCurrency: displayCurrency.trim().isEmpty
            ? null
            : displayCurrency.trim(),
        sortBy: CatalogSortOption.fromApi(sortBy),
        attributeFilters: attributeFilters,
      ),
      limit: limit,
      offset: offset,
      lang: lang.trim().isEmpty ? _client.activeLanguageCode : lang.trim(),
    );
  }

  @override
  Future<Product> fetchProductDetail(String idOrSlug) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/store/products/$idOrSlug',
      );
      return Product.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<CatalogAttributeGroup>> listStoreAttributes() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/attributes');
      final rawMap = HttpRepoHelpers.asMap(resp.data);
      final groups = <CatalogAttributeGroup>[];
      rawMap.forEach((name, val) {
        if (val is List) {
          final values = val
              .map((e) => (e ?? '').toString().trim())
              .where((e) => e.isNotEmpty)
              .toList();
          if (values.isNotEmpty) {
            groups.add(CatalogAttributeGroup(name: name, values: values));
          }
        }
      });
      return groups;
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<ManufacturerSummary>> listManufacturers() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/brands');
      return HttpRepoHelpers.parseList(resp.data, ManufacturerSummary.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<ManufacturerDetail> fetchManufacturerDetail(String slugOrId) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/brands/${slugOrId.trim()}',
      );
      return ManufacturerDetail.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }
}
