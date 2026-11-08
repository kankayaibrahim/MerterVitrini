class CurrencyFormatter {
  CurrencyFormatter._();

  static const Map<String, String> symbols = {
    'TRY': '₺',
    'TL': '₺',
    'USD': '\$',
    'EUR': '€',
    'GBP': '£',
    'RUB': '₽',
  };

  /// Parses B2B packing/series ratio strings like "1-2-2-1" (=6), "2,2,2" (=6),
  /// "S-M-L-XL" (=4), or single numeric "8" (=8). Defaults to 1 if empty/invalid.
  static int parseUnitsPerPackage(String? ratioRaw) {
    if (ratioRaw == null || ratioRaw.trim().isEmpty) {
      return 1;
    }
    final cleaned = ratioRaw.trim();
    final parts = cleaned
        .split(RegExp(r'[-,/+\s:]+'))
        .where((e) => e.trim().isNotEmpty)
        .toList();
    if (parts.isEmpty) {
      return 1;
    }

    var allNumeric = true;
    var numericSum = 0;
    for (final p in parts) {
      final token = p.contains('=') ? p.split('=').last.trim() : p.trim();
      final parsed = int.tryParse(token);
      if (parsed == null || parsed <= 0) {
        allNumeric = false;
        break;
      }
      numericSum += parsed;
    }

    if (allNumeric && numericSum > 0) {
      return numericSum;
    }
    return parts.length > 1 ? parts.length : 1;
  }

  /// Converts an amount from [sourceCurrency] to [displayCurrency] using TCMB TRY rates.
  static double convert({
    required double amount,
    required String sourceCurrency,
    required String displayCurrency,
    required Map<String, double> ratesToTry,
  }) {
    final src = sourceCurrency.toUpperCase() == 'TL'
        ? 'TRY'
        : sourceCurrency.toUpperCase();
    final dst = displayCurrency.toUpperCase() == 'TL'
        ? 'TRY'
        : displayCurrency.toUpperCase();
    if (src == dst) {
      return amount;
    }

    final srcRate = src == 'TRY' ? 1.0 : (ratesToTry[src] ?? 1.0);
    final dstRate = dst == 'TRY' ? 1.0 : (ratesToTry[dst] ?? 1.0);
    if (dstRate <= 0) {
      return amount;
    }

    final amountInTry = amount * srcRate;
    return amountInTry / dstRate;
  }

  static String format(
    double amount, {
    String currency = 'TRY',
    Map<String, double>? ratesToTry,
    String? sourceCurrency,
  }) {
    var value = amount;
    if (ratesToTry != null &&
        sourceCurrency != null &&
        sourceCurrency.isNotEmpty) {
      value = convert(
        amount: amount,
        sourceCurrency: sourceCurrency,
        displayCurrency: currency,
        ratesToTry: ratesToTry,
      );
    }

    final code = currency.toUpperCase() == 'TL' ? 'TRY' : currency.toUpperCase();
    final sym = symbols[code] ?? code;
    final formatted = value.toStringAsFixed(2);
    return '$sym$formatted';
  }
}

