import '../models/cart_and_order.dart';
import '../models/product.dart';

/// ISP Contract: Customer B2B Cart, Orders, Wishlist & Mobile Notifications.
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

  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String paymentMethod = 'BANK_TRANSFER',
  });

  Future<List<CustomerOrder>> listCustomerOrders();

  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String notes = '',
  });

  Future<void> cancelCustomerOrder(String orderId);

  Future<List<Product>> fetchWishlist();

  Future<void> addWishlist(String productId);

  Future<void> removeWishlist(String productId);

  Future<(List<MobileNotificationItem>, int)> fetchNotifications();

  Future<void> markAllNotificationsRead();
}

