import 'dart:typed_data';

import '../contracts/auth_repository.dart';
import '../contracts/catalog_repository.dart';
import '../contracts/chat_repository.dart';
import '../contracts/commerce_repository.dart';
import '../contracts/marketplace_repository.dart';
import '../contracts/supplier_catalog_repository.dart';
import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/marketplace.dart';
import '../models/product.dart';
import '../models/user.dart';
import '../repositories/http_auth_repository.dart';
import '../repositories/http_catalog_repository.dart';
import '../repositories/http_chat_repository.dart';
import '../repositories/http_commerce_repository.dart';
import '../repositories/http_marketplace_repository.dart';
import '../repositories/http_supplier_catalog_repository.dart';
import '../repositories/http_supplier_operations_repository.dart';
import 'api_client.dart';

/// Unified SOLID facade composing segregated ISP HTTP repositories.
class MobileApiService
    implements
        ICatalogRepository,
        IAuthRepository,
        ICommerceRepository,
        IChatRepository,
        ISupplierCatalogRepository,
        ISupplierOperationsRepository,
        IMarketplaceRepository {
  final ICatalogRepository catalog;
  final IAuthRepository auth;
  final ICommerceRepository commerce;
  final IChatRepository chat;
  final ISupplierCatalogRepository supplierCatalog;
  final ISupplierOperationsRepository supplierOperations;
  final IMarketplaceRepository marketplace;

  MobileApiService.composed({
    required this.catalog,
    required this.auth,
    required this.commerce,
    required this.chat,
    required this.supplierCatalog,
    required this.supplierOperations,
    IMarketplaceRepository? marketplace,
  }) : marketplace = marketplace ?? HttpMarketplaceRepository(ApiClient());

  factory MobileApiService(ApiClient client) {
    return MobileApiService.composed(
      catalog: HttpCatalogRepository(client),
      auth: HttpAuthRepository(client),
      commerce: HttpCommerceRepository(client),
      chat: HttpChatRepository(client),
      supplierCatalog: HttpSupplierCatalogRepository(client),
      supplierOperations: HttpSupplierOperationsRepository(client),
      marketplace: HttpMarketplaceRepository(client),
    );
  }

  // --- ICatalogRepository ---
  @override
  Future<BootstrapPayload> fetchBootstrap() => catalog.fetchBootstrap();

  @override
  Future<CatalogQueryResult> searchCatalog(
    CatalogFilterParams filter, {
    int limit = 24,
    int offset = 0,
    String? lang,
  }) =>
      catalog.searchCatalog(filter, limit: limit, offset: offset, lang: lang);

  @override
  Future<CatalogQueryResult> searchProducts({
    String query = '',
    String categoryId = '',
    String brandId = '',
    String brandSlug = '',
    String gender = '',
    String season = '',
    bool fason = false,
    bool privateLabel = false,
    String companyType = '',
    String maxMoq = '',
    String exportCountry = '',
    String sortBy = 'newest',
    double? minPrice,
    double? maxPrice,
    String displayCurrency = '',
    Map<String, List<String>> attributeFilters = const {},
    String lang = '',
    int limit = 24,
    int offset = 0,
  }) =>
      catalog.searchProducts(
        query: query,
        categoryId: categoryId,
        brandId: brandId,
        brandSlug: brandSlug,
        gender: gender,
        season: season,
        fason: fason,
        privateLabel: privateLabel,
        companyType: companyType,
        maxMoq: maxMoq,
        exportCountry: exportCountry,
        sortBy: sortBy,
        minPrice: minPrice,
        maxPrice: maxPrice,
        displayCurrency: displayCurrency,
        attributeFilters: attributeFilters,
        lang: lang,
        limit: limit,
        offset: offset,
      );

  @override
  Future<Product> fetchProductDetail(String idOrSlug) =>
      catalog.fetchProductDetail(idOrSlug);

  @override
  Future<List<CatalogAttributeGroup>> listStoreAttributes() =>
      catalog.listStoreAttributes();

  @override
  Future<List<ManufacturerSummary>> listManufacturers() =>
      catalog.listManufacturers();

  @override
  Future<ManufacturerDetail> fetchManufacturerDetail(String slugOrId) =>
      catalog.fetchManufacturerDetail(slugOrId);

  // --- IAuthRepository ---
  @override
  Future<Map<String, dynamic>> mobileLogin({
    required String email,
    required String password,
    required String role,
  }) =>
      auth.mobileLogin(email: email, password: password, role: role);

  @override
  Future<Map<String, dynamic>> registerCustomer({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
    String challengeToken = '',
  }) =>
      auth.registerCustomer(
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        password: password,
        challengeToken: challengeToken,
      );

  @override
  Future<void> submitSupplierApplication({
    required String companyName,
    required String contactName,
    required String email,
    required String phone,
    required String city,
    required String district,
    String category = '',
    String instagram = '',
    String website = '',
    String notes = '',
    String challengeToken = '',
  }) =>
      auth.submitSupplierApplication(
        companyName: companyName,
        contactName: contactName,
        email: email,
        phone: phone,
        city: city,
        district: district,
        category: category,
        instagram: instagram,
        website: website,
        notes: notes,
        challengeToken: challengeToken,
      );

  @override
  Future<Map<String, dynamic>> refreshAuthToken({
    required String refreshToken,
    String? activeBearerToken,
  }) =>
      auth.refreshAuthToken(
        refreshToken: refreshToken,
        activeBearerToken: activeBearerToken,
      );

  @override
  Future<void> deleteAccountPermanently({
    required String bearerToken,
    String reason = '',
  }) =>
      auth.deleteAccountPermanently(bearerToken: bearerToken, reason: reason);

  @override
  Future<CustomerUser> fetchCustomerProfile() => auth.fetchCustomerProfile();

  @override
  Future<CustomerUser> updateCustomerProfile({
    required String firstName,
    required String lastName,
    required String phone,
    String preferredLang = '',
    String preferredCurrency = '',
    String billingAddress = '',
    String deliveryAddress = '',
    String taxNoTCKN = '',
    String instagramUsername = '',
  }) =>
      auth.updateCustomerProfile(
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        preferredLang: preferredLang,
        preferredCurrency: preferredCurrency,
        billingAddress: billingAddress,
        deliveryAddress: deliveryAddress,
        taxNoTCKN: taxNoTCKN,
        instagramUsername: instagramUsername,
      );

  @override
  Future<void> resendEmailVerification({String? email}) =>
      auth.resendEmailVerification(email: email);

  @override
  Future<List<CustomerAddress>> listCustomerAddresses() =>
      auth.listCustomerAddresses();

  @override
  Future<void> createCustomerAddress({
    required String title,
    required String recipientName,
    required String phone,
    required String addressLine,
    required String city,
    required String state,
    required String country,
    String postalCode = '',
    String addressType = 'shipping',
    String firstName = '',
    String lastName = '',
    String companyName = '',
    String countryId = '',
    String stateId = '',
    String cityId = '',
    String taxNoTCKN = '',
    String taxOffice = '',
    bool isDefault = false,
  }) =>
      auth.createCustomerAddress(
        title: title,
        recipientName: recipientName,
        phone: phone,
        addressLine: addressLine,
        city: city,
        state: state,
        country: country,
        postalCode: postalCode,
        addressType: addressType,
        firstName: firstName,
        lastName: lastName,
        companyName: companyName,
        countryId: countryId,
        stateId: stateId,
        cityId: cityId,
        taxNoTCKN: taxNoTCKN,
        taxOffice: taxOffice,
        isDefault: isDefault,
      );

  @override
  Future<CustomerAddress> createCustomerAddressPayload(
    CustomerAddress address,
  ) =>
      auth.createCustomerAddressPayload(address);

  @override
  Future<CustomerAddress> updateCustomerAddress(
    String addressId,
    CustomerAddress address,
  ) =>
      auth.updateCustomerAddress(addressId, address);

  @override
  Future<void> deleteCustomerAddress(String addressId) =>
      auth.deleteCustomerAddress(addressId);

  @override
  Future<List<LocationItem>> listCountries() => auth.listCountries();

  @override
  Future<List<LocationItem>> listStatesByCountry(String countryId) =>
      auth.listStatesByCountry(countryId);

  @override
  Future<List<LocationItem>> listCitiesByState(String stateId) =>
      auth.listCitiesByState(stateId);

  // --- ICommerceRepository ---
  @override
  Future<List<CartItem>> fetchServerCart() => commerce.fetchServerCart();

  @override
  Future<void> addServerCartItem({
    required String productId,
    required int totalUnitsQuantity,
  }) =>
      commerce.addServerCartItem(
        productId: productId,
        totalUnitsQuantity: totalUnitsQuantity,
      );

  @override
  Future<void> updateServerCartItem({
    required String itemId,
    required int totalUnitsQuantity,
  }) =>
      commerce.updateServerCartItem(
        itemId: itemId,
        totalUnitsQuantity: totalUnitsQuantity,
      );

  @override
  Future<void> removeServerCartItem(String itemId) =>
      commerce.removeServerCartItem(itemId);

  @override
  Future<void> clearServerCart() => commerce.clearServerCart();

  @override
  Future<void> syncServerCart(List<CartItem> items) =>
      commerce.syncServerCart(items);

  @override
  Future<Uint8List> exportCartExcel({
    required String lang,
    required String displayCurrency,
    required List<CartItem> items,
  }) =>
      commerce.exportCartExcel(
        lang: lang,
        displayCurrency: displayCurrency,
        items: items,
      );

  @override
  Future<Map<String, dynamic>> createOrder({
    required String billingAddress,
    required String deliveryAddress,
    String paymentMethod = 'BANK_TRANSFER',
  }) =>
      commerce.createOrder(
        billingAddress: billingAddress,
        deliveryAddress: deliveryAddress,
        paymentMethod: paymentMethod,
      );

  @override
  Future<List<CustomerOrder>> listCustomerOrders() =>
      commerce.listCustomerOrders();

  @override
  Future<OrderDetailModel> fetchOrderDetail(String orderId) =>
      commerce.fetchOrderDetail(orderId);

  @override
  Future<void> submitPaymentNotification({
    required String orderId,
    required String senderName,
    required String bankName,
    required double amount,
    String notes = '',
  }) =>
      commerce.submitPaymentNotification(
        orderId: orderId,
        senderName: senderName,
        bankName: bankName,
        amount: amount,
        notes: notes,
      );

  @override
  Future<void> cancelCustomerOrder(String orderId) =>
      commerce.cancelCustomerOrder(orderId);

  @override
  Future<void> requestOrderRefund({
    required String orderId,
    required OrderRefundPayload payload,
  }) =>
      commerce.requestOrderRefund(orderId: orderId, payload: payload);

  @override
  Future<Uint8List> downloadOrderExcel(String orderId) =>
      commerce.downloadOrderExcel(orderId);

  @override
  Future<Uint8List> downloadOrderImagesZip(String orderId) =>
      commerce.downloadOrderImagesZip(orderId);

  @override
  Future<List<Product>> fetchWishlist() => commerce.fetchWishlist();

  @override
  Future<void> addWishlist(String productId) => commerce.addWishlist(productId);

  @override
  Future<void> removeWishlist(String productId) =>
      commerce.removeWishlist(productId);

  @override
  Future<(List<MobileNotificationItem>, int)> fetchNotifications() =>
      commerce.fetchNotifications();

  @override
  Future<void> markAllNotificationsRead() =>
      commerce.markAllNotificationsRead();

  // --- IChatRepository ---
  @override
  Future<List<SupplierAgent>> listBrandAgents(String brandId) =>
      chat.listBrandAgents(brandId);

  @override
  Future<ChatRoom> initOrGetCustomerRoom({
    required String brandId,
    String supplierUserId = '',
    String productId = '',
    required String customerId,
    required String customerName,
    String customerEmail = '',
    String customerPhone = '',
  }) =>
      chat.initOrGetCustomerRoom(
        brandId: brandId,
        supplierUserId: supplierUserId,
        productId: productId,
        customerId: customerId,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
      );

  @override
  Future<List<ChatRoom>> listCustomerChatRooms() =>
      chat.listCustomerChatRooms();

  @override
  Future<List<ChatRoom>> listSupplierChatRooms({String scope = 'all'}) =>
      chat.listSupplierChatRooms(scope: scope);

  @override
  Future<List<ChatMessage>> listRoomMessages({
    required String roomId,
    required bool asSupplier,
  }) =>
      chat.listRoomMessages(roomId: roomId, asSupplier: asSupplier);

  @override
  Future<String> uploadChatPhoto(String filePath) =>
      chat.uploadChatPhoto(filePath);

  @override
  Future<ChatMessage> sendCustomerChatMessage({
    required String roomId,
    required String customerId,
    required String customerName,
    required String content,
    String imageUrl = '',
  }) =>
      chat.sendCustomerChatMessage(
        roomId: roomId,
        customerId: customerId,
        customerName: customerName,
        content: content,
        imageUrl: imageUrl,
      );

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
  }) =>
      chat.sendSupplierChatMessage(
        roomId: roomId,
        messageType: messageType,
        content: content,
        imageUrl: imageUrl,
        productId: productId,
        packagesQty: packagesQty,
        offeredUnitPrice: offeredUnitPrice,
        discountPercent: discountPercent,
      );

  @override
  Future<ChatMessage> acceptCustomOffer(String messageId) =>
      chat.acceptCustomOffer(messageId);

  // --- ISupplierCatalogRepository ---
  @override
  Future<(List<Product>, int)> listSupplierProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
    int limit = 30,
    int offset = 0,
  }) =>
      supplierCatalog.listSupplierProducts(
        query: query,
        status: status,
        categoryId: categoryId,
        limit: limit,
        offset: offset,
      );

  @override
  Future<Product> fetchSupplierProductDetail(String productId) =>
      supplierCatalog.fetchSupplierProductDetail(productId);

  @override
  Future<List<String>> uploadSupplierProductPhotos(List<String> localPaths) =>
      supplierCatalog.uploadSupplierProductPhotos(localPaths);

  @override
  Future<String> createSupplierProduct(Map<String, dynamic> payload) =>
      supplierCatalog.createSupplierProduct(payload);

  @override
  Future<void> updateSupplierProduct(
    String productId,
    Map<String, dynamic> payload,
  ) =>
      supplierCatalog.updateSupplierProduct(productId, payload);

  @override
  Future<void> quickUpdateSupplierProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
    int? seriesStock,
  }) =>
      supplierCatalog.quickUpdateSupplierProduct(
        productId: productId,
        price: price,
        buyingPrice: buyingPrice,
        isActive: isActive,
        stock: stock,
        seriesStock: seriesStock,
      );

  @override
  Future<void> deleteSupplierProduct(String productId) =>
      supplierCatalog.deleteSupplierProduct(productId);

  @override
  Future<void> toggleArchiveProduct({
    required String productId,
    required bool isArchived,
    bool restoreActive = false,
  }) =>
      supplierCatalog.toggleArchiveProduct(
        productId: productId,
        isArchived: isArchived,
        restoreActive: restoreActive,
      );

  @override
  Future<int> bulkArchiveProducts({
    List<String> productIds = const [],
    bool isArchived = true,
    bool restoreActive = false,
    String season = '',
    int? olderThanDays,
    bool zeroStockOnly = false,
  }) =>
      supplierCatalog.bulkArchiveProducts(
        productIds: productIds,
        isArchived: isArchived,
        restoreActive: restoreActive,
        season: season,
        olderThanDays: olderThanDays,
        zeroStockOnly: zeroStockOnly,
      );

  @override
  Future<String> findSupplierProductByCode(String code) =>
      supplierCatalog.findSupplierProductByCode(code);

  @override
  Future<List<SimpleOptionItem>> fetchSupplierCategories() =>
      supplierCatalog.fetchSupplierCategories();

  @override
  Future<(List<SimpleOptionItem>, List<SimpleOptionItem>)>
      fetchSupplierAttributes() => supplierCatalog.fetchSupplierAttributes();

  @override
  Future<SupplierAttributesBundle> fetchSupplierAttributeBundle() =>
      supplierCatalog.fetchSupplierAttributeBundle();

  @override
  Future<SupplierProductTranslationMap> fetchSupplierProductTranslations(
    String productId,
  ) =>
      supplierCatalog.fetchSupplierProductTranslations(productId);

  @override
  Future<void> updateSupplierProductTranslations(
    String productId,
    Map<String, SupplierProductTranslationEntry> translations,
  ) =>
      supplierCatalog.updateSupplierProductTranslations(
        productId,
        translations,
      );

  @override
  Future<Map<String, Map<String, String>>> autoTranslateSupplierFields(
    Map<String, String> fields, {
    String sourceLang = 'tr',
    List<String>? targetLangs,
  }) =>
      supplierCatalog.autoTranslateSupplierFields(
        fields,
        sourceLang: sourceLang,
        targetLangs: targetLangs,
      );

  // --- ISupplierOperationsRepository ---
  @override
  Future<Map<String, dynamic>> fetchSupplierDashboard() =>
      supplierOperations.fetchSupplierDashboard();

  @override
  Future<List<SupplierSubOrder>> listSupplierSubOrders({
    String status = 'ALL',
  }) =>
      supplierOperations.listSupplierSubOrders(status: status);

  @override
  Future<SupplierSubOrder> fetchSupplierSubOrderDetail(String subOrderId) =>
      supplierOperations.fetchSupplierSubOrderDetail(subOrderId);

  @override
  Future<void> updateSupplierSubOrderStatus({
    required String subOrderId,
    required String status,
    String trackingCompany = '',
    String trackingNumber = '',
    String notes = '',
  }) =>
      supplierOperations.updateSupplierSubOrderStatus(
        subOrderId: subOrderId,
        status: status,
        trackingCompany: trackingCompany,
        trackingNumber: trackingNumber,
        notes: notes,
      );

  @override
  Future<SupplierEditorialProfile> fetchSupplierEditorialProfile() =>
      supplierOperations.fetchSupplierEditorialProfile();

  @override
  Future<void> updateSupplierEditorialProfile(
    SupplierEditorialProfile profile, {
    bool quickWhatsappOnly = false,
  }) =>
      supplierOperations.updateSupplierEditorialProfile(
        profile,
        quickWhatsappOnly: quickWhatsappOnly,
      );

  @override
  Future<SupplierAnalyticsOverview> fetchSupplierAnalytics({
    String period = '30d',
  }) =>
      supplierOperations.fetchSupplierAnalytics(period: period);

  @override
  Future<SupplierBillingOverview> fetchSupplierBilling() =>
      supplierOperations.fetchSupplierBilling();

  @override
  Future<void> updateSupplierBillingTaxInfo(SupplierTaxInfoPayload payload) =>
      supplierOperations.updateSupplierBillingTaxInfo(payload);

  @override
  Future<void> submitSupplierSubscriptionPayment(
    SupplierWirePaymentPayload payload,
  ) =>
      supplierOperations.submitSupplierSubscriptionPayment(payload);

  @override
  Future<(SupplierWallet, List<SupplierLedgerEntry>)> fetchSupplierWallet() =>
      supplierOperations.fetchSupplierWallet();

  @override
  Future<void> updateSupplierIban({
    required String iban,
    required String bankName,
    required String accountHolder,
  }) =>
      supplierOperations.updateSupplierIban(
        iban: iban,
        bankName: bankName,
        accountHolder: accountHolder,
      );

  @override
  Future<List<SupplierPayoutItem>> listSupplierPayoutRequests() =>
      supplierOperations.listSupplierPayoutRequests();

  @override
  Future<void> requestSupplierPayout(double amount) =>
      supplierOperations.requestSupplierPayout(amount);

  @override
  Future<List<RfqItem>> listSupplierRfqs() =>
      supplierOperations.listSupplierRfqs();

  @override
  Future<RfqOfferItem> submitSupplierRfqOffer({
    required String rfqId,
    required SubmitRfqOfferPayload payload,
  }) =>
      supplierOperations.submitSupplierRfqOffer(rfqId: rfqId, payload: payload);

  @override
  Future<List<SupplierAgent>> listSupplierTeam() =>
      supplierOperations.listSupplierTeam();

  @override
  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String jobTitle = '',
    String phone = '',
    String spokenLanguages = 'tr',
  }) =>
      supplierOperations.createSupplierTeamMember(
        contactName: contactName,
        email: email,
        password: password,
        jobTitle: jobTitle,
        phone: phone,
        spokenLanguages: spokenLanguages,
      );

  @override
  Future<void> deleteSupplierTeamMember(String memberId) =>
      supplierOperations.deleteSupplierTeamMember(memberId);

  // --- IMarketplaceRepository ---
  @override
  Future<List<RfqItem>> listPublicRfqs() => marketplace.listPublicRfqs();

  @override
  Future<RfqItem> createPublicRfq(CreateRfqPayload payload) =>
      marketplace.createPublicRfq(payload);

  @override
  Future<DirectInquiryResponse> submitDirectInquiry(
    DirectInquiryPayload payload,
  ) =>
      marketplace.submitDirectInquiry(payload);

  @override
  Future<List<ServiceProviderItem>> listServiceProviders({
    String category = '',
    String query = '',
  }) =>
      marketplace.listServiceProviders(category: category, query: query);

  @override
  Future<Map<String, dynamic>> submitServiceProviderApplication(
    ServiceProviderSubmission payload,
  ) =>
      marketplace.submitServiceProviderApplication(payload);

  @override
  Future<void> trackServiceProviderClick(String providerId) =>
      marketplace.trackServiceProviderClick(providerId);

  @override
  Future<List<SponsoredSlotItem>> listSponsoredSlots({
    String placement = '',
    String categorySlug = '',
  }) =>
      marketplace.listSponsoredSlots(
        placement: placement,
        categorySlug: categorySlug,
      );

  @override
  Future<void> trackSponsoredSlotClick(String slotId) =>
      marketplace.trackSponsoredSlotClick(slotId);

  @override
  Future<void> subscribeNewsletter(NewsletterSubscribePayload payload) =>
      marketplace.subscribeNewsletter(payload);

  @override
  Future<CmsPageItem> fetchCmsPageBySlug(String slug) =>
      marketplace.fetchCmsPageBySlug(slug);

  @override
  Future<LegalPolicyItem> fetchActivePolicy(String policyType) =>
      marketplace.fetchActivePolicy(policyType);

  @override
  Future<List<BlogPostItem>> listBlogPosts() => marketplace.listBlogPosts();

  @override
  Future<BlogPostItem> fetchBlogPostBySlug(String slug) =>
      marketplace.fetchBlogPostBySlug(slug);
}
