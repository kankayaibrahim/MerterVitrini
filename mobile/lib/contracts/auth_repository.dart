import '../models/user.dart';

/// ISP Contract: Authentication, Registration, Account Lifecycle & Customer Address Book.
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
    String challengeToken = '',
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
    String challengeToken = '',
  });

  Future<Map<String, dynamic>> refreshAuthToken({
    required String refreshToken,
    String? activeBearerToken,
  });

  Future<void> deleteAccountPermanently({
    required String bearerToken,
    String reason = '',
  });

  Future<CustomerUser> fetchCustomerProfile();

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
  });

  Future<void> resendEmailVerification({String? email});

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
  });

  Future<CustomerAddress> createCustomerAddressPayload(CustomerAddress address);

  Future<CustomerAddress> updateCustomerAddress(
    String addressId,
    CustomerAddress address,
  );

  Future<void> deleteCustomerAddress(String addressId);

  Future<List<LocationItem>> listCountries();

  Future<List<LocationItem>> listStatesByCountry(String countryId);

  Future<List<LocationItem>> listCitiesByState(String stateId);
}
