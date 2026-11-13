import '../core/app_config.dart';
import 'model_json.dart';

class CartItem {
  final String id;
  final String productId;
  final String title;
  final String customSku;
  final String color;
  final int packagesQty;
  final int unitsPerPackage;
  final double pricePerUnit;
  final double weightPerUnit;
  final String imageUrl;
  final String currency;
  final String slug;
  final Map<String, String> titleTranslations;

  const CartItem({
    required this.id,
    required this.productId,
    required this.title,
    required this.customSku,
    required this.color,
    required this.packagesQty,
    required this.unitsPerPackage,
    required this.pricePerUnit,
    this.weightPerUnit = 0.0,
    required this.imageUrl,
    required this.currency,
    this.slug = '',
    this.titleTranslations = const {},
  });

  int get totalUnits =>
      packagesQty * (unitsPerPackage <= 0 ? 1 : unitsPerPackage);

  double get lineTotal => pricePerUnit * totalUnits;

  String localizedTitle(String langCode) =>
      ModelJson.pickLangText(titleTranslations, langCode, title);

  CartItem copyWith({
    String? id,
    int? packagesQty,
    int? unitsPerPackage,
    double? pricePerUnit,
    String? currency,
  }) {
    return CartItem(
      id: id ?? this.id,
      productId: productId,
      title: title,
      customSku: customSku,
      color: color,
      packagesQty: packagesQty ?? this.packagesQty,
      unitsPerPackage: unitsPerPackage ?? this.unitsPerPackage,
      pricePerUnit: pricePerUnit ?? this.pricePerUnit,
      weightPerUnit: weightPerUnit,
      imageUrl: imageUrl,
      currency: currency ?? this.currency,
      slug: slug,
      titleTranslations: titleTranslations,
    );
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    final pkgQty = ModelJson.integer(
      json['packages_qty'] ?? json['quantity'],
      1,
    );
    final units = ModelJson.integer(json['units_per_package'], 1);
    return CartItem(
      id: ModelJson.trimmed(json['id']),
      productId: ModelJson.trimmed(json['product_id']),
      title: ModelJson.trimmed(json['title']),
      customSku: ModelJson.trimmed(json['custom_sku']),
      color: ModelJson.trimmed(json['color']),
      packagesQty: pkgQty < 1 ? 1 : pkgQty,
      unitsPerPackage: units < 1 ? 1 : units,
      pricePerUnit: ModelJson.decimal(
        json['price_per_unit'] ?? json['price'],
      ),
      weightPerUnit: ModelJson.decimal(json['weight_per_unit']),
      imageUrl: AppConfig.resolveMediaUrl(ModelJson.trimmed(json['image_url'])),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      slug: ModelJson.trimmed(json['slug']),
      titleTranslations: ModelJson.stringMap(json['title_translations']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'product_id': productId,
    'title': title,
    'custom_sku': customSku,
    'color': color,
    'packages_qty': packagesQty,
    'units_per_package': unitsPerPackage,
    'price_per_unit': pricePerUnit,
    'weight_per_unit': weightPerUnit,
    'image_url': imageUrl,
    'currency': currency,
    'slug': slug,
    if (titleTranslations.isNotEmpty) 'title_translations': titleTranslations,
  };

  /// Serializes exact `ExportCartExcelRequestItem` for `POST /api/v1/store/cart/export-excel`.
  Map<String, dynamic> toExportExcelJson() => {
    'product_id': productId,
    'title': title,
    'custom_sku': customSku,
    'color': color,
    'packages_qty': packagesQty,
    'units_per_package': unitsPerPackage,
    'price_per_unit': pricePerUnit,
    'weight_per_unit': weightPerUnit,
    'image_url': imageUrl,
    'currency': currency,
    'slug': slug,
    if (titleTranslations.isNotEmpty) 'title_translations': titleTranslations,
  };
}

class CustomerOrderItem {
  final String id;
  final String productId;
  final String productName;
  final String productSku;
  final int quantity;
  final double priceAtPurchase;
  final String imageUrl;

  const CustomerOrderItem({
    required this.id,
    required this.productId,
    required this.productName,
    required this.productSku,
    required this.quantity,
    required this.priceAtPurchase,
    required this.imageUrl,
  });

  double get lineTotal => priceAtPurchase * quantity;

  factory CustomerOrderItem.fromJson(Map<String, dynamic> json) {
    return CustomerOrderItem(
      id: ModelJson.trimmed(json['id']),
      productId: ModelJson.trimmed(json['product_id']),
      productName: ModelJson.trimmed(json['product_name']),
      productSku: ModelJson.trimmed(json['product_sku']),
      quantity: ModelJson.integer(json['quantity'], 1),
      priceAtPurchase: ModelJson.decimal(json['price_at_purchase']),
      imageUrl: AppConfig.resolveMediaUrl(
        ModelJson.trimmed(json['image_url_at_purchase'] ?? json['image_url']),
      ),
    );
  }
}

class CustomerOrder {
  final String id;
  final String orderNumber;
  final double totalAmount;
  final String currency;
  final String paymentMethod;
  final String orderStatus;
  final String billingAddress;
  final String deliveryAddress;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final List<CustomerOrderItem> items;
  final String refundStatus;

  const CustomerOrder({
    required this.id,
    required this.orderNumber,
    required this.totalAmount,
    this.currency = 'TRY',
    required this.paymentMethod,
    required this.orderStatus,
    required this.billingAddress,
    required this.deliveryAddress,
    required this.createdAt,
    this.updatedAt,
    required this.items,
    this.refundStatus = '',
  });

  bool get canCancel {
    final s = orderStatus.toUpperCase();
    return s == 'PENDING_PAYMENT' || s == 'PENDING' || s == 'CONFIRMED';
  }

  bool get canRequestRefund {
    final s = orderStatus.toUpperCase();
    return s == 'PAID' || s == 'SHIPPED' || s == 'DELIVERED';
  }

  factory CustomerOrder.fromJson(Map<String, dynamic> json) {
    final parsedItems = <CustomerOrderItem>[];
    if (json['items'] is List) {
      for (final it in json['items'] as List) {
        if (it is Map<String, dynamic>) {
          parsedItems.add(CustomerOrderItem.fromJson(it));
        }
      }
    }
    return CustomerOrder(
      id: ModelJson.trimmed(json['id']),
      orderNumber: ModelJson.trimmed(json['order_number']),
      totalAmount: ModelJson.decimal(json['total_amount']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      paymentMethod: ModelJson.trimmed(json['payment_method'], 'BANK_TRANSFER'),
      orderStatus: ModelJson.trimmed(json['order_status'], 'PENDING_PAYMENT'),
      billingAddress: ModelJson.trimmed(json['billing_address']),
      deliveryAddress: ModelJson.trimmed(json['delivery_address']),
      createdAt: ModelJson.dateTime(json['created_at']),
      updatedAt: ModelJson.nullableDateTime(json['updated_at']),
      items: parsedItems,
      refundStatus: ModelJson.trimmed(json['refund_status']),
    );
  }
}

/// Detailed order view (`GET /api/v1/store/orders/{id}`).
class OrderDetailModel extends CustomerOrder {
  final String trackingCompany;
  final String trackingNumber;
  final String notes;

  const OrderDetailModel({
    required super.id,
    required super.orderNumber,
    required super.totalAmount,
    super.currency = 'TRY',
    required super.paymentMethod,
    required super.orderStatus,
    required super.billingAddress,
    required super.deliveryAddress,
    required super.createdAt,
    super.updatedAt,
    required super.items,
    super.refundStatus = '',
    this.trackingCompany = '',
    this.trackingNumber = '',
    this.notes = '',
  });

  factory OrderDetailModel.fromJson(Map<String, dynamic> json) {
    final base = CustomerOrder.fromJson(json);
    return OrderDetailModel(
      id: base.id,
      orderNumber: base.orderNumber,
      totalAmount: base.totalAmount,
      currency: base.currency,
      paymentMethod: base.paymentMethod,
      orderStatus: base.orderStatus,
      billingAddress: base.billingAddress,
      deliveryAddress: base.deliveryAddress,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      items: base.items,
      refundStatus: base.refundStatus,
      trackingCompany: ModelJson.trimmed(json['tracking_company']),
      trackingNumber: ModelJson.trimmed(json['tracking_number']),
      notes: ModelJson.trimmed(json['notes']),
    );
  }
}

class OrderRefundItemPayload {
  final String orderItemId;
  final int quantity;

  const OrderRefundItemPayload({
    required this.orderItemId,
    required this.quantity,
  });

  Map<String, dynamic> toJson() => {
    'order_item_id': orderItemId,
    'quantity': quantity,
  };
}

/// Payload for `POST /api/v1/store/orders/{id}/refund`.
class OrderRefundPayload {
  final String refundType; // 'FULL' or 'PARTIAL'
  final String reason;
  final List<OrderRefundItemPayload> items;

  const OrderRefundPayload({
    required this.refundType,
    required this.reason,
    this.items = const [],
  });

  Map<String, dynamic> toJson() => {
    'refund_type': refundType.toUpperCase(),
    'reason': reason.trim(),
    if (items.isNotEmpty) 'items': items.map((e) => e.toJson()).toList(),
  };
}

class SupplierSubOrderItem {
  final String id;
  final String productId;
  final String productName;
  final String productSku;
  final int quantity;
  final double priceAtPurchase;
  final double totalPrice;
  final String imageUrl;
  final String seriesRatio;

  const SupplierSubOrderItem({
    required this.id,
    required this.productId,
    required this.productName,
    required this.productSku,
    required this.quantity,
    required this.priceAtPurchase,
    required this.totalPrice,
    required this.imageUrl,
    required this.seriesRatio,
  });

  factory SupplierSubOrderItem.fromJson(Map<String, dynamic> json) {
    return SupplierSubOrderItem(
      id: ModelJson.trimmed(json['id']),
      productId: ModelJson.trimmed(json['product_id']),
      productName: ModelJson.trimmed(json['product_name']),
      productSku: ModelJson.trimmed(json['product_sku']),
      quantity: ModelJson.integer(json['quantity'], 1),
      priceAtPurchase: ModelJson.decimal(json['price_at_purchase']),
      totalPrice: ModelJson.decimal(json['total_price']),
      imageUrl: AppConfig.resolveMediaUrl(
        ModelJson.trimmed(json['image_url_at_purchase'] ?? json['image_url']),
      ),
      seriesRatio: ModelJson.trimmed(json['series_ratio']),
    );
  }
}

class SupplierSubOrder {
  final String id;
  final String orderId;
  final String subOrderNumber;
  final double grossAmount;
  final double commissionRate;
  final double commissionAmount;
  final double netPayoutAmount;
  final String currency;
  final String status;
  final String trackingCompany;
  final String trackingNumber;
  final String notes;
  final String customerName;
  final String customerCompany;
  final String customerPhone;
  final String customerEmail;
  final String deliveryAddress;
  final String billingAddress;
  final DateTime createdAt;
  final List<SupplierSubOrderItem> items;

  const SupplierSubOrder({
    required this.id,
    required this.orderId,
    required this.subOrderNumber,
    required this.grossAmount,
    required this.commissionRate,
    required this.commissionAmount,
    required this.netPayoutAmount,
    required this.currency,
    required this.status,
    required this.trackingCompany,
    required this.trackingNumber,
    required this.notes,
    required this.customerName,
    required this.customerCompany,
    required this.customerPhone,
    required this.customerEmail,
    required this.deliveryAddress,
    required this.billingAddress,
    required this.createdAt,
    required this.items,
  });

  factory SupplierSubOrder.fromJson(Map<String, dynamic> json) {
    final parsedItems = <SupplierSubOrderItem>[];
    if (json['items'] is List) {
      for (final it in json['items'] as List) {
        if (it is Map<String, dynamic>) {
          parsedItems.add(SupplierSubOrderItem.fromJson(it));
        }
      }
    }
    return SupplierSubOrder(
      id: ModelJson.trimmed(json['id']),
      orderId: ModelJson.trimmed(json['order_id']),
      subOrderNumber: ModelJson.trimmed(json['sub_order_number']),
      grossAmount: ModelJson.decimal(json['gross_amount']),
      commissionRate: ModelJson.decimal(json['commission_rate']),
      commissionAmount: ModelJson.decimal(json['commission_amount']),
      netPayoutAmount: ModelJson.decimal(json['net_payout_amount']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      status: ModelJson.trimmed(json['status'], 'PENDING'),
      trackingCompany: ModelJson.trimmed(json['tracking_company']),
      trackingNumber: ModelJson.trimmed(json['tracking_number']),
      notes: ModelJson.trimmed(json['notes']),
      customerName: ModelJson.trimmed(json['customer_name']),
      customerCompany: ModelJson.trimmed(json['customer_company']),
      customerPhone: ModelJson.trimmed(json['customer_phone']),
      customerEmail: ModelJson.trimmed(json['customer_email']),
      deliveryAddress: ModelJson.trimmed(json['delivery_address']),
      billingAddress: ModelJson.trimmed(json['billing_address']),
      createdAt: ModelJson.dateTime(json['created_at']),
      items: parsedItems,
    );
  }
}

class SupplierWallet {
  final String currency;
  final double pendingBalance;
  final double availableBalance;
  final double withdrawnBalance;
  final double commissionRate;
  final String iban;
  final String bankName;
  final String bankAccountHolder;

  const SupplierWallet({
    required this.currency,
    required this.pendingBalance,
    required this.availableBalance,
    required this.withdrawnBalance,
    required this.commissionRate,
    required this.iban,
    required this.bankName,
    required this.bankAccountHolder,
  });

  factory SupplierWallet.fromJson(Map<String, dynamic> json) {
    return SupplierWallet(
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      pendingBalance: ModelJson.decimal(json['pending_balance']),
      availableBalance: ModelJson.decimal(json['available_balance']),
      withdrawnBalance: ModelJson.decimal(json['withdrawn_balance']),
      commissionRate: ModelJson.decimal(json['commission_rate'], 5),
      iban: ModelJson.trimmed(json['iban']),
      bankName: ModelJson.trimmed(json['bank_name']),
      bankAccountHolder: ModelJson.trimmed(json['bank_account_holder']),
    );
  }
}

class SupplierLedgerEntry {
  final String id;
  final String transactionType;
  final double amount;
  final double balanceAfter;
  final String currency;
  final String description;
  final DateTime createdAt;

  const SupplierLedgerEntry({
    required this.id,
    required this.transactionType,
    required this.amount,
    required this.balanceAfter,
    required this.currency,
    required this.description,
    required this.createdAt,
  });

  factory SupplierLedgerEntry.fromJson(Map<String, dynamic> json) {
    return SupplierLedgerEntry(
      id: ModelJson.trimmed(json['id']),
      transactionType: ModelJson.trimmed(json['transaction_type']),
      amount: ModelJson.decimal(json['amount']),
      balanceAfter: ModelJson.decimal(json['balance_after']),
      currency: ModelJson.trimmed(json['currency'], 'TRY'),
      description: ModelJson.trimmed(json['description']),
      createdAt: ModelJson.dateTime(json['created_at']),
    );
  }
}

class MobileNotificationItem {
  final String id;
  final String title;
  final String body;
  final String notificationType;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic> metadata;

  const MobileNotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.notificationType,
    required this.isRead,
    required this.createdAt,
    required this.metadata,
  });

  factory MobileNotificationItem.fromJson(Map<String, dynamic> json) {
    return MobileNotificationItem(
      id: ModelJson.trimmed(json['id']),
      title: ModelJson.trimmed(json['title']),
      body: ModelJson.trimmed(json['body']),
      notificationType: ModelJson.trimmed(json['notification_type'], 'system'),
      isRead: ModelJson.boolean(json['is_read']),
      createdAt: ModelJson.dateTime(json['created_at']),
      metadata: ModelJson.map(json['metadata']),
    );
  }
}
