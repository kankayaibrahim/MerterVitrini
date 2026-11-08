import 'dart:async';

import '../models/chat.dart';

class RealtimePushEvent {
  final String channel;
  final String event;
  final Map<String, dynamic> data;

  const RealtimePushEvent({
    required this.channel,
    required this.event,
    required this.data,
  });
}

/// DIP Contract: Decouples ChatProvider from concrete WebSocket/Centrifuge transport.
abstract interface class IRealtimeMessagingClient {
  Stream<RealtimePushEvent> get events;
  bool get isConnected;

  void connect({required String clientId});
  void subscribeChannel(String channel);
  void unsubscribeChannel(String channel);
  void disconnect();
  void dispose();
}

/// ISP Contract: B2B Customer & Supplier Chat REST operations.
abstract interface class IChatRepository {
  Future<List<SupplierAgent>> listBrandAgents(String brandId);

  Future<ChatRoom> initOrGetCustomerRoom({
    required String brandId,
    String supplierUserId = '',
    String productId = '',
    required String customerId,
    required String customerName,
    String customerEmail = '',
    String customerPhone = '',
  });

  Future<List<ChatRoom>> listCustomerChatRooms();

  Future<List<ChatRoom>> listSupplierChatRooms({String scope = 'all'});

  Future<List<ChatMessage>> listRoomMessages({
    required String roomId,
    required bool asSupplier,
  });

  Future<String> uploadChatPhoto(String filePath);

  Future<ChatMessage> sendCustomerChatMessage({
    required String roomId,
    required String customerId,
    required String customerName,
    required String content,
    String imageUrl = '',
  });

  Future<ChatMessage> sendSupplierChatMessage({
    required String roomId,
    required String messageType,
    String content = '',
    String imageUrl = '',
    String productId = '',
    int packagesQty = 1,
    double offeredUnitPrice = 0.0,
    double discountPercent = 0.0,
  });

  Future<ChatMessage> acceptCustomOffer(String messageId);
}

