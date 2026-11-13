import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_config.dart';
import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../widgets/country_flag_icon.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/language_currency_modal.dart';
import '../../widgets/luxury_icons.dart';
import 'phone_completion_sheet.dart';
import 'supplier_application_screen.dart';

class AuthScreen extends StatefulWidget {
  final AppRole initialRole;
  final bool initialRegisterMode;

  const AuthScreen({
    super.key,
    this.initialRole = AppRole.customer,
    this.initialRegisterMode = false,
  });

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late AppRole _selectedRole;
  late bool _isRegisterMode;
  final _formKey = GlobalKey<FormState>();

  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _submitting = false;
  bool _obscurePassword = true;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.initialRole;
    _isRegisterMode =
        widget.initialRole == AppRole.customer && widget.initialRegisterMode;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: _isRegisterMode ? '/auth/register' : '/auth/login',
            pageTitle: _isRegisterMode ? 'Customer Register' : 'Auth Login',
          );
    });
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _openServerUrlDialog() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final ctrl = TextEditingController(text: AppConfig.apiBaseUrl);
    final updated = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        title: Text(
          UiText.pick(
            lang,
            tr: 'API Sunucu Adresi',
            en: 'API Server Address',
            ru: 'Адрес API-сервера',
            ar: 'عنوان خادم API',
            de: 'API-Serveradresse',
            fr: 'Adresse du serveur API',
            pl: 'Adres serwera API',
            bg: 'Адрес на API сървъра',
          ),
          style: const TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Backend Base URL',
            hintText: 'https://mertervitrini.com.tr/api/v1/mobile',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.obsidian,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
            ),
            child: Text(AppStrings.t(lang, 'save')),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (updated != null && updated.isNotEmpty) {
      AppConfig.setRuntimeBaseUrl(updated);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('API: ${AppConfig.apiBaseUrl}')),
        );
      }
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final session = context.read<SessionProvider>();
    final lang = session.languageCode;

    if (_selectedRole == AppRole.customer && _isRegisterMode) {
      final phoneCheck = PhoneValidator.normalizeAndValidate(
        _phoneCtrl.text,
        lang: lang,
      );
      if (!phoneCheck.isValid) {
        setState(() => _errorText = phoneCheck.localizedError(lang));
        return;
      }
    }

    setState(() {
      _submitting = true;
      _errorText = null;
    });

    try {
      if (_selectedRole == AppRole.customer && _isRegisterMode) {
        final phoneCheck = PhoneValidator.normalizeAndValidate(
          _phoneCtrl.text,
          lang: lang,
        );
        await session.registerCustomerAccount(
          firstName: _firstNameCtrl.text.trim(),
          lastName: _lastNameCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
          phone: phoneCheck.normalized,
          password: _passwordCtrl.text,
        );
        await session.telemetry.trackMemberEvent(
          eventType: 'customer_registered',
        );
      } else {
        await session.login(
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text,
          role: _selectedRole == AppRole.supplier ? 'supplier' : 'customer',
        );
        if (_selectedRole == AppRole.customer) {
          await session.telemetry.trackMemberEvent(
            eventType: 'customer_logged_in',
          );
        }
      }

      if (!mounted) return;
      if (_selectedRole == AppRole.customer && session.requiresPhoneCompletion) {
        await showPhoneCompletionModal(context);
        if (!mounted) return;
      }

      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorText = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Row(
          children: [
            const MvEditorialCrest(size: 26),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                AppStrings.tUpper(lang, 'app_title'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: AppColors.serifFontFamily,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: AppStrings.letterSpacing(lang, 1.4),
                  color: AppColors.obsidian,
                ),
              ),
            ),
          ],
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          InkWell(
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            onTap: () => showLanguageCurrencyModal(context),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CountryFlagIcon(code: lang, width: 20, height: 14),
                  const SizedBox(width: 5),
                  Text(
                    lang.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.obsidian,
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            onPressed: _openServerUrlDialog,
            icon: const Icon(Icons.tune_rounded, size: 19),
            tooltip: UiText.pick(
              lang,
              tr: 'Sunucu Adresi',
              en: 'Server Address',
              ru: 'Адрес сервера',
              ar: 'عنوان الخادم',
              de: 'Serveradresse',
              fr: 'Adresse serveur',
              pl: 'Adres serwera',
              bg: 'Адрес на сървъра',
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Role Segmented Switcher (Customer Store vs Supplier Studio)
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      border: Border.all(color: AppColors.cultured),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _RoleSegmentButton(
                            label: AppStrings.t(lang, 'customer_store'),
                            icon: Icons.storefront_outlined,
                            selected: _selectedRole == AppRole.customer,
                            onTap: () => setState(() {
                              _selectedRole = AppRole.customer;
                              _errorText = null;
                            }),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: _RoleSegmentButton(
                            label: AppStrings.t(lang, 'supplier_panel'),
                            icon: Icons.camera_alt_outlined,
                            selected: _selectedRole == AppRole.supplier,
                            onTap: () => setState(() {
                              _selectedRole = AppRole.supplier;
                              _isRegisterMode = false;
                              _errorText = null;
                            }),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Main Auth Card
                  EditorialCard(
                    padding: const EdgeInsets.all(20),
                    borderRadius: AppColors.radiusLg,
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _selectedRole == AppRole.supplier
                                ? AppStrings.t(lang, 'supplier_portal_login')
                                : (_isRegisterMode
                                    ? AppStrings.t(lang, 'register_title')
                                    : AppStrings.t(lang, 'login')),
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontSize: 21,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _selectedRole == AppRole.supplier
                                ? UiText.pick(
                                    lang,
                                    tr: 'Üretici ve tedarikçi stüdyo paneline bağlanarak ürün yükleyin ve B2B teklifleri yönetin.',
                                    en: 'Sign in to the manufacturer & supplier studio to publish series and manage wholesale offers.',
                                    ru: 'Войдите в студию поставщика для публикации серий и управления оптовыми предложениями.',
                                    ar: 'سجّل الدخول إلى استوديو المورد لنشر المجموعات وإدارة عروض الجملة.',
                                    de: 'Melden Sie sich im Lieferanten-Studio an, um Serien zu veröffentlichen und Angebote zu verwalten.',
                                    fr: 'Connectez-vous au studio fournisseur pour publier des séries et gérer vos offres B2B.',
                                    pl: 'Zaloguj się do studia dostawcy, aby publikować serie i zarządzać ofertami B2B.',
                                    bg: 'Влезте в студиото за доставчици, за да публикувате серии и управлявате B2B оферти.',
                                  )
                                : (_isRegisterMode
                                    ? UiText.pick(
                                        lang,
                                        tr: 'Merter toptan fiyatlarını görmek, seri sipariş vermek ve üreticilerle doğrudan görüşmek için B2B alıcı hesabı oluşturun.',
                                        en: 'Create your B2B buyer account to unlock wholesale prices, place series orders, and chat directly with manufacturers.',
                                        ru: 'Создайте B2B-аккаунт покупателя для доступа к оптовым ценам, заказам и чату с производителями.',
                                        ar: 'أنشئ حساب المشتري B2B لفتح أسعار الجملة والطلب والتواصل المباشر مع المصانع.',
                                        de: 'Erstellen Sie Ihr B2B-Käuferkonto für Großhandelspreise, Serienbestellungen und Hersteller-Chat.',
                                        fr: 'Créez votre compte acheteur B2B pour débloquer les tarifs de gros et contacter les fabricants.',
                                        pl: 'Utwórz konto kupca B2B, aby odblokować ceny hurtowe i kontakt z producentami.',
                                        bg: 'Създайте B2B акаунт, за да отключите цените на едро и директния контакт с производителите.',
                                      )
                                    : AppStrings.t(
                                        lang,
                                        'guest_price_lock_subtitle',
                                      )),
                            style: const TextStyle(
                              fontSize: 12.8,
                              color: AppColors.sonicSilver,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 18),

                          if (_selectedRole == AppRole.customer &&
                              _isRegisterMode) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _firstNameCtrl,
                                    textCapitalization: TextCapitalization.words,
                                    decoration: InputDecoration(
                                      labelText:
                                          '${AppStrings.t(lang, 'first_name')} *',
                                    ),
                                    validator: (v) =>
                                        (v == null || v.trim().isEmpty)
                                            ? AppStrings.t(
                                                lang,
                                                'err_validation',
                                              )
                                            : null,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextFormField(
                                    controller: _lastNameCtrl,
                                    textCapitalization: TextCapitalization.words,
                                    decoration: InputDecoration(
                                      labelText:
                                          '${AppStrings.t(lang, 'last_name')} *',
                                    ),
                                    validator: (v) =>
                                        (v == null || v.trim().isEmpty)
                                            ? AppStrings.t(
                                                lang,
                                                'err_validation',
                                              )
                                            : null,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                          ],

                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration: InputDecoration(
                              labelText: '${AppStrings.t(lang, 'email')} *',
                              hintText: 'buyer@company.com',
                              prefixIcon: const Icon(
                                Icons.mail_outline_rounded,
                                size: 19,
                              ),
                            ),
                            validator: (v) {
                              if (v == null || !v.contains('@')) {
                                return AppStrings.t(lang, 'err_validation');
                              }
                              return null;
                            },
                          ),

                          if (_selectedRole == AppRole.customer &&
                              _isRegisterMode) ...[
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _phoneCtrl,
                              keyboardType: TextInputType.phone,
                              decoration: InputDecoration(
                                labelText: '${AppStrings.t(lang, 'phone')} *',
                                hintText: '+90 5XX XXX XX XX',
                                prefixIcon: const Icon(
                                  Icons.phone_outlined,
                                  size: 19,
                                ),
                              ),
                              validator: (v) {
                                final check =
                                    PhoneValidator.normalizeAndValidate(
                                  v ?? '',
                                  lang: lang,
                                );
                                return check.isValid
                                    ? null
                                    : check.localizedError(lang);
                              },
                            ),
                          ],

                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _passwordCtrl,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: '${AppStrings.t(lang, 'password')} *',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                                size: 19,
                              ),
                              suffixIcon: IconButton(
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 19,
                                ),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.length < 6) {
                                return AppStrings.t(lang, 'err_validation');
                              }
                              return null;
                            },
                          ),

                          if (_errorText != null) ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.dangerLight,
                                borderRadius:
                                    BorderRadius.circular(AppColors.radiusSm),
                                border: Border.all(
                                  color:
                                      AppColors.danger.withValues(alpha: 0.35),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.error_outline_rounded,
                                    color: AppColors.danger,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _errorText!,
                                      style: const TextStyle(
                                        color: AppColors.danger,
                                        fontSize: 12.2,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 18),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _submitting ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.obsidian,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(AppColors.radiusMd),
                                ),
                              ),
                              child: _submitting
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      _selectedRole == AppRole.supplier
                                          ? AppStrings.tUpper(lang, 'login')
                                          : (_isRegisterMode
                                              ? AppStrings.tUpper(
                                                  lang,
                                                  'register_submit',
                                                )
                                              : AppStrings.tUpper(
                                                  lang,
                                                  'login',
                                                )),
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing:
                                            AppStrings.letterSpacing(lang, 1.0),
                                      ),
                                    ),
                            ),
                          ),

                          if (_selectedRole == AppRole.customer) ...[
                            const SizedBox(height: 10),
                            TextButton(
                              onPressed: () {
                                setState(() {
                                  _isRegisterMode = !_isRegisterMode;
                                  _errorText = null;
                                });
                              },
                              child: Text(
                                _isRegisterMode
                                    ? UiText.pick(
                                        lang,
                                        tr: 'Zaten B2B hesabınız var mı? Giriş Yapın',
                                        en: 'Already have a B2B account? Sign In',
                                        ru: 'Уже есть B2B-аккаунт? Войти',
                                        ar: 'هل لديك حساب B2B بالفعل؟ تسجيل الدخول',
                                        de: 'Bereits ein B2B-Konto? Anmelden',
                                        fr: 'Déjà un compte B2B ? Se connecter',
                                        pl: 'Masz już konto B2B? Zaloguj się',
                                        bg: 'Вече имате B2B акаунт? Влезте',
                                      )
                                    : UiText.pick(
                                        lang,
                                        tr: 'Henüz hesabınız yok mu? Hemen Üye Olun',
                                        en: 'New B2B buyer? Create an account',
                                        ru: 'Новый оптовый покупатель? Зарегистрироваться',
                                        ar: 'مشتري جديد؟ أنشئ حسابك الآن',
                                        de: 'Neu hier? B2B-Konto erstellen',
                                        fr: 'Nouvel acheteur ? Créer un compte',
                                        pl: 'Nowy kupiec B2B? Utwórz konto',
                                        bg: 'Нов B2B купувач? Създайте акаунт',
                                      ),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.obsidian,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),
                  // Supplier Partnership Application CTA Card (Accessible from both modes)
                  EditorialCard(
                    padding: const EdgeInsets.all(16),
                    backgroundColor: Colors.white,
                    borderColor:
                        AppColors.champagneGold.withValues(alpha: 0.55),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const SupplierApplicationScreen(),
                        ),
                      );
                    },
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.warmIvory,
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
                            border: Border.all(
                              color: AppColors.champagneGold
                                  .withValues(alpha: 0.55),
                            ),
                          ),
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.factory_outlined,
                            size: 20,
                            color: AppColors.editorialGold,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                AppStrings.t(lang, 'supplier_apply'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: AppColors.serifFontFamily,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: AppColors.obsidian,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                UiText.pick(
                                  lang,
                                  tr: 'Merter veya Türkiye geneli toptan üretim/ihracat firmanızı vitrine taşıyın.',
                                  en: 'Showcase your wholesale manufacturing & export catalog on Merter Vitrini.',
                                  ru: 'Представьте ваше швейное производство или оптовый бренд на витрине Merter Vitrini.',
                                  ar: 'اعرض مصنعك أو علامتك التجارية للجملة على منصة مرتر فيتريني.',
                                  de: 'Präsentieren Sie Ihre Großhandelskollektion auf Merter Vitrini.',
                                  fr: 'Exposez votre catalogue de fabrication en gros sur Merter Vitrini.',
                                  pl: 'Zaprezentuj swój katalog producenta hurtowego na Merter Vitrini.',
                                  bg: 'Представете своя каталог на едро в Merter Vitrini.',
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.sonicSilver,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          size: 18,
                          color: AppColors.obsidian,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleSegmentButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleSegmentButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.obsidian : Colors.transparent,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? Colors.white : AppColors.sonicSilver,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: selected ? Colors.white : AppColors.sonicSilver,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
