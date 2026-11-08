import '../models/user.dart';

class SavedSessionSnapshot {
  final String languageCode;
  final String currencyCode;
  final String guestCustomerId;
  final String savedRole;
  final String? customerToken;
  final String? customerRefreshToken;
  final CustomerUser? customerUser;
  final String? supplierToken;
  final String? supplierRefreshToken;
  final SupplierUser? supplierUser;

  const SavedSessionSnapshot({
    required this.languageCode,
    required this.currencyCode,
    required this.guestCustomerId,
    required this.savedRole,
    this.customerToken,
    this.customerRefreshToken,
    this.customerUser,
    this.supplierToken,
    this.supplierRefreshToken,
    this.supplierUser,
  });
}

/// DIP Contract: Decouples SessionProvider & CartProvider from FlutterSecureStorage / SharedPreferences.
abstract interface class ISessionStorage {
  Future<SavedSessionSnapshot> loadSnapshot();

  Future<void> saveLanguageCode(String code);
  Future<void> saveCurrencyCode(String code);
  Future<void> saveActiveRole(AppRole role);

  Future<void> saveCustomerSession({
    required CustomerUser user,
    required String token,
    String refreshToken = '',
  });

  Future<void> updateCustomerTokens({
    required String token,
    String refreshToken = '',
  });

  Future<void> clearCustomerSession();

  Future<void> saveSupplierSession({
    required SupplierUser user,
    required String token,
    String refreshToken = '',
  });

  Future<void> updateSupplierTokens({
    required String token,
    String refreshToken = '',
  });

  Future<void> clearSupplierSession();
}

