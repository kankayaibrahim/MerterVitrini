import 'package:dio/dio.dart';

import '../contracts/auth_repository.dart';
import '../models/user.dart';
import '../services/api_client.dart';

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
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/mobile/auth/login',
        data: {
          'email': email.trim(),
          'password': password,
          'role': role,
        },
      );
      return resp.data ?? <String, dynamic>{};
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Map<String, dynamic>> registerCustomer({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      final resp = await _client.dio.post<Map<String, dynamic>>(
        '/api/v1/store/auth/register',
        data: {
          'first_name': firstName.trim(),
          'last_name': lastName.trim(),
          'email': email.trim(),
          'phone': phone.trim(),
          'password': password,
        },
      );
      return resp.data ?? <String, dynamic>{};
    } catch (e) {
      throw ApiClient.mapError(e);
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
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/supplier-applications',
        data: {
          'company_name': companyName.trim(),
          'contact_name': contactName.trim(),
          'email': email.trim(),
          'phone': phone.trim(),
          'city': city.trim(),
          'district': district.trim(),
          'category': category.trim(),
          'instagram': instagram.trim(),
          'website': website.trim(),
          'notes': notes.trim(),
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<Map<String, dynamic>> refreshAuthToken({
    required String refreshToken,
    String? activeBearerToken,
  }) async {
    final headers = <String, dynamic>{};
    if (activeBearerToken != null && activeBearerToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $activeBearerToken';
    }
    final resp = await _client.dio.post<Map<String, dynamic>>(
      '/api/v1/mobile/auth/refresh',
      data: {'refresh_token': refreshToken},
      options: Options(headers: headers),
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
      throw ApiClient.mapError(e);
    }
  }

  @override
  Future<List<CustomerAddress>> listCustomerAddresses() async {
    try {
      final resp = await _client.dio.get<dynamic>(
        '/api/v1/store/profile/addresses',
      );
      final list = <CustomerAddress>[];
      final raw = resp.data;
      if (raw is List) {
        for (final item in raw) {
          if (item is Map<String, dynamic>) {
            list.add(CustomerAddress.fromJson(item));
          }
        }
      }
      return list;
    } catch (e) {
      throw ApiClient.mapError(e);
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
  }) async {
    try {
      await _client.dio.post<dynamic>(
        '/api/v1/store/profile/addresses',
        data: {
          'title': title,
          'recipient_name': recipientName,
          'phone': phone,
          'address_line': addressLine,
          'city': city,
          'state': state,
          'country': country,
          'postal_code': postalCode,
          'is_default': true,
        },
      );
    } catch (e) {
      throw ApiClient.mapError(e);
    }
  }
}

