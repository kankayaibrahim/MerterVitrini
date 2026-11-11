export '../contracts/auth_repository.dart';
export '../contracts/catalog_repository.dart';
export '../contracts/chat_repository.dart';
export '../contracts/commerce_repository.dart';
export '../contracts/supplier_catalog_repository.dart';
export '../contracts/supplier_operations_repository.dart';

import '../contracts/auth_repository.dart';
import '../contracts/catalog_repository.dart';
import '../contracts/chat_repository.dart';
import '../contracts/commerce_repository.dart';
import '../contracts/supplier_catalog_repository.dart';
import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/product.dart';
import '../models/user.dart';
import '../repositories/http_auth_repository.dart';
import '../repositories/http_catalog_repository.dart';
import '../repositories/http_chat_repository.dart';
import '../repositories/http_commerce_repository.dart';
import '../repositories/http_supplier_catalog_repository.dart';
import '../repositories/http_supplier_operations_repository.dart';
import 'api_client.dart';

/// SOLID Composite Facade:
/// Composes the 6 Single-Responsibility HTTP Repositories (`ICatalogRepository`,
/// `IAuthRepository`, `ICommerceRepository`, `IChatRepository`,
/// `ISupplierCatalogRepository`, `ISupplierOperationsRepository`).
///
/// Domain providers depend strictly on their segregated interfaces (ISP + DIP),
/// while UI screens can also consume [MobileApiService] seamlessly.
class MobileApiService
    implements
        ICatalogRepository,
        IAuthRepository,
        ICommerceRepository,
        IChatRepository,
        ISupplierCatalogRepository,
        ISupplierOperationsRepository {
  final ICatalogRepository catalog;
  final IAuthRepository auth;
  final ICommerceRepository commerce;
  final IChatRepository chat;
  final ISupplierCatalogRepository supplierCatalog;
  final ISupplierOperationsRepository supplierOperations;

  factory MobileApiService(ApiClient client) {
    return MobileApiService.composed(
      catalog: HttpCatalogRepository(client),
      auth: HttpAuthRepository(client),
      commerce: HttpCommerceRepository(client),
      chat: HttpChatRepository(client),
      supplierCatalog: HttpSupplierCatalogRepository(client),
      supplierOperations: HttpSupplierOperationsRepository(client),
    );
  }

  const MobileApiService.composed({
    required this.catalog,
    required this.auth,
    required this.commerce,
    required this.chat,
    required this.supplierCatalog,
    required this.supplierOperations,
  });

  // --- ICatalogRepository ---

  @override
  Future<BootstrapPayload> fetchBootstrap() => catalog.fetchBootstrap();

  @override
  Future<CatalogQueryResult> searchProducts({
    String query = '',
    String categoryId = '',
    String brandId = '',
    String gender = '',
    String season = '',
    bool fason = false,
    bool privateLabel = false,
    String companyType = '',
    String maxMoq = '',
    String exportCountry = '',
    String sortBy = 'newest',
    int limit = 24,
    int offset = 0,
  }) =>
      catalog.searchProducts(
        query: query,
        categoryId: categoryId,
        brandId: brandId,
        gender: gender,
        season: season,
        fason: fason,
        privateLabel: privateLabel,
        companyType: companyType,
        maxMoq: maxMoq,
        exportCountry: exportCountry,
        sortBy: sortBy,
        limit: limit,
        offset: offset,
      );

  @override
  Future<Product> fetchProductDetail(String idOrSlug) =>
      catalog.fetchProductDetail(idOrSlug);

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
  }) =>
      auth.registerCustomer(
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        password: password,
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
      );

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
  Future<Map<String, Map<String, String>>> autoTranslateSupplierFields(
    Map<String, String> fields,
  ) =>
      supplierCatalog.autoTranslateSupplierFields(fields);

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
  Future<void> requestSupplierPayout(double amount) =>
      supplierOperations.requestSupplierPayout(amount);

  @override
  Future<List<SupplierAgent>> listSupplierTeam() =>
      supplierOperations.listSupplierTeam();

  @override
  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String phone = '',
    String jobTitle = 'Satış Temsilcisi',
    String spokenLanguages = 'TR',
  }) =>
      supplierOperations.createSupplierTeamMember(
        contactName: contactName,
        email: email,
        password: password,
        phone: phone,
        jobTitle: jobTitle,
        spokenLanguages: spokenLanguages,
      );

  @override
  Future<void> deleteSupplierTeamMember(String memberId) =>
      supplierOperations.deleteSupplierTeamMember(memberId);
}
