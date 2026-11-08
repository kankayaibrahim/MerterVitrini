import '../models/product.dart';

/// ISP Contract: Supplier Product Management & Camera Batch Image Upload.
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
  });

  Future<void> deleteSupplierProduct(String productId);

  Future<String> findSupplierProductByCode(String code);

  Future<List<SimpleOptionItem>> fetchSupplierCategories();

  Future<(List<SimpleOptionItem>, List<SimpleOptionItem>)>
      fetchSupplierAttributes();
}

