import '../contracts/marketplace_repository.dart';
import '../models/marketplace.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

class HttpMarketplaceRepository implements IMarketplaceRepository {
  final ApiClient _client;

  const HttpMarketplaceRepository(this._client);

  @override
  Future<List<RfqItem>> listPublicRfqs() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/rfqs');
      return HttpRepoHelpers.parseList(resp.data, RfqItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<RfqItem> createPublicRfq(CreateRfqPayload payload) async {
    try {
      final resp = await _client.dio.post<dynamic>(
        '/api/v1/store/rfqs',
        data: payload.toJson(),
      );
      return RfqItem.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<DirectInquiryResponse> submitDirectInquiry(
    DirectInquiryPayload payload,
  ) async {
    try {
      final resp = await HttpRepoHelpers.postWithChallenge(
        _client,
        mobilePath: '/api/v1/store/inquiries',
        fallbackStorePath: '/api/v1/store/inquiries',
        purpose: 'submit_inquiry',
        payload: payload.toJson(),
      );
      return DirectInquiryResponse.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<ServiceProviderItem>> listServiceProviders({
    String category = '',
    String query = '',
  }) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/service-providers',
        queryParameters: {
          if (category.trim().isNotEmpty) 'category': category.trim(),
          if (query.trim().isNotEmpty) 'q': query.trim(),
        },
      );
      return HttpRepoHelpers.parseList(resp.data, ServiceProviderItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<Map<String, dynamic>> submitServiceProviderApplication(
    ServiceProviderSubmission payload,
  ) async {
    try {
      final resp = await HttpRepoHelpers.postWithChallenge(
        _client,
        mobilePath: '/api/v1/mobile/service-providers',
        fallbackStorePath: '/api/v1/store/service-providers',
        purpose: 'service_provider_apply',
        payload: payload.toJson(),
      );
      return HttpRepoHelpers.asMap(resp.data);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> trackServiceProviderClick(String providerId) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/service-providers/${providerId.trim()}/click',
      );
    } catch (_) {
      // Click tracking is non-blocking.
    }
  }

  @override
  Future<List<SponsoredSlotItem>> listSponsoredSlots({
    String placement = '',
    String categorySlug = '',
  }) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/sponsored-slots',
        queryParameters: {
          if (placement.trim().isNotEmpty) 'placement': placement.trim(),
          if (categorySlug.trim().isNotEmpty)
            'category_slug': categorySlug.trim(),
        },
      );
      return HttpRepoHelpers.parseList(resp.data, SponsoredSlotItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> trackSponsoredSlotClick(String slotId) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/sponsored-slots/${slotId.trim()}/click',
      );
    } catch (_) {
      // Click tracking is non-blocking.
    }
  }

  @override
  Future<void> subscribeNewsletter(NewsletterSubscribePayload payload) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/newsletter/subscribe',
        data: payload.toJson(),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<CmsPageItem> fetchCmsPageBySlug(String slug) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/pages/${slug.trim()}',
      );
      return CmsPageItem.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<LegalPolicyItem> fetchActivePolicy(String policyType) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/policies/${policyType.trim()}/active',
      );
      return LegalPolicyItem.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<BlogPostItem>> listBlogPosts() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/blog');
      return HttpRepoHelpers.parseList(resp.data, BlogPostItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<BlogPostItem> fetchBlogPostBySlug(String slug) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/blog/${slug.trim()}',
      );
      return BlogPostItem.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }
}
