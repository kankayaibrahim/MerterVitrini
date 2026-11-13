import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../providers/session_provider.dart';
import 'utils/supplier_l10n.dart';

/// Textile vertical camera studio optimized for Merter garment showcase framing (3:4).
class CameraStudioScreen extends StatefulWidget {
  final bool allowMultiple;
  final int maxPhotos;

  const CameraStudioScreen({
    super.key,
    this.allowMultiple = true,
    this.maxPhotos = 8,
  });

  @override
  State<CameraStudioScreen> createState() => _CameraStudioScreenState();
}

class _CameraStudioScreenState extends State<CameraStudioScreen>
    with WidgetsBindingObserver {
  final ImagePicker _fallbackPicker = ImagePicker();
  final List<String> _capturedPaths = <String>[];

  List<CameraDescription> _cameras = const <CameraDescription>[];
  CameraController? _controller;
  int _selectedCameraIndex = 0;
  FlashMode _flashMode = FlashMode.auto;
  bool _initializing = true;
  bool _capturing = false;
  String? _errorKey;

  String _resolveLang() {
    if (!mounted) return 'tr';
    try {
      return Provider.of<SessionProvider>(context, listen: false).languageCode;
    } catch (_) {
      return 'tr';
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCameras();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final camCtrl = _controller;
    if (camCtrl == null || !camCtrl.value.isInitialized) {
      return;
    }
    if (state == AppLifecycleState.inactive) {
      camCtrl.dispose();
      _controller = null;
    } else if (state == AppLifecycleState.resumed) {
      _setupController(_selectedCameraIndex);
    }
  }

  Future<void> _initCameras() async {
    try {
      final list = await availableCameras();
      if (!mounted) return;
      if (list.isEmpty) {
        setState(() {
          _initializing = false;
          _errorKey = 'camera_no_device';
        });
        return;
      }
      _cameras = list;
      final rearIdx = list.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
      );
      _selectedCameraIndex = rearIdx >= 0 ? rearIdx : 0;
      await _setupController(_selectedCameraIndex);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _errorKey = 'camera_permission_error';
      });
    }
  }

  Future<void> _setupController(int index) async {
    setState(() {
      _initializing = true;
      _errorKey = null;
    });

    final prev = _controller;
    _controller = null;
    await prev?.dispose();

    final ctrl = CameraController(
      _cameras[index],
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await ctrl.initialize();
      try {
        await ctrl.setFlashMode(_flashMode);
      } catch (_) {}
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() {
        _controller = ctrl;
        _initializing = false;
      });
    } catch (_) {
      await ctrl.dispose();
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _errorKey = 'camera_permission_error';
      });
    }
  }

  Future<void> _cycleFlashMode() async {
    final next = switch (_flashMode) {
      FlashMode.auto => FlashMode.torch,
      FlashMode.torch => FlashMode.always,
      FlashMode.always => FlashMode.off,
      FlashMode.off => FlashMode.auto,
    };
    setState(() => _flashMode = next);
    try {
      await _controller?.setFlashMode(next);
    } catch (_) {}
  }

  Future<void> _switchCameraLens() async {
    if (_cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    await _setupController(_selectedCameraIndex);
  }

  Future<void> _captureShot() async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized || _capturing) {
      return;
    }
    final lang = _resolveLang();
    if (_capturedPaths.length >= widget.maxPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${SupplierL10n.t(lang, 'camera_max_photos')} (${widget.maxPhotos})',
          ),
        ),
      );
      return;
    }

    setState(() => _capturing = true);
    try {
      final shot = await ctrl.takePicture();
      if (!mounted) return;
      if (!widget.allowMultiple) {
        Navigator.of(context).pop(<String>[shot.path]);
        return;
      }
      setState(() {
        _capturedPaths.add(shot.path);
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(SupplierL10n.t(lang, 'camera_capture_error')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _capturing = false);
      }
    }
  }

  Future<void> _useSystemCameraFallback() async {
    final picked = await _fallbackPicker.pickImage(
      source: ImageSource.camera,
      imageQuality: 88,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (picked == null || !mounted) return;
    if (!widget.allowMultiple) {
      Navigator.of(context).pop(<String>[picked.path]);
      return;
    }
    setState(() {
      _capturedPaths.add(picked.path);
    });
  }

  IconData _flashIcon() {
    return switch (_flashMode) {
      FlashMode.auto => Icons.flash_auto_rounded,
      FlashMode.torch => Icons.highlight_rounded,
      FlashMode.always => Icons.flash_on_rounded,
      FlashMode.off => Icons.flash_off_rounded,
    };
  }

  String _flashLabel(String lang) {
    return switch (_flashMode) {
      FlashMode.auto => SupplierL10n.t(lang, 'flash_auto'),
      FlashMode.torch => SupplierL10n.t(lang, 'flash_studio'),
      FlashMode.always => SupplierL10n.t(lang, 'flash_on'),
      FlashMode.off => SupplierL10n.t(lang, 'flash_off'),
    };
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = _controller;
    var lang = 'tr';
    try {
      lang = Provider.of<SessionProvider>(context).languageCode;
    } catch (_) {}

    return Directionality(
      textDirection: AppStrings.directionOf(lang),
      child: Scaffold(
        backgroundColor: AppColors.obsidian,
        body: SafeArea(
          child: Column(
            children: [
              // Top Studio Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(<String>[]),
                      icon: const Icon(
                        Icons.close_rounded,
                        color: AppColors.pureWhite,
                      ),
                    ),
                    Expanded(
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.pureWhite.withValues(alpha: 0.14),
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusLg),
                            border: Border.all(
                              color: AppColors.pureWhite.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Text(
                            widget.allowMultiple
                                ? '${SupplierL10n.t(lang, 'camera_studio_title')} (${_capturedPaths.length}/${widget.maxPhotos})'
                                : SupplierL10n.t(lang, 'camera_take_photo'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.pureWhite,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _cycleFlashMode,
                      icon: Icon(
                        _flashIcon(),
                        color: AppColors.champagneGold,
                        size: 19,
                      ),
                      label: Text(
                        _flashLabel(lang),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.pureWhite,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Viewfinder + 3:4 Garment Guide
              Expanded(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (_initializing)
                      const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.pureWhite,
                        ),
                      )
                    else if (_errorKey != null ||
                        ctrl == null ||
                        !ctrl.value.isInitialized)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.camera_alt_outlined,
                              color: AppColors.pureWhite.withValues(alpha: 0.72),
                              size: 54,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              SupplierL10n.t(
                                lang,
                                _errorKey ?? 'camera_not_ready',
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.pureWhite
                                    .withValues(alpha: 0.82),
                              ),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: _useSystemCameraFallback,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.luxuryBronze,
                                foregroundColor: AppColors.pureWhite,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusMd,
                                  ),
                                ),
                              ),
                              icon: const Icon(Icons.photo_camera_rounded),
                              label: Text(
                                SupplierL10n.t(lang, 'camera_system_fallback'),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ClipRRect(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusLg),
                        child: AspectRatio(
                          aspectRatio: 3 / 4,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              CameraPreview(ctrl),
                              IgnorePointer(
                                child: Container(
                                  margin: const EdgeInsets.all(22),
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color: AppColors.pureWhite
                                          .withValues(alpha: 0.5),
                                      width: 1.2,
                                    ),
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusLg,
                                    ),
                                  ),
                                  alignment: Alignment.bottomCenter,
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.obsidian
                                          .withValues(alpha: 0.55),
                                      borderRadius: BorderRadius.circular(
                                        AppColors.radiusSm,
                                      ),
                                    ),
                                    child: Text(
                                      SupplierL10n.t(
                                        lang,
                                        'camera_framing_hint',
                                      ),
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        color: AppColors.pureWhite,
                                        fontSize: 11,
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

              // Captured Filmstrip (Multi-Shot mode)
              if (widget.allowMultiple && _capturedPaths.isNotEmpty)
                SizedBox(
                  height: 82,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    scrollDirection: Axis.horizontal,
                    itemCount: _capturedPaths.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final path = _capturedPaths[index];
                      return Stack(
                        children: [
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                            child: Image.file(
                              File(path),
                              width: 58,
                              height: 70,
                              fit: BoxFit.cover,
                            ),
                          ),
                          if (index == 0)
                            Positioned(
                              bottom: 2,
                              left: 2,
                              right: 2,
                              child: Container(
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: AppColors.luxuryBronze,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  SupplierL10n.upper(lang, 'cover_badge'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppColors.pureWhite,
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          Positioned(
                            top: 2,
                            right: 2,
                            child: GestureDetector(
                              onTap: () => setState(() {
                                _capturedPaths.removeAt(index);
                              }),
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: AppColors.obsidian
                                      .withValues(alpha: 0.86),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close,
                                  size: 13,
                                  color: AppColors.pureWhite,
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),

              // Bottom Shutter Controls
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 18),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      onPressed:
                          _cameras.length > 1 ? _switchCameraLens : null,
                      icon: const Icon(
                        Icons.cameraswitch_rounded,
                        color: AppColors.pureWhite,
                        size: 30,
                      ),
                    ),
                    GestureDetector(
                      onTap: _captureShot,
                      child: Container(
                        width: 74,
                        height: 74,
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.pureWhite,
                            width: 3.5,
                          ),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _capturing
                                ? AppColors.luxuryBronze
                                : AppColors.pureWhite,
                          ),
                        ),
                      ),
                    ),
                    if (widget.allowMultiple && _capturedPaths.isNotEmpty)
                      ElevatedButton.icon(
                        onPressed: () =>
                            Navigator.of(context).pop(_capturedPaths),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.emerald,
                          foregroundColor: AppColors.pureWhite,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                        ),
                        icon: const Icon(Icons.check_rounded, size: 18),
                        label: Text(
                          '${SupplierL10n.t(lang, 'camera_use_photos')} (${_capturedPaths.length})',
                        ),
                      )
                    else
                      const SizedBox(width: 48),
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
