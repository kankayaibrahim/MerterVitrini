import '../core/currency_formatter.dart';

class ProductImage {
  final String id;
  final String imageUrl;
  final int sortOrder;
  final bool isCover;

  const ProductImage({
    required this.id,
    required this.imageUrl,
    required this.sortOrder,
    required this.isCover,
  });

  factory ProductImage.fromJson(Map<String, dynamic> json) {
    return ProductImage(
      id: (json['id'] ?? '').toString(),
      imageUrl: (json['image_url'] ?? '').toString(),
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      isCover: json['is_cover'] == true,
    );
  }
}

class ProductVariant {
  final String id;
  final String size;
  final String barcode;
  final int stock;
  final bool isSingle;

  const ProductVariant({
    required this.id,
    required this.size,
    required this.barcode,
    required this.stock,
    required this.isSingle,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: (json['id'] ?? '').toString(),
      size: (json['variant_size'] ?? json['size'] ?? 'STD').toString(),
      barcode: (json['barcode'] ?? '').toString(),
      stock: (json['stock'] as num?)?.toInt() ?? 0,
      isSingle: json['is_single'] == true,
    );
  }

  Map<String, dynamic> toSupplierInputJson() => {
        'size': size,
        'barcode': barcode,
        'stock': stock,
        'is_single': isSingle,
      };
}

class SiblingProduct {
  final String id;
  final String customSku;
  final String slug;
  final String color;
  final String imageUrl;

  const SiblingProduct({
    required this.id,
    required this.customSku,
    required this.slug,
    required this.color,
    required this.imageUrl,
  });

  factory SiblingProduct.fromJson(Map<String, dynamic> json) {
    return SiblingProduct(
      id: (json['id'] ?? '').toString(),
      customSku: (json['custom_sku'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      color: (json['color'] ?? 'Standart').toString(),
      imageUrl: (json['image_url'] ?? '').toString(),
    );
  }
}

class ProductTranslation {
  final String title;
  final String shortDescription;
  final String description;

  const ProductTranslation({
    required this.title,
    required this.shortDescription,
    required this.description,
  });

  factory ProductTranslation.fromJson(Map<String, dynamic> json) {
    return ProductTranslation(
      title: (json['title'] ?? '').toString(),
      shortDescription: (json['short_description'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }
}

class Product {
  final String id;
  final String title;
  final String slug;
  final String customSku;
  final String sku;
  final String barcode;
  final String shortDescription;
  final String description;
  final String brandId;
  final String brandName;
  final String categoryId;
  final String categoryTitle;
  final String? colorId;
  final String? fabricId;
  final String gender;
  final String season;
  final String fabric;
  final String color;
  final String packingRatio;
  final String seriesRatio;
  final int minimumOrderQuantity;
  final double price;
  final double? discountedPrice;
  final double buyingPrice;
  final String currency;
  final int stock;
  final bool isActive;
  final List<ProductImage> images;
  final List<ProductVariant> variants;
  final List<SiblingProduct> colorVariants;
  final Map<String, ProductTranslation> translations;

  const Product({
    required this.id,
    required this.title,
    required this.slug,
    required this.customSku,
    required this.sku,
    required this.barcode,
    required this.shortDescription,
    required this.description,
    required this.brandId,
    required this.brandName,
    required this.categoryId,
    required this.categoryTitle,
    this.colorId,
    this.fabricId,
    required this.gender,
    required this.season,
    required this.fabric,
    required this.color,
    required this.packingRatio,
    required this.seriesRatio,
    required this.minimumOrderQuantity,
    required this.price,
    this.discountedPrice,
    required this.buyingPrice,
    required this.currency,
    required this.stock,
    required this.isActive,
    required this.images,
    required this.variants,
    required this.colorVariants,
    required this.translations,
  });

  double get effectiveUnitPrice {
    if (discountedPrice != null &&
        discountedPrice! > 0 &&
        discountedPrice! < price) {
      return discountedPrice!;
    }
    return price;
  }

  int get unitsPerPackage => CurrencyFormatter.parseUnitsPerPackage(
        seriesRatio.isNotEmpty ? seriesRatio : packingRatio,
      );

  /// Minimum order quantity in packages/series.
  /// In PostgreSQL (`catalog.products`), `minimum_order_quantity` is stored in total pieces (units),
  /// e.g. `6` pieces for a `2-2-2` (6-unit) series = `1` package/series.
  int get minOrderPackages {
    if (minimumOrderQuantity <= 1) {
      return 1;
    }
    final units = unitsPerPackage > 0 ? unitsPerPackage : 1;
    final pkgs = (minimumOrderQuantity / units).ceil();
    return pkgs > 0 ? pkgs : 1;
  }

  /// Minimum order quantity in total pieces (units), aligned to full series packages.
  int get minOrderUnits => minOrderPackages * unitsPerPackage;

  double get packageTotalPrice => effectiveUnitPrice * unitsPerPackage;

  /// Returns the open supplier/manufacturer brand name on the storefront (falling back to SKU prefix only if brandName is empty).
  String get maskedBrandName {
    final name = brandName.trim();
    if (name.isNotEmpty) {
      return name;
    }
    final skuTrimmed = customSku.trim();
    final dashIdx = skuTrimmed.indexOf('-');
    if (dashIdx > 0) {
      return skuTrimmed.substring(0, dashIdx).toUpperCase();
    }
    return 'Merter Vitrini';
  }

  String get coverImageUrl {
    if (images.isEmpty) {
      return '';
    }
    for (final img in images) {
      if (img.isCover && img.imageUrl.isNotEmpty) {
        return img.imageUrl;
      }
    }
    return images.first.imageUrl;
  }

  String localizedTitle(String langCode) {
    final tr = translations[langCode];
    if (tr != null && tr.title.trim().isNotEmpty) {
      return tr.title;
    }
    return title;
  }

  String localizedDescription(String langCode) {
    final tr = translations[langCode];
    if (tr != null && tr.description.trim().isNotEmpty) {
      return tr.description;
    }
    return description;
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final parsedImages = <ProductImage>[];
    final rawImages = json['images'];
    if (rawImages is List) {
      for (var i = 0; i < rawImages.length; i++) {
        final item = rawImages[i];
        if (item is Map<String, dynamic>) {
          parsedImages.add(ProductImage.fromJson(item));
        } else if (item is String && item.isNotEmpty) {
          parsedImages.add(
            ProductImage(
              id: '$i',
              imageUrl: item,
              sortOrder: i,
              isCover: i == 0,
            ),
          );
        }
      }
    } else if (json['cover_image'] is String &&
        (json['cover_image'] as String).isNotEmpty) {
      parsedImages.add(
        ProductImage(
          id: '0',
          imageUrl: json['cover_image'] as String,
          sortOrder: 0,
          isCover: true,
        ),
      );
    }

    final parsedVariants = <ProductVariant>[];
    if (json['variants'] is List) {
      for (final v in json['variants'] as List) {
        if (v is Map<String, dynamic>) {
          parsedVariants.add(ProductVariant.fromJson(v));
        }
      }
    }

    final parsedSiblings = <SiblingProduct>[];
    if (json['color_variants'] is List) {
      for (final s in json['color_variants'] as List) {
        if (s is Map<String, dynamic>) {
          parsedSiblings.add(SiblingProduct.fromJson(s));
        }
      }
    }

    final parsedTranslations = <String, ProductTranslation>{};
    if (json['translations'] is Map<String, dynamic>) {
      (json['translations'] as Map<String, dynamic>).forEach((key, val) {
        if (val is Map<String, dynamic>) {
          parsedTranslations[key] = ProductTranslation.fromJson(val);
        }
      });
    }

    return Product(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      customSku: (json['custom_sku'] ?? '').toString(),
      sku: (json['sku'] ?? '').toString(),
      barcode: (json['barcode'] ?? '').toString(),
      shortDescription: (json['short_description'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      brandId: (json['brand_id'] ?? '').toString(),
      brandName: (json['brand_name'] ?? 'Merter Vitrini').toString(),
      categoryId: (json['category_id'] ?? '').toString(),
      categoryTitle:
          (json['category_title'] ?? json['category_name'] ?? '').toString(),
      colorId: json['color_id']?.toString(),
      fabricId: json['fabric_id']?.toString(),
      gender: (json['gender'] ?? '').toString(),
      season: (json['season'] ?? '').toString(),
      fabric: (json['kumas_fabric'] ?? '').toString(),
      color: (json['color'] ?? 'Standart').toString(),
      packingRatio: (json['packing_ratio'] ?? '').toString(),
      seriesRatio: (json['series_ratio'] ?? '').toString(),
      minimumOrderQuantity:
          (json['minimum_order_quantity'] as num?)?.toInt() ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      discountedPrice: (json['discounted_price'] as num?)?.toDouble(),
      buyingPrice: (json['buying_price'] as num?)?.toDouble() ?? 0.0,
      currency: (json['currency'] ?? 'TRY').toString(),
      stock: (json['stock'] as num?)?.toInt() ??
          (json['total_stock'] as num?)?.toInt() ??
          0,
      isActive: json['is_active'] != false,
      images: parsedImages,
      variants: parsedVariants,
      colorVariants: parsedSiblings,
      translations: parsedTranslations,
    );
  }
}

class CategoryNode {
  final String id;
  final String? parentId;
  final String title;
  final String slug;
  final String nodePath;
  final int activeProducts;
  final Map<String, String> localizedTitles;
  final List<CategoryNode> children;

  const CategoryNode({
    required this.id,
    this.parentId,
    required this.title,
    required this.slug,
    required this.nodePath,
    required this.activeProducts,
    required this.localizedTitles,
    required this.children,
  });

  String displayTitle(String langCode) {
    final t = localizedTitles[langCode];
    if (t != null && t.trim().isNotEmpty) {
      return t;
    }
    return title;
  }

  factory CategoryNode.fromJson(Map<String, dynamic> json) {
    final titles = <String, String>{};
    if (json['translations'] is Map<String, dynamic>) {
      (json['translations'] as Map<String, dynamic>).forEach((k, v) {
        if (v is Map<String, dynamic> && v['title'] != null) {
          titles[k] = v['title'].toString();
        }
      });
    }

    final kids = <CategoryNode>[];
    if (json['children'] is List) {
      for (final c in json['children'] as List) {
        if (c is Map<String, dynamic>) {
          kids.add(CategoryNode.fromJson(c));
        }
      }
    }

    return CategoryNode(
      id: (json['id'] ?? '').toString(),
      parentId: json['parent_id']?.toString(),
      title: (json['title'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      nodePath: (json['node_path'] ?? '').toString(),
      activeProducts: (json['active_products'] as num?)?.toInt() ?? 0,
      localizedTitles: titles,
      children: kids,
    );
  }
}

class BrandSummary {
  final String id;
  final String name;
  final String slug;
  final String aliasCode;

  const BrandSummary({
    required this.id,
    required this.name,
    required this.slug,
    required this.aliasCode,
  });

  String get maskedDisplayName =>
      aliasCode.trim().isNotEmpty ? aliasCode.trim() : name;

  factory BrandSummary.fromJson(Map<String, dynamic> json) {
    return BrandSummary(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? json['brand_name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      aliasCode: (json['alias_code'] ?? '').toString(),
    );
  }
}

class SimpleOptionItem {
  final String id;
  final String name;
  final String code;

  const SimpleOptionItem({
    required this.id,
    required this.name,
    this.code = '',
  });

  factory SimpleOptionItem.fromJson(Map<String, dynamic> json) {
    return SimpleOptionItem(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? json['title'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
    );
  }
}

