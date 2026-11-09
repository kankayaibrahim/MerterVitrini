import 'dart:async';

import 'package:flutter/foundation.dart';

import '../contracts/chat_repository.dart';
import '../models/chat.dart';
import '../services/centrifuge_service.dart';
import 'session_provider.dart';

/// ISP + DIP Compliant Chat State Manager:
/// Depends on [IChatRepository] and [IRealtimeMessagingClient] abstractions.
class ChatProvider extends ChangeNotifier {
  final IChatRepository api;
  final SessionProvider session;
  final IRealtimeMessagingClient _realtimeClient;

  StreamSubscription<RealtimePushEvent>? _wsSub;

  List<ChatRoom> _customerRooms = <ChatRoom>[];
  List<ChatRoom> _supplierRooms = <ChatRoom>[];
  String _supplierScope = 'all';

  String? _activeRoomId;
  List<ChatMessage> _activeMessages = <ChatMessage>[];
  bool _loadingRooms = false;
  bool _loadingMessages = false;
  bool _sending = false;

  ChatProvider({
    required this.api,
    required this.session,
    IRealtimeMessagingClient? realtimeClient,
  }) : _realtimeClient = realtimeClient ?? CentrifugeService() {
    _wsSub = _realtimeClient.events.listen(_onRealtimePush);
  }

  List<ChatRoom> get customerRooms => _customerRooms;
  List<ChatRoom> get supplierRooms => _supplierRooms;
  String get supplierScope => _supplierScope;
  List<ChatMessage> get activeMessages => _activeMessages;
  bool get loadingRooms => _loadingRooms;
  bool get loadingMessages => _loadingMessages;
  bool get sending => _sending;
  bool get isRealtimeConnected => _realtimeClient.isConnected;

  int get totalCustomerUnread => _customerRooms.fold<int>(
        0,
        (sum, r) => sum + r.unreadCustomerCount,
      );

  int get totalSupplierUnread => _supplierRooms.fold<int>(
        0,
        (sum, r) => sum + r.unreadSupplierCount,
      );

  void syncRealtimeConnection() {
    if (session.isSupplierMode && session.isSupplierLoggedIn) {
      final sup = session.supplierUser!;
      _realtimeClient.connect(clientId: sup.id);
      _realtimeClient.subscribeChannel('chat:supplier#${sup.brandId}');
      _realtimeClient.subscribeChannel('chat:supplier_user#${sup.id}');
    } else if (session.isCustomerLoggedIn) {
      final cid = session.effectiveChatCustomerId;
      _realtimeClient.connect(clientId: cid);
      _realtimeClient.subscribeChannel('chat:customer#$cid');
    }
  }

  Future<void> loadRoomsForCurrentRole() async {
    if (!session.isSupplierLoggedIn && !session.isCustomerLoggedIn) {
      _customerRooms = <ChatRoom>[];
      notifyListeners();
      return;
    }
    syncRealtimeConnection();
    _loadingRooms = true;
    notifyListeners();
    try {
      if (session.isSupplierMode && session.isSupplierLoggedIn) {
        _supplierRooms = await api.listSupplierChatRooms(scope: _supplierScope);
      } else {
        _customerRooms = await api.listCustomerChatRooms();
      }
    } catch (_) {
      // Keep existing list on transient offline error
    } finally {
      _loadingRooms = false;
      notifyListeners();
    }
  }

  Future<void> setSupplierScope(String scope) async {
    _supplierScope = scope;
    await loadRoomsForCurrentRole();
  }

  Future<ChatRoom> startCustomerProductOrBrandChat({
    required String brandId,
    String supplierUserId = '',
    String productId = '',
  }) async {
    syncRealtimeConnection();
    final cust = session.customerUser;
    final room = await api.initOrGetCustomerRoom(
      brandId: brandId,
      supplierUserId: supplierUserId,
      productId: productId,
      customerId: session.effectiveChatCustomerId,
      customerName: session.effectiveCustomerDisplayName,
      customerEmail: cust?.email ?? '',
      customerPhone: cust?.phone ?? '',
    );
    await loadRoomsForCurrentRole();
    return room;
  }

  Future<void> openRoom(String roomId) async {
    syncRealtimeConnection();
    if (_activeRoomId != null && _activeRoomId != roomId) {
      _realtimeClient.unsubscribeChannel('chat:room#$_activeRoomId');
    }
    _activeRoomId = roomId;
    _realtimeClient.subscribeChannel('chat:room#$roomId');

    _loadingMessages = true;
    notifyListeners();
    try {
      _activeMessages = await api.listRoomMessages(
        roomId: roomId,
        asSupplier: session.isSupplierMode && session.isSupplierLoggedIn,
      );
    } finally {
      _loadingMessages = false;
      notifyListeners();
    }
  }

  void closeActiveRoom() {
    if (_activeRoomId != null) {
      _realtimeClient.unsubscribeChannel('chat:room#$_activeRoomId');
      _activeRoomId = null;
    }
  }

  Future<void> sendTextMessage(String roomId, String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      return;
    }
    _sending = true;
    notifyListeners();
    try {
      final ChatMessage sent;
      if (session.isSupplierMode && session.isSupplierLoggedIn) {
        sent = await api.sendSupplierChatMessage(
          roomId: roomId,
          messageType: 'text',
          content: trimmed,
        );
      } else {
        sent = await api.sendCustomerChatMessage(
          roomId: roomId,
          customerId: session.effectiveChatCustomerId,
          customerName: session.effectiveCustomerDisplayName,
          content: trimmed,
        );
      }
      _appendOrUpdateMessage(sent);
    } finally {
      _sending = false;
      notifyListeners();
    }
  }

  Future<void> sendPhotoMessage(
    String roomId,
    String localFilePath, {
    String caption = '',
  }) async {
    _sending = true;
    notifyListeners();
    try {
      final uploadedUrl = await api.uploadChatPhoto(localFilePath);
      if (uploadedUrl.isEmpty) {
        return;
      }
      final ChatMessage sent;
      if (session.isSupplierMode && session.isSupplierLoggedIn) {
        sent = await api.sendSupplierChatMessage(
          roomId: roomId,
          messageType: 'image',
          imageUrl: uploadedUrl,
          content: caption.trim(),
        );
      } else {
        sent = await api.sendCustomerChatMessage(
          roomId: roomId,
          customerId: session.effectiveChatCustomerId,
          customerName: session.effectiveCustomerDisplayName,
          content: caption.trim(),
          imageUrl: uploadedUrl,
        );
      }
      _appendOrUpdateMessage(sent);
    } finally {
      _sending = false;
      notifyListeners();
    }
  }

  Future<void> sendSupplierCustomOffer({
    required String roomId,
    required String productId,
    required int packagesQty,
    double offeredUnitPrice = 0.0,
    double discountPercent = 0.0,
    String note = '',
  }) async {
    _sending = true;
    notifyListeners();
    try {
      final sent = await api.sendSupplierChatMessage(
        roomId: roomId,
        messageType: 'custom_offer',
        productId: productId,
        packagesQty: packagesQty,
        offeredUnitPrice: offeredUnitPrice,
        discountPercent: discountPercent,
        content: note.trim(),
      );
      _appendOrUpdateMessage(sent);
    } finally {
      _sending = false;
      notifyListeners();
    }
  }

  Future<ChatMessage> acceptOfferAsCustomer(String messageId) async {
    final updated = await api.acceptCustomOffer(messageId);
    _appendOrUpdateMessage(updated);
    return updated;
  }

  void _onRealtimePush(RealtimePushEvent evt) {
    if (evt.event == 'new_message' || evt.event == 'offer_updated') {
      final msg = ChatMessage.fromJson(evt.data);
      if (_activeRoomId != null && msg.roomId == _activeRoomId) {
        _appendOrUpdateMessage(msg);
      }
      loadRoomsForCurrentRole();
    } else if (evt.event == 'room_updated') {
      loadRoomsForCurrentRole();
    }
  }

  void _appendOrUpdateMessage(ChatMessage msg) {
    final idx = _activeMessages.indexWhere((m) => m.id == msg.id);
    if (idx >= 0) {
      _activeMessages[idx] = msg;
    } else {
      _activeMessages = [..._activeMessages, msg];
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _realtimeClient.dispose();
    super.dispose();
  }
}
