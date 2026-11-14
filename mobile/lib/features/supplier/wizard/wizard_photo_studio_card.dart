import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/app_theme.dart';
import '../../../widgets/smart_network_image.dart';
import '../utils/supplier_l10n.dart';
import '../widgets/supplier_editorial_widgets.dart';
import 'wizard_models.dart';

class WizardPhotoStudioCard extends StatelessWidget {
  final List<WizardPhotoItem> photos;
  final bool saving;
  final VoidCallback onOpenCamera;
  final VoidCallback onPickGallery;
  final ValueChanged<int> onMakeCover;
  final ValueChanged<int> onRemovePhoto;
  final void Function(int oldIndex, int newIndex) onReorderPhoto;
  final String lang;

  const WizardPhotoStudioCard({
    super.key,
    required this.photos,
    required this.saving,
    required this.onOpenCamera,
    required this.onPickGallery,
    required this.onMakeCover,
    required this.onRemovePhoto,
    required this.onReorderPhoto,
    this.lang = 'tr',
  });

  @override
  Widget build(BuildContext context) {
    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '1. ${SupplierL10n.t(lang, 'wizard_photos_title')}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14.5,
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              EditorialStatusBadge.neutral('${photos.length}/10'),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            SupplierL10n.t(lang, 'wizard_photos_desc'),
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.mutedAccessible,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.luxuryBronze,
                    foregroundColor: AppColors.pureWhite,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    ),
                  ),
                  onPressed: saving ? null : onOpenCamera,
                  icon: const Icon(Icons.camera_alt_rounded, size: 18),
                  label: Text(
                    SupplierL10n.t(lang, 'wizard_add_camera'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.obsidian,
                    side: const BorderSide(color: AppColors.warmHairline),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    ),
                  ),
                  onPressed: saving ? null : onPickGallery,
                  icon: const Icon(Icons.photo_library_outlined, size: 18),
                  label: Text(
                    SupplierL10n.t(lang, 'wizard_add_gallery'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
          if (photos.isNotEmpty) ...[
            if (photos.length > 1) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(
                    Icons.drag_indicator_rounded,
                    size: 15,
                    color: AppColors.luxuryBronze,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      SupplierL10n.t(lang, 'drag_reorder_hint'),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.luxuryBronze,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              height: 162,
              child: ReorderableListView.builder(
                scrollDirection: Axis.horizontal,
                buildDefaultDragHandles: false,
                onReorderItem: (oldIndex, newIndex) {
                  if (newIndex == 0 || oldIndex == 0) {
                    HapticFeedback.selectionClick();
                  }
                  onReorderPhoto(oldIndex, newIndex);
                },
                proxyDecorator: (child, index, animation) {
                  return Material(
                    color: Colors.transparent,
                    elevation: 6,
                    shadowColor: AppColors.obsidian.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(AppColors.radiusLg),
                    child: child,
                  );
                },
                itemCount: photos.length,
                itemBuilder: (context, idx) {
                  final item = photos[idx];
                  final isCover = idx == 0;
                  final baseKey = item.identityKey;
                  var occurrence = 0;
                  for (var j = 0; j < idx; j++) {
                    if (photos[j].identityKey == baseKey) {
                      occurrence++;
                    }
                  }
                  final uniqueKey = ValueKey('$baseKey#$occurrence');

                  return ReorderableDelayedDragStartListener(
                    key: uniqueKey,
                    index: idx,
                    enabled: !saving,
                    child: Container(
                      width: 112,
                      margin: EdgeInsetsDirectional.only(
                        end: idx == photos.length - 1 ? 0 : 10,
                      ),
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusLg),
                        border: Border.all(
                          color: isCover
                              ? AppColors.luxuryBronze
                              : AppColors.warmHairline,
                          width: isCover ? 2 : 1,
                        ),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusMd),
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
                              onTap: (isCover || saving)
                                  ? null
                                  : () => onMakeCover(idx),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: isCover
                                      ? AppColors.luxuryBronze
                                      : AppColors.obsidian
                                          .withValues(alpha: 0.72),
                                  borderRadius: BorderRadius.circular(
                                    AppColors.radiusSm,
                                  ),
                                ),
                                child: Text(
                                  isCover
                                      ? SupplierL10n.upper(lang, 'cover_badge')
                                      : SupplierL10n.t(lang, 'make_cover'),
                                  style: const TextStyle(
                                    color: AppColors.pureWhite,
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
                              onTap: saving ? null : () => onRemovePhoto(idx),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: AppColors.obsidian
                                      .withValues(alpha: 0.74),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close_rounded,
                                  size: 14,
                                  color: AppColors.pureWhite,
                                ),
                              ),
                            ),
                          ),
                          if (photos.length > 1)
                            Positioned(
                              bottom: 6,
                              right: 6,
                              child: ReorderableDragStartListener(
                                index: idx,
                                enabled: !saving,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: AppColors.obsidian
                                        .withValues(alpha: 0.68),
                                    borderRadius: BorderRadius.circular(
                                      AppColors.radiusSm,
                                    ),
                                  ),
                                  child: Tooltip(
                                    message: SupplierL10n.t(
                                      lang,
                                      'drag_handle_tooltip',
                                    ),
                                    child: const Icon(
                                      Icons.drag_indicator_rounded,
                                      size: 14,
                                      color: AppColors.pureWhite,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}
