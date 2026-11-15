import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/address_validator.dart';
import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../core/phone_validator.dart';
import '../../models/user.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';

class AddressBookScreen extends StatefulWidget {
  final bool selectionMode;

  const AddressBookScreen({super.key, this.selectionMode = false});

  @override
  State<AddressBookScreen> createState() => _AddressBookScreenState();
}

class _AddressBookScreenState extends State<AddressBookScreen> {
  List<CustomerAddress> _addresses = <CustomerAddress>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/profile/addresses',
            pageTitle: 'Address Book',
          );
      _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list =
          await context.read<SessionProvider>().api.listCustomerAddresses();
      if (!mounted) return;
      setState(() => _addresses = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openEditor({CustomerAddress? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radiusLg),
        ),
      ),
      builder: (_) => _AddressEditorModal(existing: existing),
    );
    if (saved == true && mounted) {
      await _load();
    }
  }

  Future<void> _confirmDelete(CustomerAddress addr) async {
    final lang = context.read<SessionProvider>().languageCode;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        title: Text(AppStrings.t(lang, 'delete_address')),
        content: Text(addr.title.isNotEmpty ? addr.title : addr.addressLine),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t(lang, 'cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
            ),
            child: Text(AppStrings.t(lang, 'delete')),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;

    try {
      await context.read<SessionProvider>().api.deleteCustomerAddress(addr.id);
      if (!mounted) return;
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'address_book'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        backgroundColor: AppColors.obsidian,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusMd),
        ),
        icon: const Icon(Icons.add_location_alt_outlined, size: 19),
        label: Text(
          AppStrings.t(lang, 'add_address'),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : _addresses.isEmpty
                  ? EditorialEmptyState(
                      icon: Icons.location_on_outlined,
                      title: AppStrings.t(lang, 'empty'),
                      subtitle: UiText.pick(
                        lang,
                        tr: 'Henüz kayıtlı teslimat veya fatura adresiniz yok.',
                        en: 'No saved shipping or billing addresses yet.',
                        ru: 'Сохраненных адресов доставки или оплаты пока нет.',
                        ar: 'لا توجد عناوين شحن أو فواتير محفوظة بعد.',
                        de: 'Noch keine gespeicherten Liefer- oder Rechnungsadressen.',
                        fr: 'Aucune adresse de livraison ou de facturation enregistrée.',
                        pl: 'Brak zapisanych adresów dostawy lub rozliczeniowych.',
                        bg: 'Все още няма запазени адреси за доставка или фактуриране.',
                      ),
                      actionLabel: AppStrings.t(lang, 'add_address'),
                      onAction: () => _openEditor(),
                    )
                  : RefreshIndicator(
                      color: AppColors.obsidian,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 88),
                        itemCount: _addresses.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final a = _addresses[index];
                          final typeLabel = a.addressType == 'billing'
                              ? AppStrings.t(lang, 'address_type_billing')
                              : AppStrings.t(lang, 'address_type_shipping');

                          return EditorialCard(
                            onTap: widget.selectionMode
                                ? () => Navigator.of(context).pop(a)
                                : null,
                            padding: const EdgeInsets.all(16),
                            borderColor: a.isDefault
                                ? AppColors.champagneGold.withValues(alpha: 0.7)
                                : AppColors.cultured,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        a.title.isNotEmpty
                                            ? a.title
                                            : typeLabel,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: AppColors.serifFontFamily,
                                          fontSize: 15.5,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    EditorialBadge(
                                      label: typeLabel,
                                      backgroundColor: AppColors.warmIvory,
                                      languageCode: lang,
                                    ),
                                    if (a.isDefault) ...[
                                      const SizedBox(width: 6),
                                      EditorialBadge(
                                        label: AppStrings.t(
                                          lang,
                                          'default_badge',
                                        ),
                                        backgroundColor: AppColors.obsidian,
                                        textColor: AppColors.champagneGold,
                                        borderColor: AppColors.obsidian,
                                        languageCode: lang,
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  [
                                    if (a.recipientName.trim().isNotEmpty)
                                      a.recipientName.trim(),
                                    if ((a.companyName ?? '').trim().isNotEmpty)
                                      a.companyName!.trim(),
                                  ].join(' • '),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.obsidian,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  a.formattedFullAddress,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    color: AppColors.onyx,
                                    height: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  a.phone,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.sonicSilver,
                                  ),
                                ),
                                if ((a.taxNoTCKN ?? '').isNotEmpty ||
                                    (a.taxOffice ?? '').isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    [
                                      if ((a.taxOffice ?? '').isNotEmpty)
                                        a.taxOffice!,
                                      if ((a.taxNoTCKN ?? '').isNotEmpty)
                                        a.taxNoTCKN!,
                                    ].join(' • '),
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.mutedAccessible,
                                    ),
                                  ),
                                ],
                                const Divider(height: 18),
                                Row(
                                  children: [
                                    if (widget.selectionMode)
                                      Expanded(
                                        child: ElevatedButton(
                                          onPressed: () =>
                                              Navigator.of(context).pop(a),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.obsidian,
                                            foregroundColor: Colors.white,
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(
                                                AppColors.radiusSm,
                                              ),
                                            ),
                                          ),
                                          child: Text(AppStrings.t(lang, 'confirm')),
                                        ),
                                      )
                                    else
                                      const Spacer(),
                                    TextButton.icon(
                                      onPressed: () => _openEditor(existing: a),
                                      icon: const Icon(
                                        Icons.edit_outlined,
                                        size: 16,
                                      ),
                                      label: Text(AppStrings.t(lang, 'edit')),
                                    ),
                                    TextButton.icon(
                                      onPressed: () => _confirmDelete(a),
                                      style: TextButton.styleFrom(
                                        foregroundColor: AppColors.danger,
                                      ),
                                      icon: const Icon(
                                        Icons.delete_outline_rounded,
                                        size: 16,
                                      ),
                                      label: Text(AppStrings.t(lang, 'delete')),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class _AddressEditorModal extends StatefulWidget {
  final CustomerAddress? existing;

  const _AddressEditorModal({this.existing});

  @override
  State<_AddressEditorModal> createState() => _AddressEditorModalState();
}

class _AddressEditorModalState extends State<_AddressEditorModal> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressLineCtrl = TextEditingController();
  final _postalCtrl = TextEditingController();
  final _taxNoCtrl = TextEditingController();
  final _taxOfficeCtrl = TextEditingController();
  final _stateManualCtrl = TextEditingController();
  final _cityManualCtrl = TextEditingController();

  String _addressType = 'shipping';
  bool _isDefault = false;
  bool _submitting = false;
  bool _loadingLocations = false;
  String? _error;

  List<LocationItem> _countries = <LocationItem>[];
  List<LocationItem> _states = <LocationItem>[];
  List<LocationItem> _cities = <LocationItem>[];

  LocationItem? _selectedCountry;
  LocationItem? _selectedState;
  LocationItem? _selectedCity;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _addressType = e.addressType.isNotEmpty ? e.addressType : 'shipping';
      _titleCtrl.text = e.title;
      _firstNameCtrl.text = e.firstName;
      _lastNameCtrl.text = e.lastName;
      if (_firstNameCtrl.text.isEmpty && e.recipientName.isNotEmpty) {
        final parts = e.recipientName.trim().split(RegExp(r'\s+'));
        _firstNameCtrl.text = parts.first;
        if (parts.length > 1) {
          _lastNameCtrl.text = parts.sublist(1).join(' ');
        }
      }
      _companyCtrl.text = e.companyName ?? '';
      _phoneCtrl.text = e.phone;
      _addressLineCtrl.text = e.addressLine;
      _postalCtrl.text = e.postalCode;
      _taxNoCtrl.text = e.taxNoTCKN ?? '';
      _taxOfficeCtrl.text = e.taxOffice ?? '';
      _stateManualCtrl.text = e.state;
      _cityManualCtrl.text = e.city;
      _isDefault = e.isDefault;
    } else {
      final user = context.read<SessionProvider>().customerUser;
      if (user != null) {
        _firstNameCtrl.text = user.firstName;
        _lastNameCtrl.text = user.lastName;
        _phoneCtrl.text = user.phone;
        _taxNoCtrl.text = user.taxNoTCKN;
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCountries());
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _companyCtrl.dispose();
    _phoneCtrl.dispose();
    _addressLineCtrl.dispose();
    _postalCtrl.dispose();
    _taxNoCtrl.dispose();
    _taxOfficeCtrl.dispose();
    _stateManualCtrl.dispose();
    _cityManualCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCountries() async {
    setState(() => _loadingLocations = true);
    try {
      final api = context.read<SessionProvider>().api;
      final countries = await api.listCountries();
      if (!mounted) return;
      LocationItem? initialCountry;
      final existingId = widget.existing?.countryId ?? '';
      final existingName = widget.existing?.country ?? '';
      if (countries.isNotEmpty) {
        initialCountry = countries.firstWhere(
          (c) =>
              c.id == existingId ||
              (existingName.isNotEmpty &&
                  (c.name.toLowerCase() == existingName.toLowerCase() ||
                      c.nameTr.toLowerCase() == existingName.toLowerCase())),
          orElse: () => countries.firstWhere(
            (c) => c.code.toUpperCase() == 'TR',
            orElse: () => countries.first,
          ),
        );
      }
      setState(() {
        _countries = countries;
        _selectedCountry = initialCountry;
      });
      if (initialCountry != null) {
        await _onCountryChanged(initialCountry, preserveExisting: true);
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _onCountryChanged(
    LocationItem country, {
    bool preserveExisting = false,
  }) async {
    setState(() {
      _selectedCountry = country;
      _selectedState = null;
      _selectedCity = null;
      _states = <LocationItem>[];
      _cities = <LocationItem>[];
      _loadingLocations = true;
    });
    try {
      final states =
          await context.read<SessionProvider>().api.listStatesByCountry(
                country.id,
              );
      if (!mounted) return;
      LocationItem? matchState;
      if (preserveExisting && states.isNotEmpty) {
        final sid = widget.existing?.stateId ?? '';
        final sname = widget.existing?.state ?? '';
        for (final s in states) {
          if ((sid.isNotEmpty && s.id == sid) ||
              (sname.isNotEmpty &&
                  (s.name.toLowerCase() == sname.toLowerCase() ||
                      s.nameTr.toLowerCase() == sname.toLowerCase()))) {
            matchState = s;
            break;
          }
        }
      }
      setState(() {
        _states = states;
        _selectedState = matchState;
      });
      if (matchState != null) {
        await _onStateChanged(matchState, preserveExisting: preserveExisting);
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _onStateChanged(
    LocationItem stateItem, {
    bool preserveExisting = false,
  }) async {
    setState(() {
      _selectedState = stateItem;
      _selectedCity = null;
      _cities = <LocationItem>[];
      _loadingLocations = true;
    });
    try {
      final cities = await context
          .read<SessionProvider>()
          .api
          .listCitiesByState(stateItem.id);
      if (!mounted) return;
      LocationItem? matchCity;
      if (preserveExisting && cities.isNotEmpty) {
        final cid = widget.existing?.cityId ?? '';
        final cname = widget.existing?.city ?? '';
        for (final c in cities) {
          if ((cid.isNotEmpty && c.id == cid) ||
              (cname.isNotEmpty &&
                  (c.name.toLowerCase() == cname.toLowerCase() ||
                      c.nameTr.toLowerCase() == cname.toLowerCase()))) {
            matchCity = c;
            break;
          }
        }
      }
      setState(() {
        _cities = cities;
        _selectedCity = matchCity;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingLocations = false);
    }
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

    if (_selectedCountry == null ||
        (_states.isNotEmpty && _selectedState == null) ||
        (_cities.isNotEmpty && _selectedCity == null)) {
      setState(
        () => _error = UiText.pick(
          lang,
          tr: 'Lütfen ülke, il ve ilçe seçimini eksiksiz yapın.',
          en: 'Please complete country, state/province, and city selection.',
          ru: 'Пожалуйста, выберите страну, регион и город.',
          ar: 'يرجى تحديد البلد والولاية والمدينة بالكامل.',
          de: 'Bitte wählen Sie Land, Bundesland/Provinz und Stadt vollständig aus.',
          fr: 'Veuillez sélectionner le pays, la région et la ville.',
          pl: 'Proszę wybrać kraj, region i miasto.',
          bg: 'Моля, изберете държава, област и град.',
        ),
      );
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final first = _firstNameCtrl.text.trim();
      final last = _lastNameCtrl.text.trim();
      final fullName = '$first $last'.trim();
      final stateName = _selectedState?.localizedName(lang) ??
          _stateManualCtrl.text.trim();
      final cityName =
          _selectedCity?.localizedName(lang) ?? _cityManualCtrl.text.trim();
      final countryName =
          _selectedCountry?.localizedName(lang) ?? 'Türkiye';

      final addr = CustomerAddress(
        id: widget.existing?.id ?? '',
        title: _titleCtrl.text.trim(),
        addressType: _addressType,
        firstName: first,
        lastName: last,
        recipientName: fullName,
        companyName: _companyCtrl.text.trim(),
        phone: phoneCheck.normalized,
        countryId: _selectedCountry?.id ?? widget.existing?.countryId ?? '',
        stateId: _selectedState?.id,
        cityId: _selectedCity?.id,
        addressLine: _addressLineCtrl.text.trim(),
        city: cityName,
        state: stateName,
        country: countryName,
        postalCode: _postalCtrl.text.trim(),
        taxNoTCKN: _taxNoCtrl.text.trim(),
        taxOffice: _taxOfficeCtrl.text.trim(),
        isDefault: _isDefault,
      );

      if (widget.existing == null) {
        await session.api.createCustomerAddressPayload(addr);
      } else {
        await session.api.updateCustomerAddress(widget.existing!.id, addr);
      }

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.90,
          maxChildSize: 0.96,
          minChildSize: 0.55,
          builder: (context, scrollCtrl) => SingleChildScrollView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: Form(
              key: _formKey,
              child: Column(
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
                        child: Text(
                          widget.existing == null
                              ? AppStrings.tUpper(lang, 'add_address')
                              : AppStrings.tUpper(lang, 'edit_address'),
                          style: TextStyle(
                            fontFamily: AppColors.serifFontFamily,
                            fontSize: 15.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: AppStrings.letterSpacing(lang, 0.9),
                            color: AppColors.obsidian,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(false),
                        icon: const Icon(Icons.close_rounded, size: 20),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          selected: _addressType == 'shipping',
                          onSelected: (_) =>
                              setState(() => _addressType = 'shipping'),
                          label: SizedBox(
                            width: double.infinity,
                            child: Text(
                              AppStrings.t(lang, 'address_type_shipping'),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          selectedColor: AppColors.obsidian,
                          labelStyle: TextStyle(
                            color: _addressType == 'shipping'
                                ? Colors.white
                                : AppColors.obsidian,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ChoiceChip(
                          selected: _addressType == 'billing',
                          onSelected: (_) =>
                              setState(() => _addressType = 'billing'),
                          label: SizedBox(
                            width: double.infinity,
                            child: Text(
                              AppStrings.t(lang, 'address_type_billing'),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          selectedColor: AppColors.obsidian,
                          labelStyle: TextStyle(
                            color: _addressType == 'billing'
                                ? Colors.white
                                : AppColors.obsidian,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _titleCtrl,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'address_title')} *',
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? AppStrings.t(lang, 'err_validation')
                        : null,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _firstNameCtrl,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'first_name')} *',
                          ),
                          validator: (v) => AddressValidator.validatePersonName(
                            v ?? '',
                            lang: lang,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _lastNameCtrl,
                          decoration: InputDecoration(
                            labelText:
                                '${AppStrings.t(lang, 'last_name')} *',
                          ),
                          validator: (v) => AddressValidator.validatePersonName(
                            v ?? '',
                            lang: lang,
                          ),
                        ),
                      ),
                    ],
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
                      return check.isValid
                          ? null
                          : check.localizedError(lang);
                    },
                  ),
                  const SizedBox(height: 12),
                  if (_loadingLocations)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: LinearProgressIndicator(
                        minHeight: 2,
                        color: AppColors.obsidian,
                      ),
                    ),
                  if (_countries.isNotEmpty) ...[
                    DropdownButtonFormField<LocationItem>(
                      key: ValueKey(
                        'addr_country_${_selectedCountry?.id ?? 'none'}',
                      ),
                      initialValue: _selectedCountry,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: '${AppStrings.t(lang, 'country')} *',
                      ),
                      items: _countries
                          .map(
                            (c) => DropdownMenuItem(
                              value: c,
                              child: Text(
                                c.localizedName(lang),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      validator: (v) =>
                          v == null ? AppStrings.t(lang, 'err_validation') : null,
                      onChanged: (v) {
                        if (v != null) _onCountryChanged(v);
                      },
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (_states.isNotEmpty) ...[
                    DropdownButtonFormField<LocationItem>(
                      key: ValueKey(
                        'addr_state_${_selectedCountry?.id ?? 'none'}_${_selectedState?.id ?? 'none'}',
                      ),
                      initialValue: _selectedState,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: '${AppStrings.t(lang, 'state_province')} *',
                      ),
                      items: _states
                          .map(
                            (s) => DropdownMenuItem(
                              value: s,
                              child: Text(
                                s.localizedName(lang),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      validator: (v) =>
                          v == null ? AppStrings.t(lang, 'err_validation') : null,
                      onChanged: (v) {
                        if (v != null) _onStateChanged(v);
                      },
                    ),
                    const SizedBox(height: 10),
                  ] else if (!_loadingLocations && _selectedCountry != null) ...[
                    TextFormField(
                      controller: _stateManualCtrl,
                      decoration: InputDecoration(
                        labelText: AppStrings.t(lang, 'state_province'),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (_cities.isNotEmpty) ...[
                    DropdownButtonFormField<LocationItem>(
                      key: ValueKey(
                        'addr_city_${_selectedState?.id ?? 'none'}_${_selectedCity?.id ?? 'none'}',
                      ),
                      initialValue: _selectedCity,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: '${AppStrings.t(lang, 'city_district')} *',
                      ),
                      items: _cities
                          .map(
                            (c) => DropdownMenuItem(
                              value: c,
                              child: Text(
                                c.localizedName(lang),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      validator: (v) =>
                          v == null ? AppStrings.t(lang, 'err_validation') : null,
                      onChanged: (v) => setState(() => _selectedCity = v),
                    ),
                    const SizedBox(height: 10),
                  ] else if (!_loadingLocations &&
                      (_states.isEmpty || _selectedState != null)) ...[
                    TextFormField(
                      controller: _cityManualCtrl,
                      decoration: InputDecoration(
                        labelText: AppStrings.t(lang, 'city_district'),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextFormField(
                    controller: _addressLineCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'address_line')} *',
                    ),
                    validator: (v) => AddressValidator.validateStreetAddress(
                      v ?? '',
                      lang: lang,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _postalCtrl,
                    decoration: InputDecoration(
                      labelText: '${AppStrings.t(lang, 'postal_code')} *',
                    ),
                    validator: (v) => AddressValidator.validatePostalCode(
                      v ?? '',
                      lang: lang,
                      required: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _taxNoCtrl,
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'tax_no_tckn'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _taxOfficeCtrl,
                          decoration: InputDecoration(
                            labelText: AppStrings.t(lang, 'tax_office'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.obsidian,
                    value: _isDefault,
                    onChanged: (v) => setState(() => _isDefault = v ?? false),
                    title: Text(
                      AppStrings.t(lang, 'set_default_address'),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
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
                  const SizedBox(height: 14),
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
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              AppStrings.tUpper(lang, 'save'),
                              style: TextStyle(
                                fontSize: 12.5,
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
      ),
    );
  }
}
