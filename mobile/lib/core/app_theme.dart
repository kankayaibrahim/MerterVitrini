import 'package:flutter/material.dart';

import 'localization.dart';

class AppColors {
  AppColors._();

  // Corporate Light Luxury Editorial Tokens
  static const Color pureWhite = Color(0xFFFFFFFF);
  static const Color pureBlack = Color(0xFF000000);
  static const Color obsidian = Color(0xFF111111);
  static const Color charcoal = Color(0xFF2C2C30);
  static const Color eerieBlack = Color(0xFF2C2C30);
  static const Color onyx = Color(0xFF262629);
  static const Color davysGray = Color(0xFF47474F);
  static const Color sonicSilver = Color(0xFF595962);
  static const Color mutedAccessible = Color(0xFF595962);
  static const Color spanishGray = Color(0xFF595962);
  static const Color warmHairline = Color(0xFFE7E2D8);
  static const Color cultured = Color(0xFFE7E2D8);
  static const Color luxuryBronze = Color(0xFF8A6D3B);
  static const Color editorialGold = Color(0xFF8A6D3B);
  static const Color champagneGold = Color(0xFFB89655);
  static const Color warmIvory = Color(0xFFFAF9F6);
  static const Color warmSurface = Color(0xFFF6F4EF);
  static const Color editorialIvory = Color(0xFFF6F4EF);
  static const Color editorialOffWhite = Color(0xFFFAF9F6);
  static const Color discountRed = Color(0xFFA30000);

  // Shared Dual-Role Semantic Tokens
  static const Color navy = Color(0xFF111111);
  static const Color navySurface = Color(0xFF2C2C30);
  static const Color primary = Color(0xFF111111);
  static const Color primaryLight = Color(0xFFF6F4EF);
  static const Color accentGold = Color(0xFF8A6D3B);
  static const Color accentGoldLight = Color(0xFFF3ECE1);
  static const Color emerald = Color(0xFF047857);
  static const Color emeraldLight = Color(0xFFD1FAE5);
  static const Color danger = Color(0xFFA30000);
  static const Color dangerLight = Color(0xFFFEE2E2);
  static const Color background = Color(0xFFFAF9F6);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE7E2D8);
  static const Color textPrimary = Color(0xFF111111);
  static const Color textSecondary = Color(0xFF595962);
  static const Color textMuted = Color(0xFF595962);

  static const String serifFontFamily = 'Georgia';
  static const double radiusSm = 8.0;
  static const double radiusMd = 10.0;
  static const double radiusLg = 12.0;
}

class AppTheme {
  AppTheme._();

  static const double radiusSm = AppColors.radiusSm;
  static const double radiusMd = AppColors.radiusMd;
  static const double radiusLg = AppColors.radiusLg;

  static ThemeData light({
    bool? isSupplier,
    bool isSupplierMode = false,
    String languageCode = 'tr',
  }) {
    final supplierMode = isSupplier ?? isSupplierMode;
    final primary = supplierMode ? AppColors.luxuryBronze : AppColors.obsidian;
    final secondary = supplierMode ? AppColors.obsidian : AppColors.luxuryBronze;
    final cardBorder = AppColors.warmHairline;
    final focusBorder = supplierMode ? AppColors.luxuryBronze : AppColors.obsidian;
    final chipBg = supplierMode
        ? AppColors.accentGoldLight
        : AppColors.warmSurface;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.warmIvory,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        onPrimary: Colors.white,
        secondary: secondary,
        onSecondary: Colors.white,
        surface: Colors.white,
        onSurface: AppColors.obsidian,
        error: AppColors.danger,
        onError: Colors.white,
        brightness: Brightness.light,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.warmHairline,
        thickness: 1,
        space: 1,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.warmIvory,
        foregroundColor: AppColors.obsidian,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: AppColors.obsidian),
        shape: const Border(
          bottom: BorderSide(color: AppColors.warmHairline, width: 1),
        ),
        titleTextStyle: TextStyle(
          color: AppColors.obsidian,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: AppStrings.letterSpacing(languageCode, 0.3),
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
          side: BorderSide(color: cardBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return primary.withValues(alpha: 0.45);
            }
            return primary;
          }),
          foregroundColor: const WidgetStatePropertyAll<Color>(Colors.white),
          elevation: const WidgetStatePropertyAll<double>(0),
          minimumSize: const WidgetStatePropertyAll<Size>(Size(0, 48)),
          shape: WidgetStatePropertyAll<OutlinedBorder>(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radiusMd),
            ),
          ),
          textStyle: WidgetStatePropertyAll<TextStyle>(
            TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13.5,
              letterSpacing: AppStrings.letterSpacing(languageCode, 0.4),
            ),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll<Color>(primary),
          side: WidgetStatePropertyAll<BorderSide>(
            BorderSide(color: AppColors.warmHairline.withValues(alpha: 0.95)),
          ),
          minimumSize: const WidgetStatePropertyAll<Size>(Size(0, 46)),
          shape: WidgetStatePropertyAll<OutlinedBorder>(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radiusMd),
            ),
          ),
          textStyle: const WidgetStatePropertyAll<TextStyle>(
            TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll<Color>(primary),
          shape: WidgetStatePropertyAll<OutlinedBorder>(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radiusSm),
            ),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: chipBg,
        selectedColor: primary.withValues(alpha: 0.12),
        side: const BorderSide(color: AppColors.warmHairline),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        labelStyle: const TextStyle(
          color: AppColors.charcoal,
          fontSize: 12.5,
          fontWeight: FontWeight.w500,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        hintStyle: const TextStyle(
          color: AppColors.mutedAccessible,
          fontSize: 13.5,
        ),
        labelStyle: const TextStyle(
          color: AppColors.charcoal,
          fontSize: 13.5,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: AppColors.warmHairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: AppColors.warmHairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: focusBorder, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.warmIvory,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(radiusLg),
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.obsidian,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
      ),
    );
  }
}
