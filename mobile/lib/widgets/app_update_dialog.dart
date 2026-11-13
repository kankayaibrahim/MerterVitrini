import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_theme.dart';
import '../providers/session_provider.dart';
import '../services/app_update_service.dart';

class AppUpdateDialog extends StatefulWidget {
  final UpdateCheckResult checkResult;
  final String languageCode;
  final AppUpdateService service;

  static bool _checkedThisSession = false;

  const AppUpdateDialog({
    super.key,
    required this.checkResult,
    required this.languageCode,
    this.service = const AppUpdateService(),
  });

  /// Automatically checks for an Android OTA update once per app launch.
  static Future<void> checkOnStartupIfNeeded(BuildContext context) async {
    if (_checkedThisSession || !AppUpdateService.supportsInAppApkUpdate) {
      return;
    }
    _checkedThisSession = true;

    try {
      final session = context.read<SessionProvider>();
      const svc = AppUpdateService();
      final result = await svc.checkForUpdate(session.apiClient.dio);
      if (!context.mounted || !result.hasUpdate) {
        return;
      }

      await showDialog<void>(
        context: context,
        barrierDismissible: !result.isForceUpdate,
        builder: (_) => AppUpdateDialog(
          checkResult: result,
          languageCode: session.languageCode,
          service: svc,
        ),
      );
    } catch (_) {
      // Silent fail on background startup check so offline browsing isn't interrupted
    }
  }

  /// Triggered manually by the user ("Güncellemeleri Kontrol Et").
  static Future<void> checkManually(BuildContext context) async {
    final session = context.read<SessionProvider>();
    final messenger = ScaffoldMessenger.of(context);
    const svc = AppUpdateService();

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2),
                ),
                SizedBox(width: 14),
                Text(
                  'Yeni sürüm kontrol ediliyor...',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final result = await svc.checkForUpdate(session.apiClient.dio);
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      if (!context.mounted) return;

      if (!result.hasUpdate) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              'Uygulamanız güncel: v${result.installed.version} (Yapı #${result.installed.buildNumber})',
            ),
            backgroundColor: AppColors.emerald,
          ),
        );
        return;
      }

      await showDialog<void>(
        context: context,
        barrierDismissible: !result.isForceUpdate,
        builder: (_) => AppUpdateDialog(
          checkResult: result,
          languageCode: session.languageCode,
          service: svc,
        ),
      );
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      messenger.showSnackBar(
        SnackBar(
          content: Text('Güncelleme kontrolü başarısız oldu: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  State<AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<AppUpdateDialog> {
  bool _downloading = false;
  double _progress = 0;
  int _receivedBytes = 0;
  int _totalBytes = 0;
  String? _downloadedApkPath;
  bool _awaitingInstallPermission = false;
  String? _errorMessage;
  CancelToken? _cancelToken;

  @override
  void dispose() {
    _cancelToken?.cancel('dialog_closed');
    super.dispose();
  }

  String _formatMb(int bytes) {
    if (bytes <= 0) return '0.0 MB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  Future<void> _startDownloadAndInstall() async {
    if (!AppUpdateService.supportsInAppApkUpdate) {
      final uri = Uri.tryParse(widget.checkResult.remote.webPageUrl);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return;
    }

    // If APK was already downloaded during this dialog session, jump directly to install
    if (_downloadedApkPath != null && _downloadedApkPath!.isNotEmpty) {
      await _launchInstaller(_downloadedApkPath!);
      return;
    }

    final token = CancelToken();
    setState(() {
      _cancelToken = token;
      _downloading = true;
      _progress = 0;
      _receivedBytes = 0;
      _totalBytes = widget.checkResult.remote.fileSizeBytes;
      _errorMessage = null;
      _awaitingInstallPermission = false;
    });

    try {
      final savedPath = await widget.service.downloadAndVerifyApk(
        release: widget.checkResult.remote,
        installed: widget.checkResult.installed,
        cancelToken: token,
        onProgress: (received, total) {
          if (!mounted) return;
          setState(() {
            _receivedBytes = received;
            _totalBytes = total;
            _progress = total > 0 ? (received / total).clamp(0.0, 1.0) : 0.0;
          });
        },
      );

      if (!mounted) return;
      setState(() {
        _downloading = false;
        _progress = 1.0;
        _downloadedApkPath = savedPath;
      });

      await _launchInstaller(savedPath);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        if (mounted) {
          setState(() {
            _downloading = false;
            _errorMessage = 'İndirme iptal edildi.';
          });
        }
        return;
      }
      if (mounted) {
        setState(() {
          _downloading = false;
          _errorMessage =
              'APK indirilirken ağ hatası oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _downloading = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _launchInstaller(String apkPath) async {
    try {
      final status = await widget.service.triggerInstallApk(apkPath);
      if (!mounted) return;
      if (status == ApkInstallTriggerStatus.permissionRequired) {
        setState(() {
          _awaitingInstallPermission = true;
        });
      } else {
        setState(() {
          _awaitingInstallPermission = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Kurulum başlatılamadı: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final remote = widget.checkResult.remote;
    final installed = widget.checkResult.installed;
    final isForced = widget.checkResult.isForceUpdate;
    final percentText = '${(_progress * 100).round()}%';

    return PopScope(
      canPop: !isForced && !_downloading,
      child: Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusLg),
        ),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Editorial Dark Header
              Container(
                color: AppColors.eerieBlack,
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      color: Colors.white.withValues(alpha: 0.1),
                      child: Text(
                        isForced
                            ? 'ZORUNLU GÜNCELLEME'
                            : 'YENİ SÜRÜM MEVCUT • OTA',
                        style: const TextStyle(
                          color: AppColors.accentGoldLight,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Merter Vitrini Güncellemesi Hazır',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Yeni sürüm indirilsin ve uygulamanız otomatik güncellensin mi?',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.78),
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Version Comparison Row
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFAFAFA),
                        border: Border.all(color: AppColors.cultured),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'MEVCUT SÜRÜM',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.sonicSilver,
                                    letterSpacing: 1,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'v${installed.version} (#${installed.buildNumber})',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 18,
                            color: AppColors.editorialGold,
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text(
                                  'YENİ SÜRÜM',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.editorialGold,
                                    letterSpacing: 1,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'v${remote.version} (#${remote.buildNumber})',
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.eerieBlack,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    if (remote.formattedSize.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Paket Boyutu: ${remote.formattedSize} • SHA-256 Doğrulamalı',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.sonicSilver,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],

                    const SizedBox(height: 14),
                    const Text(
                      'SÜRÜM NOTLARI',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: AppColors.eerieBlack,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      remote.localizedNotes(widget.languageCode),
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.45,
                        color: AppColors.onyx,
                      ),
                    ),

                    if (_downloading) ...[
                      const SizedBox(height: 18),
                      LinearProgressIndicator(
                        value: _totalBytes > 0 ? _progress : null,
                        minHeight: 7,
                        backgroundColor: AppColors.cultured,
                        color: AppColors.eerieBlack,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'İndiriliyor... $percentText',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.eerieBlack,
                            ),
                          ),
                          Text(
                            _totalBytes > 0
                                ? '${_formatMb(_receivedBytes)} / ${_formatMb(_totalBytes)}'
                                : _formatMb(_receivedBytes),
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.sonicSilver,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],

                    if (_awaitingInstallPermission) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: const Text(
                          'Açılan Android ayar ekranında "Bu kaynaktan izin ver" anahtarını açın. Uygulamaya geri döndüğünüzde güncelleme penceresi otomatik başlayacaktır.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF92400E),
                            height: 1.4,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.danger,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 20),

                    // Action Buttons
                    if (_downloading)
                      if (!isForced)
                        OutlinedButton(
                          onPressed: () =>
                              _cancelToken?.cancel('user_cancelled'),
                          child: const Text('İNDİRMEYİ İPTAL ET'),
                        )
                      else
                        const SizedBox.shrink()
                    else ...[
                      SizedBox(
                        height: 46,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.eerieBlack,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusMd),
                            ),
                          ),
                          onPressed: _startDownloadAndInstall,
                          icon: Icon(
                            _downloadedApkPath != null
                                ? Icons.system_update_rounded
                                : Icons.download_rounded,
                            size: 18,
                            color: AppColors.accentGoldLight,
                          ),
                          label: Text(
                            _downloadedApkPath != null
                                ? 'KURULUMU BAŞLAT'
                                : 'İNDİR VE GÜNCELLE',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                      ),
                      if (!isForced) ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text(
                            'DAHA SONRA HATIRLAT',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.sonicSilver,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

