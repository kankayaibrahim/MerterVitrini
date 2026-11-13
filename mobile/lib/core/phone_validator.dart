import 'localization.dart';

class PhoneValidationResult {
  final bool isValid;
  final String normalized;
  final String errorKey;
  final String? errorMessage;

  const PhoneValidationResult({
    required this.isValid,
    this.normalized = '',
    this.errorKey = '',
    this.errorMessage,
  });

  bool get valid => isValid;

  String localizedError(String langCode) {
    if (isValid) return '';
    if (errorKey.isNotEmpty) {
      return AppStrings.t(langCode, errorKey);
    }
    return errorMessage ?? '';
  }
}

/// Validates and normalizes international & Turkish phone numbers without
/// embedding hardcoded UI prose. Matches backend `pkg/phoneutil` rules.
class PhoneValidator {
  PhoneValidator._();

  static const Set<String> _fakeNumberSet = <String>{
    '0000000000',
    '1111111111',
    '1234567890',
    '9876543210',
    '5555555555',
    '5000000000',
    '5050000000',
    '5320000000',
    '5330000000',
    '5420000000',
    '5551234567',
    '5321234567',
    '5301234567',
    '5421234567',
    '5550000000',
    '5551112233',
    '5001112233',
    '5321112233',
    '5331112233',
    '5421112233',
    '5555551212',
    '5551231212',
    '5001234567',
    '5051234567',
    '5351234567',
    '5431234567',
    '5441234567',
    '905555555555',
    '905551234567',
    '905321234567',
    '905000000000',
    '905550000000',
    '905551112233',
  };

  static const Set<String> _blockedPrefixes = <String>{
    '000',
    '111',
    '222',
    '333',
    '444',
    '555',
    '666',
    '777',
    '888',
    '999',
  };

  static const Set<String> _sequentialPatterns = <String>{
    '0123456',
    '1234567',
    '2345678',
    '3456789',
    '9876543',
    '8765432',
    '7654321',
    '6543210',
  };

  static PhoneValidationResult _fail(String errorKey, String lang) {
    return PhoneValidationResult(
      isValid: false,
      errorKey: errorKey,
      errorMessage: AppStrings.t(lang, errorKey),
    );
  }

  static PhoneValidationResult normalizeAndValidate(
    String raw, {
    String lang = 'tr',
  }) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return _fail('phone_err_required', lang);
    }

    final hasPlusPrefix = trimmed.startsWith('+');
    final hasIntlPrefix = trimmed.startsWith('00');

    final digitsBuf = StringBuffer();
    for (var i = 0; i < trimmed.length; i++) {
      final code = trimmed.codeUnitAt(i);
      if (code >= 48 && code <= 57) {
        digitsBuf.writeCharCode(code);
      }
    }
    var digits = digitsBuf.toString();

    if (digits.isEmpty) {
      return _fail('phone_err_required', lang);
    }

    if (hasIntlPrefix && digits.length > 2) {
      digits = digits.substring(2);
    }

    if (!hasPlusPrefix && !hasIntlPrefix) {
      if (digits.startsWith('0') && digits.length == 11) {
        digits = '90${digits.substring(1)}';
      } else if (digits.length == 10 && digits.startsWith('5')) {
        digits = '90$digits';
      }
    }

    if (digits.startsWith('900') && digits.length == 13) {
      digits = '90${digits.substring(3)}';
    }

    if (digits.length < 7 || digits.length > 15) {
      return _fail('phone_err_invalid', lang);
    }

    if (digits.startsWith('90')) {
      if (digits.length != 12) {
        return _fail('phone_err_invalid', lang);
      }
      final third = digits[2];
      final fourth = digits[3];
      if (third != '5' &&
          third != '2' &&
          third != '3' &&
          third != '4' &&
          third != '8') {
        return _fail('phone_err_invalid', lang);
      }
      if (third == '5' && fourth == '0' && digits.substring(4) == '0000000') {
        return _fail('phone_err_invalid', lang);
      }
    }

    var localDigits = digits;
    if (digits.length > 10) {
      localDigits = digits.substring(digits.length - 10);
    }

    if (!_isRealisticLocalDigits(digits, localDigits)) {
      return _fail('phone_err_invalid', lang);
    }

    return PhoneValidationResult(
      isValid: true,
      normalized: '+$digits',
    );
  }

  static bool isRealistic(String raw) {
    return normalizeAndValidate(raw).isValid;
  }

  static bool _isRealisticLocalDigits(String fullDigits, String localDigits) {
    if (_fakeNumberSet.contains(fullDigits) ||
        _fakeNumberSet.contains(localDigits)) {
      return false;
    }

    if (fullDigits.isNotEmpty) {
      var allSame = true;
      for (var i = 1; i < fullDigits.length; i++) {
        if (fullDigits[i] != fullDigits[0]) {
          allSame = false;
          break;
        }
      }
      if (allSame) return false;
    }

    if (localDigits.length >= 6) {
      var allSameLocal = true;
      for (var i = 1; i < localDigits.length; i++) {
        if (localDigits[i] != localDigits[0]) {
          allSameLocal = false;
          break;
        }
      }
      if (allSameLocal) return false;
    }

    if (localDigits.length >= 7) {
      final tail7 = localDigits.substring(localDigits.length - 7);
      var tailAllSame = true;
      for (var i = 1; i < tail7.length; i++) {
        if (tail7[i] != tail7[0]) {
          tailAllSame = false;
          break;
        }
      }
      if (tailAllSame) return false;

      if (_sequentialPatterns.contains(tail7)) return false;

      if (localDigits.length == 10 &&
          localDigits.startsWith('5') &&
          _blockedPrefixes.contains(tail7)) {
        return false;
      }

      if (tail7.startsWith('00000') || tail7.endsWith('00000')) {
        return false;
      }
    }

    if (localDigits.length >= 6) {
      var distinctCount = 0;
      final seen = List<bool>.filled(10, false);
      for (var i = 0; i < localDigits.length; i++) {
        final idx = localDigits.codeUnitAt(i) - 48;
        if (idx >= 0 && idx <= 9 && !seen[idx]) {
          seen[idx] = true;
          distinctCount++;
        }
      }
      if (distinctCount <= 2) return false;
    }

    for (final seq in _sequentialPatterns) {
      if (localDigits.contains(seq)) {
        return false;
      }
    }

    if (localDigits.length >= 8 &&
        _hasRepeatingPairPattern(localDigits.substring(localDigits.length - 8))) {
      return false;
    }

    return true;
  }

  static bool _hasRepeatingPairPattern(String tail) {
    if (tail.length < 6) return false;
    final p1 = tail.substring(0, 2);
    var matchCount = 0;
    for (var i = 0; i + 2 <= tail.length; i += 2) {
      if (tail.substring(i, i + 2) == p1) {
        matchCount++;
      }
    }
    return matchCount * 2 == tail.length;
  }
}
