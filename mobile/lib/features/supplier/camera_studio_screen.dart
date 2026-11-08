import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/app_theme.dart';

/// Dedicated In-App Textile Camera Studio for Merter Vitrini Suppliers & Chat.
/// Supports single-shot or multi-shot garment photography with 3:4 framing guide,
/// Torch/Flash control, Front/Rear lens switching, and filmstrip preview.
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
  List<CameraDescription> _cameras = const <CameraDescription>[];
  CameraController? _controller;
  int _selectedCameraIndex = 0;
  FlashMode _flashMode = FlashMode.auto;

  bool _initializing = true;
  bool _capturing = false;
  String? _errorMessage;

  final List<String> _capturedPaths = <String>[];
  final ImagePicker _fallbackPicker = ImagePicker();

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
          _errorMessage = 'Cihazda aktif kamera bulunamadı.';
        });
        return;
      }
      _cameras = list;
      final rearIdx = list.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
      );
      _selectedCameraIndex = rearIdx >= 0 ? rearIdx : 0;
      await _setupController(_selectedCameraIndex);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _errorMessage =
            'Kamera erişimi başlatılamadı. Lütfen kamera iznini kontrol edin.';
      });
    }
  }

  Future<void> _setupController(int index) async {
    setState(() {
      _initializing = true;
      _errorMessage = null;
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
        _errorMessage = 'Kamera başlatılamadı veya izin verilmedi.';
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
    if (_capturedPaths.length >= widget.maxPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('En fazla ${widget.maxPhotos} fotoğraf çekebilirsiniz.'),
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
          const SnackBar(
            content: Text('Fotoğraf çekilirken bir hata oluştu.'),
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

  String _flashLabel() {
    return switch (_flashMode) {
      FlashMode.auto => 'Oto',
      FlashMode.torch => 'Stüdyo Işığı',
      FlashMode.always => 'Açık',
      FlashMode.off => 'Kapalı',
    };
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = _controller;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // Top Studio Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(<String>[]),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      widget.allowMultiple
                          ? 'Tekstil Kamera Stüdyosu (${_capturedPaths.length}/${widget.maxPhotos})'
                          : 'Fotoğraf Çek',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _cycleFlashMode,
                    icon: Icon(
                      _flashIcon(),
                      color: AppColors.accentGoldLight,
                      size: 20,
                    ),
                    label: Text(
                      _flashLabel(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
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
                      child: CircularProgressIndicator(color: Colors.white),
                    )
                  else if (_errorMessage != null ||
                      ctrl == null ||
                      !ctrl.value.isInitialized)
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.camera_alt_outlined,
                            color: Colors.white70,
                            size: 54,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _errorMessage ?? 'Kamera hazır değil.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white70),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: _useSystemCameraFallback,
                            icon: const Icon(Icons.photo_camera_rounded),
                            label: const Text('Sistem Kamerasıyla Çek'),
                          ),
                        ],
                      ),
                    )
                  else
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: AspectRatio(
                        aspectRatio: 3 / 4,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            CameraPreview(ctrl),
                            // Garment framing overlay
                            IgnorePointer(
                              child: Container(
                                margin: const EdgeInsets.all(22),
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.45),
                                    width: 1.2,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                alignment: Alignment.bottomCenter,
                                padding: const EdgeInsets.only(bottom: 10),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.45),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'Ürünü vitrin dikey kadrajına (3:4) ortalayın',
                                    style: TextStyle(
                                      color: Colors.white,
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
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final path = _capturedPaths[index];
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
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
                                color: AppColors.accentGold,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'KAPAK',
                                style: TextStyle(
                                  color: Colors.white,
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
                              decoration: const BoxDecoration(
                                color: Colors.black87,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                size: 13,
                                color: Colors.white,
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
                      color: Colors.white,
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
                        border: Border.all(color: Colors.white, width: 3.5),
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _capturing
                              ? AppColors.accentGold
                              : Colors.white,
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
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                      ),
                      icon: const Icon(Icons.check_rounded, size: 18),
                      label: Text('Kullan (${_capturedPaths.length})'),
                    )
                  else
                    const SizedBox(width: 48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

