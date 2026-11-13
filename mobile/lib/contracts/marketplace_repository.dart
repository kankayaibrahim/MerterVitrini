import '../models/marketplace.dart';

/// ISP Contract: B2B RFQ Board, Direct Inquiries, Ecosystem Service Providers,
/// Sponsored Showcases, Newsletter & Storefront Editorial Content (Blog, CMS, Policies).
abstract interface class IMarketplaceRepository {
  Future<List<RfqItem>> listPublicRfqs();

  Future<RfqItem> createPublicRfq(CreateRfqPayload payload);

  Future<DirectInquiryResponse> submitDirectInquiry(
    DirectInquiryPayload payload,
  );

  Future<List<ServiceProviderItem>> listServiceProviders({
    String category = '',
    String query = '',
  });

  Future<Map<String, dynamic>> submitServiceProviderApplication(
    ServiceProviderSubmission payload,
  );

  Future<void> trackServiceProviderClick(String providerId);

  Future<List<SponsoredSlotItem>> listSponsoredSlots({
    String placement = '',
    String categorySlug = '',
  });

  Future<void> trackSponsoredSlotClick(String slotId);

  Future<void> subscribeNewsletter(NewsletterSubscribePayload payload);

  Future<CmsPageItem> fetchCmsPageBySlug(String slug);

  Future<LegalPolicyItem> fetchActivePolicy(String policyType);

  Future<List<BlogPostItem>> listBlogPosts();

  Future<BlogPostItem> fetchBlogPostBySlug(String slug);
}
