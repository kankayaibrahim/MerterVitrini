import 'package:dio/dio.dart';

import '../contracts/chat_repository.dart';
import '../models/chat.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

class HttpChatRepository implements IChatRepository {
  final ApiClient _client;

  const HttpChatRepository(this._client);

  @override
  Future<List<SupplierAgent>> listBrandAgents(String brandId) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/chat/brands/$brandId/agents',
      );
      return HttpRepoHelpers.parseList(resp.data, SupplierAgent.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<ChatRoom> initOrGetCustomerRoom({
    required String brandId,
    String supplierUserId = '',
    String productId = '',
    required String customerId,
    required String customerName,
    String customerEmail = '',
    String customerPhone = '',
  }) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/store/chat/rooms',
        data: {
          'brand_id': brandId,
          'supplier_user_id': supplierUserId,
          'product_id': productId,
          'customer_id': customerId,
          'customer_name': customerName,
          'customer_email': customerEmail,
          'customer_phone': customerPhone,
        },
      );
      return ChatRoom.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<ChatRoom>> listCustomerChatRooms() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/chat/rooms');
      return HttpRepoHelpers.parseList(resp.data, ChatRoom.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<ChatRoom>> listSupplierChatRooms({String scope = 'all'}) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/supplier/chat/rooms',
        queryParameters: {'scope': scope},
      );
      return HttpRepoHelpers.parseList(resp.data, ChatRoom.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<ChatMessage>> listRoomMessages({
    required String roomId,
    required bool asSupplier,
  }) async {
    try {
      final endpoint = asSupplier
          ? '/api/v1/supplier/chat/rooms/$roomId/messages'
          : '/api/v1/store/chat/rooms/$roomId/messages';
      final resp = await _client.dio.get<dynamic>(endpoint);
      return HttpRepoHelpers.parseList(resp.data, ChatMessage.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<String> uploadChatPhoto(String filePath) async {
    try {
      final form = FormData.fromMap({
        'image': await MultipartFile.fromFile(filePath),
      });
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/mobile/chat/upload-image',
        data: form,
      );
      return (resp.data?['image_url'] ?? '').toString();
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<ChatMessage> sendCustomerChatMessage({
    required String roomId,
    required String customerId,
    required String customerName,
    required String content,
    String imageUrl = '',
  }) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/store/chat/rooms/$roomId/messages',
        data: {
          'customer_id': customerId,
          'customer_name': customerName,
          'message_type': imageUrl.isNotEmpty ? 'image' : 'text',
          'image_url': imageUrl,
          'content': content,
        },
      );
      return ChatMessage.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<ChatMessage> sendSupplierChatMessage({
    required String roomId,
    required String messageType,
    String content = '',
    String imageUrl = '',
    String productId = '',
    int packagesQty = 1,
    double offeredUnitPrice = 0.0,
    double discountPercent = 0.0,
  }) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/supplier/chat/rooms/$roomId/messages',
        data: {
          'message_type': messageType,
          'image_url': imageUrl,
          'content': content,
          'product_id': productId,
          'packages_qty': packagesQty,
          'offered_unit_price': offeredUnitPrice,
          'discount_percent': discountPercent,
        },
      );
      return ChatMessage.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<ChatMessage> acceptCustomOffer(String messageId) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/store/chat/messages/$messageId/accept-offer',
      );
      final msgData = resp.data?['message'];
      if (msgData is Map<String, dynamic>) {
        return ChatMessage.fromJson(msgData);
      }
      throw const ApiException('Teklif yanıtı çözümlenemedi.');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

}

