import '../models/cart_and_order.dart';
import '../models/chat.dart';

/// ISP Contract: Supplier KPI Dashboard, Sub-Orders, Payout Wallet & Sales Team.
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

  Future<(SupplierWallet, List<SupplierLedgerEntry>)> fetchSupplierWallet();

  Future<void> updateSupplierIban({
    required String iban,
    required String bankName,
    required String accountHolder,
  });

  Future<void> requestSupplierPayout(double amount);

  Future<List<SupplierAgent>> listSupplierTeam();

  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String phone = '',
    String jobTitle = 'Satış Temsilcisi',
    String spokenLanguages = 'TR',
  });

  Future<void> deleteSupplierTeamMember(String memberId);
}

