import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../services/api_client.dart';

class HttpSupplierOperationsRepository implements ISupplierOperationsRepository {
  final ApiClient _client;

  const HttpSupplierOperationsRepository(this._client);

  @override
  Future<Map<String, dynamic>> fetchSupplierDashboard() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/mobile/supplier/dashboard',
      );
      return resp.data ?? <String, dynamic>{};
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<SupplierSubOrder>> listSupplierSubOrders({
    String status = 'ALL',
  }) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/orders',
        queryParameters: {'status': status, 'limit': 50},
      );
      return _parseList(resp.data?['orders'], SupplierSubOrder.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<SupplierSubOrder> fetchSupplierSubOrderDetail(
    String subOrderId,
  ) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/orders/$subOrderId',
      );
      return SupplierSubOrder.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> updateSupplierSubOrderStatus({
    required String subOrderId,
    required String status,
    String trackingCompany = '',
    String trackingNumber = '',
    String notes = '',
  }) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/supplier/orders/$subOrderId/status',
        data: {
          'status': status,
          'tracking_company': trackingCompany.trim(),
          'tracking_number': trackingNumber.trim(),
          'notes': notes.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<(SupplierWallet, List<SupplierLedgerEntry>)>
      fetchSupplierWallet() async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/wallet',
      );
      final data = resp.data ?? <String, dynamic>{};
      final wallet = data['wallet'] is Map<String, dynamic>
          ? SupplierWallet.fromJson(data['wallet'] as Map<String, dynamic>)
          : const SupplierWallet();
      final ledger = _parseList(data['ledger'], SupplierLedgerEntry.fromJson);
      return (wallet, ledger);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> updateSupplierIban({
    required String iban,
    required String bankName,
    required String accountHolder,
  }) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/supplier/wallet/iban',
        data: {
          'iban': iban.trim(),
          'bank_name': bankName.trim(),
          'bank_account_holder': accountHolder.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> requestSupplierPayout(double amount) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/supplier/payouts',
        data: {'amount': amount},
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<SupplierAgent>> listSupplierTeam() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/team');
      return _parseList(resp.data, SupplierAgent.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String phone = '',
    String jobTitle = 'Satış Temsilcisi',
    String spokenLanguages = 'TR',
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/supplier/team',
        data: {
          'contact_name': contactName.trim(),
          'email': email.trim(),
          'password': password,
          'phone': phone.trim(),
          'job_title': jobTitle.trim(),
          'spoken_languages': spokenLanguages.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<void> deleteSupplierTeamMember(String memberId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/supplier/team/$memberId');
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  List<T> _parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) mapper,
  ) {
    final result = <T>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) {
          result.add(mapper(item));
        }
      }
    }
    return result;
  }
}

