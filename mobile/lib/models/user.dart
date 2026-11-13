import 'model_json.dart';

enum AppRole { customer, supplier }

/// Cascading country / state / city lookup item (`store_auth.go`).
class LocationItem {
  final String id;
  final String code;
  final int phoneCode;
  final String nameTr;
  final String nameEn;
  final String name;
  final String countryId;
  final String stateId;

  const LocationItem({
    required this.id,
    this.code = '',
    this.phoneCode = 0,
    this.nameTr = '',
    this.nameEn = '',
    this.name = '',
    this.countryId = '',
    this.stateId = '',
  });

  String localizedName(String langCode) {
    final lower = langCode.toLowerCase();
    if (lower == 'tr' && nameTr.trim().isNotEmpty) return nameTr.trim();
    if (nameEn.trim().isNotEmpty && lower != 'tr') return nameEn.trim();
    if (name.trim().isNotEmpty) return name.trim();
    if (nameEn.trim().isNotEmpty) return nameEn.trim();
    if (nameTr.trim().isNotEmpty) return nameTr.trim();
    return code;
  }

  factory LocationItem.fromJson(Map<String, dynamic> json) {
    final tr = ModelJson.trimmed(json['name_tr']);
    final en = ModelJson.trimmed(json['name_en']);
    final genericName = ModelJson.trimmed(
      json['state_name'] ?? json['name'] ?? (tr.isNotEmpty ? tr : en),
    );
    return LocationItem(
      id: ModelJson.trimmed(json['id']),
      code: ModelJson.trimmed(json['code']),
      phoneCode: ModelJson.integer(json['phone_code']),
      nameTr: tr.isNotEmpty ? tr : genericName,
      nameEn: en.isNotEmpty ? en : genericName,
      name: genericName,
      countryId: ModelJson.trimmed(json['country_id']),
      stateId: ModelJson.trimmed(json['state_id']),
    );
  }
}

class CustomerUser {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String role;
  final String preferredLang;
  final String preferredCurrency;
  final String billingAddress;
  final String deliveryAddress;
  final String taxNoTCKN;
  final String instagramUsername;
  final bool emailVerified;
  final bool requiresPhone;

  const CustomerUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
    required this.role,
    this.preferredLang = 'tr',
    this.preferredCurrency = 'TRY',
    this.billingAddress = '',
    this.deliveryAddress = '',
    this.taxNoTCKN = '',
    this.instagramUsername = '',
    this.emailVerified = false,
    this.requiresPhone = false,
  });

  String get fullName {
    final full = '$firstName $lastName'.trim();
    return full.isNotEmpty ? full : email;
  }

  bool get hasVerifiedPhone => phone.trim().isNotEmpty && !requiresPhone;

  CustomerUser copyWith({
    String? id,
    String? firstName,
    String? lastName,
    String? email,
    String? phone,
    String? role,
    String? preferredLang,
    String? preferredCurrency,
    String? billingAddress,
    String? deliveryAddress,
    String? taxNoTCKN,
    String? instagramUsername,
    bool? emailVerified,
    bool? requiresPhone,
  }) {
    return CustomerUser(
      id: id ?? this.id,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      preferredLang: preferredLang ?? this.preferredLang,
      preferredCurrency: preferredCurrency ?? this.preferredCurrency,
      billingAddress: billingAddress ?? this.billingAddress,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      taxNoTCKN: taxNoTCKN ?? this.taxNoTCKN,
      instagramUsername: instagramUsername ?? this.instagramUsername,
      emailVerified: emailVerified ?? this.emailVerified,
      requiresPhone: requiresPhone ?? this.requiresPhone,
    );
  }

  factory CustomerUser.fromJson(Map<String, dynamic> json) {
    final phone = ModelJson.trimmed(json['phone']);
    final explicitRequiresPhone = json.containsKey('requires_phone')
        ? ModelJson.boolean(json['requires_phone'])
        : phone.isEmpty;
    return CustomerUser(
      id: ModelJson.trimmed(json['id']),
      firstName: ModelJson.trimmed(json['first_name']),
      lastName: ModelJson.trimmed(json['last_name']),
      email: ModelJson.trimmed(json['email']),
      phone: phone,
      role: ModelJson.trimmed(json['role'], 'customer'),
      preferredLang: ModelJson.trimmed(json['preferred_lang'], 'tr'),
      preferredCurrency: ModelJson.trimmed(json['preferred_currency'], 'TRY'),
      billingAddress: ModelJson.trimmed(json['billing_address']),
      deliveryAddress: ModelJson.trimmed(json['delivery_address']),
      taxNoTCKN: ModelJson.trimmed(json['tax_no_tckn']),
      instagramUsername: ModelJson.trimmed(json['instagram_username']),
      emailVerified: ModelJson.boolean(json['email_verified']),
      requiresPhone: explicitRequiresPhone,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'first_name': firstName,
    'last_name': lastName,
    'email': email,
    'phone': phone,
    'role': role,
    'preferred_lang': preferredLang,
    'preferred_currency': preferredCurrency,
    'billing_address': billingAddress,
    'delivery_address': deliveryAddress,
    'tax_no_tckn': taxNoTCKN,
    'instagram_username': instagramUsername,
    'email_verified': emailVerified,
    'requires_phone': requiresPhone,
  };
}

class CustomerAddress {
  final String id;
  final String userId;
  final String title;
  final String addressType; // 'shipping' or 'billing'
  final String firstName;
  final String lastName;
  final String recipientName;
  final String? companyName;
  final String phone;
  final String countryId;
  final String? stateId;
  final String? cityId;
  final String addressLine;
  final String city;
  final String state;
  final String country;
  final String postalCode;
  final String? taxNoTCKN;
  final String? taxOffice;
  final bool isDefault;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const CustomerAddress({
    required this.id,
    this.userId = '',
    required this.title,
    this.addressType = 'shipping',
    this.firstName = '',
    this.lastName = '',
    required this.recipientName,
    this.companyName,
    required this.phone,
    this.countryId = '',
    this.stateId,
    this.cityId,
    required this.addressLine,
    required this.city,
    required this.state,
    required this.country,
    required this.postalCode,
    this.taxNoTCKN,
    this.taxOffice,
    required this.isDefault,
    this.createdAt,
    this.updatedAt,
  });

  String get formattedFullAddress {
    final parts = [
      addressLine,
      city,
      state,
      country,
      postalCode,
    ].map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    return parts.join(', ');
  }

  bool get isBilling => addressType.toLowerCase() == 'billing';

  factory CustomerAddress.fromJson(Map<String, dynamic> json) {
    final first = ModelJson.trimmed(json['first_name']);
    final last = ModelJson.trimmed(json['last_name']);
    final combinedName = '$first $last'.trim();
    final recipient = ModelJson.trimmed(json['recipient_name']);

    return CustomerAddress(
      id: ModelJson.trimmed(json['id']),
      userId: ModelJson.trimmed(json['user_id']),
      title: ModelJson.trimmed(json['title']),
      addressType: ModelJson.trimmed(json['address_type'], 'shipping'),
      firstName: first.isNotEmpty
          ? first
          : (recipient.isNotEmpty ? recipient.split(' ').first : ''),
      lastName: last.isNotEmpty
          ? last
          : (recipient.contains(' ')
                ? recipient.substring(recipient.indexOf(' ') + 1).trim()
                : ''),
      recipientName: combinedName.isNotEmpty ? combinedName : recipient,
      companyName: ModelJson.nullableStr(json['company_name']),
      phone: ModelJson.trimmed(json['phone']),
      countryId: ModelJson.trimmed(json['country_id']),
      stateId: ModelJson.nullableStr(json['state_id']),
      cityId: ModelJson.nullableStr(json['city_id']),
      addressLine: ModelJson.trimmed(json['address_line']),
      city: ModelJson.trimmed(json['city_name'] ?? json['city']),
      state: ModelJson.trimmed(json['state_name'] ?? json['state']),
      country: ModelJson.trimmed(json['country_name'] ?? json['country']),
      postalCode: ModelJson.trimmed(json['postal_code']),
      taxNoTCKN: ModelJson.nullableStr(json['tax_no_tckn']),
      taxOffice: ModelJson.nullableStr(json['tax_office']),
      isDefault: ModelJson.boolean(json['is_default']),
      createdAt: ModelJson.nullableDateTime(json['created_at']),
      updatedAt: ModelJson.nullableDateTime(json['updated_at']),
    );
  }

  /// Serializes exact `AddressRequestPayload` JSON expected by Go `/api/v1/store/profile/addresses`.
  Map<String, dynamic> toCreateJson() {
    final trimmedFirst = firstName.trim().isNotEmpty
        ? firstName.trim()
        : (recipientName.trim().isNotEmpty
              ? recipientName.trim().split(' ').first
              : title.trim());
    final trimmedLast = lastName.trim().isNotEmpty
        ? lastName.trim()
        : (recipientName.trim().contains(' ')
              ? recipientName
                    .trim()
                    .substring(recipientName.trim().indexOf(' ') + 1)
                    .trim()
              : '-');
    return {
      'title': title.trim(),
      'address_type': addressType.trim().isEmpty
          ? 'shipping'
          : addressType.trim().toLowerCase(),
      'first_name': trimmedFirst,
      'last_name': trimmedLast,
      'company_name': companyName?.trim().isNotEmpty == true
          ? companyName!.trim()
          : null,
      'phone': phone.trim(),
      'country_id': countryId.trim(),
      'state_id': stateId?.trim().isNotEmpty == true ? stateId!.trim() : null,
      'city_id': cityId?.trim().isNotEmpty == true ? cityId!.trim() : null,
      'address_line': addressLine.trim(),
      'postal_code': postalCode.trim().isNotEmpty ? postalCode.trim() : '34000',
      'tax_no_tckn': taxNoTCKN?.trim().isNotEmpty == true
          ? taxNoTCKN!.trim()
          : null,
      'tax_office': taxOffice?.trim().isNotEmpty == true
          ? taxOffice!.trim()
          : null,
      'is_default': isDefault,
    };
  }

  Map<String, dynamic> toUpdateJson() => toCreateJson();
}

class SupplierUser {
  final String id;
  final String brandId;
  final String brandName;
  final String aliasCode;
  final String email;
  final String contactName;
  final String phone;
  final String jobTitle;
  final String spokenLanguages;
  final bool isOwner;

  const SupplierUser({
    required this.id,
    required this.brandId,
    required this.brandName,
    required this.aliasCode,
    required this.email,
    required this.contactName,
    required this.phone,
    required this.jobTitle,
    required this.spokenLanguages,
    required this.isOwner,
  });

  String get displayBrand =>
      brandName.trim().isNotEmpty ? brandName.trim() : aliasCode.trim();

  factory SupplierUser.fromJson(Map<String, dynamic> json) {
    return SupplierUser(
      id: ModelJson.trimmed(json['id']),
      brandId: ModelJson.trimmed(json['brand_id']),
      brandName: ModelJson.trimmed(json['brand_name']),
      aliasCode: ModelJson.trimmed(json['alias_code']),
      email: ModelJson.trimmed(json['email']),
      contactName: ModelJson.trimmed(json['contact_name']),
      phone: ModelJson.trimmed(json['phone']),
      jobTitle: ModelJson.trimmed(json['job_title']),
      spokenLanguages: ModelJson.trimmed(json['spoken_languages']),
      isOwner: ModelJson.boolean(json['is_owner']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'brand_id': brandId,
    'brand_name': brandName,
    'alias_code': aliasCode,
    'email': email,
    'contact_name': contactName,
    'phone': phone,
    'job_title': jobTitle,
    'spoken_languages': spokenLanguages,
    'is_owner': isOwner,
  };
}

/// Full 17-field editorial supplier storefront profile (`supplier_portal.go`).
class SupplierEditorialProfile {
  final String id;
  final String brandName;
  final String slug;
  final String aliasCode;
  final String companyType;
  final String description;
  final Map<String, String> descriptionTranslations;
  final String phone;
  final String whatsappPhone;
  final String publicEmail;
  final String website;
  final String instagramHandle;
  final String locationAddress;
  final String exportCountries;
  final int minOrderQuantity;
  final bool supportsPrivateLabel;
  final bool supportsFason;
  final String bankName;
  final String bankAccountHolder;
  final String iban;
  final bool isVerified;
  final bool isActive;
  final int activeProductCount;
  final int totalProducts;
  final int totalStock;
  final int totalVariants;
  final int totalOrders;

  const SupplierEditorialProfile({
    this.id = '',
    this.brandName = '',
    this.slug = '',
    this.aliasCode = '',
    this.companyType = 'uretici_toptanci',
    this.description = '',
    this.descriptionTranslations = const {},
    this.phone = '',
    this.whatsappPhone = '',
    this.publicEmail = '',
    this.website = '',
    this.instagramHandle = '',
    this.locationAddress = '',
    this.exportCountries = '',
    this.minOrderQuantity = 1,
    this.supportsPrivateLabel = false,
    this.supportsFason = false,
    this.bankName = '',
    this.bankAccountHolder = '',
    this.iban = '',
    this.isVerified = false,
    this.isActive = true,
    this.activeProductCount = 0,
    this.totalProducts = 0,
    this.totalStock = 0,
    this.totalVariants = 0,
    this.totalOrders = 0,
  });

  String localizedDescription(String langCode) =>
      ModelJson.pickLangText(descriptionTranslations, langCode, description);

  SupplierEditorialProfile copyWith({
    String? brandName,
    String? companyType,
    String? description,
    Map<String, String>? descriptionTranslations,
    String? phone,
    String? whatsappPhone,
    String? publicEmail,
    String? website,
    String? instagramHandle,
    String? locationAddress,
    String? exportCountries,
    int? minOrderQuantity,
    bool? supportsPrivateLabel,
    bool? supportsFason,
    String? bankName,
    String? bankAccountHolder,
    String? iban,
  }) {
    return SupplierEditorialProfile(
      id: id,
      brandName: brandName ?? this.brandName,
      slug: slug,
      aliasCode: aliasCode,
      companyType: companyType ?? this.companyType,
      description: description ?? this.description,
      descriptionTranslations:
          descriptionTranslations ?? this.descriptionTranslations,
      phone: phone ?? this.phone,
      whatsappPhone: whatsappPhone ?? this.whatsappPhone,
      publicEmail: publicEmail ?? this.publicEmail,
      website: website ?? this.website,
      instagramHandle: instagramHandle ?? this.instagramHandle,
      locationAddress: locationAddress ?? this.locationAddress,
      exportCountries: exportCountries ?? this.exportCountries,
      minOrderQuantity: minOrderQuantity ?? this.minOrderQuantity,
      supportsPrivateLabel: supportsPrivateLabel ?? this.supportsPrivateLabel,
      supportsFason: supportsFason ?? this.supportsFason,
      bankName: bankName ?? this.bankName,
      bankAccountHolder: bankAccountHolder ?? this.bankAccountHolder,
      iban: iban ?? this.iban,
      isVerified: isVerified,
      isActive: isActive,
      activeProductCount: activeProductCount,
      totalProducts: totalProducts,
      totalStock: totalStock,
      totalVariants: totalVariants,
      totalOrders: totalOrders,
    );
  }

  factory SupplierEditorialProfile.fromJson(Map<String, dynamic> json) {
    final brandMap = json['brand_profile'] is Map<String, dynamic>
        ? json['brand_profile'] as Map<String, dynamic>
        : (json['brand'] is Map<String, dynamic>
              ? json['brand'] as Map<String, dynamic>
              : json);
    final statsMap = json['stats'] is Map<String, dynamic>
        ? json['stats'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return SupplierEditorialProfile(
      id: ModelJson.trimmed(brandMap['id']),
      brandName: ModelJson.trimmed(brandMap['brand_name'] ?? brandMap['name']),
      slug: ModelJson.trimmed(brandMap['slug']),
      aliasCode: ModelJson.trimmed(brandMap['alias_code']),
      companyType: ModelJson.trimmed(
        brandMap['company_type'],
        'uretici_toptanci',
      ),
      description: ModelJson.trimmed(brandMap['description']),
      descriptionTranslations: ModelJson.stringMap(
        brandMap['description_translations'],
      ),
      phone: ModelJson.trimmed(brandMap['phone']),
      whatsappPhone: ModelJson.trimmed(brandMap['whatsapp_phone']),
      publicEmail: ModelJson.trimmed(brandMap['public_email']),
      website: ModelJson.trimmed(brandMap['website']),
      instagramHandle: ModelJson.trimmed(brandMap['instagram_handle']),
      locationAddress: ModelJson.trimmed(brandMap['location_address']),
      exportCountries: ModelJson.trimmed(brandMap['export_countries']),
      minOrderQuantity: ModelJson.integer(brandMap['min_order_quantity'], 1),
      supportsPrivateLabel: ModelJson.boolean(
        brandMap['supports_private_label'],
      ),
      supportsFason: ModelJson.boolean(brandMap['supports_fason']),
      bankName: ModelJson.trimmed(brandMap['bank_name']),
      bankAccountHolder: ModelJson.trimmed(brandMap['bank_account_holder']),
      iban: ModelJson.trimmed(brandMap['iban']),
      isVerified: ModelJson.boolean(brandMap['is_verified']),
      isActive: ModelJson.boolean(brandMap['is_active'], true),
      activeProductCount: ModelJson.integer(
        statsMap['active_products'] ?? brandMap['active_product_count'],
      ),
      totalProducts: ModelJson.integer(statsMap['total_products']),
      totalStock: ModelJson.integer(statsMap['total_stock']),
      totalVariants: ModelJson.integer(statsMap['total_variants']),
      totalOrders: ModelJson.integer(statsMap['total_orders']),
    );
  }

  Map<String, dynamic> toUpdateJson({bool quickWhatsappOnly = false}) => {
    'brand_name': brandName.trim(),
    'company_type': companyType.trim().isEmpty
        ? 'uretici_toptanci'
        : companyType.trim(),
    'description': description.trim(),
    if (descriptionTranslations.isNotEmpty)
      'description_translations': descriptionTranslations,
    'phone': phone.trim(),
    'whatsapp_phone': whatsappPhone.trim(),
    'public_email': publicEmail.trim(),
    'website': website.trim(),
    'instagram_handle': instagramHandle.trim(),
    'location_address': locationAddress.trim(),
    'export_countries': exportCountries.trim(),
    'min_order_quantity': minOrderQuantity < 1 ? 1 : minOrderQuantity,
    'supports_private_label': supportsPrivateLabel,
    'supports_fason': supportsFason,
    'bank_name': bankName.trim(),
    'bank_account_holder': bankAccountHolder.trim(),
    'iban': iban.trim(),
    'quick_whatsapp_only': quickWhatsappOnly,
  };
}
