class AppConfig {
  AppConfig._();

  static const String defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://mertervitrini.com.tr',
  );

  static String _runtimeBaseUrl = defaultBaseUrl;

  static String get apiBaseUrl => _runtimeBaseUrl;

  static void setRuntimeBaseUrl(String url) {
    final trimmed = url.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.isNotEmpty) {
      _runtimeBaseUrl = trimmed;
    }
  }

  static String get wsUrl {
    const customWs = String.fromEnvironment('WS_URL', defaultValue: '');
    if (customWs.isNotEmpty) {
      return customWs;
    }
    final base = _runtimeBaseUrl;
    if (base.startsWith('https://')) {
      return '${base.replaceFirst('https://', 'wss://')}/api/v1/chat/ws';
    }
    if (base.startsWith('http://')) {
      return '${base.replaceFirst('http://', 'ws://')}/api/v1/chat/ws';
    }
    return 'wss://mertervitrini.com.tr/api/v1/chat/ws';
  }

  static String resolveMediaUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) {
      return '';
    }
    final url = rawUrl.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return '$_runtimeBaseUrl$url';
    }
    return '$_runtimeBaseUrl/$url';
  }

  static const String appName = 'Merter Vitrini';
  static const String packageId = 'com.mertervitrini.app';
  static const String privacyPolicyUrl =
      'https://mertervitrini.com.tr/policies/privacy_policy';
  static const String termsUrl =
      'https://mertervitrini.com.tr/policies/terms_of_service';
  static const String accountDeletionUrl =
      'https://mertervitrini.com.tr/account-deletion';
}

