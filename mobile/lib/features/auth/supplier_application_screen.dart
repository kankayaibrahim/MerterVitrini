import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';

class SupplierApplicationScreen extends StatefulWidget {
  const SupplierApplicationScreen({super.key});

  @override
  State<SupplierApplicationScreen> createState() =>
      _SupplierApplicationScreenState();
}

class _SupplierApplicationScreenState extends State<SupplierApplicationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _cityCtrl = TextEditingController(text: 'İstanbul');
  final _districtCtrl = TextEditingController(text: 'Merter / Güngören');
  final _categoryCtrl = TextEditingController();
  final _instagramCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      final user = session.customerUser;
      if (user != null) {
        if (_contactCtrl.text.isEmpty && user.fullName.trim().isNotEmpty) {
          _contactCtrl.text = user.fullName;
        }
        if (_emailCtrl.text.isEmpty && user.email.trim().isNotEmpty) {
          _emailCtrl.text = user.email;
        }
        if (_phoneCtrl.text.isEmpty && user.phone.trim().isNotEmpty) {
          _phoneCtrl.text = user.phone;
        }
      }
      session.telemetry.trackScreenView(
        path: '/supplier-application',
        pageTitle: 'Become a Supplier Application',
      );
    });
  }

  @override
  void dispose() {
    _companyCtrl.dispose();
    _contactCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _cityCtrl.dispose();
    _districtCtrl.dispose();
    _categoryCtrl.dispose();
    _instagramCtrl.dispose();
    _websiteCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final phoneCheck = PhoneValidator.normalizeAndValidate(
      _phoneCtrl.text,
      lang: lang,
    );
    if (!phoneCheck.isValid) {
      setState(() => _error = phoneCheck.localizedError(lang));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await session.api.submitSupplierApplication(
        companyName: _companyCtrl.text.trim(),
        contactName: _contactCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        phone: phoneCheck.normalized,
        city: _cityCtrl.text.trim(),
        district: _districtCtrl.text.trim(),
        category: _categoryCtrl.text.trim(),
        instagram: _instagramCtrl.text.trim(),
        website: _websiteCtrl.text.trim(),
        notes: _notesCtrl.text.trim(),
      );
      await session.telemetry.trackMemberEvent(
        eventType: 'supplier_application_submitted',
      );
      if (!mounted) return;
      setState(() => _submitted = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
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
        title: Text(
          AppStrings.tUpper(lang, 'supplier_apply'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.1),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: SafeArea(
        child: _submitted
            ? EditorialEmptyState(
                icon: Icons.verified_outlined,
                title: UiText.pick(
                  lang,
                  tr: 'Tedarikçi Başvurunuz Alındı',
                  en: 'Supplier Application Received',
                  ru: 'Заявка поставщика получена',
                  ar: 'تم استلام طلب المورد',
                  de: 'Lieferantenbewerbung eingegangen',
                  fr: 'Candidature fournisseur reçue',
                  pl: 'Zgłoszenie dostawcy zostało odebrane',
                  bg: 'Заявката за доставчик е получена',
                ),
                subtitle: UiText.pick(
                  lang,
                  tr: 'Ticari ekibimiz işletme bilgilerinizi doğruladıktan sonra üretici stüdyo hesabınızı ve vitrin mağazanızı aktif edecektir.',
                  en: 'Our B2B onboarding team will verify your company details and activate your manufacturer studio & showroom.',
                  ru: 'Наша B2B-команда проверит данные вашей компании и активирует студию и витрину производителя.',
                  ar: 'سيقوم فريقنا بالتحقق من بيانات شركتك وتفعيل استوديو المصنع ومعرض المنتجات.',
                  de: 'Unser B2B-Team prüft Ihre Unternehmensdaten und schaltet Ihr Hersteller-Studio frei.',
                  fr: 'Notre équipe B2B vérifiera vos coordonnées et activera votre vitrine fabricant.',
                  pl: 'Nasz zespół B2B zweryfikuje dane firmy i aktywuje Twoje studio producenta.',
                  bg: 'Нашият B2B екип ще провери данните на фирмата и ще активира профила ви.',
                ),
                actionLabel: AppStrings.t(lang, 'close'),
                onAction: () => Navigator.of(context).pop(),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    EditorialCard(
                      padding: const EdgeInsets.all(16),
                      backgroundColor: Colors.white,
                      borderColor:
                          AppColors.champagneGold.withValues(alpha: 0.55),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: AppColors.warmIvory,
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusSm),
                            ),
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.factory_outlined,
                              color: AppColors.editorialGold,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppStrings.t(lang, 'supplier_apply'),
                                  style: const TextStyle(
                                    fontFamily: AppColors.serifFontFamily,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  UiText.pick(
                                    lang,
                                    tr: 'Üretici ve toptancı firmanızın gerçek ticari unvanı ile global B2B alıcılara doğrudan ulaşın.',
                                    en: 'Reach global B2B wholesale buyers directly under your verified factory & brand identity.',
                                    ru: 'Продавайте оптом глобальным B2B-покупателям напрямую от лица вашего бренда.',
                                    ar: 'تواصل مباشرة مع مشتري الجملة العالميين تحت اسم مصنعك وعلامتك التجارية الموثقة.',
                                    de: 'Erreichen Sie globale B2B-Einkäufer direkt unter Ihrer verifizierten Herstellermarke.',
                                    fr: 'Touchez directement les acheteurs B2B mondiaux sous votre identité de fabricant.',
                                    pl: 'Dotrzyj bezpośrednio do globalnych kupców B2B pod zweryfikowaną marką producenta.',
                                    bg: 'Достигнете директно до глобални B2B купувачи с вашия верифициран бранд.',
                                  ),
                                  style: const TextStyle(
                                    fontSize: 12.2,
                                    color: AppColors.sonicSilver,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    EditorialCard(
                      padding: const EdgeInsets.all(18),
                      borderRadius: AppColors.radiusLg,
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _companyCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: InputDecoration(
                                labelText:
                                    '${AppStrings.t(lang, 'company_name')} *',
                                hintText: 'Örn: Lustrin Tekstil San. Tic. Ltd.',
                              ),
                              validator: (v) =>
                                  (v == null || v.trim().length < 2)
                                      ? AppStrings.t(lang, 'err_validation')
                                      : null,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _contactCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: InputDecoration(
                                labelText:
                                    '${AppStrings.t(lang, 'sender_name')} *',
                              ),
                              validator: (v) =>
                                  (v == null || v.trim().length < 2)
                                      ? AppStrings.t(lang, 'err_validation')
                                      : null,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                labelText: '${AppStrings.t(lang, 'email')} *',
                              ),
                              validator: (v) =>
                                  (v == null || !v.contains('@'))
                                      ? AppStrings.t(lang, 'err_validation')
                                      : null,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _phoneCtrl,
                              keyboardType: TextInputType.phone,
                              decoration: InputDecoration(
                                labelText: '${AppStrings.t(lang, 'phone')} *',
                                hintText: '+90 5XX XXX XX XX',
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
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _cityCtrl,
                                    decoration: InputDecoration(
                                      labelText:
                                          '${AppStrings.t(lang, 'state_province')} *',
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
                                    controller: _districtCtrl,
                                    decoration: InputDecoration(
                                      labelText:
                                          '${AppStrings.t(lang, 'city_district')} *',
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
                            TextFormField(
                              controller: _categoryCtrl,
                              decoration: InputDecoration(
                                labelText: AppStrings.t(lang, 'categories'),
                                hintText: UiText.pick(
                                  lang,
                                  tr: 'Kadın Giyim, Erkek Giyim, Tesettür...',
                                  en: 'Womenswear, Menswear, Evening Dress...',
                                  ru: 'Женская, мужская, вечерняя одежда...',
                                  ar: 'ملابس نسائية، رجالية، سهرة...',
                                  de: 'Damenmode, Herrenmode, Abendmode...',
                                  fr: 'Femme, Homme, Robes de soirée...',
                                  pl: 'Odzież damska, męska, wieczorowa...',
                                  bg: 'Дамска, мъжка, вечерна мода...',
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _instagramCtrl,
                              decoration: InputDecoration(
                                labelText:
                                    AppStrings.t(lang, 'instagram_handle'),
                                hintText: '@brandname',
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _websiteCtrl,
                              keyboardType: TextInputType.url,
                              decoration: InputDecoration(
                                labelText: AppStrings.t(lang, 'website_url'),
                                hintText: 'https://...',
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _notesCtrl,
                              maxLines: 3,
                              decoration: InputDecoration(
                                labelText:
                                    AppStrings.t(lang, 'brand_description'),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.dangerLight,
                                  borderRadius:
                                      BorderRadius.circular(AppColors.radiusSm),
                                  border: Border.all(
                                    color:
                                        AppColors.danger.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
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
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusMd,
                                    ),
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
                                        AppStrings.tUpper(
                                          lang,
                                          'register_submit',
                                        ),
                                        style: TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing:
                                              AppStrings.letterSpacing(
                                            lang,
                                            0.9,
                                          ),
                                        ),
                                      ),
                              ),
                            ),
                          ],
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
