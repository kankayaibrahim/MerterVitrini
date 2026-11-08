enum AppRole { customer, supplier }

class CustomerUser {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String role;

  const CustomerUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
    required this.role,
  });

  String get fullName {
    final full = '$firstName $lastName'.trim();
    return full.isEmpty ? email : full;
  }

  factory CustomerUser.fromJson(Map<String, dynamic> json) {
    return CustomerUser(
      id: (json['id'] ?? '').toString(),
      firstName: (json['first_name'] ?? '').toString(),
      lastName: (json['last_name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      role: (json['role'] ?? 'customer').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'first_name': firstName,
        'last_name': lastName,
        'email': email,
        'phone': phone,
        'role': role,
      };
}

class CustomerAddress {
  final String id;
  final String title;
  final String recipientName;
  final String phone;
  final String addressLine;
  final String city;
  final String state;
  final String country;
  final String postalCode;
  final bool isDefault;

  const CustomerAddress({
    required this.id,
    required this.title,
    required this.recipientName,
    required this.phone,
    required this.addressLine,
    required this.city,
    required this.state,
    required this.country,
    required this.postalCode,
    required this.isDefault,
  });

  String get formattedFullAddress {
    final parts = [
      title.isNotEmpty ? '[$title]' : '',
      recipientName,
      addressLine,
      city,
      state,
      country,
      phone,
    ].where((s) => s.trim().isNotEmpty).toList();
    return parts.join(', ');
  }

  factory CustomerAddress.fromJson(Map<String, dynamic> json) {
    return CustomerAddress(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['address_title'] ?? 'İş Adresi').toString(),
      recipientName:
          (json['recipient_name'] ?? json['full_name'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      addressLine:
          (json['address_line'] ?? json['full_address'] ?? '').toString(),
      city: (json['city'] ?? json['city_name'] ?? '').toString(),
      state: (json['state'] ?? json['state_name'] ?? '').toString(),
      country: (json['country'] ?? json['country_name'] ?? 'Türkiye').toString(),
      postalCode: (json['postal_code'] ?? json['zip_code'] ?? '').toString(),
      isDefault: json['is_default'] == true,
    );
  }
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
      aliasCode.isNotEmpty ? '$brandName ($aliasCode)' : brandName;

  factory SupplierUser.fromJson(Map<String, dynamic> json) {
    return SupplierUser(
      id: (json['id'] ?? json['sub'] ?? '').toString(),
      brandId: (json['brand_id'] ?? '').toString(),
      brandName: (json['brand_name'] ?? '').toString(),
      aliasCode: (json['alias_code'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      contactName: (json['contact_name'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      jobTitle: (json['job_title'] ?? 'Firma Yetkilisi').toString(),
      spokenLanguages: (json['spoken_languages'] ?? 'TR').toString(),
      isOwner: json['is_owner'] != false,
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

