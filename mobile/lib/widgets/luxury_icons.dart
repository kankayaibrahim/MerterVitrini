import 'package:flutter/material.dart';

import '../core/app_theme.dart';
import '../core/localization.dart';

enum LuxuryIconKind {
  showroom,
  collection,
  bag,
  concierge,
  account,
  heart,
  bell,
  search,
  filter,
  studioCamera,
  share,
  orders,
  location,
  shield,
  document,
  update,
}

/// Crisp, architectural fine-stroke vector icons designed specifically for the
/// Merter Vitrini Monochrome & Champagne Gold Luxury B2B interface.
class LuxuryIcon extends StatelessWidget {
  final LuxuryIconKind kind;
  final double size;
  final Color color;
  final Color? accentColor;
  final bool active;
  final double strokeWidth;

  const LuxuryIcon({
    super.key,
    required this.kind,
    this.size = 20,
    this.color = AppColors.eerieBlack,
    this.accentColor,
    this.active = false,
    this.strokeWidth = 1.55,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _LuxuryIconPainter(
          kind: kind,
          color: color,
          accentColor: accentColor ?? AppColors.editorialGold,
          active: active,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

class _LuxuryIconPainter extends CustomPainter {
  final LuxuryIconKind kind;
  final Color color;
  final Color accentColor;
  final bool active;
  final double strokeWidth;

  const _LuxuryIconPainter({
    required this.kind,
    required this.color,
    required this.accentColor,
    required this.active,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.square
      ..strokeJoin = StrokeJoin.miter
      ..isAntiAlias = true;

    final accentStroke = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.square
      ..strokeJoin = StrokeJoin.miter
      ..isAntiAlias = true;

    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final accentFill = Paint()
      ..color = accentColor
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    switch (kind) {
      case LuxuryIconKind.showroom:
        // Boutique couturier hanger + showroom baseline
        final hookPath = Path()
          ..moveTo(w * 0.42, h * 0.25)
          ..arcToPoint(
            Offset(w * 0.58, h * 0.25),
            radius: Radius.circular(w * 0.09),
            clockwise: true,
          )
          ..quadraticBezierTo(w * 0.58, h * 0.35, w * 0.50, h * 0.39)
          ..lineTo(w * 0.50, h * 0.45);
        canvas.drawPath(hookPath, active ? accentStroke : stroke);

        final hangerBody = Path()
          ..moveTo(w * 0.50, h * 0.45)
          ..lineTo(w * 0.88, h * 0.72)
          ..lineTo(w * 0.88, h * 0.78)
          ..lineTo(w * 0.12, h * 0.78)
          ..lineTo(w * 0.12, h * 0.72)
          ..close();
        if (active) {
          canvas.drawPath(
            hangerBody,
            Paint()
              ..color = color.withValues(alpha: 0.10)
              ..style = PaintingStyle.fill,
          );
        }
        canvas.drawPath(hangerBody, stroke);
        break;

      case LuxuryIconKind.collection:
        // Asymmetric 4-pane editorial lookbook grid
        final gap = w * 0.08;
        final leftW = w * 0.38;
        final rightW = w * 0.76 - leftW - gap;
        final x0 = w * 0.12;
        final y0 = h * 0.12;
        final r1 = Rect.fromLTWH(x0, y0, leftW, h * 0.44);
        final r2 = Rect.fromLTWH(x0, y0 + h * 0.44 + gap, leftW, h * 0.24);
        final r3 = Rect.fromLTWH(x0 + leftW + gap, y0, rightW, h * 0.24);
        final r4 = Rect.fromLTWH(
          x0 + leftW + gap,
          y0 + h * 0.24 + gap,
          rightW,
          h * 0.44,
        );
        if (active) {
          canvas.drawRect(r1, fill);
          canvas.drawRect(r4, accentFill);
          canvas.drawRect(r2, stroke);
          canvas.drawRect(r3, stroke);
        } else {
          canvas.drawRect(r1, stroke);
          canvas.drawRect(r2, stroke);
          canvas.drawRect(r3, stroke);
          canvas.drawRect(r4, stroke);
        }
        break;

      case LuxuryIconKind.bag:
        // Structured luxury fashion tote bag
        final bagPath = Path()
          ..moveTo(w * 0.20, h * 0.34)
          ..lineTo(w * 0.80, h * 0.34)
          ..lineTo(w * 0.85, h * 0.86)
          ..lineTo(w * 0.15, h * 0.86)
          ..close();
        if (active) {
          canvas.drawPath(bagPath, fill);
        } else {
          canvas.drawPath(bagPath, stroke);
        }
        final handle = Path()
          ..moveTo(w * 0.35, h * 0.34)
          ..lineTo(w * 0.35, h * 0.25)
          ..arcToPoint(
            Offset(w * 0.65, h * 0.25),
            radius: Radius.circular(w * 0.15),
            clockwise: true,
          )
          ..lineTo(w * 0.65, h * 0.34);
        canvas.drawPath(handle, active ? accentStroke : stroke);
        break;

      case LuxuryIconKind.concierge:
        // Architectural dialogue frame
        final msg = Path()
          ..moveTo(w * 0.14, h * 0.18)
          ..lineTo(w * 0.86, h * 0.18)
          ..lineTo(w * 0.86, h * 0.68)
          ..lineTo(w * 0.42, h * 0.68)
          ..lineTo(w * 0.22, h * 0.85)
          ..lineTo(w * 0.22, h * 0.68)
          ..lineTo(w * 0.14, h * 0.68)
          ..close();
        if (active) {
          canvas.drawPath(msg, fill);
          final linePaint = Paint()
            ..color = Colors.white
            ..strokeWidth = strokeWidth
            ..style = PaintingStyle.stroke;
          canvas.drawLine(
            Offset(w * 0.30, h * 0.38),
            Offset(w * 0.70, h * 0.38),
            linePaint,
          );
          canvas.drawLine(
            Offset(w * 0.30, h * 0.50),
            Offset(w * 0.56, h * 0.50),
            linePaint,
          );
        } else {
          canvas.drawPath(msg, stroke);
          canvas.drawLine(
            Offset(w * 0.30, h * 0.38),
            Offset(w * 0.70, h * 0.38),
            accentStroke,
          );
          canvas.drawLine(
            Offset(w * 0.30, h * 0.51),
            Offset(w * 0.55, h * 0.51),
            stroke,
          );
        }
        break;

      case LuxuryIconKind.account:
        // Minimalist atelier silhouette
        final headCenter = Offset(w * 0.50, h * 0.31);
        if (active) {
          canvas.drawCircle(headCenter, w * 0.16, fill);
        } else {
          canvas.drawCircle(headCenter, w * 0.16, stroke);
        }
        final shoulders = Path()
          ..moveTo(w * 0.18, h * 0.85)
          ..lineTo(w * 0.22, h * 0.64)
          ..quadraticBezierTo(w * 0.50, h * 0.52, w * 0.78, h * 0.64)
          ..lineTo(w * 0.82, h * 0.85);
        if (active) {
          shoulders.close();
          canvas.drawPath(shoulders, fill);
        } else {
          canvas.drawPath(shoulders, stroke);
        }
        break;

      case LuxuryIconKind.heart:
        final heart = Path()
          ..moveTo(w * 0.50, h * 0.83)
          ..cubicTo(
            w * 0.14,
            h * 0.58,
            w * 0.10,
            h * 0.28,
            w * 0.31,
            h * 0.20,
          )
          ..cubicTo(
            w * 0.42,
            h * 0.16,
            w * 0.50,
            h * 0.25,
            w * 0.50,
            h * 0.32,
          )
          ..cubicTo(
            w * 0.50,
            h * 0.25,
            w * 0.58,
            h * 0.16,
            w * 0.69,
            h * 0.20,
          )
          ..cubicTo(
            w * 0.90,
            h * 0.28,
            w * 0.86,
            h * 0.58,
            w * 0.50,
            h * 0.83,
          )
          ..close();
        if (active) {
          canvas.drawPath(heart, fill);
        } else {
          canvas.drawPath(heart, stroke);
        }
        break;

      case LuxuryIconKind.bell:
        final bell = Path()
          ..moveTo(w * 0.22, h * 0.72)
          ..lineTo(w * 0.28, h * 0.44)
          ..arcToPoint(
            Offset(w * 0.72, h * 0.44),
            radius: Radius.circular(w * 0.22),
            clockwise: true,
          )
          ..lineTo(w * 0.78, h * 0.72)
          ..close();
        canvas.drawPath(bell, stroke);
        canvas.drawLine(
          Offset(w * 0.42, h * 0.82),
          Offset(w * 0.58, h * 0.82),
          accentStroke,
        );
        break;

      case LuxuryIconKind.search:
        canvas.drawCircle(Offset(w * 0.44, h * 0.44), w * 0.27, stroke);
        canvas.drawLine(
          Offset(w * 0.64, h * 0.64),
          Offset(w * 0.86, h * 0.86),
          stroke,
        );
        break;

      case LuxuryIconKind.filter:
        canvas.drawLine(
          Offset(w * 0.14, h * 0.28),
          Offset(w * 0.86, h * 0.28),
          stroke,
        );
        canvas.drawLine(
          Offset(w * 0.14, h * 0.52),
          Offset(w * 0.86, h * 0.52),
          stroke,
        );
        canvas.drawLine(
          Offset(w * 0.14, h * 0.76),
          Offset(w * 0.86, h * 0.76),
          stroke,
        );
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset(w * 0.34, h * 0.28),
            width: w * 0.14,
            height: h * 0.14,
          ),
          accentFill,
        );
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset(w * 0.66, h * 0.52),
            width: w * 0.14,
            height: h * 0.14,
          ),
          fill,
        );
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset(w * 0.42, h * 0.76),
            width: w * 0.14,
            height: h * 0.14,
          ),
          accentFill,
        );
        break;

      case LuxuryIconKind.studioCamera:
        final cam = Path()
          ..moveTo(w * 0.14, h * 0.32)
          ..lineTo(w * 0.32, h * 0.32)
          ..lineTo(w * 0.38, h * 0.20)
          ..lineTo(w * 0.62, h * 0.20)
          ..lineTo(w * 0.68, h * 0.32)
          ..lineTo(w * 0.86, h * 0.32)
          ..lineTo(w * 0.86, h * 0.80)
          ..lineTo(w * 0.14, h * 0.80)
          ..close();
        canvas.drawPath(cam, stroke);
        canvas.drawCircle(Offset(w * 0.50, h * 0.55), w * 0.16, accentStroke);
        break;

      case LuxuryIconKind.share:
        canvas.drawLine(
          Offset(w * 0.50, h * 0.64),
          Offset(w * 0.50, h * 0.16),
          stroke,
        );
        final arrow = Path()
          ..moveTo(w * 0.32, h * 0.34)
          ..lineTo(w * 0.50, h * 0.16)
          ..lineTo(w * 0.68, h * 0.34);
        canvas.drawPath(arrow, stroke);
        final tray = Path()
          ..moveTo(w * 0.20, h * 0.54)
          ..lineTo(w * 0.20, h * 0.84)
          ..lineTo(w * 0.80, h * 0.84)
          ..lineTo(w * 0.80, h * 0.54);
        canvas.drawPath(tray, stroke);
        break;

      case LuxuryIconKind.orders:
        canvas.drawRect(
          Rect.fromLTWH(w * 0.20, h * 0.14, w * 0.60, h * 0.72),
          stroke,
        );
        canvas.drawLine(
          Offset(w * 0.32, h * 0.34),
          Offset(w * 0.68, h * 0.34),
          accentStroke,
        );
        canvas.drawLine(
          Offset(w * 0.32, h * 0.50),
          Offset(w * 0.68, h * 0.50),
          stroke,
        );
        canvas.drawLine(
          Offset(w * 0.32, h * 0.66),
          Offset(w * 0.54, h * 0.66),
          stroke,
        );
        break;

      case LuxuryIconKind.location:
        final pin = Path()
          ..moveTo(w * 0.50, h * 0.86)
          ..quadraticBezierTo(w * 0.20, h * 0.56, w * 0.20, h * 0.38)
          ..arcToPoint(
            Offset(w * 0.80, h * 0.38),
            radius: Radius.circular(w * 0.30),
            clockwise: true,
          )
          ..quadraticBezierTo(w * 0.80, h * 0.56, w * 0.50, h * 0.86);
        canvas.drawPath(pin, stroke);
        canvas.drawCircle(Offset(w * 0.50, h * 0.38), w * 0.10, accentFill);
        break;

      case LuxuryIconKind.shield:
        final shield = Path()
          ..moveTo(w * 0.50, h * 0.14)
          ..lineTo(w * 0.82, h * 0.26)
          ..lineTo(w * 0.82, h * 0.52)
          ..quadraticBezierTo(w * 0.82, h * 0.76, w * 0.50, h * 0.88)
          ..quadraticBezierTo(w * 0.18, h * 0.76, w * 0.18, h * 0.52)
          ..lineTo(w * 0.18, h * 0.26)
          ..close();
        canvas.drawPath(shield, stroke);
        break;

      case LuxuryIconKind.document:
        final doc = Path()
          ..moveTo(w * 0.22, h * 0.14)
          ..lineTo(w * 0.62, h * 0.14)
          ..lineTo(w * 0.78, h * 0.30)
          ..lineTo(w * 0.78, h * 0.86)
          ..lineTo(w * 0.22, h * 0.86)
          ..close();
        canvas.drawPath(doc, stroke);
        canvas.drawLine(
          Offset(w * 0.34, h * 0.48),
          Offset(w * 0.66, h * 0.48),
          stroke,
        );
        canvas.drawLine(
          Offset(w * 0.34, h * 0.64),
          Offset(w * 0.58, h * 0.64),
          accentStroke,
        );
        break;

      case LuxuryIconKind.update:
        canvas.drawArc(
          Rect.fromCircle(center: Offset(w * 0.50, h * 0.50), radius: w * 0.32),
          -2.4,
          4.4,
          false,
          stroke,
        );
        final arrowHead = Path()
          ..moveTo(w * 0.66, h * 0.16)
          ..lineTo(w * 0.82, h * 0.24)
          ..lineTo(w * 0.74, h * 0.40);
        canvas.drawPath(arrowHead, accentStroke);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _LuxuryIconPainter oldDelegate) {
    return oldDelegate.kind != kind ||
        oldDelegate.color != color ||
        oldDelegate.accentColor != accentColor ||
        oldDelegate.active != active ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

/// Architectural MV Monogram Crest used in headers, splash, and login mastheads.
class MvEditorialCrest extends StatelessWidget {
  final double size;
  final bool darkBackground;

  const MvEditorialCrest({
    super.key,
    this.size = 30,
    this.darkBackground = true,
  });

  @override
  Widget build(BuildContext context) {
    final bg = darkBackground ? AppColors.pureBlack : Colors.white;
    final fg = darkBackground ? Colors.white : AppColors.pureBlack;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(
          color: AppColors.champagneGold.withValues(alpha: 0.75),
          width: 1,
        ),
      ),
      padding: const EdgeInsets.all(2),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: AppColors.champagneGold.withValues(alpha: 0.28),
            width: 0.75,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          'MV',
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            color: fg,
            fontSize: size * 0.36,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}

class EditorialNavItem {
  final LuxuryIconKind icon;
  final String label;
  final int badgeCount;

  const EditorialNavItem({
    required this.icon,
    required this.label,
    this.badgeCount = 0,
  });
}

/// Couture Bottom Tab Bar replacing generic Material 3 blob pills with a razor-sharp
/// architectural top indicator, bespoke fine-line icons, and tracked uppercase labels.
class EditorialBottomNavBar extends StatelessWidget {
  final int selectedIndex;
  final List<EditorialNavItem> items;
  final ValueChanged<int> onTap;
  final bool darkTheme;
  final String languageCode;

  const EditorialBottomNavBar({
    super.key,
    required this.selectedIndex,
    required this.items,
    required this.onTap,
    this.darkTheme = false,
    this.languageCode = 'tr',
  });

  @override
  Widget build(BuildContext context) {
    final bg = darkTheme ? AppColors.eerieBlack : Colors.white;
    final borderColor =
        darkTheme ? Colors.white.withValues(alpha: 0.08) : AppColors.cultured;
    final activeFg = darkTheme ? Colors.white : AppColors.pureBlack;
    final inactiveFg =
        darkTheme ? const Color(0xFF9CA3AF) : AppColors.sonicSilver;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        border: Border(top: BorderSide(color: borderColor, width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 14,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: List<Widget>.generate(items.length, (i) {
              final item = items[i];
              final isSelected = i == selectedIndex;
              return Expanded(
                child: InkWell(
                  onTap: () => onTap(i),
                  splashColor: AppColors.editorialIvory,
                  highlightColor: Colors.transparent,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Top Architectural Active Bar
                      Positioned(
                        top: 0,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutCubic,
                          width: isSelected ? 28 : 0,
                          height: 2,
                          color: isSelected
                              ? (darkTheme
                                  ? AppColors.champagneGold
                                  : AppColors.pureBlack)
                              : Colors.transparent,
                        ),
                      ),
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 2),
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              LuxuryIcon(
                                kind: item.icon,
                                size: 20,
                                active: isSelected,
                                color: isSelected ? activeFg : inactiveFg,
                                accentColor: AppColors.champagneGold,
                              ),
                              if (item.badgeCount > 0)
                                Positioned(
                                  top: -5,
                                  right: -8,
                                  child: Container(
                                    constraints: const BoxConstraints(
                                      minWidth: 15,
                                      minHeight: 15,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 3.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: darkTheme
                                          ? AppColors.champagneGold
                                          : AppColors.pureBlack,
                                      border: Border.all(
                                        color: bg,
                                        width: 1,
                                      ),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      item.badgeCount > 99
                                          ? '99+'
                                          : '${item.badgeCount}',
                                      style: TextStyle(
                                        color: darkTheme
                                            ? AppColors.pureBlack
                                            : Colors.white,
                                        fontSize: 8.5,
                                        fontWeight: FontWeight.w900,
                                        height: 1.0,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Text(
                            AppStrings.upper(item.label, languageCode),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9.2,
                              fontWeight: isSelected
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                              letterSpacing: 0.9,
                              color: isSelected ? activeFg : inactiveFg,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
