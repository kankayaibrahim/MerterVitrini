import '../core/app_config.dart';
import '../core/currency_formatter.dart';
import 'model_json.dart';

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
      id: ModelJson.trimmed(json['id']),
      imageUrl: AppConfig.resolveMediaUrl(
        ModelJson.trimmed(json['image_url'] ?? json['url']),
      ),
      sortOrder: ModelJson.integer(json['sort_order']),
      isCover: ModelJson.boolean(json['is_cover']),
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
      id: ModelJson.trimmed(json['id']),
      size: ModelJson.trimmed(json['variant_size'] ?? json['size'], 'STD'),
      barcode: ModelJson.trimmed(json['barcode']),
      stock: ModelJson.integer(json['stock']),
      isSingle: ModelJson.boolean(json['is_single']),
    );
  }

  Map<String, dynamic> toSupplierInputJson() => {
    'variant_size': size,
    'barcode': barcode,
    'stock': stock,
    'is_single': isSingle,
  };
}

class SiblingProduct {
  final String id;
  final String title;
  final String customSku;
  final String slug;
  final String? colorId;
  final String color;
  final String imageUrl;
  final double price;
  final String currency;
  final bool isActive;
  final String sourceProductGroupId;

  const SiblingProduct({
    required this.id,
    this.title = '',
    required this.customSku,
    required this.slug,
    this.colorId,
    required this.color,
    required this.imageUrl,
    this.price = 0,
    this.currency = 'TRY',
    this.isActive = true,
    this.sourceProductGroupId = '',
  });

  factory SiblingProduct.fromJson(Map<String, dynamic> json) {
    final rawCurrency = ModelJson.trimmed(json['currency'], 'TRY');
    return SiblingProduct(
      id: ModelJson.trimmed(json['id']),
      title: ModelJson.trimmed(json['title']),
      customSku: ModelJson.trimmed(json['custom_sku']),
      slug: ModelJson.trimmed(json['slug']),
      colorId: ModelJson.nullableStr(json['color_id']),
      color: ModelJson.trimmed(json['color']),
      imageUrl: AppConfig.resolveMediaUrl(
        ModelJson.trimmed(json['image_url'] ?? json['cover_image']),
      ),
      price: ModelJson.decimal(json['price']),
      currency: rawCurrency.isEmpty ? 'TRY' : rawCurrency,
      isActive: ModelJson.boolean(json['is_active'], true),
      sourceProductGroupId: ModelJson.trimmed(json['source_product_group_id']),
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
      title: ModelJson.trimmed(json['title']),
      shortDescription: ModelJson.trimmed(json['short_description']),
      description: ModelJson.trimmed(json['description']),
    );
  }
}

/// Editorial brand showcase & directory record returned by `/api/v1/store/brands` and `/brands/{slug}`.
class ManufacturerSummary {
  final String id;
  final String name;
  final String slug;
  final String aliasCode;
  final String companyType;
  final String description;
  final Map<String, String> descriptionTranslations;
  final String website;
  final String phone;
  final String whatsappPhone;
  final String publicEmail;
  final String instagramHandle;
  final String locationAddress;
  final String exportCountries;
  final int minOrderQuantity;
  final bool supportsPrivateLabel;
  final bool supportsFason;
  final bool isVerified;
  final String bankName;
  final String bankAccountHolder;
  final String iban;
  final int activeProductCount;
  final bool isActive;

  const ManufacturerSummary({
    required this.id,
    required this.name,
    required this.slug,
    this.aliasCode = '',
    this.companyType = 'uretici_toptanci',
    this.description = '',
    this.descriptionTranslations = const {},
    this.website = '',
    this.phone = '',
    this.whatsappPhone = '',
    this.publicEmail = '',
    this.instagramHandle = '',
    this.locationAddress = '',
    this.exportCountries = '',
    this.minOrderQuantity = 1,
    this.supportsPrivateLabel = false,
    this.supportsFason = false,
    this.isVerified = false,
    this.bankName = '',
    this.bankAccountHolder = '',
    this.iban = '',
    this.activeProductCount = 0,
    this.isActive = true,
  });

  String get displayName =>
      name.trim().isNotEmpty ? name.trim() : aliasCode.trim();

  String localizedDescription(String langCode) =>
      ModelJson.pickLangText(descriptionTranslations, langCode, description);

  List<String> get exportCountryList => exportCountries
      .split(',')
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList();

  factory ManufacturerSummary.fromJson(Map<String, dynamic> json) {
    return ManufacturerSummary(
      id: ModelJson.trimmed(json['id']),
      name: ModelJson.trimmed(json['name'] ?? json['brand_name']),
      slug: ModelJson.trimmed(json['slug']),
      aliasCode: ModelJson.trimmed(json['alias_code']),
      companyType: ModelJson.trimmed(json['company_type'], 'uretici_toptanci'),
      description: ModelJson.trimmed(json['description']),
      descriptionTranslations: ModelJson.stringMap(
        json['description_translations'],
      ),
      website: ModelJson.trimmed(json['website']),
      phone: ModelJson.trimmed(json['phone']),
      whatsappPhone: ModelJson.trimmed(json['whatsapp_phone']),
      publicEmail: ModelJson.trimmed(json['public_email']),
      instagramHandle: ModelJson.trimmed(json['instagram_handle']),
      locationAddress: ModelJson.trimmed(json['location_address']),
      exportCountries: ModelJson.trimmed(json['export_countries']),
      minOrderQuantity: ModelJson.integer(json['min_order_quantity'], 1),
      supportsPrivateLabel: ModelJson.boolean(json['supports_private_label']),
      supportsFason: ModelJson.boolean(json['supports_fason']),
      isVerified: ModelJson.boolean(json['is_verified']),
      bankName: ModelJson.trimmed(json['bank_name']),
      bankAccountHolder: ModelJson.trimmed(json['bank_account_holder']),
      iban: ModelJson.trimmed(json['iban']),
      activeProductCount: ModelJson.integer(json['active_product_count']),
      isActive: ModelJson.boolean(json['is_active'], true),
    );
  }
}

typedef ManufacturerDetail = ManufacturerSummary;

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
  final String brandPhone;
  final String brandWhatsapp;
  final String brandEmail;
  final String brandAddress;
  final String brandIban;
  final String brandBankName;
  final String brandBankHolder;
  final bool brandVerified;
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
  final int seriesStock;
  final int minimumOrderQuantity;
  final double price;
  final double? discountedPrice;
  final double? singlePrice;
  final double buyingPrice;
  final double taxRate;
  final String currency;
  final int stock;
  final bool isActive;
  final bool isArchived;
  final DateTime? archivedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final List<ProductImage> images;
  final List<ProductVariant> variants;
  final List<SiblingProduct> colorVariants;
  final String sourceProductGroupId;
  final int siblingCount;
  final List<SiblingProduct> supplierSiblings;
  final Map<String, ProductTranslation> translations;
  final ManufacturerSummary? brandProfile;
  final List<String> aiHighlights;
  final Map<String, String> metaAttributes;

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
    this.brandPhone = '',
    this.brandWhatsapp = '',
    this.brandEmail = '',
    this.brandAddress = '',
    this.brandIban = '',
    this.brandBankName = '',
    this.brandBankHolder = '',
    this.brandVerified = false,
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
    this.seriesStock = 100,
    required this.minimumOrderQuantity,
    required this.price,
    this.discountedPrice,
    this.singlePrice,
    required this.buyingPrice,
    this.taxRate = 10.0,
    required this.currency,
    required this.stock,
    required this.isActive,
    this.isArchived = false,
    this.archivedAt,
    this.createdAt,
    this.updatedAt,
    required this.images,
    required this.variants,
    required this.colorVariants,
    this.sourceProductGroupId = '',
    this.siblingCount = 0,
    this.supplierSiblings = const [],
    required this.translations,
    this.brandProfile,
    this.aiHighlights = const [],
    this.metaAttributes = const {},
  });

  double get effectiveUnitPrice {
    if (discountedPrice != null &&
        discountedPrice! > 0 &&
        discountedPrice! < price) {
      return discountedPrice!;
    }
    return price;
  }

  bool get hasDiscount =>
      discountedPrice != null &&
      discountedPrice! > 0 &&
      discountedPrice! < price;

  int get unitsPerPackage => CurrencyFormatter.parseUnitsPerPackage(
    seriesRatio.isNotEmpty ? seriesRatio : packingRatio,
  );

  int get minOrderPackages {
    if (minimumOrderQuantity <= 1) return 1;
    final units = unitsPerPackage > 0 ? unitsPerPackage : 1;
    final pkgs = (minimumOrderQuantity / units).ceil();
    return pkgs < 1 ? 1 : pkgs;
  }

  int get minOrderUnits => minOrderPackages * unitsPerPackage;

  double get packageTotalPrice => effectiveUnitPrice * unitsPerPackage;

  /// Returns the verified brand trade name (falls back to SKU prefix only if brand_name missing).
  String get maskedBrandName {
    final name = brandName.trim();
    if (name.isNotEmpty) return name;
    final skuTrimmed = customSku.trim();
    final dashIdx = skuTrimmed.indexOf('-');
    if (dashIdx > 0) {
      return skuTrimmed.substring(0, dashIdx).toUpperCase();
    }
    return '';
  }

  String get coverImageUrl {
    if (images.isEmpty) return '';
    final cover = images.firstWhere(
      (i) => i.isCover,
      orElse: () => images.first,
    );
    return cover.imageUrl;
  }

  String localizedTitle(String langCode) {
    final tr =
        translations[langCode] ?? translations[langCode.toLowerCase()];
    if (tr != null && tr.title.trim().isNotEmpty) return tr.title.trim();
    return title;
  }

  String localizedShortDescription(String langCode) {
    final tr =
        translations[langCode] ?? translations[langCode.toLowerCase()];
    if (tr != null && tr.shortDescription.trim().isNotEmpty) {
      return tr.shortDescription.trim();
    }
    return shortDescription;
  }

  String localizedDescription(String langCode) {
    final tr =
        translations[langCode] ?? translations[langCode.toLowerCase()];
    if (tr != null && tr.description.trim().isNotEmpty) {
      return tr.description.trim();
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
        } else if (item is String && item.trim().isNotEmpty) {
          parsedImages.add(
            ProductImage(
              id: '$i',
              imageUrl: AppConfig.resolveMediaUrl(item.trim()),
              sortOrder: i,
              isCover: i == 0,
            ),
          );
        }
      }
    } else if (json['cover_image'] is String &&
        (json['cover_image'] as String).trim().isNotEmpty) {
      parsedImages.add(
        ProductImage(
          id: '0',
          imageUrl: AppConfig.resolveMediaUrl(
            (json['cover_image'] as String).trim(),
          ),
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
        } else if (s is Map) {
          parsedSiblings.add(SiblingProduct.fromJson(ModelJson.map(s)));
        }
      }
    }

    final parsedSupplierSiblings = <SiblingProduct>[];
    if (json['supplier_siblings'] is List) {
      for (final s in json['supplier_siblings'] as List) {
        if (s is Map<String, dynamic>) {
          parsedSupplierSiblings.add(SiblingProduct.fromJson(s));
        } else if (s is Map) {
          parsedSupplierSiblings.add(SiblingProduct.fromJson(ModelJson.map(s)));
        }
      }
    } else if (parsedSiblings.isNotEmpty) {
      parsedSupplierSiblings.addAll(parsedSiblings);
    }

    final parsedSiblingCount = json['sibling_count'] != null
        ? ModelJson.integer(json['sibling_count'])
        : parsedSupplierSiblings.length;

    final parsedTranslations = <String, ProductTranslation>{};
    if (json['translations'] is Map) {
      (json['translations'] as Map).forEach((key, val) {
        if (val is Map<String, dynamic>) {
          parsedTranslations[key.toString()] = ProductTranslation.fromJson(val);
        } else if (val is Map) {
          parsedTranslations[key.toString()] = ProductTranslation.fromJson(
            ModelJson.map(val),
          );
        }
      });
    }

    final bpMap = json['brand_profile'] is Map<String, dynamic>
        ? json['brand_profile'] as Map<String, dynamic>
        : null;
    final bp = bpMap != null ? ManufacturerSummary.fromJson(bpMap) : null;

    final rawStock = ModelJson.integer(json['stock']);
    final rawSeriesStock = json['series_stock'] != null
        ? ModelJson.integer(json['series_stock'])
        : (json['stock'] != null ? rawStock : 100);

    return Product(
      id: ModelJson.trimmed(json['id']),
      title: ModelJson.trimmed(json['title']),
      slug: ModelJson.trimmed(json['slug']),
      customSku: ModelJson.trimmed(json['custom_sku']),
      sku: ModelJson.trimmed(json['sku']),
      barcode: ModelJson.trimmed(json['barcode']),
      shortDescription: ModelJson.trimmed(json['short_description']),
      description: ModelJson.trimmed(json['description']),
      brandId: ModelJson.trimmed(json['brand_id'] ?? bp?.id),
      brandName: ModelJson.trimmed(json['brand_name'] ?? bp?.name),
      brandPhone: ModelJson.trimmed(json['brand_phone'] ?? bp?.phone),
      brandWhatsapp: ModelJson.trimmed(
        json['brand_whatsapp'] ?? bp?.whatsappPhone,
      ),
      brandEmail: ModelJson.trimmed(json['brand_email'] ?? bp?.publicEmail),
      brandAddress: ModelJson.trimmed(
        json['brand_address'] ?? bp?.locationAddress,
      ),
      brandIban: ModelJson.trimmed(json['brand_iban'] ?? bp?.iban),
      brandBankName: ModelJson.trimmed(json['brand_bank_name'] ?? bp?.bankName),
      brandBankHolder: ModelJson.trimmed(
        json['brand_bank_holder'] ?? bp?.bankAccountHolder,
      ),
      brandVerified: ModelJson.boolean(
        json['brand_verified'] ?? bp?.isVerified,
      ),
      categoryId: ModelJson.trimmed(json['category_id']),
      categoryTitle: ModelJson.trimmed(json['category_title']),
      colorId: ModelJson.nullableStr(json['color_id']),
      fabricId: ModelJson.nullableStr(json['fabric_id']),
      gender: ModelJson.trimmed(json['gender']),
      season: ModelJson.trimmed(json['season']),
      fabric: ModelJson.trimmed(json['kumas_fabric'] ?? json['fabric']),
      color: ModelJson.trimmed(json['color']),
      packingRatio: ModelJson.trimmed(json['packing_ratio']),
      seriesRatio: ModelJson.trimmed(json['series_ratio']),
      seriesStock: rawSeriesStock,
      minimumOrderQuantity: ModelJson.integer(
        json['minimum_order_quantity'],
        1,
      ),
      price: ModelJson.decimal(json['price']),
      discountedPrice: ModelJson.nullableDecimal(json['discounted_price']),
      singlePrice: ModelJson.nullableDecimal(json['single_price']),
      buyingPrice: ModelJson.decimal(json['buying_price']),
      taxRate: ModelJson.decimal(json['tax_rate'], 10.0),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      stock: rawStock,
      isActive: ModelJson.boolean(json['is_active'], true),
      isArchived: ModelJson.boolean(json['is_archived']),
      archivedAt: ModelJson.nullableDateTime(json['archived_at']),
      createdAt: ModelJson.nullableDateTime(json['created_at']),
      updatedAt: ModelJson.nullableDateTime(json['updated_at']),
      images: parsedImages,
      variants: parsedVariants,
      colorVariants: parsedSiblings,
      sourceProductGroupId: ModelJson.trimmed(json['source_product_group_id']),
      siblingCount: parsedSiblingCount,
      supplierSiblings: parsedSupplierSiblings,
      translations: parsedTranslations,
      brandProfile: bp,
      aiHighlights: ModelJson.stringList(json['ai_highlights']),
      metaAttributes: ModelJson.stringMap(json['attributes']),
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
    this.activeProducts = 0,
    this.localizedTitles = const {},
    this.children = const [],
  });

  String displayTitle(String langCode) {
    final code = langCode.trim().toLowerCase();
    final t = localizedTitles[code];
    if (t != null && t.trim().isNotEmpty) return t.trim();
    final en = localizedTitles['en'];
    if (en != null && en.trim().isNotEmpty) return en.trim();
    return title;
  }

  String localizedTitle(String langCode) => displayTitle(langCode);

  factory CategoryNode.fromJson(Map<String, dynamic> json) {
    final titles = <String, String>{};
    if (json['translations'] is Map) {
      (json['translations'] as Map).forEach((k, v) {
        if (v is Map && v['title'] != null) {
          titles[k.toString()] = v['title'].toString();
        } else if (v is String) {
          titles[k.toString()] = v;
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
      id: ModelJson.trimmed(json['id']),
      parentId: ModelJson.nullableStr(json['parent_id']),
      title: ModelJson.trimmed(json['title']),
      slug: ModelJson.trimmed(json['slug']),
      nodePath: ModelJson.trimmed(json['node_path']),
      activeProducts: ModelJson.integer(json['active_products']),
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
  final String companyType;
  final int activeProductCount;
  final bool isVerified;
  final bool supportsFason;
  final bool supportsPrivateLabel;
  final int minOrderQuantity;
  final String exportCountries;
  final String whatsappPhone;
  final String locationAddress;

  const BrandSummary({
    required this.id,
    required this.name,
    required this.slug,
    required this.aliasCode,
    this.companyType = 'uretici_toptanci',
    this.activeProductCount = 0,
    this.isVerified = false,
    this.supportsFason = false,
    this.supportsPrivateLabel = false,
    this.minOrderQuantity = 1,
    this.exportCountries = '',
    this.whatsappPhone = '',
    this.locationAddress = '',
  });

  String get maskedDisplayName =>
      name.trim().isNotEmpty ? name.trim() : aliasCode.trim();

  factory BrandSummary.fromJson(Map<String, dynamic> json) {
    return BrandSummary(
      id: ModelJson.trimmed(json['id']),
      name: ModelJson.trimmed(json['name'] ?? json['brand_name']),
      slug: ModelJson.trimmed(json['slug']),
      aliasCode: ModelJson.trimmed(json['alias_code']),
      companyType: ModelJson.trimmed(json['company_type'], 'uretici_toptanci'),
      activeProductCount: ModelJson.integer(json['active_product_count']),
      isVerified: ModelJson.boolean(json['is_verified']),
      supportsFason: ModelJson.boolean(json['supports_fason']),
      supportsPrivateLabel: ModelJson.boolean(json['supports_private_label']),
      minOrderQuantity: ModelJson.integer(json['min_order_quantity'], 1),
      exportCountries: ModelJson.trimmed(json['export_countries']),
      whatsappPhone: ModelJson.trimmed(json['whatsapp_phone']),
      locationAddress: ModelJson.trimmed(json['location_address']),
    );
  }
}

/// All 7 catalog sort keys supported by `store_catalog.go#buildCatalogOrderBy`.
enum CatalogSortOption {
  newest('newest'),
  priceAsc('price_asc'),
  priceDesc('price_desc'),
  nameAsc('name_asc'),
  nameDesc('name_desc'),
  skuAsc('sku_asc'),
  skuDesc('sku_desc');

  final String apiValue;
  const CatalogSortOption(this.apiValue);

  static CatalogSortOption fromApi(String? raw) {
    for (final val in CatalogSortOption.values) {
      if (val.apiValue == raw) return val;
    }
    return CatalogSortOption.newest;
  }
}

/// Immutable filter payload matching Go `store_catalog.go` query parameters.
class CatalogFilterParams {
  final String? query;
  final String? categoryId;
  final String? brandId;
  final String? brandSlug;
  final CatalogSortOption sortBy;
  final bool fasonOnly;
  final bool privateLabelOnly;
  final String? companyType;
  final int? maxMoq;
  final String? exportCountry;
  final double? minPrice;
  final double? maxPrice;
  final String? displayCurrency;
  final String? gender;
  final String? season;
  final Map<String, List<String>> attributeFilters;

  const CatalogFilterParams({
    this.query,
    this.categoryId,
    this.brandId,
    this.brandSlug,
    this.sortBy = CatalogSortOption.newest,
    this.fasonOnly = false,
    this.privateLabelOnly = false,
    this.companyType,
    this.maxMoq,
    this.exportCountry,
    this.minPrice,
    this.maxPrice,
    this.displayCurrency,
    this.gender,
    this.season,
    this.attributeFilters = const {},
  });

  bool get hasActiveFilters =>
      (query != null && query!.trim().isNotEmpty) ||
      (categoryId != null && categoryId!.trim().isNotEmpty) ||
      (brandId != null && brandId!.trim().isNotEmpty) ||
      (brandSlug != null && brandSlug!.trim().isNotEmpty) ||
      fasonOnly ||
      privateLabelOnly ||
      (companyType != null && companyType!.trim().isNotEmpty) ||
      (maxMoq != null && maxMoq! > 0) ||
      (exportCountry != null && exportCountry!.trim().isNotEmpty) ||
      minPrice != null ||
      maxPrice != null ||
      (gender != null && gender!.trim().isNotEmpty) ||
      (season != null && season!.trim().isNotEmpty) ||
      attributeFilters.values.any((list) => list.isNotEmpty);

  CatalogFilterParams copyWith({
    String? query,
    String? categoryId,
    String? brandId,
    String? brandSlug,
    CatalogSortOption? sortBy,
    bool? fasonOnly,
    bool? privateLabelOnly,
    String? companyType,
    int? maxMoq,
    String? exportCountry,
    double? minPrice,
    double? maxPrice,
    String? displayCurrency,
    String? gender,
    String? season,
    Map<String, List<String>>? attributeFilters,
    bool clearCategory = false,
    bool clearBrand = false,
    bool clearCompanyType = false,
    bool clearMaxMoq = false,
    bool clearExportCountry = false,
    bool clearPriceRange = false,
    bool clearGender = false,
    bool clearSeason = false,
  }) {
    return CatalogFilterParams(
      query: query ?? this.query,
      categoryId: clearCategory ? null : (categoryId ?? this.categoryId),
      brandId: clearBrand ? null : (brandId ?? this.brandId),
      brandSlug: clearBrand ? null : (brandSlug ?? this.brandSlug),
      sortBy: sortBy ?? this.sortBy,
      fasonOnly: fasonOnly ?? this.fasonOnly,
      privateLabelOnly: privateLabelOnly ?? this.privateLabelOnly,
      companyType: clearCompanyType ? null : (companyType ?? this.companyType),
      maxMoq: clearMaxMoq ? null : (maxMoq ?? this.maxMoq),
      exportCountry: clearExportCountry
          ? null
          : (exportCountry ?? this.exportCountry),
      minPrice: clearPriceRange ? null : (minPrice ?? this.minPrice),
      maxPrice: clearPriceRange ? null : (maxPrice ?? this.maxPrice),
      displayCurrency: displayCurrency ?? this.displayCurrency,
      gender: clearGender ? null : (gender ?? this.gender),
      season: clearSeason ? null : (season ?? this.season),
      attributeFilters: attributeFilters ?? this.attributeFilters,
    );
  }

  Map<String, dynamic> toQueryParameters({
    int limit = 24,
    int offset = 0,
    String? lang,
  }) {
    final params = <String, dynamic>{
      'limit': limit,
      'offset': offset,
      'sort_by': sortBy.apiValue,
    };
    if (query != null && query!.trim().isNotEmpty) {
      params['q'] = query!.trim();
    }
    if (categoryId != null && categoryId!.trim().isNotEmpty) {
      params['category_id'] = categoryId!.trim();
    }
    if (brandId != null && brandId!.trim().isNotEmpty) {
      params['brand_id'] = brandId!.trim();
    }
    if (brandSlug != null && brandSlug!.trim().isNotEmpty) {
      params['brand_slug'] = brandSlug!.trim();
    }
    if (fasonOnly) params['fason'] = 'true';
    if (privateLabelOnly) params['private_label'] = 'true';
    if (companyType != null && companyType!.trim().isNotEmpty) {
      params['company_type'] = companyType!.trim();
    }
    if (maxMoq != null && maxMoq! > 0) params['max_moq'] = maxMoq;
    if (exportCountry != null && exportCountry!.trim().isNotEmpty) {
      params['export_country'] = exportCountry!.trim();
    }
    if (minPrice != null) params['min_price'] = minPrice;
    if (maxPrice != null) params['max_price'] = maxPrice;
    if (displayCurrency != null && displayCurrency!.trim().isNotEmpty) {
      params['display_currency'] = displayCurrency!.trim();
    }
    if (gender != null && gender!.trim().isNotEmpty) {
      params['gender'] = gender!.trim();
    }
    if (season != null && season!.trim().isNotEmpty) {
      params['season'] = season!.trim();
    }
    if (lang != null && lang.trim().isNotEmpty) {
      params['lang'] = lang.trim();
    }
    attributeFilters.forEach((key, vals) {
      final clean = vals.map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
      if (key.trim().isNotEmpty && clean.isNotEmpty) {
        params['attr_${key.trim()}'] = clean.join(',');
      }
    });
    return params;
  }
}

/// Active distinct storefront attribute group (`GET /api/v1/store/attributes`).
class CatalogAttributeGroup {
  final String name;
  final List<String> values;

  const CatalogAttributeGroup({required this.name, required this.values});
}

class CatalogFacets {
  final Map<String, int> brands;
  final Map<String, int> genders;
  final Map<String, int> seasons;
  final Map<String, Map<String, int>> attributes;

  const CatalogFacets({
    this.brands = const {},
    this.genders = const {},
    this.seasons = const {},
    this.attributes = const {},
  });

  factory CatalogFacets.fromJson(Map<String, dynamic> json) {
    Map<String, int> parseIntMap(dynamic raw) {
      if (raw is! Map) return const {};
      final out = <String, int>{};
      raw.forEach((k, v) {
        final key = k.toString().trim();
        if (key.isNotEmpty) out[key] = ModelJson.integer(v);
      });
      return out;
    }

    final parsedAttrs = <String, Map<String, int>>{};
    if (json['attributes'] is Map) {
      (json['attributes'] as Map).forEach((attrKey, val) {
        if (val is Map) {
          parsedAttrs[attrKey.toString()] = parseIntMap(val);
        }
      });
    }

    return CatalogFacets(
      brands: parseIntMap(json['brands']),
      genders: parseIntMap(json['genders']),
      seasons: parseIntMap(json['seasons']),
      attributes: parsedAttrs,
    );
  }
}

/// Infinite scroll / faceted catalog page result.
class CatalogQueryResult {
  final List<Product> products;
  final int total;
  final int offset;
  final int limit;
  final CatalogFacets facets;

  const CatalogQueryResult({
    required this.products,
    required this.total,
    this.offset = 0,
    this.limit = 24,
    this.facets = const CatalogFacets(),
  });

  bool get hasMore => offset + products.length < total;
}

/// 8-language product translation row for supplier editor & AI auto-translate.
class SupplierProductTranslationEntry {
  final String title;
  final String shortDescription;
  final String description;

  const SupplierProductTranslationEntry({
    this.title = '',
    this.shortDescription = '',
    this.description = '',
  });

  factory SupplierProductTranslationEntry.fromJson(Map<String, dynamic> json) {
    return SupplierProductTranslationEntry(
      title: ModelJson.trimmed(json['title']),
      shortDescription: ModelJson.trimmed(json['short_description']),
      description: ModelJson.trimmed(json['description']),
    );
  }

  Map<String, dynamic> toJson() => {
    'title': title,
    if (shortDescription.isNotEmpty) 'short_description': shortDescription,
    if (description.isNotEmpty) 'description': description,
  };
}

class SupplierProductTranslationMap {
  final String productId;
  final Map<String, SupplierProductTranslationEntry> translations;

  const SupplierProductTranslationMap({
    required this.productId,
    required this.translations,
  });

  factory SupplierProductTranslationMap.fromJson(Map<String, dynamic> json) {
    final parsed = <String, SupplierProductTranslationEntry>{};
    if (json['translations'] is Map) {
      (json['translations'] as Map).forEach((k, v) {
        if (v is Map) {
          parsed[k.toString().toLowerCase()] =
              SupplierProductTranslationEntry.fromJson(ModelJson.map(v));
        }
      });
    }
    return SupplierProductTranslationMap(
      productId: ModelJson.trimmed(json['product_id']),
      translations: parsed,
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
      id: ModelJson.trimmed(json['id']),
      name: ModelJson.trimmed(json['name']),
      code: ModelJson.trimmed(json['code']),
    );
  }
}

class SizeDefinitionOption {
  final String id;
  final String code;
  final String label;
  final String sizeGroup;
  final int sortOrder;

  const SizeDefinitionOption({
    required this.id,
    required this.code,
    required this.label,
    required this.sizeGroup,
    required this.sortOrder,
  });

  factory SizeDefinitionOption.fromJson(Map<String, dynamic> json) {
    final codeVal = ModelJson.trimmed(json['code']);
    final labelVal = ModelJson.trimmed(json['label'], codeVal);
    return SizeDefinitionOption(
      id: ModelJson.trimmed(json['id']),
      code: codeVal,
      label: labelVal,
      sizeGroup: ModelJson.trimmed(json['size_group'], 'genel'),
      sortOrder: ModelJson.integer(json['sort_order']),
    );
  }
}

class SeriesTemplateOption {
  final String id;
  final String templateKey;
  final String name;
  final String categoryHint;
  final List<String> sizes;
  final String seriesRatio;
  final int unitsPerSeries;
  final int sortOrder;

  const SeriesTemplateOption({
    required this.id,
    required this.templateKey,
    required this.name,
    this.categoryHint = '',
    required this.sizes,
    required this.seriesRatio,
    required this.unitsPerSeries,
    this.sortOrder = 0,
  });

  factory SeriesTemplateOption.fromJson(Map<String, dynamic> json) {
    final parsedSizes = <String>[];
    if (json['sizes'] is List) {
      for (final s in json['sizes'] as List) {
        final str = (s ?? '').toString().trim();
        if (str.isNotEmpty) parsedSizes.add(str);
      }
    }
    return SeriesTemplateOption(
      id: ModelJson.trimmed(json['id']),
      templateKey: ModelJson.trimmed(json['template_key']),
      name: ModelJson.trimmed(json['name']),
      categoryHint: ModelJson.trimmed(json['category_hint']),
      sizes: parsedSizes,
      seriesRatio: ModelJson.trimmed(json['series_ratio']),
      unitsPerSeries: ModelJson.integer(json['units_per_series'], 1),
      sortOrder: ModelJson.integer(json['sort_order']),
    );
  }
}

class SupplierAttributesBundle {
  final List<SimpleOptionItem> colors;
  final List<SimpleOptionItem> fabrics;
  final List<SizeDefinitionOption> sizes;
  final List<SeriesTemplateOption> seriesTemplates;

  const SupplierAttributesBundle({
    required this.colors,
    required this.fabrics,
    this.sizes = const [],
    this.seriesTemplates = const [],
  });
}
