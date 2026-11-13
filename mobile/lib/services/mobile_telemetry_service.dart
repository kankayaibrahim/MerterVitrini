import 'api_client.dart';

/// Non-blocking Business Intelligence & funnel telemetry client (`analytics.go`,
/// `member_journey_tracker.go`, `brand_analytics.go`).
class MobileTelemetryService {
  final ApiClient _client;
  final String Function()? getCurrency;
  bool enabled;

  MobileTelemetryService(
    this._client, {
    this.getCurrency,
    this.enabled = true,
  });

  String get _currency => getCurrency?.call() ?? 'TRY';

  Future<Map<String, dynamic>> _baseIdentity({bool includeToken = true}) async {
    final visitorId = await _client.ensureVisitorId();
    final token = includeToken ? await _client.getCustomerToken?.call() : null;
    return {
      'visitor_id': visitorId,
      'session_id': _client.sessionId,
      if (token != null && token.trim().isNotEmpty) 'auth_token': token.trim(),
      'language': _client.activeLanguageCode,
    };
  }

  /// Records a screen/page view via `POST /api/v1/store/track`.
  Future<void> trackScreenView({
    required String path,
    String pageTitle = '',
    String referrer = 'mobile_app',
    int screenWidth = 390,
    int screenHeight = 844,
  }) async {
    if (!enabled) return;
    try {
      final base = await _baseIdentity();
      await _client.dio.post<dynamic>(
        '/api/v1/store/track',
        data: {
          ...base,
          'page_title': pageTitle,
          'url': 'app://mertervitrini$path',
          'path': path,
          'referrer': referrer,
          'screen_width': screenWidth,
          'screen_height': screenHeight,
          'viewport_width': screenWidth,
          'viewport_height': screenHeight,
          'currency': _currency,
        },
      );
    } catch (_) {
      // Telemetry must never surface errors to the UI.
    }
  }

  /// Records customer funnel events via `POST /api/v1/store/member-events`.
  Future<void> trackMemberEvent({
    required String eventType,
    String eventCategory = 'mobile',
    String title = '',
    String subtitle = '',
    String urlPath = '',
    String entityType = '',
    String entityId = '',
    String imageUrl = '',
    String queryText = '',
    String categorySlug = '',
    int resultsCount = 0,
    bool hasFilters = false,
    String clickedProductId = '',
    Map<String, dynamic>? metadata,
  }) async {
    if (!enabled) return;
    try {
      final base = await _baseIdentity();
      await _client.dio.post<dynamic>(
        '/api/v1/store/member-events',
        data: {
          ...base,
          'event_type': eventType,
          'event_category': eventCategory,
          if (title.isNotEmpty) 'title': title,
          if (subtitle.isNotEmpty) 'subtitle': subtitle,
          if (urlPath.isNotEmpty) 'url_path': urlPath,
          if (entityType.isNotEmpty) 'entity_type': entityType,
          if (entityId.isNotEmpty) 'entity_id': entityId,
          if (imageUrl.isNotEmpty) 'image_url': imageUrl,
          if (queryText.isNotEmpty) 'query_text': queryText,
          if (categorySlug.isNotEmpty) 'category_slug': categorySlug,
          if (resultsCount > 0) 'results_count': resultsCount,
          if (hasFilters) 'has_filters': true,
          if (clickedProductId.isNotEmpty)
            'clicked_product_id': clickedProductId,
          if (metadata != null && metadata.isNotEmpty) 'metadata': metadata,
        },
      );
    } catch (_) {
      // Non-blocking telemetry.
    }
  }

  /// Records manufacturer profile/product/WhatsApp/phone interactions via `POST /api/v1/store/brand-events`.
  Future<void> trackBrandEvent({
    required String brandId,
    required String eventType,
    String productId = '',
  }) async {
    if (!enabled || brandId.trim().isEmpty) return;
    try {
      final base = await _baseIdentity();
      await _client.dio.post<dynamic>(
        '/api/v1/store/brand-events',
        data: {
          'brand_id': brandId.trim(),
          if (productId.trim().isNotEmpty) 'product_id': productId.trim(),
          'event_type': eventType.trim(),
          'visitor_id': base['visitor_id'],
          if (base['auth_token'] != null) 'auth_token': base['auth_token'],
          'language': base['language'],
        },
      );
    } catch (_) {
      // Non-blocking telemetry.
    }
  }

  /// Records catalog search queries & clicks via `POST /api/v1/store/search-events`.
  Future<void> trackSearchEvent({
    required String queryText,
    String eventType = 'search_result',
    String categorySlug = '',
    int resultsCount = 0,
    bool hasFilters = false,
    String clickedProductId = '',
  }) async {
    if (!enabled || queryText.trim().isEmpty) return;
    try {
      final base = await _baseIdentity();
      await _client.dio.post<dynamic>(
        '/api/v1/store/search-events',
        data: {
          ...base,
          'event_type': eventType,
          'query_text': queryText.trim(),
          if (categorySlug.isNotEmpty) 'category_slug': categorySlug,
          'results_count': resultsCount,
          'has_filters': hasFilters,
          if (clickedProductId.isNotEmpty)
            'clicked_product_id': clickedProductId,
        },
      );
    } catch (_) {
      // Non-blocking telemetry.
    }
  }
}
