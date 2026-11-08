import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../core/app_config.dart';
import '../core/app_theme.dart';

class SmartNetworkImage extends StatelessWidget {
  final String? imageUrl;
  final BoxFit fit;
  final Alignment alignment;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const SmartNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.topCenter,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final resolved = AppConfig.resolveMediaUrl(imageUrl);
    Widget content;

    if (resolved.isEmpty || resolved.endsWith('/placeholder.png')) {
      content = _buildFallback();
    } else {
      content = CachedNetworkImage(
        imageUrl: resolved,
        width: width,
        height: height,
        fit: fit,
        alignment: alignment,
        placeholder: (context, url) => Shimmer.fromColors(
          baseColor: const Color(0xFFEDEAE4),
          highlightColor: const Color(0xFFF8F6F2),
          child: Container(
            width: width,
            height: height,
            color: Colors.white,
          ),
        ),
        errorWidget: (context, url, error) => _buildFallback(),
      );
    }

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: content,
      );
    }
    return content;
  }

  Widget _buildFallback() {
    return Container(
      width: width,
      height: height,
      color: const Color(0xFFF1F5F9),
      alignment: Alignment.center,
      child: const Icon(
        Icons.checkroom_rounded,
        color: AppColors.textMuted,
        size: 32,
      ),
    );
  }
}

