import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/marketplace.dart';
import '../../models/product.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';

/// Opens a Direct B2B Inquiry modal submitting to `POST /api/v1/store/inquiries`.
Future<void> showDirectInquiryModal(
  BuildContext context, {
  required String brandId,
  required String brandName,
  Product? product,
  int initialPackagesQty = 1,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (_) => _DirectInquirySheet(
      brandId: brandId,
      brandName: brandName,
      product: product,
      initialPackagesQty: initialPackagesQty,
    ),
  );
}

class _DirectInquirySheet extends StatefulWidget {
  final String brandId;
  final String brandName;
  final Product? product;
  final int initialPackagesQty;

  const _DirectInquirySheet({
    required this.brandId,
    required this.brandName,
    this.product,
    this.initialPackagesQty = 1,
  });

  @override
  State<_DirectInquirySheet> createState() => _DirectInquirySheetState();
}

class _DirectInquirySheetState extends State<_DirectInquirySheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();

  late int _packagesQty;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _packagesQty = widget.initialPackagesQty;
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final user = session.customerUser;
    if (user != null) {
      _nameCtrl.text = user.fullName;
      _phoneCtrl.text = user.phone;
      _emailCtrl.text = user.email;
      _addressCtrl.text = user.deliveryAddress;
    }
    if (widget.product != null) {
      final p = widget.product!;
      _messageCtrl.text = UiText.pick(
        lang,
        tr: '${p.localizedTitle(lang)} (SKU: ${p.customSku}) modeli için $_packagesQty seri fiyat ve stok bilgisi talep ediyorum.',
        en: 'Requesting wholesale quote and stock availability for $_packagesQty series of ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
        ru: 'Запрос оптовой цены и наличия для $_packagesQty серий ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
        ar: 'أطلب عرض سعر جملة وتوفر المخزون لعدد $_packagesQty سيري من ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
        de: 'Anfrage zu Großhandelspreis und Verfügbarkeit für $_packagesQty Serien ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
        fr: 'Demande de tarif de gros et stock pour $_packagesQty séries de ${p.localizedTitle(lang)} (SKU : ${p.customSku}).',
        pl: 'Zapytanie o cenę hurtową i dostępność $_packagesQty serii ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
        bg: 'Запитване за цена на едро и наличност за $_packagesQty серии ${p.localizedTitle(lang)} (SKU: ${p.customSku}).',
      );
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _companyCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _messageCtrl.dispose();
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
      final p = widget.product;
      final items = <DirectInquiryItemPayload>[
        if (p != null)
          DirectInquiryItemPayload(
            productId: p.id,
            title: p.localizedTitle(lang),
            customSku: p.customSku,
            quantity: _packagesQty * p.unitsPerPackage,
            price: p.discountedPrice ?? p.price,
          ),
      ];

      final res = await session.api.submitDirectInquiry(
        DirectInquiryPayload(
          fullName: _nameCtrl.text.trim(),
          companyName: _companyCtrl.text.trim(),
          phone: phoneCheck.normalized,
          email: _emailCtrl.text.trim(),
          message: _messageCtrl.text.trim(),
          deliveryAddress: _addressCtrl.text.trim(),
          items: items,
        ),
      );

      await session.telemetry.trackBrandEvent(
        brandId: widget.brandId,
        eventType: 'inquiry',
        productId: p?.id ?? '',
      );

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            AppStrings.t(lang, 'inquiry_sent_success'),
            style: const TextStyle(color: Colors.white),
          ),
          action: res.whatsappUrl.isNotEmpty
              ? SnackBarAction(
                  label: 'WhatsApp',
                  textColor: AppColors.champagneGold,
                  onPressed: () {
                    final uri = Uri.tryParse(res.whatsappUrl);
                    if (uri != null) {
                      launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
                  },
                )
              : null,
        ),
      );
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
    final p = widget.product;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.warmHairline,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppStrings.tUpper(lang, 'direct_inquiry'),
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing:
                                  AppStrings.letterSpacing(lang, 1.2),
                              color: AppColors.editorialGold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.brandName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: AppColors.serifFontFamily,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ),
                  ],
                ),
                if (p != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.warmIvory,
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      border: Border.all(color: AppColors.cultured),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${p.localizedTitle(lang)} • SKU: ${p.customSku}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: _packagesQty > p.minOrderPackages
                                  ? () => setState(() => _packagesQty--)
                                  : null,
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                            Text(
                              '$_packagesQty ${AppStrings.t(lang, 'package')}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => setState(() => _packagesQty++),
                              icon: const Icon(Icons.add_circle_outline),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                TextFormField(
                  controller: _nameCtrl,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t(lang, 'sender_name')} *',
                  ),
                  validator: (v) => (v == null || v.trim().length < 2)
                      ? AppStrings.t(lang, 'err_validation')
                      : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _companyCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'company_name'),
                  ),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t(lang, 'phone')} *',
                    hintText: '+90 5XX XXX XX XX',
                  ),
                  validator: (v) {
                    final check = PhoneValidator.normalizeAndValidate(
                      v ?? '',
                      lang: lang,
                    );
                    return check.isValid ? null : check.localizedError(lang);
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t(lang, 'email')} *',
                  ),
                  validator: (v) => (v == null || !v.contains('@'))
                      ? AppStrings.t(lang, 'err_validation')
                      : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _addressCtrl,
                  decoration: InputDecoration(
                    labelText: AppStrings.t(lang, 'location_address'),
                  ),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _messageCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: '${UiText.pick(
                      lang,
                      tr: 'Mesajınız / Talebiniz',
                      en: 'Your Message / Request',
                      ru: 'Ваше сообщение / запрос',
                      ar: 'رسالتك / طلبك',
                      de: 'Ihre Nachricht / Anfrage',
                      fr: 'Votre message / demande',
                      pl: 'Twoja wiadomość / zapytanie',
                      bg: 'Вашето съобщение / запитване',
                    )} *',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? AppStrings.t(lang, 'err_validation')
                      : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.dangerLight,
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
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
                const SizedBox(height: 16),
                SizedBox(
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.obsidian,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            AppStrings.tUpper(lang, 'send_inquiry'),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing:
                                  AppStrings.letterSpacing(lang, 1.0),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
