import 'package:dio/dio.dart';

import '../contracts/auth_repository.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import 'http_repo_helpers.dart';

class HttpAuthRepository implements IAuthRepository {
  final ApiClient _client;

  const HttpAuthRepository(this._client);

  @override
  Future<Map<String, dynamic>> mobileLogin({
    required String email,
    required String password,
    required String role,
  }) async {
    try {
      final visitorId = await _client.ensureVisitorId();
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/mobile/auth/login',
        data: {
          'email': email.trim(),
          'password': password,
          'role': role,
          'visitor_id': visitorId,
        },
      );
      return resp.data ?? <String, dynamic>{};
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<Map<String, dynamic>> registerCustomer({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
    String challengeToken = '',
  }) async {
    try {
      final visitorId = await _client.ensureVisitorId();
      final resp = await HttpRepoHelpers.postWithChallenge(
        _client,
        mobilePath: '/api/v1/mobile/auth/register',
        fallbackStorePath: '/api/v1/store/auth/register',
        purpose: 'register',
        explicitChallengeToken: challengeToken,
        payload: {
          'first_name': firstName.trim(),
          'last_name': lastName.trim(),
          'email': email.trim(),
          'phone': phone.trim(),
          'password': password,
          'visitor_id': visitorId,
          'website_hp': '',
        },
      );
      return HttpRepoHelpers.asMap(resp.data);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

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
  }) async {
    try {
      await HttpRepoHelpers.postWithChallenge(
        _client,
        mobilePath: '/api/v1/mobile/supplier-applications',
        fallbackStorePath: '/api/v1/store/supplier-applications',
        purpose: 'supplier_apply',
        explicitChallengeToken: challengeToken,
        payload: {
          'company_name': companyName.trim(),
          'contact_name': contactName.trim(),
          'email': email.trim(),
          'phone': phone.trim(),
          'city': city.trim(),
          'district': district.trim(),
          if (category.trim().isNotEmpty) 'category': category.trim(),
          if (instagram.trim().isNotEmpty) 'instagram': instagram.trim(),
          if (website.trim().isNotEmpty) 'website': website.trim(),
          if (notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<Map<String, dynamic>> refreshAuthToken({
    required String refreshToken,
    String? activeBearerToken,
  }) async {
    final resp = await _client.dio.post<Map<String, dynamic>>(
      '/api/v1/mobile/auth/refresh',
      data: {'refresh_token': refreshToken},
      options: activeBearerToken != null && activeBearerToken.isNotEmpty
          ? Options(headers: {'Authorization': 'Bearer $activeBearerToken'})
          : null,
    );
    return resp.data ?? <String, dynamic>{};
  }

  @override
  Future<void> deleteAccountPermanently({
    required String bearerToken,
    String reason = '',
  }) async {
    try {
      await _client.dio.delete<dynamic>(
        '/api/v1/mobile/auth/account',
        data: {'reason': reason.trim()},
        options: Options(headers: {'Authorization': 'Bearer $bearerToken'}),
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<CustomerUser> fetchCustomerProfile() async {
    try {
      final resp = await _client.dio.get<dynamic>('/api/v1/store/profile');
      return CustomerUser.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

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
  }) async {
    try {
      await _client.dio.put<dynamic>(
        '/api/v1/store/profile',
        data: {
          'first_name': firstName.trim(),
          'last_name': lastName.trim(),
          'phone': phone.trim(),
          if (preferredLang.trim().isNotEmpty)
            'preferred_lang': preferredLang.trim(),
          if (preferredCurrency.trim().isNotEmpty)
            'preferred_currency': preferredCurrency.trim(),
          'billing_address': billingAddress.trim(),
          'delivery_address': deliveryAddress.trim(),
          'tax_no_tckn': taxNoTCKN.trim(),
          'instagram_username': instagramUsername.trim(),
        },
      );
      return await fetchCustomerProfile();
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> resendEmailVerification({String? email}) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/auth/resend-verification',
        data: {
          if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<CustomerAddress>> listCustomerAddresses() async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/profile/addresses',
      );
      return HttpRepoHelpers.parseList(resp.data, CustomerAddress.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

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
  }) async {
    var resolvedCountryId = countryId.trim();
    if (resolvedCountryId.isEmpty) {
      // Resolve matching country_id from /store/locations/countries when legacy UI passes country name.
      try {
        final countries = await listCountries();
        final needle = country.trim().toLowerCase();
        for (final c in countries) {
          if (c.nameTr.toLowerCase() == needle ||
              c.nameEn.toLowerCase() == needle ||
              c.code.toLowerCase() == needle ||
              c.id == country.trim()) {
            resolvedCountryId = c.id;
            break;
          }
        }
        if (resolvedCountryId.isEmpty && countries.isNotEmpty) {
          resolvedCountryId = countries.first.id;
        }
      } catch (_) {
        // Let backend validation return clear error if lookup fails.
      }
    }

    final addr = CustomerAddress(
      id: '',
      title: title,
      addressType: addressType,
      firstName: firstName,
      lastName: lastName,
      recipientName: recipientName,
      companyName: companyName.trim().isEmpty ? null : companyName.trim(),
      phone: phone,
      countryId: resolvedCountryId,
      stateId: stateId.trim().isEmpty ? null : stateId.trim(),
      cityId: cityId.trim().isEmpty ? null : cityId.trim(),
      addressLine: addressLine,
      city: city,
      state: state,
      country: country,
      postalCode: postalCode,
      taxNoTCKN: taxNoTCKN.trim().isEmpty ? null : taxNoTCKN.trim(),
      taxOffice: taxOffice.trim().isEmpty ? null : taxOffice.trim(),
      isDefault: isDefault,
    );
    await createCustomerAddressPayload(addr);
  }

  @override
  Future<CustomerAddress> createCustomerAddressPayload(
    CustomerAddress address,
  ) async {
    try {
      final resp = await _client.dio.post<dynamic>(
        '/api/v1/store/profile/addresses',
        data: address.toCreateJson(),
      );
      return CustomerAddress.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<CustomerAddress> updateCustomerAddress(
    String addressId,
    CustomerAddress address,
  ) async {
    try {
      final resp = await _client.dio.put<dynamic>(
        '/api/v1/store/profile/addresses/$addressId',
        data: address.toUpdateJson(),
      );
      return CustomerAddress.fromJson(HttpRepoHelpers.asMap(resp.data));
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<void> deleteCustomerAddress(String addressId) async {
    try {
      await _client.dio.delete<dynamic>(
        '/api/v1/store/profile/addresses/$addressId',
      );
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<LocationItem>> listCountries() async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/locations/countries',
      );
      return HttpRepoHelpers.parseList(resp.data, LocationItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<LocationItem>> listStatesByCountry(String countryId) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/locations/countries/$countryId/states',
      );
      return HttpRepoHelpers.parseList(resp.data, LocationItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }

  @override
  Future<List<LocationItem>> listCitiesByState(String stateId) async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/locations/states/$stateId/cities',
      );
      return HttpRepoHelpers.parseList(resp.data, LocationItem.fromJson);
    } catch (e) {
      throw ApiClient.mapError(e, lang: _client.activeLanguageCode);
    }
  }
}
