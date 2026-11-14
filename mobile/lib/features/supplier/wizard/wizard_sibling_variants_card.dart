import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/app_theme.dart';
import '../../../core/localization.dart';
import '../../../models/product.dart';
import '../../../widgets/smart_network_image.dart';
import '../camera_studio_screen.dart';
import '../utils/supplier_l10n.dart';
import '../widgets/supplier_editorial_widgets.dart';
import 'searchable_option_sheet.dart';
import 'wizard_models.dart';

class WizardSiblingVariantsCard extends StatefulWidget {
  final String lang;
  final List<SiblingProduct> linkedSiblings;
  final String? pendingLinkParentLabel;
  final String? pendingLinkParentImageUrl;
  final VoidCallback? onClearPendingLinkParent;
  final List<SimpleOptionItem> availableColors;
  final List<WizardAdditionalColorDraft> extraColorDrafts;
  final ValueChanged<SiblingProduct> onUnlinkSibling;
  final VoidCallback onOpenLinkerSheet;
  final ValueChanged<WizardAdditionalColorDraft> onAddExtraColorDraft;
  final ValueChanged<int> onRemoveExtraColorDraft;
  final bool saving;
  final bool linkingSiblings;
  final String? unlinkingSiblingId;

  const WizardSiblingVariantsCard({
    super.key,
    required this.lang,
    required this.linkedSiblings,
    this.pendingLinkParentLabel,
    this.pendingLinkParentImageUrl,
    this.onClearPendingLinkParent,
    required this.availableColors,
    required this.extraColorDrafts,
    required this.onUnlinkSibling,
    required this.onOpenLinkerSheet,
    required this.onAddExtraColorDraft,
    required this.onRemoveExtraColorDraft,
    required this.saving,
    this.linkingSiblings = false,
    this.unlinkingSiblingId,
  });

  @override
  State<WizardSiblingVariantsCard> createState() =>
      _WizardSiblingVariantsCardState();
}

class _WizardSiblingVariantsCardState extends State<WizardSiblingVariantsCard> {
  final ImagePicker _picker = ImagePicker();
  bool _showInlineCreator = false;
  String? _draftColorId;
  String _draftColorName = '';
  final List<WizardPhotoItem> _draftPhotos = <WizardPhotoItem>[];

  Future<void> _pickColor() async {
    final chosen = await showSearchableOptionSheet(
      context,
      title: SupplierL10n.t(widget.lang, 'primary_color_label'),
      options: widget.availableColors,
      languageCode: widget.lang,
    );
    if (chosen == null || !mounted) return;
    setState(() {
      _draftColorId = chosen.id;
      _draftColorName = chosen.name;
    });
  }

  Future<void> _openCameraForExtraColor() async {
    final remaining = 6 - _draftPhotos.length;
    if (remaining <= 0) return;
    final captured = await Navigator.of(context).push<List<String>>(
      MaterialPageRoute<List<String>>(
        builder: (_) => CameraStudioScreen(
          allowMultiple: true,
          maxPhotos: remaining,
        ),
      ),
    );
    if (!mounted || captured == null || captured.isEmpty) return;
    setState(() {
      for (final path in captured) {
        if (_draftPhotos.length < 6) {
          _draftPhotos.add(WizardPhotoItem.local(path));
        }
      }
    });
  }

  Future<void> _pickGalleryForExtraColor() async {
    final remaining = 6 - _draftPhotos.length;
    if (remaining <= 0) return;
    try {
      final picked = await _picker.pickMultiImage(imageQuality: 85);
      if (!mounted || picked.isEmpty) return;
      setState(() {
        for (final file in picked) {
          if (_draftPhotos.length < 6) {
            _draftPhotos.add(WizardPhotoItem.local(file.path));
          }
        }
      });
    } catch (_) {}
  }

  void _commitInlineExtraColor() {
    final messenger = ScaffoldMessenger.of(context);
    if (_draftColorName.trim().isEmpty) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(SupplierL10n.t(widget.lang, 'select_color_first')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    if (_draftPhotos.isEmpty) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(SupplierL10n.t(widget.lang, 'add_color_photos_hint')),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    widget.onAddExtraColorDraft(
      WizardAdditionalColorDraft(
        colorId: _draftColorId,
        colorName: _draftColorName.trim(),
        photos: List<WizardPhotoItem>.of(_draftPhotos),
      ),
    );

    setState(() {
      _draftColorId = null;
      _draftColorName = '';
      _draftPhotos.clear();
      _showInlineCreator = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.lang;
    final totalCount =
        widget.linkedSiblings.length + widget.extraColorDrafts.length;

    return EditorialSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.palette_outlined,
                size: 18,
                color: AppColors.luxuryBronze,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  SupplierL10n.t(lang, 'color_variants_title'),
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14.5,
                    letterSpacing: AppStrings.letterSpacing(lang, -0.1),
                    color: AppColors.obsidian,
                  ),
                ),
              ),
              if (totalCount > 0)
                EditorialStatusBadge.bronze(
                  '$totalCount ${SupplierL10n.t(lang, 'colors_badge_suffix')}',
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            SupplierL10n.t(lang, 'color_variants_sub'),
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.mutedAccessible,
            ),
          ),
          if (widget.pendingLinkParentLabel != null &&
              widget.pendingLinkParentLabel!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.accentGoldLight,
                borderRadius: BorderRadius.circular(AppColors.radiusMd),
                border: Border.all(
                  color: AppColors.luxuryBronze.withValues(alpha: 0.45),
                ),
              ),
              child: Row(
                children: [
                  if ((widget.pendingLinkParentImageUrl ?? '').isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: SizedBox(
                        width: 30,
                        height: 36,
                        child: SmartNetworkImage(
                          imageUrl: widget.pendingLinkParentImageUrl,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ] else
                    const Padding(
                      padding: EdgeInsetsDirectional.only(end: 8),
                      child: Icon(
                        Icons.link_rounded,
                        size: 16,
                        color: AppColors.luxuryBronze,
                      ),
                    ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.pendingLinkParentLabel!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.obsidian,
                          ),
                        ),
                        Text(
                          SupplierL10n.t(lang, 'linked_parent_banner'),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.charcoal,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.onClearPendingLinkParent != null)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 28,
                        minHeight: 28,
                      ),
                      onPressed: widget.saving
                          ? null
                          : widget.onClearPendingLinkParent,
                      icon: const Icon(
                        Icons.close_rounded,
                        size: 16,
                        color: AppColors.charcoal,
                      ),
                    ),
                ],
              ),
            ),
          ],
          if (widget.linkedSiblings.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.linkedSiblings.map((sib) {
                final unlinking = widget.unlinkingSiblingId == sib.id;
                final label = sib.color.isNotEmpty
                    ? sib.color
                    : (sib.title.isNotEmpty ? sib.title : sib.customSku);
                return Container(
                  constraints: const BoxConstraints(maxWidth: 220),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.warmSurface,
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    border: Border.all(color: AppColors.warmHairline),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: SizedBox(
                          width: 30,
                          height: 36,
                          child: sib.imageUrl.isNotEmpty
                              ? SmartNetworkImage(
                                  imageUrl: sib.imageUrl,
                                  fit: BoxFit.cover,
                                )
                              : Container(
                                  color: AppColors.pureWhite,
                                  child: const Icon(
                                    Icons.palette_outlined,
                                    size: 14,
                                    color: AppColors.mutedAccessible,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: sib.isActive
                                        ? AppColors.emerald
                                        : const Color(0xFFD97706),
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (sib.customSku.isNotEmpty)
                              Text(
                                sib.customSku,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: AppColors.mutedAccessible,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: (widget.saving || unlinking)
                            ? null
                            : () => widget.onUnlinkSibling(sib),
                        child: Padding(
                          padding: const EdgeInsets.all(3),
                          child: unlinking
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.8,
                                  ),
                                )
                              : const Icon(
                                  Icons.close_rounded,
                                  size: 15,
                                  color: AppColors.charcoal,
                                ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ] else if ((widget.pendingLinkParentLabel ?? '').isEmpty &&
              widget.extraColorDrafts.isEmpty) ...[
            const SizedBox(height: 8),
            Text(
              SupplierL10n.t(lang, 'linked_colors_empty'),
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.mutedAccessible,
                height: 1.35,
              ),
            ),
          ],
          if (widget.extraColorDrafts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              SupplierL10n.t(lang, 'extra_colors_queued'),
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: AppColors.charcoal,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List<Widget>.generate(widget.extraColorDrafts.length, (
                idx,
              ) {
                final draft = widget.extraColorDrafts[idx];
                final firstPhoto =
                    draft.photos.isNotEmpty ? draft.photos.first : null;
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.emeraldLight,
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    border: Border.all(
                      color: AppColors.emerald.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (firstPhoto != null) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: SizedBox(
                            width: 28,
                            height: 34,
                            child: firstPhoto.isRemote
                                ? SmartNetworkImage(
                                    imageUrl: firstPhoto.remoteUrl,
                                    fit: BoxFit.cover,
                                  )
                                : Image.file(
                                    File(firstPhoto.localPath!),
                                    fit: BoxFit.cover,
                                  ),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        '${draft.colorName} (${draft.photos.length})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                      const SizedBox(width: 4),
                      InkWell(
                        onTap: widget.saving
                            ? null
                            : () => widget.onRemoveExtraColorDraft(idx),
                        child: const Padding(
                          padding: EdgeInsets.all(2),
                          child: Icon(
                            Icons.close_rounded,
                            size: 15,
                            color: AppColors.charcoal,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.obsidian,
                  side: const BorderSide(color: AppColors.warmHairline),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 9,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  ),
                ),
                onPressed: (widget.saving || widget.linkingSiblings)
                    ? null
                    : widget.onOpenLinkerSheet,
                icon: widget.linkingSiblings
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.link_rounded, size: 17),
                label: Text(
                  SupplierL10n.t(lang, 'link_existing_product'),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.luxuryBronze,
                  side: BorderSide(
                    color: _showInlineCreator
                        ? AppColors.luxuryBronze
                        : AppColors.luxuryBronze.withValues(alpha: 0.45),
                  ),
                  backgroundColor: _showInlineCreator
                      ? AppColors.accentGoldLight
                      : AppColors.pureWhite,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 9,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                  ),
                ),
                onPressed: widget.saving
                    ? null
                    : () => setState(
                          () => _showInlineCreator = !_showInlineCreator,
                        ),
                icon: Icon(
                  _showInlineCreator
                      ? Icons.expand_less_rounded
                      : Icons.add_photo_alternate_outlined,
                  size: 17,
                ),
                label: Text(
                  SupplierL10n.t(lang, 'add_another_color_now'),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          if (_showInlineCreator) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warmSurface,
                borderRadius: BorderRadius.circular(AppColors.radiusMd),
                border: Border.all(color: AppColors.warmHairline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusMd),
                    onTap: widget.saving ? null : _pickColor,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.pureWhite,
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                        border: Border.all(color: AppColors.warmHairline),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.color_lens_outlined,
                            size: 18,
                            color: AppColors.luxuryBronze,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _draftColorName.isNotEmpty
                                  ? _draftColorName
                                  : SupplierL10n.t(
                                      lang,
                                      'primary_color_label',
                                    ),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: _draftColorName.isNotEmpty
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: _draftColorName.isNotEmpty
                                    ? AppColors.obsidian
                                    : AppColors.mutedAccessible,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: AppColors.mutedAccessible,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (widget.availableColors.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: widget.availableColors.take(8).map((c) {
                          final active = _draftColorId == c.id;
                          return Padding(
                            padding: const EdgeInsetsDirectional.only(end: 6),
                            child: ChoiceChip(
                              label: Text(
                                c.name,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: active
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                ),
                              ),
                              selected: active,
                              selectedColor: AppColors.accentGoldLight,
                              onSelected: widget.saving
                                  ? null
                                  : (_) => setState(() {
                                        _draftColorId = c.id;
                                        _draftColorName = c.name;
                                      }),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: AppColors.pureWhite,
                            foregroundColor: AppColors.obsidian,
                            side:
                                const BorderSide(color: AppColors.warmHairline),
                          ),
                          onPressed:
                              widget.saving ? null : _openCameraForExtraColor,
                          icon: const Icon(Icons.camera_alt_outlined, size: 16),
                          label: Text(
                            SupplierL10n.t(lang, 'wizard_add_camera'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: AppColors.pureWhite,
                            foregroundColor: AppColors.obsidian,
                            side:
                                const BorderSide(color: AppColors.warmHairline),
                          ),
                          onPressed:
                              widget.saving ? null : _pickGalleryForExtraColor,
                          icon: const Icon(
                            Icons.photo_library_outlined,
                            size: 16,
                          ),
                          label: Text(
                            SupplierL10n.t(lang, 'wizard_add_gallery'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_draftPhotos.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 82,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _draftPhotos.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, idx) {
                          final item = _draftPhotos[idx];
                          return Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(
                                  AppColors.radiusSm,
                                ),
                                child: SizedBox(
                                  width: 64,
                                  height: 82,
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
                              ),
                              Positioned(
                                top: 2,
                                right: 2,
                                child: InkWell(
                                  onTap: () => setState(
                                    () => _draftPhotos.removeAt(idx),
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(
                                      color: AppColors.obsidian
                                          .withValues(alpha: 0.72),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.close_rounded,
                                      size: 12,
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
                  ],
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.luxuryBronze,
                      foregroundColor: AppColors.pureWhite,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppColors.radiusMd),
                      ),
                    ),
                    onPressed: widget.saving ? null : _commitInlineExtraColor,
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: Text(
                      SupplierL10n.t(lang, 'add_extra_color_btn'),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
