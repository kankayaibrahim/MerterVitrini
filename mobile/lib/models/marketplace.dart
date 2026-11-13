import '../core/app_config.dart';
import 'model_json.dart';

/// Manufacturer quote on a B2B Buying Lead (`BuyerRfqOfferDTO` in `rfq.go`).
class RfqOfferItem {
  final String id;
  final String rfqId;
  final String brandId;
  final String brandName;
  final double offeredUnitPrice;
  final String currency;
  final int minOrderQuantity;
  final int deliveryDays;
  final String notes;
  final String supplierPhone;
  final String supplierWhatsapp;
  final String status;
  final DateTime createdAt;

  const RfqOfferItem({
    required this.id,
    required this.rfqId,
    required this.brandId,
    required this.brandName,
    required this.offeredUnitPrice,
    required this.currency,
    required this.minOrderQuantity,
    required this.deliveryDays,
    this.notes = '',
    this.supplierPhone = '',
    this.supplierWhatsapp = '',
    this.status = 'SENT',
    required this.createdAt,
  });

  factory RfqOfferItem.fromJson(Map<String, dynamic> json) {
    return RfqOfferItem(
      id: ModelJson.trimmed(json['id']),
      rfqId: ModelJson.trimmed(json['rfq_id']),
      brandId: ModelJson.trimmed(json['brand_id']),
      brandName: ModelJson.trimmed(json['brand_name']),
      offeredUnitPrice: ModelJson.decimal(json['offered_unit_price']),
      currency: ModelJson.trimmed(json['currency'], 'USD'),
      minOrderQuantity: ModelJson.integer(json['min_order_quantity'], 1),
      deliveryDays: ModelJson.integer(json['delivery_days'], 7),
      notes: ModelJson.trimmed(json['notes']),
      supplierPhone: ModelJson.trimmed(json['supplier_phone']),
      supplierWhatsapp: ModelJson.trimmed(json['supplier_whatsapp']),
      status: ModelJson.trimmed(json['status'], 'SENT'),
      createdAt: ModelJson.dateTime(json['created_at']),
    );
  }
}

/// B2B Wholesale Buying Lead (`BuyerRfqDTO` in `rfq.go`).
class RfqItem {
  final String id;
  final String rfqNumber;
  final String title;
  final String categoryName;
  final int targetQuantity;
  final String unitType;
  final double? targetPrice;
  final String currency;
  final String productionType;
  final String description;
  final String buyerName;
  final String buyerCompany;
  final String buyerCountry;
  final String buyerPhone;
  final String buyerWhatsapp;
  final String buyerEmail;
  final bool buyerEmailVerified;
  final String status;
  final int offerCount;
  final RfqOfferItem? myOffer;
  final List<RfqOfferItem> offers;
  final DateTime createdAt;

  const RfqItem({
    required this.id,
    required this.rfqNumber,
    required this.title,
    required this.categoryName,
    required this.targetQuantity,
    required this.unitType,
    this.targetPrice,
    required this.currency,
    required this.productionType,
    required this.description,
    required this.buyerName,
    this.buyerCompany = '',
    this.buyerCountry = '',
    this.buyerPhone = '',
    this.buyerWhatsapp = '',
    this.buyerEmail = '',
    this.buyerEmailVerified = false,
    this.status = 'OPEN',
    this.offerCount = 0,
    this.myOffer,
    this.offers = const [],
    required this.createdAt,
  });

  factory RfqItem.fromJson(Map<String, dynamic> json) {
    final parsedOffers = <RfqOfferItem>[];
    if (json['offers'] is List) {
      for (final raw in json['offers'] as List) {
        if (raw is Map<String, dynamic>) {
          parsedOffers.add(RfqOfferItem.fromJson(raw));
        }
      }
    }
    return RfqItem(
      id: ModelJson.trimmed(json['id']),
      rfqNumber: ModelJson.trimmed(json['rfq_number']),
      title: ModelJson.trimmed(json['title']),
      categoryName: ModelJson.trimmed(json['category_name']),
      targetQuantity: ModelJson.integer(json['target_quantity'], 100),
      unitType: ModelJson.trimmed(json['unit_type'], 'ADET'),
      targetPrice: ModelJson.nullableDecimal(json['target_price']),
      currency: ModelJson.trimmed(json['currency'], 'USD'),
      productionType: ModelJson.trimmed(json['production_type'], 'READY_STOCK'),
      description: ModelJson.trimmed(json['description']),
      buyerName: ModelJson.trimmed(json['buyer_name']),
      buyerCompany: ModelJson.trimmed(json['buyer_company']),
      buyerCountry: ModelJson.trimmed(json['buyer_country']),
      buyerPhone: ModelJson.trimmed(json['buyer_phone']),
      buyerWhatsapp: ModelJson.trimmed(json['buyer_whatsapp']),
      buyerEmail: ModelJson.trimmed(json['buyer_email']),
      buyerEmailVerified: ModelJson.boolean(json['buyer_email_verified']),
      status: ModelJson.trimmed(json['status'], 'OPEN'),
      offerCount: ModelJson.integer(json['offer_count']),
      myOffer: json['my_offer'] is Map<String, dynamic>
          ? RfqOfferItem.fromJson(json['my_offer'] as Map<String, dynamic>)
          : null,
      offers: parsedOffers,
      createdAt: ModelJson.dateTime(json['created_at']),
    );
  }
}

class CreateRfqPayload {
  final String title;
  final String categoryName;
  final int targetQuantity;
  final String unitType;
  final double? targetPrice;
  final String currency;
  final String productionType;
  final String description;
  final String buyerName;
  final String buyerCompany;
  final String buyerCountry;
  final String buyerPhone;
  final String buyerWhatsapp;
  final String buyerEmail;

  const CreateRfqPayload({
    required this.title,
    this.categoryName = '',
    required this.targetQuantity,
    this.unitType = 'ADET',
    this.targetPrice,
    this.currency = 'USD',
    this.productionType = 'READY_STOCK',
    this.description = '',
    required this.buyerName,
    this.buyerCompany = '',
    this.buyerCountry = '',
    required this.buyerPhone,
    this.buyerWhatsapp = '',
    this.buyerEmail = '',
  });

  Map<String, dynamic> toJson() => {
    'title': title.trim(),
    'category_name': categoryName.trim(),
    'target_quantity': targetQuantity,
    'unit_type': unitType.trim(),
    if (targetPrice != null) 'target_price': targetPrice,
    'currency': currency.trim(),
    'production_type': productionType.trim(),
    'description': description.trim(),
    'buyer_name': buyerName.trim(),
    'buyer_company': buyerCompany.trim(),
    'buyer_country': buyerCountry.trim(),
    'buyer_phone': buyerPhone.trim(),
    'buyer_whatsapp':
        buyerWhatsapp.trim().isNotEmpty ? buyerWhatsapp.trim() : buyerPhone.trim(),
    'buyer_email': buyerEmail.trim(),
  };
}

class SubmitRfqOfferPayload {
  final double offeredUnitPrice;
  final String currency;
  final int minOrderQuantity;
  final int deliveryDays;
  final String notes;

  const SubmitRfqOfferPayload({
    required this.offeredUnitPrice,
    this.currency = 'USD',
    this.minOrderQuantity = 1,
    this.deliveryDays = 7,
    this.notes = '',
  });

  Map<String, dynamic> toJson() => {
    'offered_unit_price': offeredUnitPrice,
    'currency': currency.trim(),
    'min_order_quantity': minOrderQuantity < 1 ? 1 : minOrderQuantity,
    'delivery_days': deliveryDays < 1 ? 1 : deliveryDays,
    'notes': notes.trim(),
  };
}

class DirectInquiryItemPayload {
  final String productId;
  final String title;
  final String customSku;
  final int quantity;
  final double price;

  const DirectInquiryItemPayload({
    required this.productId,
    required this.title,
    required this.customSku,
    required this.quantity,
    required this.price,
  });

  Map<String, dynamic> toJson() => {
    'product_id': productId,
    'title': title,
    'custom_sku': customSku,
    'quantity': quantity,
    'price': price,
  };
}

class DirectInquiryPayload {
  final String fullName;
  final String companyName;
  final String phone;
  final String email;
  final String message;
  final String deliveryAddress;
  final List<DirectInquiryItemPayload> items;

  const DirectInquiryPayload({
    required this.fullName,
    this.companyName = '',
    required this.phone,
    this.email = '',
    this.message = '',
    this.deliveryAddress = '',
    required this.items,
  });

  Map<String, dynamic> toJson() => {
    'full_name': fullName.trim(),
    if (companyName.trim().isNotEmpty) 'company_name': companyName.trim(),
    'phone': phone.trim(),
    'email': email.trim(),
    if (message.trim().isNotEmpty) 'message': message.trim(),
    'delivery_address': deliveryAddress.trim(),
    'items': items.map((e) => e.toJson()).toList(),
  };
}

class DirectInquirySupplierOrderSummary {
  final String brandId;
  final String brandName;
  final String subOrderNumber;
  final double totalAmount;
  final String whatsappUrl;

  const DirectInquirySupplierOrderSummary({
    this.brandId = '',
    this.brandName = '',
    this.subOrderNumber = '',
    this.totalAmount = 0,
    this.whatsappUrl = '',
  });

  factory DirectInquirySupplierOrderSummary.fromJson(
    Map<String, dynamic> json,
  ) {
    return DirectInquirySupplierOrderSummary(
      brandId: ModelJson.trimmed(json['brand_id']),
      brandName: ModelJson.trimmed(json['brand_name']),
      subOrderNumber: ModelJson.trimmed(json['sub_order_number']),
      totalAmount: ModelJson.decimal(json['total_amount']),
      whatsappUrl: ModelJson.trimmed(json['whatsapp_url']),
    );
  }
}

class DirectInquiryResponse {
  final bool success;
  final String id;
  final String orderNumber;
  final double totalPrice;
  final String whatsappUrl;
  final String message;
  final List<DirectInquirySupplierOrderSummary> supplierOrders;

  const DirectInquiryResponse({
    required this.success,
    required this.id,
    this.orderNumber = '',
    this.totalPrice = 0,
    this.whatsappUrl = '',
    this.message = '',
    this.supplierOrders = const [],
  });

  factory DirectInquiryResponse.fromJson(Map<String, dynamic> json) {
    final orders = <DirectInquirySupplierOrderSummary>[];
    if (json['supplier_orders'] is List) {
      for (final raw in json['supplier_orders'] as List) {
        if (raw is Map<String, dynamic>) {
          orders.add(DirectInquirySupplierOrderSummary.fromJson(raw));
        }
      }
    }
    return DirectInquiryResponse(
      success: ModelJson.boolean(json['success'], true),
      id: ModelJson.trimmed(json['id']),
      orderNumber: ModelJson.trimmed(json['order_number']),
      totalPrice: ModelJson.decimal(json['total_price']),
      whatsappUrl: ModelJson.trimmed(json['whatsapp_url']),
      message: ModelJson.trimmed(json['message']),
      supplierOrders: orders,
    );
  }
}

/// Ecosystem logistics / customs / sourcing partner (`ServiceProviderDTO` in `service_providers.go`).
class ServiceProviderItem {
  final String id;
  final String slug;
  final String companyName;
  final String contactName;
  final String serviceCategory;
  final String shortDescription;
  final String description;
  final String servicesOffered;
  final String targetCountries;
  final String city;
  final String district;
  final String address;
  final String phone;
  final String whatsappPhone;
  final String email;
  final String website;
  final String logoUrl;
  final String status;
  final bool isVerified;
  final bool isSponsored;
  final bool isActive;
  final int priority;
  final int viewCount;
  final int whatsappClickCount;
  final Map<String, dynamic> translations;
  final DateTime createdAt;

  const ServiceProviderItem({
    required this.id,
    required this.slug,
    required this.companyName,
    this.contactName = '',
    required this.serviceCategory,
    required this.shortDescription,
    this.description = '',
    this.servicesOffered = '',
    this.targetCountries = '',
    this.city = '',
    this.district = '',
    this.address = '',
    this.phone = '',
    this.whatsappPhone = '',
    this.email = '',
    this.website = '',
    this.logoUrl = '',
    this.status = 'approved',
    this.isVerified = false,
    this.isSponsored = false,
    this.isActive = true,
    this.priority = 50,
    this.viewCount = 0,
    this.whatsappClickCount = 0,
    this.translations = const {},
    required this.createdAt,
  });

  String localizedShortDescription(String langCode) {
    final entry = ModelJson.map(translations[langCode]);
    final val = ModelJson.trimmed(entry['short_description']);
    return val.isNotEmpty ? val : shortDescription;
  }

  factory ServiceProviderItem.fromJson(Map<String, dynamic> json) {
    return ServiceProviderItem(
      id: ModelJson.trimmed(json['id']),
      slug: ModelJson.trimmed(json['slug']),
      companyName: ModelJson.trimmed(json['company_name']),
      contactName: ModelJson.trimmed(json['contact_name']),
      serviceCategory: ModelJson.trimmed(json['service_category']),
      shortDescription: ModelJson.trimmed(json['short_description']),
      description: ModelJson.trimmed(json['description']),
      servicesOffered: ModelJson.trimmed(json['services_offered']),
      targetCountries: ModelJson.trimmed(json['target_countries']),
      city: ModelJson.trimmed(json['city']),
      district: ModelJson.trimmed(json['district']),
      address: ModelJson.trimmed(json['address']),
      phone: ModelJson.trimmed(json['phone']),
      whatsappPhone: ModelJson.trimmed(json['whatsapp_phone']),
      email: ModelJson.trimmed(json['email']),
      website: ModelJson.trimmed(json['website']),
      logoUrl: AppConfig.resolveMediaUrl(ModelJson.trimmed(json['logo_url'])),
      status: ModelJson.trimmed(json['status'], 'approved'),
      isVerified: ModelJson.boolean(json['is_verified']),
      isSponsored: ModelJson.boolean(json['is_sponsored']),
      isActive: ModelJson.boolean(json['is_active'], true),
      priority: ModelJson.integer(json['priority'], 50),
      viewCount: ModelJson.integer(json['view_count']),
      whatsappClickCount: ModelJson.integer(json['whatsapp_click_count']),
      translations: ModelJson.map(json['translations']),
      createdAt: ModelJson.dateTime(json['created_at']),
    );
  }
}

class ServiceProviderSubmission {
  final String companyName;
  final String contactName;
  final String serviceCategory;
  final String shortDescription;
  final String servicesOffered;
  final String targetCountries;
  final String address;
  final String phone;
  final String whatsappPhone;
  final String email;
  final String website;

  const ServiceProviderSubmission({
    required this.companyName,
    required this.contactName,
    required this.serviceCategory,
    required this.shortDescription,
    this.servicesOffered = '',
    this.targetCountries = '',
    this.address = '',
    required this.phone,
    this.whatsappPhone = '',
    required this.email,
    this.website = '',
  });

  Map<String, dynamic> toJson({String challengeToken = ''}) => {
    'company_name': companyName.trim(),
    'contact_name': contactName.trim(),
    'service_category': serviceCategory.trim(),
    'short_description': shortDescription.trim(),
    'services_offered': servicesOffered.trim(),
    'target_countries': targetCountries.trim(),
    'address': address.trim(),
    'phone': phone.trim(),
    'whatsapp_phone': whatsappPhone.trim().isNotEmpty
        ? whatsappPhone.trim()
        : phone.trim(),
    'email': email.trim(),
    'website': website.trim(),
    if (challengeToken.trim().isNotEmpty) ...{
      'challenge_token': challengeToken.trim(),
      'form_challenge_token': challengeToken.trim(),
    },
  };
}

class SponsoredSlotItem {
  final String id;
  final String placement;
  final String? brandId;
  final String brandName;
  final String brandSlug;
  final bool brandVerified;
  final String companyType;
  final String exportCountries;
  final String whatsappPhone;
  final String city;
  final String district;
  final int productCount;
  final String categorySlug;
  final String title;
  final String subtitle;
  final String badgeText;
  final String imageUrl;
  final String ctaText;
  final String targetUrl;
  final Map<String, dynamic> translations;
  final int priority;
  final bool isActive;

  const SponsoredSlotItem({
    required this.id,
    required this.placement,
    this.brandId,
    this.brandName = '',
    this.brandSlug = '',
    this.brandVerified = false,
    this.companyType = '',
    this.exportCountries = '',
    this.whatsappPhone = '',
    this.city = '',
    this.district = '',
    this.productCount = 0,
    this.categorySlug = '',
    required this.title,
    this.subtitle = '',
    this.badgeText = '',
    this.imageUrl = '',
    this.ctaText = '',
    this.targetUrl = '',
    this.translations = const {},
    this.priority = 10,
    this.isActive = true,
  });

  String _localizedField(String langCode, String key, String fallback) {
    final entry = ModelJson.map(translations[langCode]);
    final v = ModelJson.trimmed(entry[key]);
    return v.isNotEmpty ? v : fallback;
  }

  String localizedTitle(String langCode) =>
      _localizedField(langCode, 'title', title);
  String localizedSubtitle(String langCode) =>
      _localizedField(langCode, 'subtitle', subtitle);
  String localizedBadge(String langCode) =>
      _localizedField(langCode, 'badge_text', badgeText);
  String localizedCta(String langCode) =>
      _localizedField(langCode, 'cta_text', ctaText);

  factory SponsoredSlotItem.fromJson(Map<String, dynamic> json) {
    return SponsoredSlotItem(
      id: ModelJson.trimmed(json['id']),
      placement: ModelJson.trimmed(json['placement'], 'home_featured_suppliers'),
      brandId: ModelJson.nullableStr(json['brand_id']),
      brandName: ModelJson.trimmed(json['brand_name']),
      brandSlug: ModelJson.trimmed(json['brand_slug']),
      brandVerified: ModelJson.boolean(json['brand_verified']),
      companyType: ModelJson.trimmed(json['company_type']),
      exportCountries: ModelJson.trimmed(json['export_countries']),
      whatsappPhone: ModelJson.trimmed(json['whatsapp_phone']),
      city: ModelJson.trimmed(json['city']),
      district: ModelJson.trimmed(json['district']),
      productCount: ModelJson.integer(json['product_count']),
      categorySlug: ModelJson.trimmed(json['category_slug']),
      title: ModelJson.trimmed(json['title']),
      subtitle: ModelJson.trimmed(json['subtitle']),
      badgeText: ModelJson.trimmed(json['badge_text']),
      imageUrl: AppConfig.resolveMediaUrl(ModelJson.trimmed(json['image_url'])),
      ctaText: ModelJson.trimmed(json['cta_text']),
      targetUrl: ModelJson.trimmed(json['target_url']),
      translations: ModelJson.map(json['translations']),
      priority: ModelJson.integer(json['priority'], 10),
      isActive: ModelJson.boolean(json['is_active'], true),
    );
  }
}

class BlogPostTranslationItem {
  final String? slug;
  final String title;
  final String summary;
  final String content;
  final String? metaTitle;
  final String? metaDescription;

  const BlogPostTranslationItem({
    this.slug,
    required this.title,
    this.summary = '',
    this.content = '',
    this.metaTitle,
    this.metaDescription,
  });

  factory BlogPostTranslationItem.fromJson(Map<String, dynamic> json) {
    return BlogPostTranslationItem(
      slug: ModelJson.nullableStr(json['slug']),
      title: ModelJson.trimmed(json['title']),
      summary: ModelJson.trimmed(json['summary']),
      content: ModelJson.trimmed(json['content']),
      metaTitle: ModelJson.nullableStr(json['meta_title']),
      metaDescription: ModelJson.nullableStr(json['meta_description']),
    );
  }
}

class BlogPostItem {
  final String id;
  final String slug;
  final String? coverImage;
  final bool isActive;
  final Map<String, BlogPostTranslationItem> translations;
  final DateTime createdAt;
  final DateTime updatedAt;

  const BlogPostItem({
    required this.id,
    required this.slug,
    this.coverImage,
    this.isActive = true,
    required this.translations,
    required this.createdAt,
    required this.updatedAt,
  });

  BlogPostTranslationItem? translationFor(String langCode) {
    return translations[langCode] ??
        translations['en'] ??
        translations['tr'] ??
        (translations.isNotEmpty ? translations.values.first : null);
  }

  String localizedTitle(String langCode) =>
      translationFor(langCode)?.title ?? slug;

  String localizedSummary(String langCode) =>
      translationFor(langCode)?.summary ?? '';

  String localizedContent(String langCode) =>
      translationFor(langCode)?.content ?? '';

  factory BlogPostItem.fromJson(Map<String, dynamic> json) {
    final trans = <String, BlogPostTranslationItem>{};
    if (json['translations'] is Map) {
      (json['translations'] as Map).forEach((k, v) {
        if (v is Map) {
          trans[k.toString().toLowerCase()] = BlogPostTranslationItem.fromJson(
            ModelJson.map(v),
          );
        }
      });
    }
    final rawCover = ModelJson.nullableStr(json['cover_image']);
    return BlogPostItem(
      id: ModelJson.trimmed(json['id']),
      slug: ModelJson.trimmed(json['slug']),
      coverImage: rawCover != null ? AppConfig.resolveMediaUrl(rawCover) : null,
      isActive: ModelJson.boolean(json['is_active'], true),
      translations: trans,
      createdAt: ModelJson.dateTime(json['created_at']),
      updatedAt: ModelJson.dateTime(json['updated_at']),
    );
  }
}

class CmsPageTranslationItem {
  final String title;
  final String content;
  final String? metaTitle;
  final String? metaDescription;

  const CmsPageTranslationItem({
    required this.title,
    required this.content,
    this.metaTitle,
    this.metaDescription,
  });

  factory CmsPageTranslationItem.fromJson(Map<String, dynamic> json) {
    return CmsPageTranslationItem(
      title: ModelJson.trimmed(json['title']),
      content: ModelJson.trimmed(json['content']),
      metaTitle: ModelJson.nullableStr(json['meta_title']),
      metaDescription: ModelJson.nullableStr(json['meta_description']),
    );
  }
}

class CmsPageItem {
  final String id;
  final String slug;
  final bool isActive;
  final Map<String, CmsPageTranslationItem> translations;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CmsPageItem({
    required this.id,
    required this.slug,
    this.isActive = true,
    required this.translations,
    required this.createdAt,
    required this.updatedAt,
  });

  CmsPageTranslationItem? translationFor(String langCode) {
    return translations[langCode] ??
        translations['en'] ??
        translations['tr'] ??
        (translations.isNotEmpty ? translations.values.first : null);
  }

  String localizedTitle(String langCode) =>
      translationFor(langCode)?.title ?? slug;

  String localizedContent(String langCode) =>
      translationFor(langCode)?.content ?? '';

  factory CmsPageItem.fromJson(Map<String, dynamic> json) {
    final trans = <String, CmsPageTranslationItem>{};
    if (json['translations'] is Map) {
      (json['translations'] as Map).forEach((k, v) {
        if (v is Map) {
          trans[k.toString().toLowerCase()] = CmsPageTranslationItem.fromJson(
            ModelJson.map(v),
          );
        }
      });
    }
    return CmsPageItem(
      id: ModelJson.trimmed(json['id']),
      slug: ModelJson.trimmed(json['slug']),
      isActive: ModelJson.boolean(json['is_active'], true),
      translations: trans,
      createdAt: ModelJson.dateTime(json['created_at']),
      updatedAt: ModelJson.dateTime(json['updated_at']),
    );
  }
}

class LegalPolicyItem {
  final String id;
  final String type;
  final int version;
  final String title;
  final String content;
  final bool isActive;
  final DateTime updatedAt;

  const LegalPolicyItem({
    required this.id,
    required this.type,
    required this.version,
    required this.title,
    required this.content,
    required this.isActive,
    required this.updatedAt,
  });

  factory LegalPolicyItem.fromJson(Map<String, dynamic> json) {
    return LegalPolicyItem(
      id: ModelJson.trimmed(json['id']),
      type: ModelJson.trimmed(json['type']),
      version: ModelJson.integer(json['version'], 1),
      title: ModelJson.trimmed(json['title']),
      content: ModelJson.trimmed(json['content']),
      isActive: ModelJson.boolean(json['is_active'], true),
      updatedAt: ModelJson.dateTime(json['updated_at']),
    );
  }
}

class NewsletterSubscribePayload {
  final String email;
  final String fullName;
  final String companyName;
  final String country;
  final String preferredLang;
  final String interestedCategories;
  final bool kvkkConsent;
  final bool commercialConsent;

  const NewsletterSubscribePayload({
    required this.email,
    this.fullName = '',
    this.companyName = '',
    this.country = '',
    this.preferredLang = 'tr',
    this.interestedCategories = '',
    this.kvkkConsent = true,
    this.commercialConsent = true,
  });

  Map<String, dynamic> toJson() => {
    'email': email.trim(),
    'full_name': fullName.trim(),
    'company_name': companyName.trim(),
    'country': country.trim(),
    'preferred_lang': preferredLang.trim(),
    'interested_categories': interestedCategories.trim(),
    'kvkk_consent': kvkkConsent,
    'commercial_consent': commercialConsent,
  };
}

class SupplierApplicationPayload {
  final String companyName;
  final String contactName;
  final String email;
  final String phone;
  final String city;
  final String district;
  final String category;
  final String instagram;
  final String website;
  final String notes;

  const SupplierApplicationPayload({
    required this.companyName,
    required this.contactName,
    required this.email,
    required this.phone,
    this.city = 'İstanbul',
    this.district = 'Güngören / Merter',
    this.category = '',
    this.instagram = '',
    this.website = '',
    this.notes = '',
  });

  Map<String, dynamic> toJson({String challengeToken = ''}) => {
    'company_name': companyName.trim(),
    'contact_name': contactName.trim(),
    'email': email.trim(),
    'phone': phone.trim(),
    'city': city.trim(),
    'district': district.trim(),
    if (category.trim().isNotEmpty) 'category': category.trim(),
    if (instagram.trim().isNotEmpty) 'instagram': instagram.trim(),
    if (website.trim().isNotEmpty) 'website': website.trim(),
    if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    if (challengeToken.trim().isNotEmpty) ...{
      'challenge_token': challengeToken.trim(),
      'form_challenge_token': challengeToken.trim(),
    },
  };
}

// --- Supplier Analytics & Billing Models ---

class SupplierAnalyticsSummary {
  final int profileViews;
  final int productViews;
  final int uniqueVisitors;
  final int whatsappClicks;
  final int phoneClicks;
  final int emailWebsiteClicks;
  final int inquiryLeads;
  final int liveChatRooms;
  final int totalBuyerContacts;

  const SupplierAnalyticsSummary({
    this.profileViews = 0,
    this.productViews = 0,
    this.uniqueVisitors = 0,
    this.whatsappClicks = 0,
    this.phoneClicks = 0,
    this.emailWebsiteClicks = 0,
    this.inquiryLeads = 0,
    this.liveChatRooms = 0,
    this.totalBuyerContacts = 0,
  });

  factory SupplierAnalyticsSummary.fromJson(Map<String, dynamic> json) {
    return SupplierAnalyticsSummary(
      profileViews: ModelJson.integer(json['profile_views']),
      productViews: ModelJson.integer(json['product_views']),
      uniqueVisitors: ModelJson.integer(json['unique_visitors']),
      whatsappClicks: ModelJson.integer(json['whatsapp_clicks']),
      phoneClicks: ModelJson.integer(json['phone_clicks']),
      emailWebsiteClicks: ModelJson.integer(json['email_website_clicks']),
      inquiryLeads: ModelJson.integer(json['inquiry_leads']),
      liveChatRooms: ModelJson.integer(json['live_chat_rooms']),
      totalBuyerContacts: ModelJson.integer(json['total_buyer_contacts']),
    );
  }
}

class BrandCountryStatItem {
  final String countryCode;
  final String countryLabel;
  final int views;
  final int contacts;
  final double percentage;

  const BrandCountryStatItem({
    required this.countryCode,
    required this.countryLabel,
    required this.views,
    required this.contacts,
    required this.percentage,
  });

  factory BrandCountryStatItem.fromJson(Map<String, dynamic> json) {
    return BrandCountryStatItem(
      countryCode: ModelJson.trimmed(json['country_code']),
      countryLabel: ModelJson.trimmed(json['country_label']),
      views: ModelJson.integer(json['views']),
      contacts: ModelJson.integer(json['contacts']),
      percentage: ModelJson.decimal(json['percentage']),
    );
  }
}

class BrandTopProductStatItem {
  final String productId;
  final String title;
  final String customSku;
  final String slug;
  final int views;
  final int whatsappClicks;
  final int inquiries;

  const BrandTopProductStatItem({
    required this.productId,
    required this.title,
    required this.customSku,
    required this.slug,
    required this.views,
    required this.whatsappClicks,
    required this.inquiries,
  });

  factory BrandTopProductStatItem.fromJson(Map<String, dynamic> json) {
    return BrandTopProductStatItem(
      productId: ModelJson.trimmed(json['product_id']),
      title: ModelJson.trimmed(json['title']),
      customSku: ModelJson.trimmed(json['custom_sku']),
      slug: ModelJson.trimmed(json['slug']),
      views: ModelJson.integer(json['views']),
      whatsappClicks: ModelJson.integer(json['whatsapp_clicks']),
      inquiries: ModelJson.integer(json['inquiries']),
    );
  }
}

class BrandDailyStatItem {
  final String date;
  final int views;
  final int contacts;

  const BrandDailyStatItem({
    required this.date,
    required this.views,
    required this.contacts,
  });

  factory BrandDailyStatItem.fromJson(Map<String, dynamic> json) {
    return BrandDailyStatItem(
      date: ModelJson.trimmed(json['date']),
      views: ModelJson.integer(json['views']),
      contacts: ModelJson.integer(json['contacts']),
    );
  }
}

class SupplierAnalyticsOverview {
  final String period;
  final SupplierAnalyticsSummary summary;
  final List<BrandCountryStatItem> countryDistribution;
  final List<BrandTopProductStatItem> topProducts;
  final List<BrandDailyStatItem> dailyTrend;

  const SupplierAnalyticsOverview({
    this.period = '30d',
    this.summary = const SupplierAnalyticsSummary(),
    this.countryDistribution = const [],
    this.topProducts = const [],
    this.dailyTrend = const [],
  });

  factory SupplierAnalyticsOverview.fromJson(Map<String, dynamic> json) {
    return SupplierAnalyticsOverview(
      period: ModelJson.trimmed(json['period'], '30d'),
      summary: json['summary'] is Map<String, dynamic>
          ? SupplierAnalyticsSummary.fromJson(
              json['summary'] as Map<String, dynamic>,
            )
          : const SupplierAnalyticsSummary(),
      countryDistribution: (json['country_distribution'] is List)
          ? (json['country_distribution'] as List)
                .whereType<Map<String, dynamic>>()
                .map(BrandCountryStatItem.fromJson)
                .toList()
          : const [],
      topProducts: (json['top_products'] is List)
          ? (json['top_products'] as List)
                .whereType<Map<String, dynamic>>()
                .map(BrandTopProductStatItem.fromJson)
                .toList()
          : const [],
      dailyTrend: (json['daily_trend'] is List)
          ? (json['daily_trend'] as List)
                .whereType<Map<String, dynamic>>()
                .map(BrandDailyStatItem.fromJson)
                .toList()
          : const [],
    );
  }
}

class SubscriptionPlanItem {
  final String id;
  final String code;
  final String name;
  final String description;
  final double monthlyPrice;
  final double yearlyPrice;
  final String currency;
  final double taxRate;
  final int maxProducts;
  final List<String> features;
  final bool isActive;
  final int displayOrder;

  const SubscriptionPlanItem({
    required this.id,
    required this.code,
    required this.name,
    this.description = '',
    required this.monthlyPrice,
    required this.yearlyPrice,
    this.currency = 'TRY',
    this.taxRate = 20.0,
    this.maxProducts = 100,
    this.features = const [],
    this.isActive = true,
    this.displayOrder = 0,
  });

  factory SubscriptionPlanItem.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlanItem(
      id: ModelJson.trimmed(json['id']),
      code: ModelJson.trimmed(json['code']),
      name: ModelJson.trimmed(json['name']),
      description: ModelJson.trimmed(json['description']),
      monthlyPrice: ModelJson.decimal(json['monthly_price']),
      yearlyPrice: ModelJson.decimal(json['yearly_price']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      taxRate: ModelJson.decimal(json['tax_rate'], 20),
      maxProducts: ModelJson.integer(json['max_products'], 100),
      features: ModelJson.stringList(json['features']),
      isActive: ModelJson.boolean(json['is_active'], true),
      displayOrder: ModelJson.integer(json['display_order']),
    );
  }
}

class SupplierSubscriptionItem {
  final String id;
  final String brandId;
  final String brandName;
  final String planCode;
  final String planName;
  final String billingCycle;
  final String status;
  final bool isComplimentary;
  final double agreedPrice;
  final String currency;
  final int maxProducts;
  final int activeProductsCount;
  final DateTime currentPeriodStart;
  final DateTime currentPeriodEnd;
  final DateTime? nextBillingDate;
  final bool autoRenew;
  final double totalPaidAmount;
  final double totalInvoicedAmount;
  final double outstandingBalance;
  final String billingCompanyTitle;
  final String taxOffice;
  final String taxNumber;
  final String billingAddress;
  final String billingEmail;

  const SupplierSubscriptionItem({
    required this.id,
    required this.brandId,
    required this.brandName,
    required this.planCode,
    required this.planName,
    required this.billingCycle,
    required this.status,
    required this.isComplimentary,
    required this.agreedPrice,
    required this.currency,
    required this.maxProducts,
    required this.activeProductsCount,
    required this.currentPeriodStart,
    required this.currentPeriodEnd,
    this.nextBillingDate,
    this.autoRenew = false,
    this.totalPaidAmount = 0,
    this.totalInvoicedAmount = 0,
    this.outstandingBalance = 0,
    this.billingCompanyTitle = '',
    this.taxOffice = '',
    this.taxNumber = '',
    this.billingAddress = '',
    this.billingEmail = '',
  });

  factory SupplierSubscriptionItem.fromJson(Map<String, dynamic> json) {
    return SupplierSubscriptionItem(
      id: ModelJson.trimmed(json['id']),
      brandId: ModelJson.trimmed(json['brand_id']),
      brandName: ModelJson.trimmed(json['brand_name']),
      planCode: ModelJson.trimmed(json['plan_code'], 'FREE'),
      planName: ModelJson.trimmed(json['plan_name'], 'Free'),
      billingCycle: ModelJson.trimmed(json['billing_cycle'], 'MONTHLY'),
      status: ModelJson.trimmed(json['status'], 'ACTIVE'),
      isComplimentary: ModelJson.boolean(json['is_complimentary']),
      agreedPrice: ModelJson.decimal(json['agreed_price']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      maxProducts: ModelJson.integer(json['max_products'], 50),
      activeProductsCount: ModelJson.integer(json['active_products_count']),
      currentPeriodStart: ModelJson.dateTime(json['current_period_start']),
      currentPeriodEnd: ModelJson.dateTime(json['current_period_end']),
      nextBillingDate: ModelJson.nullableDateTime(json['next_billing_date']),
      autoRenew: ModelJson.boolean(json['auto_renew']),
      totalPaidAmount: ModelJson.decimal(json['total_paid_amount']),
      totalInvoicedAmount: ModelJson.decimal(json['total_invoiced_amount']),
      outstandingBalance: ModelJson.decimal(json['outstanding_balance']),
      billingCompanyTitle: ModelJson.trimmed(json['billing_company_title']),
      taxOffice: ModelJson.trimmed(json['tax_office']),
      taxNumber: ModelJson.trimmed(json['tax_number']),
      billingAddress: ModelJson.trimmed(json['billing_address']),
      billingEmail: ModelJson.trimmed(json['billing_email']),
    );
  }
}

class SupplierInvoiceItem {
  final String id;
  final String invoiceNumber;
  final String invoiceType;
  final String planCode;
  final String periodLabel;
  final double subtotalAmount;
  final double taxRate;
  final double taxAmount;
  final double totalAmount;
  final double paidAmount;
  final String currency;
  final String status;
  final DateTime issueDate;
  final DateTime dueDate;

  const SupplierInvoiceItem({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceType,
    required this.planCode,
    required this.periodLabel,
    required this.subtotalAmount,
    required this.taxRate,
    required this.taxAmount,
    required this.totalAmount,
    required this.paidAmount,
    required this.currency,
    required this.status,
    required this.issueDate,
    required this.dueDate,
  });

  factory SupplierInvoiceItem.fromJson(Map<String, dynamic> json) {
    return SupplierInvoiceItem(
      id: ModelJson.trimmed(json['id']),
      invoiceNumber: ModelJson.trimmed(json['invoice_number']),
      invoiceType: ModelJson.trimmed(json['invoice_type']),
      planCode: ModelJson.trimmed(json['plan_code']),
      periodLabel: ModelJson.trimmed(json['period_label']),
      subtotalAmount: ModelJson.decimal(json['subtotal_amount']),
      taxRate: ModelJson.decimal(json['tax_rate']),
      taxAmount: ModelJson.decimal(json['tax_amount']),
      totalAmount: ModelJson.decimal(json['total_amount']),
      paidAmount: ModelJson.decimal(json['paid_amount']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      status: ModelJson.trimmed(json['status']),
      issueDate: ModelJson.dateTime(json['issue_date']),
      dueDate: ModelJson.dateTime(json['due_date']),
    );
  }
}

class SupplierPaymentItem {
  final String id;
  final String paymentNumber;
  final String planCode;
  final int periodMonths;
  final double amount;
  final String currency;
  final String paymentMethod;
  final String status;
  final String senderName;
  final String bankReference;
  final String notes;
  final DateTime paidAt;

  const SupplierPaymentItem({
    required this.id,
    required this.paymentNumber,
    required this.planCode,
    required this.periodMonths,
    required this.amount,
    required this.currency,
    required this.paymentMethod,
    required this.status,
    required this.senderName,
    required this.bankReference,
    this.notes = '',
    required this.paidAt,
  });

  factory SupplierPaymentItem.fromJson(Map<String, dynamic> json) {
    return SupplierPaymentItem(
      id: ModelJson.trimmed(json['id']),
      paymentNumber: ModelJson.trimmed(json['payment_number']),
      planCode: ModelJson.trimmed(json['plan_code']),
      periodMonths: ModelJson.integer(json['period_months'], 1),
      amount: ModelJson.decimal(json['amount']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      paymentMethod: ModelJson.trimmed(json['payment_method'], 'BANK_TRANSFER'),
      status: ModelJson.trimmed(json['status'], 'PENDING'),
      senderName: ModelJson.trimmed(json['sender_name']),
      bankReference: ModelJson.trimmed(json['bank_reference']),
      notes: ModelJson.trimmed(json['notes']),
      paidAt: ModelJson.dateTime(json['paid_at']),
    );
  }
}

class SupplierBillingOverview {
  final SupplierSubscriptionItem? subscription;
  final List<SubscriptionPlanItem> plans;
  final List<SupplierInvoiceItem> invoices;
  final List<SupplierPaymentItem> payments;

  const SupplierBillingOverview({
    this.subscription,
    this.plans = const [],
    this.invoices = const [],
    this.payments = const [],
  });

  factory SupplierBillingOverview.fromJson(Map<String, dynamic> json) {
    return SupplierBillingOverview(
      subscription: json['subscription'] is Map<String, dynamic>
          ? SupplierSubscriptionItem.fromJson(
              json['subscription'] as Map<String, dynamic>,
            )
          : null,
      plans: (json['plans'] is List)
          ? (json['plans'] as List)
                .whereType<Map<String, dynamic>>()
                .map(SubscriptionPlanItem.fromJson)
                .toList()
          : const [],
      invoices: (json['invoices'] is List)
          ? (json['invoices'] as List)
                .whereType<Map<String, dynamic>>()
                .map(SupplierInvoiceItem.fromJson)
                .toList()
          : const [],
      payments: (json['payments'] is List)
          ? (json['payments'] as List)
                .whereType<Map<String, dynamic>>()
                .map(SupplierPaymentItem.fromJson)
                .toList()
          : const [],
    );
  }
}

class SupplierTaxInfoPayload {
  final String billingCompanyTitle;
  final String taxOffice;
  final String taxNumber;
  final String billingAddress;
  final String billingEmail;

  const SupplierTaxInfoPayload({
    required this.billingCompanyTitle,
    required this.taxOffice,
    required this.taxNumber,
    required this.billingAddress,
    required this.billingEmail,
  });

  Map<String, dynamic> toJson() => {
    'billing_company_title': billingCompanyTitle.trim(),
    'tax_office': taxOffice.trim(),
    'tax_number': taxNumber.trim(),
    'billing_address': billingAddress.trim(),
    'billing_email': billingEmail.trim(),
  };
}

class SupplierWirePaymentPayload {
  final String planCode;
  final int periodMonths;
  final double amount;
  final String paymentMethod;
  final String senderName;
  final String bankReference;
  final String notes;

  const SupplierWirePaymentPayload({
    required this.planCode,
    this.periodMonths = 1,
    required this.amount,
    this.paymentMethod = 'BANK_TRANSFER',
    required this.senderName,
    this.bankReference = '',
    this.notes = '',
  });

  Map<String, dynamic> toJson() => {
    'plan_code': planCode.trim(),
    'period_months': periodMonths < 1 ? 1 : periodMonths,
    'amount': amount,
    'payment_method': paymentMethod.trim(),
    'sender_name': senderName.trim(),
    'bank_reference': bankReference.trim(),
    'notes': notes.trim(),
  };
}

class SupplierPayoutItem {
  final String id;
  final String brandId;
  final double amount;
  final String currency;
  final String status;
  final String iban;
  final String bankName;
  final String accountHolder;
  final String adminNotes;
  final DateTime? processedAt;
  final DateTime createdAt;

  const SupplierPayoutItem({
    required this.id,
    required this.brandId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.iban,
    this.bankName = '',
    required this.accountHolder,
    this.adminNotes = '',
    this.processedAt,
    required this.createdAt,
  });

  factory SupplierPayoutItem.fromJson(Map<String, dynamic> json) {
    return SupplierPayoutItem(
      id: ModelJson.trimmed(json['id']),
      brandId: ModelJson.trimmed(json['brand_id']),
      amount: ModelJson.decimal(json['amount']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      status: ModelJson.trimmed(json['status'], 'PENDING'),
      iban: ModelJson.trimmed(json['iban']),
      bankName: ModelJson.trimmed(json['bank_name']),
      accountHolder: ModelJson.trimmed(json['account_holder']),
      adminNotes: ModelJson.trimmed(json['admin_notes']),
      processedAt: ModelJson.nullableDateTime(json['processed_at']),
      createdAt: ModelJson.dateTime(json['created_at']),
    );
  }
}
