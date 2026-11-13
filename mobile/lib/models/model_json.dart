/// Shared defensive JSON decoding helpers for Mobile B2B data models.
class ModelJson {
  ModelJson._();

  static String str(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    final text = value.toString();
    return text;
  }

  static String trimmed(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString().trim();
  }

  static String? nullableStr(dynamic value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static int integer(dynamic value, [int fallback = 0]) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      return int.tryParse(value.trim()) ??
          double.tryParse(value.trim())?.toInt() ??
          fallback;
    }
    return fallback;
  }

  static double decimal(dynamic value, [double fallback = 0.0]) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    if (value is String) {
      return double.tryParse(value.trim().replaceAll(',', '.')) ?? fallback;
    }
    return fallback;
  }

  static double? nullableDecimal(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is num) return value.toDouble();
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      return double.tryParse(trimmed.replaceAll(',', '.'));
    }
    return null;
  }

  static bool boolean(dynamic value, [bool fallback = false]) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final lower = value.trim().toLowerCase();
      if (lower == 'true' || lower == '1' || lower == 'yes') return true;
      if (lower == 'false' || lower == '0' || lower == 'no') return false;
    }
    return fallback;
  }

  static DateTime dateTime(dynamic value, [DateTime? fallback]) {
    return nullableDateTime(value) ??
        fallback ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }

  static DateTime? nullableDateTime(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      return DateTime.tryParse(trimmed);
    }
    return null;
  }

  static Map<String, String> stringMap(dynamic value) {
    if (value is! Map) return const {};
    final out = <String, String>{};
    value.forEach((key, val) {
      final k = key.toString().trim();
      final v = (val ?? '').toString().trim();
      if (k.isNotEmpty && v.isNotEmpty) {
        out[k] = v;
      }
    });
    return out;
  }

  static List<String> stringList(dynamic value) {
    if (value is! List) return const [];
    final out = <String>[];
    for (final item in value) {
      final s = (item ?? '').toString().trim();
      if (s.isNotEmpty) out.add(s);
    }
    return out;
  }

  static Map<String, dynamic> map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return value.map((k, v) => MapEntry(k.toString(), v));
    }
    return const {};
  }

  /// Resolves a translation map field across short (`tr`) or regional (`tr_TR`) keys.
  static String pickLangText(
    Map<String, String> translations,
    String langCode, [
    String fallback = '',
  ]) {
    final norm = langCode.trim().toLowerCase();
    final direct = translations[norm]?.trim();
    if (direct != null && direct.isNotEmpty) return direct;

    for (final entry in translations.entries) {
      if (entry.key.toLowerCase().startsWith('${norm}_') &&
          entry.value.trim().isNotEmpty) {
        return entry.value.trim();
      }
    }
    final en = translations['en']?.trim();
    if (en != null && en.isNotEmpty && norm != 'tr') return en;
    final tr = translations['tr']?.trim();
    if (tr != null && tr.isNotEmpty) return tr;
    return fallback;
  }
}
