class PhoneValidationResult {
  final bool valid;
  final String normalized;
  final String? errorMessage;

  const PhoneValidationResult({
    required this.valid,
    required this.normalized,
    this.errorMessage,
  });
}

class PhoneValidator {
  static const String _errRequired = 'Cep telefonu numarası zorunludur.';
  static const String _errInvalid =
      'Lütfen ülke kodu ile birlikte geçerli ve gerçek bir cep telefonu numarası giriniz (Örn: +90 532 481 92 64).';

  static const Set<String> _pairedTestTails6 = <String>{
    '112233',
    '223344',
    '334455',
    '445566',
    '556677',
    '667788',
    '778899',
    '001122',
    '998877',
    '654321',
    '123123',
    '321321',
    '000111',
    '111000',
  };

  static const Set<String> _pairedTestTails7 = <String>{
    '1112233',
    '1234123',
    '1231231',
    '0000111',
    '1111000',
  };

  static const Set<String> _trMobileSecondDigits = <String>{
    '0',
    '1',
    '3',
    '4',
    '5',
    '6',
  };

  static const Set<String> _trGeoFirstDigits = <String>{'2', '3', '4', '8'};

  static PhoneValidationResult normalizeAndValidate(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return const PhoneValidationResult(
        valid: false,
        normalized: '',
        errorMessage: _errRequired,
      );
    }

    if (!_hasOnlyAllowedChars(trimmed)) {
      return const PhoneValidationResult(
        valid: false,
        normalized: '',
        errorMessage: _errInvalid,
      );
    }

    var hasPlus = trimmed.startsWith('+');
    var digits = trimmed.replaceAll(RegExp(r'\D'), '');

    if (!hasPlus && digits.startsWith('00')) {
      if (digits.length < 11 || digits.startsWith('000')) {
        return const PhoneValidationResult(
          valid: false,
          normalized: '',
          errorMessage: _errInvalid,
        );
      }
      digits = digits.substring(2);
      hasPlus = true;
    }

    if (hasPlus && (digits.isEmpty || digits[0] == '0')) {
      return const PhoneValidationResult(
        valid: false,
        normalized: '',
        errorMessage: _errInvalid,
      );
    }

    final structural = _normalizeStructural(digits, hasPlus);
    if (structural == null || !_validateRealism(structural.$2)) {
      return const PhoneValidationResult(
        valid: false,
        normalized: '',
        errorMessage: _errInvalid,
      );
    }

    return PhoneValidationResult(valid: true, normalized: structural.$1);
  }

  static bool isRealistic(String raw) => normalizeAndValidate(raw).valid;

  static bool _hasOnlyAllowedChars(String value) {
    for (var i = 0; i < value.length; i++) {
      final code = value.codeUnitAt(i);
      final isDigit = code >= 48 && code <= 57;
      final isLeadingPlus = code == 43 && i == 0;
      final isSeparator =
          code == 32 || code == 45 || code == 40 || code == 41 || code == 46;
      if (!isDigit && !isLeadingPlus && !isSeparator) {
        return false;
      }
    }
    return true;
  }

  static bool _isTurkishPattern(String digits, bool hasPlus) {
    if (hasPlus && digits.startsWith('90')) return true;
    if (!hasPlus && digits.length == 12 && digits.startsWith('905')) {
      return true;
    }
    return !hasPlus && digits.length == 11 && digits.startsWith('05');
  }

  static bool _validateTurkishNational(String nat) {
    if (nat.length != 10) return false;
    if (nat[0] == '5') {
      if (!_trMobileSecondDigits.contains(nat[1])) return false;
      final p3 = nat.substring(0, 3);
      return p3 != '500' && p3 != '550';
    }
    if (!_trGeoFirstDigits.contains(nat[0])) return false;
    return nat.substring(0, 3) != '800';
  }

  static (String, String)? _normalizeStructural(String digits, bool hasPlus) {
    if (_isTurkishPattern(digits, hasPlus)) {
      var nat = ((hasPlus && digits.startsWith('90')) ||
              (!hasPlus && digits.startsWith('905')))
          ? digits.substring(2)
          : digits.substring(1);
      if (nat.length == 11 && nat.startsWith('0')) {
        nat = nat.substring(1);
      }
      if (!_validateTurkishNational(nat)) return null;
      return ('+90$nat', '90$nat');
    }

    if (hasPlus) {
      if (digits.length < 10 ||
          digits.length > 15 ||
          digits.codeUnitAt(0) < 49 ||
          digits.codeUnitAt(0) > 57) {
        return null;
      }
      return ('+$digits', digits);
    }

    if (digits.length < 9 || digits.length > 13) return null;
    if (digits.length == 9 &&
        (digits.codeUnitAt(0) < 52 || digits.codeUnitAt(0) > 57)) {
      return null;
    }
    if (digits[0] == '0' &&
        (digits.length < 10 || digits.length > 12 || digits[1] == '0')) {
      return null;
    }
    return (digits, digits);
  }

  static bool _validateRealism(String digits) {
    if (digits.length < 9) return false;
    if (_hasExcessiveRepeat(digits, 4)) return false;
    if (_countDistinct(digits) < 3) return false;
    final last7 = digits.substring(digits.length - 7);
    if (_countDistinct(last7) < 3) return false;
    final tail8 =
        digits.length > 8 ? digits.substring(digits.length - 8) : digits;
    if (_hasSequentialRun(tail8, 6)) return false;
    final last6 = digits.substring(digits.length - 6);
    if (_pairedTestTails6.contains(last6) || _pairedTestTails7.contains(last7)) {
      return false;
    }
    return true;
  }

  static int _countDistinct(String s) => s.split('').toSet().length;

  static bool _hasExcessiveRepeat(String s, int maxAllowed) {
    var run = 1;
    for (var i = 1; i < s.length; i++) {
      if (s[i] == s[i - 1]) {
        run++;
        if (run > maxAllowed) return true;
      } else {
        run = 1;
      }
    }
    return false;
  }

  static bool _hasSequentialRun(String s, int minRun) {
    if (s.length < minRun) return false;
    var ascRun = 1;
    var descRun = 1;
    for (var i = 1; i < s.length; i++) {
      final diff = s.codeUnitAt(i) - s.codeUnitAt(i - 1);
      if (diff == 1) {
        ascRun++;
        descRun = 1;
      } else if (diff == -1) {
        descRun++;
        ascRun = 1;
      } else {
        ascRun = 1;
        descRun = 1;
      }
      if (ascRun >= minRun || descRun >= minRun) return true;
    }
    return false;
  }
}

