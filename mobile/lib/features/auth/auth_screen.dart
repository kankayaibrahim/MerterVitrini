import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_config.dart';
import '../../core/app_theme.dart';
import '../../core/phone_validator.dart';
import '../../models/user.dart';
import '../../providers/cart_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import 'supplier_application_screen.dart';

class AuthScreen extends StatefulWidget {
  final AppRole initialRole;
  final bool popOnSuccess;

  const AuthScreen({
    super.key,
    this.initialRole = AppRole.customer,
    this.popOnSuccess = true,
  });

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late AppRole _selectedRole;
  bool _isRegisterMode = false;
  bool _obscurePassword = true;
  bool _submitting = false;

  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.initialRole;
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;

    if (email.isEmpty || password.isEmpty) {
      _showSnack('Lütfen e-posta ve şifrenizi giriniz.', isError: true);
      return;
    }

    setState(() => _submitting = true);
    final session = context.read<SessionProvider>();
    final cart = context.read<CartProvider>();

    try {
      if (_selectedRole == AppRole.customer && _isRegisterMode) {
        if (_firstNameCtrl.text.trim().isEmpty ||
            _lastNameCtrl.text.trim().isEmpty ||
            _phoneCtrl.text.trim().isEmpty) {
          _showSnack('Lütfen tüm kayıt alanlarını doldurunuz.', isError: true);
          setState(() => _submitting = false);
          return;
        }
        final phoneCheck = PhoneValidator.normalizeAndValidate(_phoneCtrl.text);
        if (!phoneCheck.valid) {
          _showSnack(
            phoneCheck.errorMessage ?? 'Geçerli bir cep telefonu numarası giriniz.',
            isError: true,
          );
          setState(() => _submitting = false);
          return;
        }
        await session.registerCustomerAccount(
          firstName: _firstNameCtrl.text,
          lastName: _lastNameCtrl.text,
          email: email,
          phone: phoneCheck.normalized,
          password: password,
        );
        await cart.loadCart();
        if (mounted && widget.popOnSuccess) {
          Navigator.of(context).pop(true);
        }
        return;
      }

      final loggedRole = await session.login(
        email: email,
        password: password,
        role: _selectedRole == AppRole.supplier ? 'supplier' : 'customer',
      );
      if (loggedRole == AppRole.customer) {
        await cart.loadCart();
      }
      if (mounted && widget.popOnSuccess) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : AppColors.obsidian,
      ),
    );
  }

  void _openServerUrlDialog() {
    final ctrl = TextEditingController(text: AppConfig.apiBaseUrl);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sunucu Bağlantı Adresi'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'API Base URL',
            hintText: 'https://mertervitrini.com.tr',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () {
              AppConfig.setRuntimeBaseUrl(ctrl.text);
              Navigator.pop(ctx);
              context.read<SessionProvider>().loadBootstrap();
              _showSnack('Sunucu adresi güncellendi: ${AppConfig.apiBaseUrl}');
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isSupplier = _selectedRole == AppRole.supplier;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'MERTER VİTRİNİ OTURUM MERKEZİ',
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Luxury Obsidian Masthead (long-press opens runtime API base URL dialog)
              GestureDetector(
                onLongPress: _openServerUrlDialog,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.obsidian,
                    border: Border.all(
                      color: AppColors.champagneGold.withValues(alpha: 0.6),
                    ),
                  ),
                  child: Row(
                    children: [
                      const MvEditorialCrest(size: 48),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isSupplier
                                  ? 'ÜRETİCİ & TEDARİKÇİ PORTALI'
                                  : 'KURUMSAL TOPTAN ALIM KULÜBÜ',
                              style: const TextStyle(
                                color: AppColors.champagneGold,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.6,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isSupplier
                                  ? 'Tedarikçi & Üretici Stüdyosu'
                                  : 'Müşteri Toptan Alım Merkezi',
                              style: const TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                color: Colors.white,
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isSupplier
                                  ? 'Kamerayla ürün yükleyin, sipariş ve müşteri sohbetlerini yönetin.'
                                  : 'Merter üreticilerinden seri bazlı doğrudan toptan alım yapın.',
                              style: const TextStyle(
                                color: Color(0xFFD4D4D4),
                                fontSize: 12,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // 2. Architectural Dual-Role Switcher
              Container(
                decoration: BoxDecoration(
                  color: AppColors.editorialOffWhite,
                  border: Border.all(color: AppColors.cultured),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _RoleSegmentButton(
                        title: 'MÜŞTERİ (ALICI)',
                        icon: LuxuryIconKind.bag,
                        selected: !isSupplier,
                        onTap: () => setState(() {
                          _selectedRole = AppRole.customer;
                        }),
                      ),
                    ),
                    Expanded(
                      child: _RoleSegmentButton(
                        title: 'TEDARİKÇİ (ÜRETİCİ)',
                        icon: LuxuryIconKind.studioCamera,
                        selected: isSupplier,
                        onTap: () => setState(() {
                          _selectedRole = AppRole.supplier;
                          _isRegisterMode = false;
                        }),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 3. Form Fields
              if (!isSupplier && _isRegisterMode) ...[
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _firstNameCtrl,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Adınız',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _lastNameCtrl,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Soyadınız',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Cep Telefonu (WhatsApp)',
                    hintText: '+90 5XX XXX XX XX',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: isSupplier
                      ? 'Tedarikçi / Temsilci E-Postası'
                      : 'Kurumsal / Bireysel E-Posta',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordCtrl,
                obscureText: _obscurePassword,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Şifreniz',
                  suffixIcon: IconButton(
                    onPressed: () => setState(() {
                      _obscurePassword = !_obscurePassword;
                    }),
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 19,
                      color: AppColors.sonicSilver,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 22),

              // 4. Primary Action Button
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.obsidian,
                    foregroundColor: Colors.white,
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.0,
                            color: AppColors.champagneGold,
                          ),
                        )
                      : Text(
                          (!isSupplier && _isRegisterMode
                                  ? 'MÜŞTERİ HESABI OLUŞTUR'
                                  : (isSupplier
                                      ? 'TEDARİKÇİ STÜDYOSUNA GİRİŞ YAP'
                                      : 'MÜŞTERİ OLARAK GİRİŞ YAP'))
                              .toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 14),

              if (!isSupplier)
                TextButton(
                  onPressed: () => setState(() {
                    _isRegisterMode = !_isRegisterMode;
                  }),
                  child: Text(
                    _isRegisterMode
                        ? 'ZATEN HESABINIZ VAR MI? GİRİŞ YAPIN'
                        : 'YENİ TOPTAN ALICI MISINIZ? ÜCRETSİZ KAYIT OLUN',
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.9,
                      color: AppColors.editorialGold,
                    ),
                  ),
                )
              else
                SizedBox(
                  height: 44,
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const SupplierApplicationScreen(),
                        ),
                      );
                    },
                    child: const Text(
                      'ÜRETİCİ / TEDARİKÇİ BAŞVURUSU YAP',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
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

class _RoleSegmentButton extends StatelessWidget {
  final String title;
  final LuxuryIconKind icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleSegmentButton({
    required this.title,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.obsidian : Colors.transparent,
          border: Border(
            bottom: BorderSide(
              color: selected ? AppColors.champagneGold : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            LuxuryIcon(
              kind: icon,
              size: 15,
              active: selected,
              color: selected ? Colors.white : AppColors.sonicSilver,
              accentColor: AppColors.champagneGold,
            ),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: selected ? Colors.white : AppColors.sonicSilver,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
