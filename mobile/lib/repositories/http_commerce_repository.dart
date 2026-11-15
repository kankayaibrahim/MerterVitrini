import 'dart:typed_data';

import '../contracts/commerce_repository.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

class HttpCommerceRepository implements ICommerceRepository {
  final ApiClient _client;

  const HttpCommerceRepository(this._client);

  @override
  Future<List<CartItem>> fetchServerCart() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/cart');
      return HttpRepoHelpers.parseList(resp.data, CartItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> removeServerCartItem(String itemId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/store/cart/items/$itemId');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> clearServerCart() async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/store/cart');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> syncServerCart(List<CartItem> items) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/cart/sync',
        data: {
          'items': items
              .map(
                (it) => {
                  'product_id': it.productId,
                  'quantity': it.totalUnits,
                },
              )
              .toList(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<Uint8List> exportCartExcel({
    required String lang,
    required String displayCurrency,
    required List<CartItem> items,
  }) {
    return _client.postBytes(
      '/api/v1/store/cart/export-excel',
      data: {
        'lang': lang,
        'display_currency': displayCurrency,
        'items': items.map((e) => e.toExportExcelJson()).toList(),
      },
    );
  }

  @override
  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String? billingAddressId,
    String? deliveryAddressId,
    String paymentMethod = 'BANK_TRANSFER',
    String customerCurrency = '',
  }) async {
    try {
      final resp = await HttpRepoHelpers.postWithChallenge(
        _client,
        mobilePath: '/api/v1/store/orders',
        fallbackStorePath: '/api/v1/store/orders',
        purpose: 'create_order',
        payload: {
          'billing_address': billingAddress,
          'delivery_address': deliveryAddress,
          if (billingAddressId != null && billingAddressId.trim().isNotEmpty)
            'billing_address_id': billingAddressId.trim(),
          if (deliveryAddressId != null && deliveryAddressId.trim().isNotEmpty)
            'delivery_address_id': deliveryAddressId.trim(),
          'payment_method': paymentMethod,
          if (customerCurrency.trim().isNotEmpty)
            'customer_currency': customerCurrency.trim().toUpperCase(),
        },
      );
      return HttpRepoHelpers.asMap(resp.data);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<CustomerOrder>> listCustomerOrders() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/orders');
      return HttpRepoHelpers.parseList(resp.data, CustomerOrder.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<OrderDetailModel> fetchOrderDetail(String orderId) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/orders/$orderId',
      );
      return OrderDetailModel.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String currency = '',
    String notes = '',
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/orders/$orderId/payment-notification',
        data: {
          'sender_name': senderName,
          'bank_name': bankName,
          'amount': amount,
          if (currency.trim().isNotEmpty)
            'currency': currency.trim().toUpperCase(),
          'notes': notes,
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> cancelCustomerOrder(String orderId) async {
    try {
      await _client.dio.post<dynamic>('/api/v1/store/orders/$orderId/cancel');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> requestOrderRefund({
    required String orderId,
    required OrderRefundPayload payload,
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/orders/$orderId/refund',
        data: payload.toJson(),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<Uint8List> downloadOrderExcel(String orderId) =>
      _client.getBytes('/api/v1/store/orders/$orderId/excel');

  @override
  Future<Uint8List> downloadOrderImagesZip(String orderId) =>
      _client.getBytes('/api/v1/store/orders/$orderId/images');

  @override
  Future<List<Product>> fetchWishlist() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/mobile/wishlist');
      final data = resp.data;
      if (data is Map && data['products'] is List) {
        return HttpRepoHelpers.parseList(data['products'], Product.fromJson);
      }
      return <Product>[];
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> addWishlist(String productId) async {
    try {
      await _client.dio.post<dynamic>('/api/v1/mobile/wishlist/$productId');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> removeWishlist(String productId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/mobile/wishlist/$productId');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<(List<MobileNotificationItem>, int)> fetchNotifications() async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/mobile/notifications',
      );
      final data = resp.data;
      if (data is Map) {
        final items = HttpRepoHelpers.parseList(
          data['items'],
          MobileNotificationItem.fromJson,
        );
        final unread = (data['unread_count'] as num?)?.toInt() ?? 0;
        return (items, unread);
      }
      return (<MobileNotificationItem>[], 0);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> markAllNotificationsRead() async {
    try {
      await _client.dio.post<dynamic>('/api/v1/mobile/notifications/read-all');
    } catch (_) {}
  }
}
