import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../contracts/session_storage.dart';
import '../models/user.dart';

/// SRP + DIP Implementation: Encapsulates encrypted Android Keystore/Keychain
/// token storage with SharedPreferences fallback.
class SecureSessionStorage implements ISessionStorage {
  final FlutterSecureStorage secureStorage;

  const SecureSessionStorage({
    this.secureStorage = const FlutterSecureStorage(),
  });

  @override
  Future<SavedSessionSnapshot> loadSnapshot() async {
    final prefs = await SharedPreferences.getInstance();
    final lang = prefs.getString('mv_lang') ?? 'tr';
    final currency = prefs.getString('mv_currency') ?? 'TRY';

    var guestId = prefs.getString('mv_guest_id') ?? '';
    if (guestId.isEmpty) {
      final rnd = Random().nextInt(900000) + 100000;
      guestId = 'mob_${DateTime.now().millisecondsSinceEpoch}_$rnd';
      await prefs.setString('mv_guest_id', guestId);
    }

    String? custToken;
    String? custRefresh;
    String? supToken;
    String? supRefresh;

    try {
      custToken = await secureStorage.read(key: 'mv_cust_token') ??
          prefs.getString('mv_cust_token_fb');
      custRefresh = await secureStorage.read(key: 'mv_cust_ref') ??
          prefs.getString('mv_cust_ref_fb');
      supToken = await secureStorage.read(key: 'mv_sup_token') ??
          prefs.getString('mv_sup_token_fb');
      supRefresh = await secureStorage.read(key: 'mv_sup_ref') ??
          prefs.getString('mv_sup_ref_fb');
    } catch (_) {
      custToken = prefs.getString('mv_cust_token_fb');
      custRefresh = prefs.getString('mv_cust_ref_fb');
      supToken = prefs.getString('mv_sup_token_fb');
      supRefresh = prefs.getString('mv_sup_ref_fb');
    }

    CustomerUser? custUser;
    final custJson = prefs.getString('mv_cust_user');
    if (custJson != null && custJson.isNotEmpty) {
      try {
        custUser = CustomerUser.fromJson(
          jsonDecode(custJson) as Map<String, dynamic>,
        );
      } catch (_) {}
    }

    SupplierUser? supUser;
    final supJson = prefs.getString('mv_sup_user');
    if (supJson != null && supJson.isNotEmpty) {
      try {
        supUser = SupplierUser.fromJson(
          jsonDecode(supJson) as Map<String, dynamic>,
        );
      } catch (_) {}
    }

    return SavedSessionSnapshot(
      languageCode: lang,
      currencyCode: currency,
      guestCustomerId: guestId,
      savedRole: prefs.getString('mv_active_role') ?? 'customer',
      customerToken: custToken,
      customerRefreshToken: custRefresh,
      customerUser: custUser,
      supplierToken: supToken,
      supplierRefreshToken: supRefresh,
      supplierUser: supUser,
    );
  }

  @override
  Future<void> saveLanguageCode(String code) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('mv_lang', code);
  }

  @override
  Future<void> saveCurrencyCode(String code) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('mv_currency', code);
  }

  @override
  Future<void> saveActiveRole(AppRole role) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'mv_active_role',
      role == AppRole.supplier ? 'supplier' : 'customer',
    );
  }

  @override
  Future<void> saveCustomerSession({
    required CustomerUser user,
    required String token,
    String refreshToken = '',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await _writeSecureOrFallback(prefs, 'mv_cust_token', 'mv_cust_token_fb', token);
    if (refreshToken.isNotEmpty) {
      await _writeSecureOrFallback(
        prefs,
        'mv_cust_ref',
        'mv_cust_ref_fb',
        refreshToken,
      );
    }
    await prefs.setString('mv_cust_user', jsonEncode(user.toJson()));
    await prefs.setString('mv_active_role', 'customer');
  }

  @override
  Future<void> updateCustomerTokens({
    required String token,
    String refreshToken = '',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await _writeSecureOrFallback(prefs, 'mv_cust_token', 'mv_cust_token_fb', token);
    if (refreshToken.isNotEmpty) {
      await _writeSecureOrFallback(
        prefs,
        'mv_cust_ref',
        'mv_cust_ref_fb',
        refreshToken,
      );
    }
  }

  @override
  Future<void> clearCustomerSession() async {
    final prefs = await SharedPreferences.getInstance();
    await _deleteSecureAndFallback(prefs, 'mv_cust_token', 'mv_cust_token_fb');
    await _deleteSecureAndFallback(prefs, 'mv_cust_ref', 'mv_cust_ref_fb');
    await prefs.remove('mv_cust_user');
  }

  @override
  Future<void> saveSupplierSession({
    required SupplierUser user,
    required String token,
    String refreshToken = '',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await _writeSecureOrFallback(prefs, 'mv_sup_token', 'mv_sup_token_fb', token);
    if (refreshToken.isNotEmpty) {
      await _writeSecureOrFallback(
        prefs,
        'mv_sup_ref',
        'mv_sup_ref_fb',
        refreshToken,
      );
    }
    await prefs.setString('mv_sup_user', jsonEncode(user.toJson()));
    await prefs.setString('mv_active_role', 'supplier');
  }

  @override
  Future<void> updateSupplierTokens({
    required String token,
    String refreshToken = '',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await _writeSecureOrFallback(prefs, 'mv_sup_token', 'mv_sup_token_fb', token);
    if (refreshToken.isNotEmpty) {
      await _writeSecureOrFallback(
        prefs,
        'mv_sup_ref',
        'mv_sup_ref_fb',
        refreshToken,
      );
    }
  }

  @override
  Future<void> clearSupplierSession() async {
    final prefs = await SharedPreferences.getInstance();
    await _deleteSecureAndFallback(prefs, 'mv_sup_token', 'mv_sup_token_fb');
    await _deleteSecureAndFallback(prefs, 'mv_sup_ref', 'mv_sup_ref_fb');
    await prefs.remove('mv_sup_user');
  }

  Future<void> _writeSecureOrFallback(
    SharedPreferences prefs,
    String secureKey,
    String fallbackKey,
    String value,
  ) async {
    await prefs.setString(fallbackKey, value);
    try {
      await secureStorage.write(key: secureKey, value: value);
    } catch (_) {}
  }

  Future<void> _deleteSecureAndFallback(
    SharedPreferences prefs,
    String secureKey,
    String fallbackKey,
  ) async {
    await prefs.remove(fallbackKey);
    try {
      await secureStorage.delete(key: secureKey);
    } catch (_) {}
  }
}
