import '../contracts/supplier_operations_repository.dart';
import '../models/cart_and_order.dart';
import '../models/chat.dart';
import '../models/marketplace.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      return HttpRepoHelpers.parseList(
        resp.data?['orders'],
        SupplierSubOrder.fromJson,
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<SupplierSubOrder> fetchSupplierSubOrderDetail(String subOrderId) async {
    try {
      final resp = await _client.dio.get<Map<String, dynamic>>(
        '/api/v1/supplier/orders/$subOrderId',
      );
      return SupplierSubOrder.fromJson(resp.data ?? <String, dynamic>{});
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<SupplierEditorialProfile> fetchSupplierEditorialProfile() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/profile');
      return SupplierEditorialProfile.fromJson(
        HttpRepoHelpers.asMap(resp.data),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> updateSupplierEditorialProfile(
    SupplierEditorialProfile profile, {
    bool quickWhatsappOnly = false,
  }) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/supplier/profile',
        data: profile.toUpdateJson(quickWhatsappOnly: quickWhatsappOnly),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<SupplierAnalyticsOverview> fetchSupplierAnalytics({
    String period = '30d',
  }) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/supplier/analytics',
        queryParameters: {'period': period},
      );
      return SupplierAnalyticsOverview.fromJson(
        HttpRepoHelpers.asMap(resp.data),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<SupplierBillingOverview> fetchSupplierBilling() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/billing');
      return SupplierBillingOverview.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> updateSupplierBillingTaxInfo(
    SupplierTaxInfoPayload payload,
  ) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/supplier/billing/tax-info',
        data: payload.toJson(),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> submitSupplierSubscriptionPayment(
    SupplierWirePaymentPayload payload,
  ) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/supplier/billing/payments',
        data: payload.toJson(),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      final wallet = SupplierWallet.fromJson(
        HttpRepoHelpers.asMap(data['wallet']),
      );
      final ledger = HttpRepoHelpers.parseList(
        data['ledger'],
        SupplierLedgerEntry.fromJson,
      );
      return (wallet, ledger);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<SupplierPayoutItem>> listSupplierPayoutRequests() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/payouts');
      return HttpRepoHelpers.parseList(resp.data, SupplierPayoutItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<RfqItem>> listSupplierRfqs() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/rfqs');
      return HttpRepoHelpers.parseList(resp.data, RfqItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<RfqOfferItem> submitSupplierRfqOffer({
    required String rfqId,
    required SubmitRfqOfferPayload payload,
  }) async {
    try {
      final resp = await _client.dio.post<dynamic>(
        '/api/v1/supplier/rfqs/$rfqId/offers',
        data: payload.toJson(),
      );
      final map = HttpRepoHelpers.asMap(resp.data);
      final offerMap = map['offer'] is Map<String, dynamic>
          ? map['offer'] as Map<String, dynamic>
          : map;
      return RfqOfferItem.fromJson(offerMap);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<SupplierAgent>> listSupplierTeam() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/supplier/team');
      return HttpRepoHelpers.parseList(resp.data, SupplierAgent.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String jobTitle = '',
    String phone = '',
    String spokenLanguages = 'tr',
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
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> deleteSupplierTeamMember(String memberId) async {
    try {
      await _client.dio.delete<dynamic>('/api/v1/supplier/team/$memberId');
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }
}
