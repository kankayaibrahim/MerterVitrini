import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';

/// Non-blocking modal sheet prompting logged-in customers without a verified
/// WhatsApp/phone number to complete it so B2B prices & checkout unlock.
Future<bool> showPhoneCompletionModal(BuildContext context) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppColors.radiusLg),
      ),
    ),
    builder: (_) => const PhoneCompletionSheet(),
  );
  return saved == true;
}

class PhoneCompletionSheet extends StatefulWidget {
  const PhoneCompletionSheet({super.key});

  @override
  State<PhoneCompletionSheet> createState() => _PhoneCompletionSheetState();
}

class _PhoneCompletionSheetState extends State<PhoneCompletionSheet> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  bool _submitting = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/phone-completion',
            pageTitle: 'Phone Completion Gate',
          );
    });
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    final check = PhoneValidator.normalizeAndValidate(
      _phoneCtrl.text,
      lang: lang,
    );
    if (!check.isValid) {
      setState(() => _errorText = check.localizedError(lang));
      return;
    }

    setState(() {
      _submitting = true;
      _errorText = null;
    });

    try {
      await session.completeCustomerPhone(check.normalized);
      await session.telemetry.trackMemberEvent(
        eventType: 'phone_completed',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.obsidian,
          content: Text(
            UiText.pick(
              lang,
              tr: 'WhatsApp / telefon numaranız doğrulandı. Tüm B2B fiyatlar ve sipariş erişimi açıldı.',
              en: 'Phone / WhatsApp verified. B2B wholesale prices and checkout are now unlocked.',
              ru: 'Телефон / WhatsApp подтвержден. Оптовые цены и оформление заказов открыты.',
              ar: 'تم تأكيد رقم الهاتف / واتساب. تم فتح أسعار الجملة وإتمام الطلب.',
              de: 'Telefon / WhatsApp bestätigt. B2B-Großhandelspreise und Kasse sind jetzt freigeschaltet.',
              fr: 'Téléphone / WhatsApp vérifié. Les tarifs B2B et la commande sont maintenant débloqués.',
              pl: 'Telefon / WhatsApp zweryfikowany. Ceny B2B i zamówienia są już odblokowane.',
              bg: 'Телефонът / WhatsApp е потвърден. B2B цените на едро и поръчките са отключени.',
            ),
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
      Navigator.of(context).pop(true);
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

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
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
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.warmIvory,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                        border: Border.all(
                          color: AppColors.champagneGold.withValues(alpha: 0.6),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.phone_iphone_rounded,
                        size: 20,
                        color: AppColors.editorialGold,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        AppStrings.t(lang, 'phone_completion_title'),
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close_rounded, size: 20),
                      tooltip: AppStrings.t(lang, 'close'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  AppStrings.t(lang, 'phone_completion_subtitle'),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.sonicSilver,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t(lang, 'phone')} *',
                    hintText: '+90 5XX XXX XX XX',
                    prefixIcon: const Icon(Icons.chat_outlined, size: 19),
                  ),
                ),
                if (_errorText != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.dangerLight,
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      _errorText!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidian,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
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
                          AppStrings.upper(
                            AppStrings.t(lang, 'phone_completion_action'),
                            lang,
                          ),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                          ),
                        ),
                ),
                const SizedBox(height: 6),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(
                    AppStrings.t(lang, 'cancel'),
                    style: const TextStyle(
                      color: AppColors.sonicSilver,
                      fontWeight: FontWeight.w600,
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

/// Non-blocking inline banner surfaced inside CustomerShell whenever
/// `session.requiresPhoneCompletion` is true.
class PhoneCompletionBanner extends StatelessWidget {
  const PhoneCompletionBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    if (!session.requiresPhoneCompletion) return const SizedBox.shrink();
    final lang = session.languageCode;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.warmIvory,
        border: Border(
          bottom: BorderSide(
            color: AppColors.champagneGold.withValues(alpha: 0.6),
          ),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.verified_user_outlined,
            size: 18,
            color: AppColors.editorialGold,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              AppStrings.t(lang, 'phone_completion_title'),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
                height: 1.25,
              ),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () => showPhoneCompletionModal(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.obsidian,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: const Size(0, 34),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
            ),
            child: Text(
              AppStrings.t(lang, 'phone_completion_action'),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
