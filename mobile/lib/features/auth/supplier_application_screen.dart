import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../providers/session_provider.dart';

class SupplierApplicationScreen extends StatefulWidget {
  const SupplierApplicationScreen({super.key});

  @override
  State<SupplierApplicationScreen> createState() =>
      _SupplierApplicationScreenState();
}

class _SupplierApplicationScreenState extends State<SupplierApplicationScreen> {
  final _companyCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _cityCtrl = TextEditingController(text: 'İstanbul');
  final _districtCtrl = TextEditingController(text: 'Güngören / Merter');
  final _categoryCtrl = TextEditingController(text: 'Kadın Hazır Giyim');
  final _instagramCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  bool _submitting = false;
  bool _completed = false;

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
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_companyCtrl.text.trim().isEmpty ||
        _contactCtrl.text.trim().isEmpty ||
        _emailCtrl.text.trim().isEmpty ||
        _phoneCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Firma adı, yetkili, e-posta ve telefon zorunludur.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<SessionProvider>().api.submitSupplierApplication(
            companyName: _companyCtrl.text,
            contactName: _contactCtrl.text,
            email: _emailCtrl.text,
            phone: _phoneCtrl.text,
            city: _cityCtrl.text,
            district: _districtCtrl.text,
            category: _categoryCtrl.text,
            instagram: _instagramCtrl.text,
            notes: _notesCtrl.text,
          );
      if (mounted) {
        setState(() => _completed = true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tedarikçi Üretici Başvurusu'),
      ),
      body: SafeArea(
        child: _completed
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.mark_email_read_rounded,
                      size: 68,
                      color: AppColors.emerald,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Başvurunuz Alındı!',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'E-posta adresinize doğrulama bağlantısı gönderildi. Doğrulama sonrasında Merter Vitrini ekibi tedarikçi hesabınızı aktif edecektir.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Giriş Ekranına Dön'),
                    ),
                  ],
                ),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Merter Vitrini B2B ihracat ağında yerinizi alın; mobil kameranızla ürünlerinizi saniyeler içinde dünya pazarına açın.',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _companyCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Firma / Marka Ünvanı *',
                        prefixIcon: Icon(Icons.business_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _contactCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Yetkili Adı Soyadı *',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Kurumsal E-Posta *',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Telefon / WhatsApp *',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _cityCtrl,
                            decoration: const InputDecoration(labelText: 'İl'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _districtCtrl,
                            decoration:
                                const InputDecoration(labelText: 'İlçe / Semt'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _categoryCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Üretim Kategorisi',
                        prefixIcon: Icon(Icons.category_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _instagramCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Instagram / Web Sitesi (Opsiyonel)',
                        prefixIcon: Icon(Icons.public_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _notesCtrl,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Üretim Kapasitesi & Notlar',
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.navy,
                      ),
                      child: Text(
                        _submitting
                            ? 'Gönderiliyor...'
                            : 'Tedarikçi Başvurusunu Gönder',
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

