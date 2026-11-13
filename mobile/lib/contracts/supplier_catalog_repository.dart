import '../models/product.dart';

/// ISP Contract: Supplier Catalog Authoring, Studio Upload, Translations & Archive Management.
abstract interface class ISupplierCatalogRepository {
  Future<(List<Product>, int)> listSupplierProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
    int limit = 30,
    int offset = 0,
  });

  Future<Product> fetchSupplierProductDetail(String productId);

  Future<List<String>> uploadSupplierProductPhotos(List<String> localPaths);

  Future<String> createSupplierProduct(Map<String, dynamic> payload);

  Future<void> updateSupplierProduct(
    String productId,
    Map<String, dynamic> payload,
  );

  Future<void> quickUpdateSupplierProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
    int? seriesStock,
  });

  Future<void> deleteSupplierProduct(String productId);

  Future<void> toggleArchiveProduct({
    required String productId,
    required bool isArchived,
    bool restoreActive = false,
  });

  Future<int> bulkArchiveProducts({
    List<String> productIds = const [],
    bool isArchived = true,
    bool restoreActive = false,
    String season = '',
    int? olderThanDays,
    bool zeroStockOnly = false,
  });

  Future<String> findSupplierProductByCode(String code);

  Future<List<SimpleOptionItem>> fetchSupplierCategories();

  Future<(List<SimpleOptionItem>, List<SimpleOptionItem>)>
      fetchSupplierAttributes();

  Future<SupplierAttributesBundle> fetchSupplierAttributeBundle();

  Future<SupplierProductTranslationMap> fetchSupplierProductTranslations(
    String productId,
  );

  Future<void> updateSupplierProductTranslations(
    String productId,
    Map<String, SupplierProductTranslationEntry> translations,
  );

  Future<Map<String, Map<String, String>>> autoTranslateSupplierFields(
    Map<String, String> fields, {
    String sourceLang = 'tr',
    List<String>? targetLangs,
  });
}
