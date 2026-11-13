import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../providers/supplier_provider.dart';
import '../../widgets/country_flag_icon.dart';
import 'utils/supplier_l10n.dart';
import 'widgets/supplier_editorial_widgets.dart';

/// Full 17-field Editorial Brand Profile editor (`GET/PUT /api/v1/supplier/profile`).
class SupplierEditorialProfileScreen extends StatefulWidget {
  final bool showAppBar;

  const SupplierEditorialProfileScreen({super.key, this.showAppBar = true});

  @override
  State<SupplierEditorialProfileScreen> createState() =>
      _SupplierEditorialProfileScreenState();
}

class _SupplierEditorialProfileScreenState
    extends State<SupplierEditorialProfileScreen> {
  final _brandNameCtrl = TextEditingController();
  final _publicEmailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _instagramCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _moqCtrl = TextEditingController();
  final _exportInputCtrl = TextEditingController();
  final _primaryDescCtrl = TextEditingController();
  final _bankNameCtrl = TextEditingController();
  final _bankHolderCtrl = TextEditingController();
  final _ibanCtrl = TextEditingController();

  final Map<String, TextEditingController> _localizedDescCtrls = {
    for (final c in AppStrings.supportedCodes) c: TextEditingController(),
  };

  String _companyType = 'uretici_toptanci';
  bool _supportsPrivateLabel = false;
  bool _supportsFason = false;
  final List<String> _exportTags = [];
  String _activeDescLang = 'tr';

  bool _hydrated = false;
  bool _saving = false;
  bool _translating = false;
  String? _loadError;

  static const List<String> _companyTypes = [
    'uretici',
    'toptanci',
    'uretici_toptanci',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final session = context.read<SessionProvider>();
      unawaited(
        session.telemetry.trackScreenView(
          path: '/supplier/profile',
          pageTitle: AppStrings.t(
            session.languageCode,
            'supplier_profile_editorial',
          ),
        ),
      );
      _loadProfile();
    });
  }

  @override
  void dispose() {
    _brandNameCtrl.dispose();
    _publicEmailCtrl.dispose();
    _phoneCtrl.dispose();
    _whatsappCtrl.dispose();
    _websiteCtrl.dispose();
    _instagramCtrl.dispose();
    _addressCtrl.dispose();
    _moqCtrl.dispose();
    _exportInputCtrl.dispose();
    _primaryDescCtrl.dispose();
    _bankNameCtrl.dispose();
    _bankHolderCtrl.dispose();
    _ibanCtrl.dispose();
    for (final c in _localizedDescCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadProfile({bool force = false}) async {
    final sup = context.read<SupplierProvider>();
    setState(() => _loadError = null);
    try {
      if (force || sup.editorialProfile == null) {
        await sup.loadEditorialProfile();
      }
      if (!mounted) return;
      final p = sup.editorialProfile;
      if (p != null) _populateFields(p);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _populateFields(SupplierEditorialProfile p) {
    _brandNameCtrl.text = p.brandName;
    _publicEmailCtrl.text = p.publicEmail;
    _phoneCtrl.text = p.phone;
    _whatsappCtrl.text = p.whatsappPhone;
    _websiteCtrl.text = p.website;
    _instagramCtrl.text = p.instagramHandle;
    _addressCtrl.text = p.locationAddress;
    _moqCtrl.text = '${p.minOrderQuantity > 0 ? p.minOrderQuantity : 1}';
    _primaryDescCtrl.text = p.description;
    _bankNameCtrl.text = p.bankName;
    _bankHolderCtrl.text = p.bankAccountHolder;
    _ibanCtrl.text = p.iban;

    _companyType = _companyTypes.contains(p.companyType.trim().toLowerCase())
        ? p.companyType.trim().toLowerCase()
        : 'uretici_toptanci';
    _supportsPrivateLabel = p.supportsPrivateLabel;
    _supportsFason = p.supportsFason;

    _exportTags
      ..clear()
      ..addAll(
        p.exportCountries
            .split(RegExp(r'[,;\n]+'))
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty),
      );

    for (final code in AppStrings.supportedCodes) {
      final text = p.descriptionTranslations[code] ??
          (code == 'tr' ? p.description : '');
      _localizedDescCtrls[code]!.text = text;
    }

    setState(() => _hydrated = true);
  }

  void _addExportCountry([String? preset]) {
    final raw = (preset ?? _exportInputCtrl.text).trim();
    if (raw.isEmpty) return;
    final parts = raw
        .split(RegExp(r'[,;\n]+'))
        .map((e) => e.trim().toUpperCase())
        .where((e) => e.isNotEmpty);
    setState(() {
      for (final p in parts) {
        if (!_exportTags.contains(p)) _exportTags.add(p);
      }
      if (preset == null) _exportInputCtrl.clear();
    });
  }

  Future<void> _autoTranslateDescription() async {
    final lang = context.read<SessionProvider>().languageCode;
    final trSource = _localizedDescCtrls['tr']!.text.trim().isNotEmpty
        ? _localizedDescCtrls['tr']!.text.trim()
        : _primaryDescCtrl.text.trim();
    if (trSource.isEmpty) {
      _showMsg(AppStrings.t(lang, 'err_validation'), isError: true);
      return;
    }

    setState(() => _translating = true);
    try {
      final result = await context
          .read<SupplierProvider>()
          .autoTranslateFields(
            {'description': trSource},
            sourceLang: 'tr',
          );
      if (!mounted) return;
      result.forEach((code, values) {
        final normalized = AppStrings.normalizeCode(code);
        final translated = (values['description'] ?? '').trim();
        if (translated.isNotEmpty && _localizedDescCtrls[normalized] != null) {
          _localizedDescCtrls[normalized]!.text = translated;
        }
      });
      if (_localizedDescCtrls['tr']!.text.trim().isEmpty) {
        _localizedDescCtrls['tr']!.text = trSource;
      }
      setState(() => _translating = false);
      _showMsg(AppStrings.t(lang, 'success'));
    } catch (e) {
      if (!mounted) return;
      setState(() => _translating = false);
      _showMsg(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  Future<void> _saveProfile() async {
    final lang = context.read<SessionProvider>().languageCode;
    final current = context.read<SupplierProvider>().editorialProfile;
    if (current == null) return;

    final pendingTag = _exportInputCtrl.text.trim();
    if (pendingTag.isNotEmpty) _addExportCountry(pendingTag);

    final descMap = <String, String>{};
    _localizedDescCtrls.forEach((code, ctrl) {
      final txt = ctrl.text.trim();
      if (txt.isNotEmpty) descMap[code] = txt;
    });

    final primaryDesc = _primaryDescCtrl.text.trim().isNotEmpty
        ? _primaryDescCtrl.text.trim()
        : (descMap['tr'] ?? '');

    final updated = current.copyWith(
      brandName: _brandNameCtrl.text.trim(),
      companyType: _companyType,
      description: primaryDesc,
      descriptionTranslations: descMap,
      phone: _phoneCtrl.text.trim(),
      whatsappPhone: _whatsappCtrl.text.trim(),
      publicEmail: _publicEmailCtrl.text.trim(),
      website: _websiteCtrl.text.trim(),
      instagramHandle: _instagramCtrl.text.trim(),
      locationAddress: _addressCtrl.text.trim(),
      exportCountries: _exportTags.join(', '),
      minOrderQuantity: int.tryParse(_moqCtrl.text.trim()) ?? 1,
      supportsPrivateLabel: _supportsPrivateLabel,
      supportsFason: _supportsFason,
      bankName: _bankNameCtrl.text.trim(),
      bankAccountHolder: _bankHolderCtrl.text.trim(),
      iban: _ibanCtrl.text.trim(),
    );

    setState(() => _saving = true);
    try {
      await context.read<SupplierProvider>().saveEditorialProfile(updated);
      if (!mounted) return;
      setState(() => _saving = false);
      _showMsg(AppStrings.t(lang, 'profile_saved'));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      _showMsg(e.toString().replaceFirst('Exception: ', ''), isError: true);
    }
  }

  void _showMsg(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.emerald,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final sup = context.watch<SupplierProvider>();
    final profile = sup.editorialProfile;

    if (profile != null && !_hydrated) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_hydrated) _populateFields(profile);
      });
    }

    final body = sup.loadingProfile && profile == null
        ? const Center(
            child: CircularProgressIndicator(color: AppColors.luxuryBronze),
          )
        : _loadError != null && profile == null
        ? EditorialEmptyState(
            icon: Icons.storefront_outlined,
            message: _loadError!,
            actionLabel: AppStrings.t(lang, 'retry'),
            onAction: () => _loadProfile(force: true),
          )
        : profile == null
        ? EditorialEmptyState(
            icon: Icons.storefront_outlined,
            message: AppStrings.t(lang, 'empty'),
            actionLabel: AppStrings.t(lang, 'retry'),
            onAction: () => _loadProfile(force: true),
          )
        : RefreshIndicator(
            color: AppColors.luxuryBronze,
            onRefresh: () => _loadProfile(force: true),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
              children: [
                _buildShowcaseStatusCard(lang, profile),
                const SizedBox(height: 14),
                _buildIdentityCard(lang),
                const SizedBox(height: 14),
                _buildContactSocialCard(lang),
                const SizedBox(height: 14),
                _buildWholesaleCapacityCard(lang),
                const SizedBox(height: 14),
                _buildMultilingualStoryCard(lang),
                const SizedBox(height: 14),
                _buildBankSettlementCard(lang),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _saveProfile,
                    icon: _saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.save_outlined, size: 18),
                    label: Text(AppStrings.t(lang, 'save_profile')),
                  ),
                ),
              ],
            ),
          );

    if (!widget.showAppBar) return body;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: buildSupplierSubPageAppBar(
        context: context,
        title: AppStrings.t(lang, 'supplier_profile_editorial'),
        subtitle: profile?.brandName,
        actions: [
          IconButton(
            tooltip: AppStrings.t(lang, 'save'),
            onPressed: (_saving || profile == null) ? null : _saveProfile,
            icon: const Icon(Icons.check_rounded, size: 22),
          ),
        ],
      ),
      body: body,
    );
  }

  Widget _buildShowcaseStatusCard(
    String lang,
    SupplierEditorialProfile p,
  ) {
    final initial = p.brandName.trim().isNotEmpty
        ? p.brandName.trim().substring(0, 1).toUpperCase()
        : 'M';
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.accentGoldLight,
                  borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  border: Border.all(
                    color: AppColors.luxuryBronze.withValues(alpha: 0.35),
                  ),
                ),
                child: Text(
                  initial,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.luxuryBronze,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.brandName.isNotEmpty ? p.brandName : p.aliasCode,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.obsidian,
                      ),
                    ),
                    if (p.slug.isNotEmpty || p.aliasCode.isNotEmpty)
                      Text(
                        [
                          if (p.aliasCode.isNotEmpty) p.aliasCode,
                          if (p.slug.isNotEmpty) '/${p.slug}',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.mutedAccessible,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              p.isVerified
                  ? EditorialStatusBadge.positive(
                      SupplierL10n.t(lang, 'verified_badge'),
                      icon: Icons.verified_rounded,
                    )
                  : EditorialStatusBadge.bronze(
                      SupplierL10n.t(lang, 'pending_verification'),
                      icon: Icons.hourglass_top_rounded,
                    ),
              p.isActive
                  ? EditorialStatusBadge.positive(
                      SupplierL10n.t(lang, 'active_showcase'),
                    )
                  : EditorialStatusBadge.neutral(
                      SupplierL10n.t(lang, 'inactive_showcase'),
                    ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.warmHairline),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ProfileStatItem(
                  label: AppStrings.t(lang, 'active_products_count'),
                  value: '${p.activeProductCount}/${p.totalProducts}',
                ),
              ),
              Expanded(
                child: _ProfileStatItem(
                  label: AppStrings.t(lang, 'stock'),
                  value: '${p.totalStock}',
                ),
              ),
              Expanded(
                child: _ProfileStatItem(
                  label: SupplierL10n.t(lang, 'kpi_total_orders'),
                  value: '${p.totalOrders}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIdentityCard(String lang) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: SupplierL10n.t(lang, 'brand_identity_section'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _brandNameCtrl,
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'brand_name_label'),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _companyType,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'filter_company_type'),
            ),
            items: _companyTypes
                .map(
                  (t) => DropdownMenuItem(
                    value: t,
                    child: Text(SupplierL10n.companyTypeLabel(lang, t)),
                  ),
                )
                .toList(),
            onChanged: (v) {
              if (v != null) setState(() => _companyType = v);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildContactSocialCard(String lang) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: SupplierL10n.t(lang, 'contact_social_section'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _publicEmailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'public_email'),
              prefixIcon: const Icon(Icons.mail_outline_rounded, size: 18),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'phone'),
              prefixIcon: const Icon(Icons.phone_outlined, size: 18),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _whatsappCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'whatsapp_direct'),
              prefixIcon: const Icon(Icons.chat_outlined, size: 18),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _websiteCtrl,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'website_url'),
              prefixIcon: const Icon(Icons.language_rounded, size: 18),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _instagramCtrl,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'instagram_handle'),
              prefixIcon: const Icon(Icons.camera_alt_outlined, size: 18),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _addressCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'location_address'),
              prefixIcon: const Icon(Icons.location_on_outlined, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWholesaleCapacityCard(String lang) {
    const quickMarkets = ['DE', 'RU', 'SA', 'FR', 'PL', 'BG', 'GB'];
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: SupplierL10n.t(lang, 'wholesale_production_section'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _moqCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'min_order_qty'),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            AppStrings.t(lang, 'export_countries'),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: AppColors.obsidian,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _exportInputCtrl,
                  onSubmitted: (_) => _addExportCountry(),
                  decoration: InputDecoration(
                    hintText: SupplierL10n.t(lang, 'export_tag_hint'),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: _addExportCountry,
                child: Text(SupplierL10n.t(lang, 'add_country')),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: quickMarkets.map((code) {
              final exists = _exportTags.contains(code);
              return ActionChip(
                avatar: CountryFlagIcon(code: code, width: 15, height: 11),
                label: Text(code),
                onPressed: () {
                  setState(() {
                    if (exists) {
                      _exportTags.remove(code);
                    } else {
                      _exportTags.add(code);
                    }
                  });
                },
                backgroundColor: exists
                    ? AppColors.accentGoldLight
                    : AppColors.warmIvory,
                side: BorderSide(
                  color: exists
                      ? AppColors.luxuryBronze
                      : AppColors.warmHairline,
                ),
                labelStyle: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: exists ? AppColors.luxuryBronze : AppColors.charcoal,
                ),
              );
            }).toList(),
          ),
          if (_exportTags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _exportTags.map((tag) {
                return Chip(
                  label: Text(tag),
                  backgroundColor: AppColors.pureWhite,
                  side: const BorderSide(color: AppColors.warmHairline),
                  deleteIconColor: AppColors.mutedAccessible,
                  onDeleted: () => setState(() => _exportTags.remove(tag)),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 8),
          SwitchListTile.adaptive(
            value: _supportsFason,
            onChanged: (v) => setState(() => _supportsFason = v),
            contentPadding: EdgeInsets.zero,
            activeTrackColor: AppColors.luxuryBronze,
            title: Text(
              AppStrings.t(lang, 'fason_badge'),
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
            subtitle: Text(
              SupplierL10n.t(lang, 'fason_desc'),
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.mutedAccessible,
              ),
            ),
          ),
          SwitchListTile.adaptive(
            value: _supportsPrivateLabel,
            onChanged: (v) => setState(() => _supportsPrivateLabel = v),
            contentPadding: EdgeInsets.zero,
            activeTrackColor: AppColors.luxuryBronze,
            title: Text(
              AppStrings.t(lang, 'private_label_badge'),
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
            subtitle: Text(
              SupplierL10n.t(lang, 'private_label_desc'),
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.mutedAccessible,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMultilingualStoryCard(String lang) {
    final activeCtrl = _localizedDescCtrls[_activeDescLang]!;
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: EditorialSectionHeader(
                  lang: lang,
                  title: SupplierL10n.t(lang, 'editorial_story_section'),
                ),
              ),
              TextButton.icon(
                onPressed: _translating ? null : _autoTranslateDescription,
                icon: _translating
                    ? const SizedBox(
                        width: 13,
                        height: 13,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.luxuryBronze,
                        ),
                      )
                    : const Icon(Icons.auto_awesome_rounded, size: 16),
                label: Text(
                  SupplierL10n.t(lang, 'auto_translate_story'),
                  style: const TextStyle(fontSize: 11.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _primaryDescCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: SupplierL10n.t(lang, 'primary_story_label'),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: AppStrings.supportedCodes.map((code) {
              final selected = _activeDescLang == code;
              final filled = _localizedDescCtrls[code]!.text.trim().isNotEmpty;
              return ChoiceChip(
                avatar: CountryFlagIcon(code: code, width: 15, height: 11),
                label: Text(
                  filled ? '${code.toUpperCase()} •' : code.toUpperCase(),
                ),
                selected: selected,
                onSelected: (_) => setState(() => _activeDescLang = code),
                selectedColor: AppColors.accentGoldLight,
                backgroundColor: AppColors.warmIvory,
                side: BorderSide(
                  color: selected
                      ? AppColors.luxuryBronze
                      : AppColors.warmHairline,
                ),
                labelStyle: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.luxuryBronze : AppColors.charcoal,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Directionality(
            textDirection: AppStrings.directionOf(_activeDescLang),
            child: TextField(
              controller: activeCtrl,
              maxLines: 4,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText:
                    '${SupplierL10n.t(lang, 'localized_story_label')} (${_activeDescLang.toUpperCase()})',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBankSettlementCard(String lang) {
    return EditorialSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EditorialSectionHeader(
            lang: lang,
            title: SupplierL10n.t(lang, 'bank_settlement_section'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _bankNameCtrl,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'bank_name'),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _bankHolderCtrl,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'bank_account_holder'),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ibanCtrl,
            decoration: InputDecoration(
              labelText: AppStrings.t(lang, 'iban'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileStatItem extends StatelessWidget {
  final String label;
  final String value;

  const _ProfileStatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.mutedAccessible,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.obsidian,
          ),
        ),
      ],
    );
  }
}
