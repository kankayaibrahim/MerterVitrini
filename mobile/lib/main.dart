import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/app_config.dart';
import 'core/app_theme.dart';
import 'core/localization.dart';
import 'features/customer/customer_shell.dart';
import 'features/supplier/supplier_shell.dart';
import 'providers/cart_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/session_provider.dart';
import 'providers/supplier_provider.dart';
import 'services/api_client.dart';
import 'widgets/luxury_icons.dart';

class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
  };
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );
  runApp(const MerterVitriniMobileApp());
}

class MerterVitriniMobileApp extends StatefulWidget {
  const MerterVitriniMobileApp({super.key});

  @override
  State<MerterVitriniMobileApp> createState() => _MerterVitriniMobileAppState();
}

class _MerterVitriniMobileAppState extends State<MerterVitriniMobileApp> {
  late final ApiClient _apiClient;
  late final SessionProvider _sessionProvider;

  @override
  void initState() {
    super.initState();
    _apiClient = ApiClient();
    _sessionProvider = SessionProvider(apiClient: _apiClient);
    _sessionProvider.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<SessionProvider>.value(value: _sessionProvider),
        ChangeNotifierProvider<CartProvider>(
          create: (_) => CartProvider(
            api: _sessionProvider.api.commerce,
            session: _sessionProvider,
          ),
        ),
        ChangeNotifierProvider<ChatProvider>(
          create: (_) => ChatProvider(
            api: _sessionProvider.api.chat,
            session: _sessionProvider,
          ),
        ),
        ChangeNotifierProvider<SupplierProvider>(
          create: (_) => SupplierProvider(
            catalogRepo: _sessionProvider.api.supplierCatalog,
            operationsRepo: _sessionProvider.api.supplierOperations,
          ),
        ),
      ],
      child: Consumer<SessionProvider>(
        builder: (context, session, _) {
          final isSupplier = session.isSupplierMode && session.isSupplierLoggedIn;
          return MaterialApp(
            title: AppConfig.appName,
            debugShowCheckedModeBanner: false,
            scrollBehavior: const AppScrollBehavior(),
            locale: Locale(AppStrings.normalizeCode(session.languageCode)),
            supportedLocales: const [
              Locale('tr'),
              Locale('en'),
              Locale('ru'),
              Locale('ar'),
              Locale('de'),
              Locale('fr'),
              Locale('pl'),
              Locale('bg'),
            ],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: AppTheme.light(
              isSupplier: isSupplier,
              languageCode: session.languageCode,
            ),
            builder: (context, child) {
              return Directionality(
                textDirection: AppStrings.directionOf(session.languageCode),
                child: child ?? const SizedBox.shrink(),
              );
            },
            home: !session.initialized
                ? const _SplashBootstrapView()
                : isSupplier
                ? const SupplierShell()
                : const CustomerShell(),
          );
        },
      ),
    );
  }
}

class _SplashBootstrapView extends StatelessWidget {
  const _SplashBootstrapView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: AppColors.pureWhite,
                borderRadius: BorderRadius.circular(AppColors.radiusLg),
                border: Border.all(color: AppColors.warmHairline, width: 1),
              ),
              child: const Center(
                child: MvEditorialCrest(size: 48, darkBackground: false),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'MERTER VİTRİNİ',
              style: TextStyle(
                color: AppColors.obsidian,
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: AppStrings.letterSpacing(
                  ApiClient.defaultLanguageCode,
                  3.2,
                ),
              ),
            ),
            const SizedBox(height: 22),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.luxuryBronze,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
