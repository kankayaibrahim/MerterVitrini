import '../contracts/commerce_repository.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import '../services/api_client.dart';

class HttpCommerceRepository implements ICommerceRepository {
  final ApiClient _client;

  const HttpCommerceRepository(this._client);

  @override
  Future<List<CartItem>> fetchServerCart() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/cart');
      final items = <CartItem>[];
      if (resp.data is List) {
        for (final item in resp.data as List) {
          if (item is Map<String, dynamic>) {
            items.add(CartItem.fromJson(item));
          }
        }
      }
      return items;
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> addServerCartItem({
    required String productId,
    required int totalUnitsQuantity,
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/cart',
        data: {
          'product_id': productId,
          'quantity': totalUnitsQuantity,
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> updateServerCartItem({
    required String itemId,
    required int totalUnitsQuantity,
  }) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/store/cart/items/$itemId',
        data: {'quantity': totalUnitsQuantity},
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> removeServerCartItem(String itemId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/store/cart/items/$itemId');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> clearServerCart() async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/store/cart');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String paymentMethod = 'BANK_TRANSFER',
  }) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/store/orders',
        data: {
          'billing_address': billingAddress,
          'delivery_address': deliveryAddress,
          'payment_method': paymentMethod,
        },
      );
      return resp.data ?? <String, dynamic>{};
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<CustomerOrder>> listCustomerOrders() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/orders');
      final list = <CustomerOrder>[];
      final raw = resp.data;
      if (raw is List) {
        for (final o in raw) {
          if (o is Map<String, dynamic>) {
            list.add(CustomerOrder.fromJson(o));
          }
        }
      } else if (raw is Map<String, dynamic> && raw['orders'] is List) {
        for (final o in raw['orders'] as List) {
          if (o is Map<String, dynamic>) {
            list.add(CustomerOrder.fromJson(o));
          }
        }
      }
      return list;
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String notes = '',
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/orders/$orderId/payment-notification',
        data: {
          'sender_name': senderName,
          'bank_name': bankName,
          'amount': amount,
          'notes': notes,
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> cancelCustomerOrder(String orderId) async {
    try {
      await _client.dio.post<dynamic>('/api/v1/store/orders/$orderId/cancel');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<Product>> fetchWishlist() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/mobile/wishlist',
      );
      final list = <Product>[];
      final raw = resp.data?['products'];
      if (raw is List) {
        for (final p in raw) {
          if (p is Map<String, dynamic>) {
            list.add(Product.fromJson(p));
          }
        }
      }
      return list;
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> addWishlist(String productId) async {
    try {
      await _client.dio.post<dynamic>('/api/v1/mobile/wishlist/$productId');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> removeWishlist(String productId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/mobile/wishlist/$productId');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<(List<MobileNotificationItem>, int)> fetchNotifications() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/mobile/notifications',
      );
      final data = resp.data ?? <String, dynamic>{};
      final list = <MobileNotificationItem>[];
      if (data['notifications'] is List) {
        for (final item in data['notifications'] as List) {
          if (item is Map<String, dynamic>) {
            list.add(MobileNotificationItem.fromJson(item));
          }
        }
      }
      final unread = (data['unread_count'] as num?)?.toInt() ?? 0;
      return (list, unread);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> markAllNotificationsRead() async {
    try {
      await _client.dio.post<dynamic>('/api/v1/mobile/notifications/read-all');
    } catch (_) {}
  }
}

