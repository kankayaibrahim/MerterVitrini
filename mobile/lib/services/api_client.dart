import 'dart:io' show Platform;
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/app_config.dart';
import '../core/localization.dart';
import '../models/user.dart';

typedef TokenLookup = Future<String?> Function();
typedef RefreshCallback = Future<String?> Function(AppRole role);

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiClient {
  static const String appVersion = '1.1.0';
  static const String _visitorPrefKey = 'mv_visitor_id_v1';

  /// Updated by [SessionProvider] so static [mapError] calls honor active locale.
  static String defaultLanguageCode = 'tr';

  late final Dio dio;
  final String _sessionId;
  String _cachedVisitorId;
  bool _visitorIdLoaded = false;

  TokenLookup? getCustomerToken;
  TokenLookup? getSupplierToken;
  AppRole Function()? getActiveRole;
  String Function()? getGuestCustomerId;
  String Function()? getCustomerDisplayName;
  String Function()? getLanguageCode;
  String Function()? getVisitorId;
  RefreshCallback? onRefreshToken;

  ApiClient({String? initialVisitorId})
    : _sessionId = _generateUuidV4(),
      _cachedVisitorId =
          (initialVisitorId != null && initialVisitorId.trim().isNotEmpty)
          ? initialVisitorId.trim()
          : _generateUuidV4() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 25),
        headers: {
          'Accept': 'application/json',
          if (!kIsWeb) 'User-Agent': userAgentString,
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (dio.options.baseUrl != AppConfig.apiBaseUrl) {
            dio.options.baseUrl = AppConfig.apiBaseUrl;
          }

          final lang = activeLanguageCode;
          defaultLanguageCode = lang;
          options.headers['Accept-Language'] = lang;

          final visitor = await _resolveVisitorId();
          options.headers['X-Visitor-Id'] = visitor;

          if (!kIsWeb && !options.headers.containsKey('User-Agent')) {
            options.headers['User-Agent'] = userAgentString;
          }

          final path = options.path;
          final useSupplierExtra = options.extra['use_supplier_token'] == true;

          if (!options.headers.containsKey('Authorization')) {
            final token = await _selectTokenForPath(
              path,
              forceSupplier: useSupplierExtra,
            );
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }

          if (path.contains('/api/v1/store/chat/')) {
            final custId = getGuestCustomerId?.call() ?? '';
            final custName = getCustomerDisplayName?.call() ?? '';
            if (custId.isNotEmpty) {
              options.headers['X-Chat-Customer-Id'] = custId;
            }
            if (custName.isNotEmpty) {
              options.headers['X-Chat-Customer-Name'] = Uri.encodeComponent(
                custName,
              );
            }
          }

          return handler.next(options);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          final path = error.requestOptions.path;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (status == 401 &&
              !alreadyRetried &&
              !path.contains('/auth/login') &&
              !path.contains('/auth/refresh') &&
              !path.contains('/auth/register')) {
            final useSupplierExtra =
                error.requestOptions.extra['use_supplier_token'] == true;
            final role = useSupplierExtra
                ? AppRole.supplier
                : _inferRoleForPath(path);
            final cb = onRefreshToken;
            if (cb != null) {
              final refreshed = await cb(role);
              if (refreshed != null && refreshed.isNotEmpty) {
                final opts = error.requestOptions;
                opts.extra['retried'] = true;
                opts.headers['Authorization'] = 'Bearer $refreshed';
                try {
                  final retryResp = await dio.fetch<dynamic>(opts);
                  return handler.resolve(retryResp);
                } catch (_) {
                  // Fall through with original 401
                }
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  static String get userAgentString {
    if (kIsWeb) {
      return 'MerterVitriniApp/$appVersion (Flutter; Web)';
    }
    return 'MerterVitriniApp/$appVersion (Flutter; ${Platform.operatingSystem})';
  }

  String get sessionId => _sessionId;

  String get visitorId {
    final override = getVisitorId?.call().trim() ?? '';
    if (override.isNotEmpty) return override;
    return _cachedVisitorId;
  }

  String get activeLanguageCode =>
      AppStrings.normalizeCode(getLanguageCode?.call() ?? defaultLanguageCode);

  Future<String> ensureVisitorId() => _resolveVisitorId();

  Future<String> _resolveVisitorId() async {
    final override = getVisitorId?.call().trim() ?? '';
    if (override.isNotEmpty) {
      _cachedVisitorId = override;
      return override;
    }
    if (_visitorIdLoaded) return _cachedVisitorId;
    _visitorIdLoaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_visitorPrefKey)?.trim() ?? '';
      if (stored.isNotEmpty) {
        _cachedVisitorId = stored;
      } else {
        await prefs.setString(_visitorPrefKey, _cachedVisitorId);
      }
    } catch (_) {
      // SharedPreferences may be unavailable in pure unit contexts; keep generated UUID.
    }
    return _cachedVisitorId;
  }

  Future<String?> _selectTokenForPath(
    String path, {
    bool forceSupplier = false,
  }) async {
    if (forceSupplier ||
        path.contains('/api/v1/supplier/') ||
        path.contains('/api/v1/mobile/supplier/')) {
      return await getSupplierToken?.call();
    }
    if (path.contains('/api/v1/store/')) {
      return await getCustomerToken?.call();
    }
    final active = getActiveRole?.call() ?? AppRole.customer;
    if (active == AppRole.supplier) {
      return await getSupplierToken?.call();
    }
    return await getCustomerToken?.call();
  }

  AppRole _inferRoleForPath(String path) {
    if (path.contains('/api/v1/supplier/') ||
        path.contains('/api/v1/mobile/supplier/')) {
      return AppRole.supplier;
    }
    if (path.contains('/api/v1/store/')) {
      return AppRole.customer;
    }
    return getActiveRole?.call() ?? AppRole.customer;
  }

  /// Downloads raw binary files (e.g. order `.xlsx` or image `.zip`) via GET.
  Future<Uint8List> getBytes(
    String path, {
    Map<String, dynamic>? queryParameters,
    bool useSupplierToken = false,
  }) async {
    try {
      final res = await dio.get<List<int>>(
        path,
        queryParameters: queryParameters,
        options: Options(
          responseType: ResponseType.bytes,
          extra: {
            if (useSupplierToken) 'use_supplier_token': true,
          },
        ),
      );
      return Uint8List.fromList(res.data ?? const <int>[]);
    } catch (e) {
      throw mapError(e, lang: activeLanguageCode);
    }
  }

  /// Downloads raw binary files (e.g. cart `.xlsx` export) via POST.
  Future<Uint8List> postBytes(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    bool useSupplierToken = false,
  }) async {
    try {
      final res = await dio.post<List<int>>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: Options(
          responseType: ResponseType.bytes,
          extra: {
            if (useSupplierToken) 'use_supplier_token': true,
          },
        ),
      );
      return Uint8List.fromList(res.data ?? const <int>[]);
    } catch (e) {
      throw mapError(e, lang: activeLanguageCode);
    }
  }

  /// Fetches a short-lived HMAC-SHA256 mobile challenge token for anti-bot endpoints.
  /// Returns `null` if the server responds 404/405 or challenge is unavailable.
  Future<String?> fetchMobileChallenge({String? purpose}) async {
    try {
      final cleanPurpose = purpose?.trim() ?? '';
      final res = await dio.get<dynamic>(
        '/api/v1/mobile/challenge',
        queryParameters: {
          if (cleanPurpose.isNotEmpty) 'purpose': cleanPurpose,
        },
      );
      final data = res.data;
      if (data is Map) {
        final token =
            (data['challenge_token'] ?? data['token'] ?? '').toString().trim();
        return token.isEmpty ? null : token;
      }
      return null;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 404 || status == 405) return null;
      rethrow;
    }
  }

  static String _generateUuidV4() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int start, int end) => bytes
        .sublist(start, end)
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
  }

  static ApiException mapError(Object error, {String? lang}) {
    if (error is ApiException) {
      return error;
    }
    final langCode = AppStrings.normalizeCode(lang ?? defaultLanguageCode);
    if (error is DioException) {
      final status = error.response?.statusCode;
      final data = error.response?.data;
      if (data is Map) {
        final msg = data['error'] ?? data['message'];
        if (msg != null && msg.toString().trim().isNotEmpty) {
          return ApiException(msg.toString().trim(), statusCode: status);
        }
      }
      if (status == 401) {
        return ApiException(
          AppStrings.t(langCode, 'err_unauthorized'),
          statusCode: status,
        );
      }
      if (status == 400 || status == 422) {
        return ApiException(
          AppStrings.t(langCode, 'err_validation'),
          statusCode: status,
        );
      }
      if (status == 404) {
        return ApiException(
          AppStrings.t(langCode, 'err_not_found'),
          statusCode: status,
        );
      }
      if (status != null && status >= 500) {
        return ApiException(
          AppStrings.t(langCode, 'err_server'),
          statusCode: status,
        );
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout) {
        return ApiException(
          AppStrings.t(langCode, 'err_timeout'),
          statusCode: status,
        );
      }
      if (error.type == DioExceptionType.connectionError) {
        return ApiException(
          AppStrings.t(langCode, 'err_connection'),
          statusCode: status,
        );
      }
      return ApiException(
        AppStrings.t(langCode, 'err_unexpected'),
        statusCode: status,
      );
    }
    return ApiException(error.toString());
  }
}
