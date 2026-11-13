import 'package:flutter/material.dart';

import 'i18n/translations_eu.dart';
import 'i18n/translations_ru_ar.dart';
import 'i18n/translations_tr_en.dart';

class AppStrings {
  AppStrings._();

  static const List<String> supportedCodes = [
    'tr',
    'en',
    'ru',
    'ar',
    'de',
    'fr',
    'pl',
    'bg',
  ];

  static const Map<String, String> localeLabels = {
    'tr': 'Türkçe',
    'en': 'English',
    'ru': 'Русский',
    'ar': 'العربية',
    'de': 'Deutsch',
    'fr': 'Français',
    'pl': 'Polski',
    'bg': 'Български',
  };

  static const Map<String, Map<String, String>> _dictionaries = {
    'tr': trStrings,
    'en': enStrings,
    'ru': ruStrings,
    'ar': arStrings,
    'de': deStrings,
    'fr': frStrings,
    'pl': plStrings,
    'bg': bgStrings,
  };

  static String normalizeCode(String langCode) {
    final code = langCode.trim().toLowerCase();
    if (code.contains('-') || code.contains('_')) {
      final short = code.split(RegExp(r'[-_]')).first;
      if (_dictionaries.containsKey(short)) {
        return short;
      }
    }
    if (_dictionaries.containsKey(code)) {
      return code;
    }
    return 'tr';
  }

  static TextDirection directionOf(String langCode) {
    return normalizeCode(langCode) == 'ar'
        ? TextDirection.rtl
        : TextDirection.ltr;
  }

  /// Arabic script ligatures break when non-zero letterSpacing is applied.
  static double letterSpacing(String langCode, double base) {
    return normalizeCode(langCode) == 'ar' ? 0.0 : base;
  }

  static String upper(String text, String langCode) {
    final code = normalizeCode(langCode);
    if (code == 'tr') {
      return text.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
    }
    if (code == 'ar') {
      return text;
    }
    return text.toUpperCase();
  }

  static String t(String langCode, String key) {
    final code = normalizeCode(langCode);
    return _dictionaries[code]?[key] ??
        _dictionaries['en']?[key] ??
        _dictionaries['tr']?[key] ??
        key;
  }

  static String tUpper(String langCode, String key) {
    return upper(t(langCode, key), langCode);
  }

  static String tParams(
    String langCode,
    String key,
    Map<String, String> params,
  ) {
    var result = t(langCode, key);
    for (final entry in params.entries) {
      result = result.replaceAll('{${entry.key}}', entry.value);
    }
    return result;
  }
}
