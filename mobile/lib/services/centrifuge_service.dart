import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../contracts/chat_repository.dart';
import '../core/app_config.dart';

/// Pure-Dart Centrifuge v5 JSON WebSocket client implementing [IRealtimeMessagingClient].
/// Compatible with `github.com/centrifugal/centrifuge v0.40.0` embedded in Go backend.
class CentrifugeService implements IRealtimeMessagingClient {
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _socketSub;
  Timer? _reconnectTimer;

  final StreamController<RealtimePushEvent> _eventsController =
      StreamController<RealtimePushEvent>.broadcast();

  final Set<String> _desiredChannels = <String>{};
  String _clientToken = 'anon';
  int _cmdId = 1;
  bool _connected = false;
  bool _disposed = false;
  int _reconnectAttempts = 0;

  @override
  Stream<RealtimePushEvent> get events => _eventsController.stream;

  @override
  bool get isConnected => _connected;

  @override
  void connect({required String clientId}) {
    _disposed = false;
    final cleanId = clientId.trim().isEmpty ? 'anon' : clientId.trim();
    if (_connected && _clientToken == cleanId && _channel != null) {
      return;
    }
    _clientToken = cleanId;
    _openSocket();
  }

  @override
  void subscribeChannel(String channel) {
    final trimmed = channel.trim();
    if (trimmed.isEmpty) {
      return;
    }
    final added = _desiredChannels.add(trimmed);
    if (added && _connected) {
      _sendCommand({
        'id': _nextId(),
        'subscribe': {'channel': trimmed},
      });
    }
  }

  @override
  void unsubscribeChannel(String channel) {
    final trimmed = channel.trim();
    if (!_desiredChannels.remove(trimmed)) {
      return;
    }
    if (_connected) {
      _sendCommand({
        'id': _nextId(),
        'unsubscribe': {'channel': trimmed},
      });
    }
  }

  void _openSocket() {
    _cleanupSocket();
    if (_disposed) {
      return;
    }

    try {
      final uri = Uri.parse(AppConfig.wsUrl);
      final ws = WebSocketChannel.connect(uri);
      _channel = ws;

      _socketSub = ws.stream.listen(
        _handleIncomingRaw,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );

      _sendCommand({
        'id': _nextId(),
        'connect': {'token': _clientToken},
      });
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _handleIncomingRaw(dynamic rawData) {
    final text = rawData is String ? rawData : utf8.decode(rawData as List<int>);
    final lines = text.split('\n');

    for (final rawLine in lines) {
      final line = rawLine.trim();
      if (line.isEmpty) {
        continue;
      }

      if (line == '{}') {
        _sendRaw('{}\n');
        continue;
      }

      try {
        final decoded = jsonDecode(line);
        if (decoded is! Map<String, dynamic>) {
          continue;
        }
        _processDecodedFrame(decoded);
      } catch (_) {}
    }
  }

  void _processDecodedFrame(Map<String, dynamic> frame) {
    if (frame.containsKey('connect') && frame['connect'] is Map) {
      _connected = true;
      _reconnectAttempts = 0;
      for (final ch in _desiredChannels) {
        _sendCommand({
          'id': _nextId(),
          'subscribe': {'channel': ch},
        });
      }
      return;
    }

    final push = frame['push'];
    if (push is Map<String, dynamic>) {
      final channel = (push['channel'] ?? '').toString();
      final pub = push['pub'];
      if (pub is Map<String, dynamic>) {
        final payload = pub['data'];
        if (payload is Map<String, dynamic>) {
          final evtName = (payload['event'] ?? '').toString();
          final evtData = payload['data'];
          if (evtName.isNotEmpty && evtData is Map<String, dynamic>) {
            _eventsController.add(
              RealtimePushEvent(
                channel: channel,
                event: evtName,
                data: evtData,
              ),
            );
          }
        }
      }
    }
  }

  int _nextId() => _cmdId++;

  void _sendCommand(Map<String, dynamic> cmd) {
    _sendRaw('${jsonEncode(cmd)}\n');
  }

  void _sendRaw(String raw) {
    try {
      _channel?.sink.add(raw);
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _connected = false;
    _cleanupSocket();
    if (_disposed) {
      return;
    }
    _reconnectTimer?.cancel();
    final delaySec = (_reconnectAttempts < 5) ? (2 << _reconnectAttempts) : 30;
    _reconnectAttempts++;
    _reconnectTimer = Timer(Duration(seconds: delaySec), _openSocket);
  }

  void _cleanupSocket() {
    _socketSub?.cancel();
    _socketSub = null;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  @override
  void disconnect() {
    _disposed = true;
    _connected = false;
    _reconnectTimer?.cancel();
    _cleanupSocket();
  }

  @override
  void dispose() {
    disconnect();
    _eventsController.close();
  }
}
