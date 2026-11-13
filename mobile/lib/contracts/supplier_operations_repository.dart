import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/marketplace.dart';
import '../models/user.dart';

/// ISP Contract: Supplier KPI Dashboard, Sub-Orders, Analytics, Editorial Profile, Billing, Payouts, RFQs & Team.
abstract interface class ISupplierOperationsRepository {
  Future<Map<String, dynamic>> fetchSupplierDashboard();

  Future<List<SupplierSubOrder>> listSupplierSubOrders({
    String status = 'ALL',
  });

  Future<SupplierSubOrder> fetchSupplierSubOrderDetail(String subOrderId);

  Future<void> updateSupplierSubOrderStatus({
    required String subOrderId,
    required String status,
    String trackingCompany = '',
    String trackingNumber = '',
    String notes = '',
  });

  Future<SupplierEditorialProfile> fetchSupplierEditorialProfile();

  Future<void> updateSupplierEditorialProfile(
    SupplierEditorialProfile profile, {
    bool quickWhatsappOnly = false,
  });

  Future<SupplierAnalyticsOverview> fetchSupplierAnalytics({
    String period = '30d',
  });

  Future<SupplierBillingOverview> fetchSupplierBilling();

  Future<void> updateSupplierBillingTaxInfo(SupplierTaxInfoPayload payload);

  Future<void> submitSupplierSubscriptionPayment(
    SupplierWirePaymentPayload payload,
  );

  Future<(SupplierWallet, List<SupplierLedgerEntry>)> fetchSupplierWallet();

  Future<void> updateSupplierIban({
    required String iban,
    required String bankName,
    required String accountHolder,
  });

  Future<List<SupplierPayoutItem>> listSupplierPayoutRequests();

  Future<void> requestSupplierPayout(double amount);

  Future<List<RfqItem>> listSupplierRfqs();

  Future<RfqOfferItem> submitSupplierRfqOffer({
    required String rfqId,
    required SubmitRfqOfferPayload payload,
  });

  Future<List<SupplierAgent>> listSupplierTeam();

  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String jobTitle = '',
    String phone = '',
    String spokenLanguages = 'tr',
  });

  Future<void> deleteSupplierTeamMember(String memberId);
}
