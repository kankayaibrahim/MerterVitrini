import 'package:dio/dio.dart';

import '../services/api_client.dart';

/// Shared HTTP repository utilities to avoid duplicate JSON list/challenge logic.
class HttpRepoHelpers {
  HttpRepoHelpers._();

  static List<T> parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) mapper,
  ) {
    final result = <T>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) {
          result.add(mapper(item));
        } else if (item is Map) {
          result.add(mapper(item.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }
    return result;
  }

  static Map<String, dynamic> asMap(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return <String, dynamic>{};
  }

  static Map<String, double> parseExchangeRates(dynamic raw) {
    final rates = <String, double>{'TRY': 1.0};
    if (raw is List) {
      for (final r in raw) {
        if (r is Map) {
          final code =
              (r['currency_code'] ?? '').toString().toUpperCase().trim();
          final rateRaw = r['buying_rate'];
          final rate = rateRaw is num
              ? rateRaw.toDouble()
              : double.tryParse((rateRaw ?? '0').toString()) ?? 0.0;
          if (code.isNotEmpty && rate > 0) {
            rates[code] = rate;
          }
        }
      }
    } else if (raw is Map) {
      raw.forEach((k, v) {
        final code = k.toString().toUpperCase().trim();
        final rate = v is num
            ? v.toDouble()
            : double.tryParse((v ?? '0').toString()) ?? 0.0;
        if (code.isNotEmpty && rate > 0) {
          rates[code] = rate;
        }
      });
    }
    return rates;
  }

  /// Obtains a short-lived HMAC challenge token for native mobile anti-bot forms,
  /// sends both `X-Mobile-Challenge` and body challenge fields, and falls back
  /// cleanly to [fallbackStorePath] only when [mobilePath] returns 404/405.
  static Future<Response<dynamic>> postWithChallenge(
    ApiClient client, {
    required String mobilePath,
    required String fallbackStorePath,
    required String purpose,
    required Map<String, dynamic> payload,
    String explicitChallengeToken = '',
  }) async {
    var challenge = explicitChallengeToken.trim();
    if (challenge.isEmpty) {
      try {
        challenge = (await client.fetchMobileChallenge(purpose: purpose)) ?? '';
      } catch (_) {
        // Challenge fetch failure will be handled on submit or fallback.
      }
    }

    final body = Map<String, dynamic>.from(payload);
    if (challenge.isNotEmpty) {
      body['challenge_token'] = challenge;
      body['form_challenge_token'] = challenge;
    }

    try {
      return await client.dio.post<dynamic>(
        mobilePath,
        data: body,
        options: Options(
          headers: {
            if (challenge.isNotEmpty) 'X-Mobile-Challenge': challenge,
          },
        ),
      );
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 404 || status == 405) {
        return client.dio.post<dynamic>(fallbackStorePath, data: body);
      }
      rethrow;
    }
  }
}
