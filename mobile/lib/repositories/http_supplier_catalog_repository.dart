import 'package:dio/dio.dart';

import '../contracts/supplier_catalog_repository.dart';
import '../models/product.dart';
import '../services/api_client.dart';

class HttpSupplierCatalogRepository implements ISupplierCatalogRepository {
  final ApiClient _client;

  const HttpSupplierCatalogRepository(this._client);

  @override
  Future<(List<Product>, int)> listSupplierProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
    int limit = 30,
    int offset = 0,
  }) async {
    try {
      final params = <String, dynamic>{
        'limit': limit,
        'offset': offset,
      };
      if (query.trim().isNotEmpty) params['q'] = query.trim();
      if (status != 'all') params['status'] = status;
      if (categoryId.isNotEmpty) params['category_id'] = categoryId;

      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/products',
        queryParameters: params,
      );
      final data = resp.data ?? <String, dynamic>{};
      final list = _parseList(data['products'], Product.fromJson);
      final total = (data['total'] as num?)?.toInt() ?? list.length;
      return (list, total);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Product> fetchSupplierProductDetail(String productId) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/products/$productId',
      );
      return Product.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<String>> uploadSupplierProductPhotos(
    List<String> localPaths,
  ) async {
    if (localPaths.isEmpty) {
      return const <String>[];
    }
    try {
      final files = <MultipartFile>[];
      for (final path in localPaths) {
        files.add(await MultipartFile.fromFile(path));
      }
      final form = FormData.fromMap({'images': files});
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/mobile/supplier/upload-images',
        data: form,
      );
      final urls = <String>[];
      final raw = resp.data?['image_urls'];
      if (raw is List) {
        for (final u in raw) {
          if (u != null && u.toString().isNotEmpty) {
            urls.add(u.toString());
          }
        }
      }
      return urls;
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<String> createSupplierProduct(Map<String, dynamic> payload) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/supplier/products',
        data: payload,
      );
      return (resp.data?['id'] ?? '').toString();
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> updateSupplierProduct(
    String productId,
    Map<String, dynamic> payload,
  ) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/supplier/products/$productId',
        data: payload,
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> quickUpdateSupplierProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
    int? seriesStock,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (price != null) body['price'] = price;
      if (buyingPrice != null) body['buying_price'] = buyingPrice;
      if (isActive != null) body['is_active'] = isActive;
      if (stock != null) body['stock'] = stock;
      if (seriesStock != null) body['series_stock'] = seriesStock;

      await _client.dio.patch<dynamic>(
        '/api/v1/mobile/supplier/products/$productId/quick-update',
        data: body,
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> deleteSupplierProduct(String productId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/supplier/products/$productId');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<String> findSupplierProductByCode(String code) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/mobile/supplier/products/by-barcode',
        queryParameters: {'code': code.trim()},
      );
      return (resp.data?['product_id'] ?? '').toString();
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<SimpleOptionItem>> fetchSupplierCategories() async {
    try {
      final resp =
          await _client.dio.get<dynamic>('/api/v1/supplier/categories');
      return _parseList(resp.data, SimpleOptionItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<(List<SimpleOptionItem>, List<SimpleOptionItem>)>
      fetchSupplierAttributes() async {
    final bundle = await fetchSupplierAttributeBundle();
    return (bundle.colors, bundle.fabrics);
  }

  @override
  Future<SupplierAttributesBundle> fetchSupplierAttributeBundle() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/attributes',
      );
      final data = resp.data ?? <String, dynamic>{};
      return SupplierAttributesBundle(
        colors: _parseList(data['colors'], SimpleOptionItem.fromJson),
        fabrics: _parseList(data['fabrics'], SimpleOptionItem.fromJson),
        sizes: _parseList(data['sizes'], SizeDefinitionOption.fromJson),
        seriesTemplates:
            _parseList(data['series_templates'], SeriesTemplateOption.fromJson),
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Map<String, Map<String, String>>> autoTranslateSupplierFields(
    Map<String, String> fields,
  ) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/supplier/translate',
        data: {
          'source_lang': 'tr',
          'target_langs': ['en', 'ru', 'ar'],
          'fields': fields,
        },
      );
      final raw = resp.data?['translations'];
      final result = <String, Map<String, String>>{};
      if (raw is Map) {
        raw.forEach((langKey, langVal) {
          if (langVal is Map) {
            final fieldMap = <String, String>{};
            langVal.forEach((k, v) {
              fieldMap[k.toString()] = (v ?? '').toString();
            });
            result[langKey.toString()] = fieldMap;
          }
        });
      }
      return result;
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

