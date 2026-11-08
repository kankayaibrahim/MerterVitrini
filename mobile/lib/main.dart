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
  Set<PointerDeviceKind> get dragDevices => const {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
    PointerDeviceKind.unknown,
  };
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
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
  void dispose() {
    _sessionProvider.dispose();
    super.dispose();
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
          final isSupplier =
              session.isSupplierMode && session.isSupplierLoggedIn;

          return MaterialApp(
            title: AppConfig.appName,
            debugShowCheckedModeBanner: false,
            scrollBehavior: const AppScrollBehavior(),
            theme: AppTheme.light(isSupplierMode: isSupplier),
            locale: Locale(session.languageCode),
            supportedLocales: const [
              Locale('tr'),
              Locale('en'),
              Locale('ru'),
              Locale('ar'),
            ],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
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
      backgroundColor: AppColors.obsidian,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const MvEditorialCrest(size: 72),
            const SizedBox(height: 22),
            const Text(
              'MERTER VİTRİNİ',
              style: TextStyle(
                fontFamily: AppColors.serifFontFamily,
                color: Colors.white,
                fontSize: 21,
                fontWeight: FontWeight.w800,
                letterSpacing: 3.4,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'GLOBAL B2B TOPTAN MODA & ÜRETİCİ ATÖLYESİ',
              style: TextStyle(
                color: AppColors.champagneGold,
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.4,
              ),
            ),
            const SizedBox(height: 30),
            SizedBox(
              width: 110,
              child: LinearProgressIndicator(
                minHeight: 1.5,
                backgroundColor: Colors.white.withValues(alpha: 0.14),
                color: AppColors.champagneGold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
