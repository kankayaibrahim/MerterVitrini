import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Website Monochrome Luxury Editorial Tokens (from frontend/src/app/globals.css)
  static const Color pureBlack = Color(0xFF000000);
  static const Color obsidian = Color(0xFF111111);
  static const Color eerieBlack = Color(0xFF1C1C1C);
  static const Color onyx = Color(0xFF262626);
  static const Color davysGray = Color(0xFF545454);
  static const Color sonicSilver = Color(0xFF636363);
  static const Color spanishGray = Color(0xFF999999);
  static const Color cultured = Color(0xFFEDEDED);
  static const Color editorialGold = Color(0xFF7A634E);
  static const Color champagneGold = Color(0xFFB89655);
  static const Color editorialIvory = Color(0xFFF8F6F2);
  static const Color editorialOffWhite = Color(0xFFFAFAFA);
  static const Color discountRed = Color(0xFFA30000);

  // Shared Dual-Role Semantic Tokens
  static const Color navy = Color(0xFF1C1C1C);
  static const Color navySurface = Color(0xFF262626);
  static const Color primary = Color(0xFF1C1C1C);
  static const Color primaryLight = Color(0xFFF2F2F2);
  static const Color accentGold = Color(0xFF7A634E);
  static const Color accentGoldLight = Color(0xFFF3ECE1);
  static const Color emerald = Color(0xFF059669);
  static const Color emeraldLight = Color(0xFFD1FAE5);
  static const Color danger = Color(0xFFA30000);
  static const Color dangerLight = Color(0xFFFEE2E2);
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFEDEDED);
  static const Color textPrimary = Color(0xFF1C1C1C);
  static const Color textSecondary = Color(0xFF636363);
  static const Color textMuted = Color(0xFF999999);

  static const String serifFontFamily = 'Georgia';
}

class AppTheme {
  AppTheme._();

  static ThemeData light({bool isSupplierMode = false}) {
    final seedColor =
        isSupplierMode ? AppColors.editorialGold : AppColors.pureBlack;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: seedColor,
      brightness: Brightness.light,
      primary: isSupplierMode ? AppColors.eerieBlack : AppColors.pureBlack,
      secondary: AppColors.editorialGold,
      surface: AppColors.surface,
      error: AppColors.danger,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor:
          isSupplierMode ? const Color(0xFFF8FAFC) : AppColors.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: isSupplierMode ? AppColors.eerieBlack : Colors.white,
        foregroundColor: isSupplierMode ? Colors.white : AppColors.eerieBlack,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: isSupplierMode ? Colors.white : AppColors.eerieBlack,
          fontSize: 17,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 14 : 0),
          side: const BorderSide(color: AppColors.cultured, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          borderSide: const BorderSide(color: AppColors.cultured),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          borderSide: const BorderSide(color: AppColors.cultured),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          borderSide: BorderSide(
            color:
                isSupplierMode ? AppColors.editorialGold : AppColors.pureBlack,
            width: 1.4,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.pureBlack,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          ),
          textStyle: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.eerieBlack,
          side: const BorderSide(color: AppColors.cultured),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(isSupplierMode ? 10 : 0),
          ),
          textStyle: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: isSupplierMode
            ? AppColors.editorialIvory
            : const Color(0xFFF2F2F2),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            letterSpacing: 0.3,
            color: selected ? AppColors.pureBlack : AppColors.sonicSilver,
          );
        }),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.cultured,
        thickness: 1,
        space: 1,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(isSupplierMode ? 16 : 0),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(isSupplierMode ? 12 : 0),
          side: const BorderSide(color: AppColors.cultured),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.obsidian,
        contentTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(),
      ),
    );
  }
}
