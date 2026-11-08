class SupplierAgent {
  final String id;
  final String brandId;
  final String contactName;
  final String email;
  final String phone;
  final String jobTitle;
  final String spokenLanguages;
  final bool isOwner;
  final bool isActive;

  const SupplierAgent({
    required this.id,
    required this.brandId,
    required this.contactName,
    required this.email,
    required this.phone,
    required this.jobTitle,
    required this.spokenLanguages,
    required this.isOwner,
    required this.isActive,
  });

  factory SupplierAgent.fromJson(Map<String, dynamic> json) {
    return SupplierAgent(
      id: (json['id'] ?? '').toString(),
      brandId: (json['brand_id'] ?? '').toString(),
      contactName: (json['contact_name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      jobTitle: (json['job_title'] ?? 'Satış Temsilcisi').toString(),
      spokenLanguages: (json['spoken_languages'] ?? 'TR').toString(),
      isOwner: json['is_owner'] == true,
      isActive: json['is_active'] != false,
    );
  }
}

class ChatRoom {
  final String id;
  final String brandId;
  final String supplierName;
  final String? supplierUserId;
  final String supplierUserName;
  final String supplierUserTitle;
  final String supplierUserLanguages;
  final String customerId;
  final String customerName;
  final String customerEmail;
  final String customerPhone;
  final String? initialProductId;
  final String lastMessagePreview;
  final DateTime lastMessageAt;
  final int unreadCustomerCount;
  final int unreadSupplierCount;

  const ChatRoom({
    required this.id,
    required this.brandId,
    required this.supplierName,
    this.supplierUserId,
    required this.supplierUserName,
    required this.supplierUserTitle,
    required this.supplierUserLanguages,
    required this.customerId,
    required this.customerName,
    required this.customerEmail,
    required this.customerPhone,
    this.initialProductId,
    required this.lastMessagePreview,
    required this.lastMessageAt,
    required this.unreadCustomerCount,
    required this.unreadSupplierCount,
  });

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    return ChatRoom(
      id: (json['id'] ?? '').toString(),
      brandId: (json['brand_id'] ?? '').toString(),
      supplierName: (json['supplier_name'] ?? 'Tedarikçi').toString(),
      supplierUserId: json['supplier_user_id']?.toString(),
      supplierUserName: (json['supplier_user_name'] ?? '').toString(),
      supplierUserTitle: (json['supplier_user_title'] ?? '').toString(),
      supplierUserLanguages: (json['supplier_user_languages'] ?? '').toString(),
      customerId: (json['customer_id'] ?? '').toString(),
      customerName: (json['customer_name'] ?? 'B2B Müşteri').toString(),
      customerEmail: (json['customer_email'] ?? '').toString(),
      customerPhone: (json['customer_phone'] ?? '').toString(),
      initialProductId: json['initial_product_id']?.toString(),
      lastMessagePreview: (json['last_message_preview'] ?? '').toString(),
      lastMessageAt:
          DateTime.tryParse((json['last_message_at'] ?? '').toString()) ??
              DateTime.now(),
      unreadCustomerCount:
          (json['unread_customer_count'] as num?)?.toInt() ?? 0,
      unreadSupplierCount:
          (json['unread_supplier_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class ChatOfferMetadata {
  final String productId;
  final String title;
  final String customSku;
  final String color;
  final String imageUrl;
  final String slug;
  final String seriesRatio;
  final int unitsPerPackage;
  final int packagesQty;
  final double originalUnitPrice;
  final double offeredUnitPrice;
  final double discountPercent;
  final String currency;
  final String offerStatus;

  const ChatOfferMetadata({
    this.productId = '',
    this.title = '',
    this.customSku = '',
    this.color = '',
    this.imageUrl = '',
    this.slug = '',
    this.seriesRatio = '',
    this.unitsPerPackage = 1,
    this.packagesQty = 1,
    this.originalUnitPrice = 0.0,
    this.offeredUnitPrice = 0.0,
    this.discountPercent = 0.0,
    this.currency = 'TRY',
    this.offerStatus = '',
  });

  double get totalOfferPrice {
    final units = unitsPerPackage <= 0 ? 1 : unitsPerPackage;
    final pkgs = packagesQty <= 0 ? 1 : packagesQty;
    return offeredUnitPrice * units * pkgs;
  }

  ChatOfferMetadata copyWith({String? offerStatus}) {
    return ChatOfferMetadata(
      productId: productId,
      title: title,
      customSku: customSku,
      color: color,
      imageUrl: imageUrl,
      slug: slug,
      seriesRatio: seriesRatio,
      unitsPerPackage: unitsPerPackage,
      packagesQty: packagesQty,
      originalUnitPrice: originalUnitPrice,
      offeredUnitPrice: offeredUnitPrice,
      discountPercent: discountPercent,
      currency: currency,
      offerStatus: offerStatus ?? this.offerStatus,
    );
  }

  factory ChatOfferMetadata.fromJson(Map<String, dynamic> json) {
    return ChatOfferMetadata(
      productId: (json['product_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      customSku: (json['custom_sku'] ?? '').toString(),
      color: (json['color'] ?? '').toString(),
      imageUrl: (json['image_url'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      seriesRatio: (json['series_ratio'] ?? '').toString(),
      unitsPerPackage: (json['units_per_package'] as num?)?.toInt() ?? 1,
      packagesQty: (json['packages_qty'] as num?)?.toInt() ?? 1,
      originalUnitPrice:
          (json['original_unit_price'] as num?)?.toDouble() ?? 0.0,
      offeredUnitPrice: (json['offered_unit_price'] as num?)?.toDouble() ?? 0.0,
      discountPercent: (json['discount_percent'] as num?)?.toDouble() ?? 0.0,
      currency: (json['currency'] ?? 'TRY').toString(),
      offerStatus: (json['offer_status'] ?? '').toString(),
    );
  }
}

class ChatMessage {
  final String id;
  final String roomId;
  final String senderType; // "customer" or "supplier"
  final String senderId;
  final String senderName;
  final String messageType; // "text", "product_card", "custom_offer", "image"
  final String content;
  final ChatOfferMetadata metadata;
  final bool isRead;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.roomId,
    required this.senderType,
    required this.senderId,
    required this.senderName,
    required this.messageType,
    required this.content,
    required this.metadata,
    required this.isRead,
    required this.createdAt,
  });

  ChatMessage copyWith({ChatOfferMetadata? metadata}) {
    return ChatMessage(
      id: id,
      roomId: roomId,
      senderType: senderType,
      senderId: senderId,
      senderName: senderName,
      messageType: messageType,
      content: content,
      metadata: metadata ?? this.metadata,
      isRead: isRead,
      createdAt: createdAt,
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final metaJson = json['metadata'];
    return ChatMessage(
      id: (json['id'] ?? '').toString(),
      roomId: (json['room_id'] ?? '').toString(),
      senderType: (json['sender_type'] ?? 'customer').toString(),
      senderId: (json['sender_id'] ?? '').toString(),
      senderName: (json['sender_name'] ?? '').toString(),
      messageType: (json['message_type'] ?? 'text').toString(),
      content: (json['content'] ?? '').toString(),
      metadata: metaJson is Map<String, dynamic>
          ? ChatOfferMetadata.fromJson(metaJson)
          : const ChatOfferMetadata(),
      isRead: json['is_read'] == true,
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

