import '../models/user.dart';

/// ISP Contract: Unified Customer/Supplier Authentication, Addresses & Account Deletion.
abstract interface class IAuthRepository {
  Future<Map<String, dynamic>> mobileLogin({
    required String email,
    required String password,
    required String role,
  });

  Future<Map<String, dynamic>> registerCustomer({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  });

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
  });

  Future<Map<String, dynamic>> refreshAuthToken({
    required String refreshToken,
    String? activeBearerToken,
  });

  Future<void> deleteAccountPermanently({
    required String bearerToken,
    String reason = '',
  });

  Future<List<CustomerAddress>> listCustomerAddresses();

  Future<void> createCustomerAddress({
    required String title,
    required String recipientName,
    required String phone,
    required String addressLine,
    required String city,
    required String state,
    required String country,
    String postalCode = '',
  });
}

