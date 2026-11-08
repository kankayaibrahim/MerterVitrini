import '../contracts/catalog_repository.dart';
import '../models/product.dart';
import '../services/api_client.dart';

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
        settings: data['settings'] is Map<String, dynamic>
            ? data['settings'] as Map<String, dynamic>
            : <String, dynamic>{},
        exchangeRates: _parseRates(data['exchange_rates']),
        categories: _parseList(data['categories'], CategoryNode.fromJson),
        brands: _parseList(data['brands'], BrandSummary.fromJson),
        newestProducts: _parseList(data['newest_products'], Product.fromJson),
        featuredProducts:
            _parseList(data['featured_products'], Product.fromJson),
      );
    } catch (_) {
      // Fallback to existing live /api/v1/store/* endpoints when /api/v1/mobile/bootstrap
      // has not yet been deployed to the remote server.
      return _fetchBootstrapFromStorefrontEndpoints();
    }
  }

  Future<BootstrapPayload> _fetchBootstrapFromStorefrontEndpoints() async {
    try {
      final results = await Future.wait<dynamic>([
        _safeGet('/api/v1/store/products', const {
          'limit': 12,
          'offset': 0,
          'sort_by': 'newest',
        }),
        _safeGet('/api/v1/store/products', const {
          'limit': 12,
          'offset': 12,
          'sort_by': 'newest',
        }),
        _safeGet('/api/v1/store/categories'),
        _safeGet('/api/v1/store/brands'),
        _safeGet('/api/v1/store/exchange-rates'),
        _safeGet('/api/v1/store/settings'),
      ]);

      final newestMap = results[0];
      final featuredMap = results[1];
      final newestList = newestMap is Map<String, dynamic>
          ? _parseList(newestMap['products'], Product.fromJson)
          : <Product>[];
      var featuredList = featuredMap is Map<String, dynamic>
          ? _parseList(featuredMap['products'], Product.fromJson)
          : <Product>[];
      if (featuredList.isEmpty) {
        featuredList = newestList;
      }

      return BootstrapPayload(
        settings: results[5] is Map<String, dynamic>
            ? results[5] as Map<String, dynamic>
            : <String, dynamic>{},
        exchangeRates: _parseRates(results[4]),
        categories: _parseList(results[2], CategoryNode.fromJson),
        brands: _parseList(results[3], BrandSummary.fromJson),
        newestProducts: newestList,
        featuredProducts: featuredList,
      );
    } catch (e) {
      throw ApiClient.mapError(e);
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

  Map<String, double> _parseRates(dynamic raw) {
    final ratesMap = <String, double>{'TRY': 1.0};
    if (raw is List) {
      for (final r in raw) {
        if (r is Map<String, dynamic>) {
          final code = (r['currency_code'] ?? '').toString().toUpperCase();
          final rate = (r['buying_rate'] as num?)?.toDouble() ?? 0.0;
          if (code.isNotEmpty && rate > 0) {
            ratesMap[code] = rate;
          }
        }
      }
    }
    return ratesMap;
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
    try {
      final params = <String, dynamic>{
        'limit': limit,
        'offset': offset,
        'sort_by': sortBy,
      };
      if (query.trim().isNotEmpty) params['q'] = query.trim();
      if (categoryId.isNotEmpty) params['category_id'] = categoryId;
      if (brandId.isNotEmpty) params['brand_id'] = brandId;
      if (gender.isNotEmpty) params['gender'] = gender;
      if (season.isNotEmpty) params['season'] = season;

      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/store/products',
        queryParameters: params,
      );
      final data = resp.data ?? <String, dynamic>{};
      final list = _parseList(data['products'], Product.fromJson);
      return CatalogQueryResult(
        products: list,
        total: (data['total'] as num?)?.toInt() ?? list.length,
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Product> fetchProductDetail(String idOrSlug) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/store/products/$idOrSlug',
      );
      return Product.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  List<T> _parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) mapper,
  ) {
    final result = <T>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) {
          result.add(mapper(item));
        }
      }
    }
    return result;
  }
}

