/// Client-side anti-gibberish person name, street address, and postal code validator.
///
/// Mirrors `backend/handlers/address_validation.go` and
/// `frontend/src/utils/addressValidation.ts` so users get instant, consistent
/// feedback on B2B inquiry and address book forms before hitting the server.
class AddressValidator {
  AddressValidator._();

  static final RegExp _letterRegex = RegExp(r'\p{L}', unicode: true);
  static final RegExp _nonLetterSplitRegex = RegExp(r'[^\p{L}]+', unicode: true);
  static final RegExp _repeatedLetterRegex = RegExp(
    r'(\p{L})\1{4,}',
    unicode: true,
    caseSensitive: false,
  );
  static final RegExp _cjkRegex = RegExp(
    r'[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]',
  );
  static final RegExp _postalCodeRegex = RegExp(
    r'^[A-Za-z0-9][A-Za-z0-9\-\s]{0,18}[A-Za-z0-9]$',
  );
  static final RegExp _asciiConsonantRunRegex = RegExp(
    r'[bcdfghjklmnpqrstvwxz]{7,}',
    caseSensitive: false,
  );

  static bool _isGibberishPart(String part) {
    final len = part.runes.length;
    if (len == 0) return false;
    if (len > 24 && !_cjkRegex.hasMatch(part)) return true;
    if (len >= 12 && _asciiConsonantRunRegex.hasMatch(part)) return true;
    if (len >= 14) {
      final unique = part.toLowerCase().runes.toSet();
      if (unique.length / len < 0.38) return true;
    }
    return false;
  }

  /// Returns true when any alphabetic token looks like random keyboard mashing.
  static bool isGibberishAlphaWord(String raw) {
    final parts = raw
        .split(_nonLetterSplitRegex)
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty);
    for (final part in parts) {
      if (_isGibberishPart(part)) {
        return true;
      }
    }
    return false;
  }

  static String? validatePersonName(String raw, {String lang = 'tr'}) {
    final clean = raw.trim();
    final len = clean.runes.length;
    if (len < 2 || len > 120) {
      return lang == 'tr'
          ? 'Ad / soyad 2 ile 120 karakter arasında olmalıdır.'
          : 'Name must be between 2 and 120 characters.';
    }

    final letterCount = _letterRegex.allMatches(clean).length;
    if (letterCount < 2) {
      return lang == 'tr'
          ? 'Lütfen geçerli bir ad soyad girin.'
          : 'Please enter a valid full name.';
    }

    if (_repeatedLetterRegex.hasMatch(clean) || isGibberishAlphaWord(clean)) {
      return lang == 'tr'
          ? 'Lütfen rastgele karakterler yerine gerçek ad soyad bilgisi girin.'
          : 'Please enter a realistic name without random or repeated characters.';
    }
    return null;
  }

  static String? validateStreetAddress(String raw, {String lang = 'tr'}) {
    final clean = raw.trim();
    if (clean.isEmpty) {
      return lang == 'tr'
          ? 'Açık adres alanı zorunludur.'
          : 'Street address line is required.';
    }

    final runeLen = clean.runes.length;
    if (runeLen < 10) {
      return lang == 'tr'
          ? 'Lütfen mahalle, cadde/sokak ve bina no içeren en az 10 karakterlik açık adres girin.'
          : 'Please enter a complete street address (minimum 10 characters).';
    }
    if (runeLen > 500) {
      return lang == 'tr'
          ? 'Adres satırı en fazla 500 karakter olabilir.'
          : 'Address line cannot exceed 500 characters.';
    }

    if (_repeatedLetterRegex.hasMatch(clean)) {
      return lang == 'tr'
          ? 'Adres alanında anlamsız tekrar eden karakterler kullanılamaz.'
          : 'Repeated gibberish characters are not allowed in the address.';
    }

    final letters = _letterRegex
        .allMatches(clean)
        .map((m) => m.group(0)!)
        .toList(growable: false);
    if (letters.length < 4) {
      return lang == 'tr'
          ? 'Lütfen yalnızca rakam veya sembol yerine anlaşılır bir açık adres girin.'
          : 'Please include street and neighborhood details using valid letters.';
    }

    final hasCjk = _cjkRegex.hasMatch(clean);
    final uniqueLetters = letters.map((ch) => ch.toLowerCase()).toSet();
    if (!hasCjk && letters.length >= 8 && uniqueLetters.length < 4) {
      return lang == 'tr'
          ? 'Lütfen geçerli ve anlaşılır bir açık adres girin.'
          : 'Please enter a valid, meaningful street address.';
    }

    final tokens = clean
        .split(RegExp(r'\s+'))
        .where((t) => t.isNotEmpty)
        .toList(growable: false);
    if (!hasCjk && tokens.length < 2) {
      return lang == 'tr'
          ? 'Lütfen tek kelime yerine mahalle, sokak/cadde ve kapı numarası içeren gerçek bir açık adres girin.'
          : 'Please include street/avenue and building details (at least 2 words).';
    }

    for (final tok in tokens) {
      if (isGibberishAlphaWord(tok)) {
        return lang == 'tr'
            ? 'Girilen açık adres geçersiz veya rastgele karakter dizisi içeriyor.'
            : 'Street address appears to contain random or invalid text.';
      }
    }
    return null;
  }

  static String? validatePostalCode(
    String raw, {
    String lang = 'tr',
    bool required = false,
  }) {
    final clean = raw.trim();
    if (clean.isEmpty) {
      if (!required) return null;
      return lang == 'tr'
          ? 'Posta kodu alanı zorunludur.'
          : 'Postal code is required.';
    }

    final len = clean.runes.length;
    if (len < 2 || len > 20 || !_postalCodeRegex.hasMatch(clean)) {
      return lang == 'tr'
          ? 'Posta kodu formatı geçersiz.'
          : 'Invalid postal code format.';
    }
    return null;
  }
}
