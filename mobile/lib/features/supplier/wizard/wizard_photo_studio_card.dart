import 'dart:io';

import 'package:flutter/material.dart';

import '../../../core/app_theme.dart';
import '../../../widgets/smart_network_image.dart';
import 'wizard_models.dart';

class WizardPhotoStudioCard extends StatelessWidget {
  final List<WizardPhotoItem> photos;
  final bool saving;
  final VoidCallback onOpenCamera;
  final VoidCallback onPickGallery;
  final ValueChanged<int> onMakeCover;
  final ValueChanged<int> onRemovePhoto;

  const WizardPhotoStudioCard({
    super.key,
    required this.photos,
    required this.saving,
    required this.onOpenCamera,
    required this.onPickGallery,
    required this.onMakeCover,
    required this.onRemovePhoto,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '1. Ürün Fotoğrafları & Kamera Stüdyosu',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14.5,
                  ),
                ),
                Text(
                  '${photos.length}/10',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Askıda veya mankende dikey (3:4) çekim yapın. İlk sıradaki fotoğraf vitrin kapak görseli olur.',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentGold,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: saving ? null : onOpenCamera,
                    icon: const Icon(Icons.camera_alt_rounded, size: 18),
                    label: const Text('Kamerayla Çek'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: saving ? null : onPickGallery,
                    icon: const Icon(Icons.photo_library_outlined, size: 18),
                    label: const Text('Galeriden Seç'),
                  ),
                ),
              ],
            ),
            if (photos.isNotEmpty) ...[
              const SizedBox(height: 14),
              SizedBox(
                height: 158,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: photos.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 10),
                  itemBuilder: (context, idx) {
                    final item = photos[idx];
                    final isCover = idx == 0;
                    return Container(
                      width: 112,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isCover
                              ? AppColors.accentGold
                              : AppColors.border,
                          width: isCover ? 2.2 : 1,
                        ),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: item.isRemote
                                ? SmartNetworkImage(
                                    imageUrl: item.remoteUrl,
                                    fit: BoxFit.cover,
                                  )
                                : Image.file(
                                    File(item.localPath!),
                                    fit: BoxFit.cover,
                                  ),
                          ),
                          Positioned(
                            top: 6,
                            left: 6,
                            child: GestureDetector(
                              onTap: isCover ? null : () => onMakeCover(idx),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: isCover
                                      ? AppColors.accentGold
                                      : Colors.black54,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isCover ? 'KAPAK' : 'Kapak Yap',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: InkWell(
                              onTap: () => onRemovePhoto(idx),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close_rounded,
                                  size: 14,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

