import 'dart:typed_data';

import '../models/cart_and_order.dart';
import '../models/product.dart';

/// ISP Contract: Customer Cart, Orders, Wishlist & Push Notifications.
abstract interface class ICommerceRepository {
  Future<List<CartItem>> fetchServerCart();

  Future<void> addServerCartItem({
    required String productId,
    required int totalUnitsQuantity,
  });

  Future<void> updateServerCartItem({
    required String itemId,
    required int totalUnitsQuantity,
  });

  Future<void> removeServerCartItem(String itemId);

  Future<void> clearServerCart();

  Future<void> syncServerCart(List<CartItem> items);

  Future<Uint8List> exportCartExcel({
    required String lang,
    required String displayCurrency,
    required List<CartItem> items,
  });

  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String paymentMethod = 'BANK_TRANSFER',
    String customerCurrency = '',
  });

  Future<List<CustomerOrder>> listCustomerOrders();

  Future<OrderDetailModel> fetchOrderDetail(String orderId);

  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String currency = '',
    String notes = '',
  });

  Future<void> cancelCustomerOrder(String orderId);

  Future<void> requestOrderRefund({
    required String orderId,
    required OrderRefundPayload payload,
  });

  Future<Uint8List> downloadOrderExcel(String orderId);

  Future<Uint8List> downloadOrderImagesZip(String orderId);

  Future<List<Product>> fetchWishlist();

  Future<void> addWishlist(String productId);

  Future<void> removeWishlist(String productId);

  Future<(List<MobileNotificationItem>, int)> fetchNotifications();

  Future<void> markAllNotificationsRead();
}
