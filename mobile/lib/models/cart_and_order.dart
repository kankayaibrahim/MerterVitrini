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

  const CartItem({
    required this.id,
    required this.productId,
    required this.title,
    required this.customSku,
    required this.color,
    required this.packagesQty,
    required this.unitsPerPackage,
    required this.pricePerUnit,
    required this.weightPerUnit,
    required this.imageUrl,
    required this.currency,
    required this.slug,
  });

  int get totalUnits => packagesQty * (unitsPerPackage <= 0 ? 1 : unitsPerPackage);

  double get lineTotal => pricePerUnit * totalUnits;

  CartItem copyWith({int? packagesQty}) {
    return CartItem(
      id: id,
      productId: productId,
      title: title,
      customSku: customSku,
      color: color,
      packagesQty: packagesQty ?? this.packagesQty,
      unitsPerPackage: unitsPerPackage,
      pricePerUnit: pricePerUnit,
      weightPerUnit: weightPerUnit,
      imageUrl: imageUrl,
      currency: currency,
      slug: slug,
    );
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: (json['id'] ?? '').toString(),
      productId: (json['product_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      customSku: (json['custom_sku'] ?? '').toString(),
      color: (json['color'] ?? 'Standart').toString(),
      packagesQty: (json['packages_qty'] as num?)?.toInt() ?? 1,
      unitsPerPackage: (json['units_per_package'] as num?)?.toInt() ?? 1,
      pricePerUnit: (json['price_per_unit'] as num?)?.toDouble() ?? 0.0,
      weightPerUnit: (json['weight_per_unit'] as num?)?.toDouble() ?? 0.35,
      imageUrl: (json['image_url'] ?? '').toString(),
      currency: (json['currency'] ?? 'TRY').toString(),
      slug: (json['slug'] ?? '').toString(),
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

  factory CustomerOrderItem.fromJson(Map<String, dynamic> json) {
    return CustomerOrderItem(
      id: (json['id'] ?? '').toString(),
      productId: (json['product_id'] ?? '').toString(),
      productName: (json['product_name'] ?? '').toString(),
      productSku: (json['product_sku'] ?? '').toString(),
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      priceAtPurchase: (json['price_at_purchase'] as num?)?.toDouble() ?? 0.0,
      imageUrl:
          (json['image_url_at_purchase'] ?? json['image_url'] ?? '').toString(),
    );
  }
}

class CustomerOrder {
  final String id;
  final String orderNumber;
  final double totalAmount;
  final String paymentMethod;
  final String orderStatus;
  final String billingAddress;
  final String deliveryAddress;
  final DateTime createdAt;
  final List<CustomerOrderItem> items;

  const CustomerOrder({
    required this.id,
    required this.orderNumber,
    required this.totalAmount,
    required this.paymentMethod,
    required this.orderStatus,
    required this.billingAddress,
    required this.deliveryAddress,
    required this.createdAt,
    required this.items,
  });

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
      id: (json['id'] ?? '').toString(),
      orderNumber: (json['order_number'] ?? '').toString(),
      totalAmount: (json['total_amount'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: (json['payment_method'] ?? 'BANK_TRANSFER').toString(),
      orderStatus: (json['order_status'] ?? 'PENDING_PAYMENT').toString(),
      billingAddress: (json['billing_address'] ?? '').toString(),
      deliveryAddress: (json['delivery_address'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      items: parsedItems,
    );
  }
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
      id: (json['id'] ?? '').toString(),
      productId: (json['product_id'] ?? '').toString(),
      productName: (json['product_name'] ?? '').toString(),
      productSku: (json['product_sku'] ?? '').toString(),
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      priceAtPurchase: (json['price_at_purchase'] as num?)?.toDouble() ?? 0.0,
      totalPrice: (json['total_price'] as num?)?.toDouble() ?? 0.0,
      imageUrl: (json['image_url'] ?? '').toString(),
      seriesRatio: (json['series_ratio'] ?? '').toString(),
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
      id: (json['id'] ?? '').toString(),
      orderId: (json['order_id'] ?? '').toString(),
      subOrderNumber: (json['sub_order_number'] ?? '').toString(),
      grossAmount: (json['gross_amount'] as num?)?.toDouble() ?? 0.0,
      commissionRate: (json['commission_rate'] as num?)?.toDouble() ?? 10.0,
      commissionAmount: (json['commission_amount'] as num?)?.toDouble() ?? 0.0,
      netPayoutAmount: (json['net_payout_amount'] as num?)?.toDouble() ?? 0.0,
      currency: (json['currency'] ?? 'TRY').toString(),
      status: (json['status'] ?? 'PENDING').toString(),
      trackingCompany: (json['tracking_company'] ?? '').toString(),
      trackingNumber: (json['tracking_number'] ?? '').toString(),
      notes: (json['notes'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
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
    this.currency = 'TRY',
    this.pendingBalance = 0.0,
    this.availableBalance = 0.0,
    this.withdrawnBalance = 0.0,
    this.commissionRate = 10.0,
    this.iban = '',
    this.bankName = '',
    this.bankAccountHolder = '',
  });

  factory SupplierWallet.fromJson(Map<String, dynamic> json) {
    return SupplierWallet(
      currency: (json['currency'] ?? 'TRY').toString(),
      pendingBalance: (json['pending_balance'] as num?)?.toDouble() ?? 0.0,
      availableBalance: (json['available_balance'] as num?)?.toDouble() ?? 0.0,
      withdrawnBalance: (json['withdrawn_balance'] as num?)?.toDouble() ?? 0.0,
      commissionRate: (json['commission_rate'] as num?)?.toDouble() ?? 10.0,
      iban: (json['iban'] ?? '').toString(),
      bankName: (json['bank_name'] ?? '').toString(),
      bankAccountHolder: (json['bank_account_holder'] ?? '').toString(),
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
      id: (json['id'] ?? '').toString(),
      transactionType: (json['transaction_type'] ?? '').toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      balanceAfter: (json['balance_after'] as num?)?.toDouble() ?? 0.0,
      currency: (json['currency'] ?? 'TRY').toString(),
      description: (json['description'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
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
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      notificationType: (json['notification_type'] ?? 'system').toString(),
      isRead: json['is_read'] == true,
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      metadata: json['metadata'] is Map<String, dynamic>
          ? json['metadata'] as Map<String, dynamic>
          : <String, dynamic>{},
    );
  }
}

