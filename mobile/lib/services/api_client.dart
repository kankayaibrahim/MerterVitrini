import 'package:dio/dio.dart';

import '../core/app_config.dart';
import '../models/user.dart';

typedef TokenLookup = String? Function();
typedef RefreshCallback = Future<String?> Function(AppRole role);

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiClient {
  late final Dio dio;

  TokenLookup? getCustomerToken;
  TokenLookup? getSupplierToken;
  AppRole Function()? getActiveRole;
  String Function()? getGuestCustomerId;
  String Function()? getCustomerDisplayName;
  RefreshCallback? onRefreshToken;

  bool _isRefreshing = false;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 40),
        headers: const {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          options.baseUrl = AppConfig.apiBaseUrl;
          final path = options.path;

          if (!options.headers.containsKey('Authorization')) {
            final token = _selectTokenForPath(path);
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }

          if (path.contains('/store/chat') ||
              path.contains('/mobile/chat/upload-image')) {
            final custId = getGuestCustomerId?.call() ?? '';
            final custName = getCustomerDisplayName?.call() ?? '';
            if (custId.isNotEmpty) {
              options.headers['X-Chat-Customer-Id'] = custId;
            }
            if (custName.isNotEmpty) {
              options.headers['X-Chat-Customer-Name'] =
                  Uri.encodeComponent(custName);
            }
          }

          handler.next(options);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          final path = error.requestOptions.path;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (status == 401 &&
              !alreadyRetried &&
              !_isRefreshing &&
              !path.contains('/auth/login') &&
              !path.contains('/auth/refresh') &&
              onRefreshToken != null) {
            _isRefreshing = true;
            try {
              final targetRole = _inferRoleForPath(path);
              final refreshed = await onRefreshToken!(targetRole);
              _isRefreshing = false;
              if (refreshed != null && refreshed.isNotEmpty) {
                final opts = error.requestOptions;
                opts.extra['retried'] = true;
                opts.headers['Authorization'] = 'Bearer $refreshed';
                final retryResp = await dio.fetch<dynamic>(opts);
                return handler.resolve(retryResp);
              }
            } catch (_) {
              _isRefreshing = false;
            }
          }

          handler.next(error);
        },
      ),
    );
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

  String? _selectTokenForPath(String path) {
    final role = _inferRoleForPath(path);
    if (role == AppRole.supplier) {
      return getSupplierToken?.call();
    }
    return getCustomerToken?.call();
  }

  static ApiException mapError(Object error) {
    if (error is ApiException) {
      return error;
    }
    if (error is DioException) {
      final status = error.response?.statusCode;
      final data = error.response?.data;
      if (data is Map<String, dynamic>) {
        final msg = data['error'] ?? data['message'];
        if (msg != null && msg.toString().trim().isNotEmpty) {
          return ApiException(msg.toString(), statusCode: status);
        }
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return ApiException(
          'Sunucu yanıt süresi aşıldı. İnternet bağlantınızı kontrol edin.',
          statusCode: status,
        );
      }
      if (error.type == DioExceptionType.connectionError) {
        return ApiException(
          'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.',
          statusCode: status,
        );
      }
      return ApiException(
        'İşlem sırasında bir hata oluştu (${status ?? 'Ağ Hatası'}).',
        statusCode: status,
      );
    }
    return ApiException(error.toString());
  }
}

