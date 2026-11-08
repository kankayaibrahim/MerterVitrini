import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Platform-independent crisp vector flag widget for language & currency codes.
/// Avoids Windows Segoe UI Emoji missing-flag bugs and requires zero network requests.
class CountryFlagIcon extends StatelessWidget {
  final String code;
  final double width;
  final double height;

  const CountryFlagIcon({
    super.key,
    required this.code,
    this.width = 18,
    this.height = 13,
  });

  static String normalizeCountryKey(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'tr':
      case 'try':
      case 'tl':
        return 'tr';
      case 'en':
      case 'gb':
      case 'uk':
      case 'gbp':
        return 'gb';
      case 'us':
      case 'usd':
        return 'us';
      case 'eu':
      case 'eur':
        return 'eu';
      case 'ru':
      case 'rub':
        return 'ru';
      case 'ar':
      case 'sa':
      case 'sar':
        return 'sa';
      case 'de':
        return 'de';
      case 'fr':
        return 'fr';
      case 'pl':
        return 'pl';
      case 'bg':
        return 'bg';
      default:
        return 'tr';
    }
  }

  @override
  Widget build(BuildContext context) {
    final normalized = normalizeCountryKey(code);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2),
        border: Border.all(
          color: Colors.black.withValues(alpha: 0.14),
          width: 0.6,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(
        size: Size(width, height),
        painter: _VectorFlagPainter(normalized),
      ),
    );
  }
}

class _VectorFlagPainter extends CustomPainter {
  final String country;

  const _VectorFlagPainter(this.country);

  @override
  void paint(Canvas canvas, Size size) {
    switch (country) {
      case 'tr':
        _paintTurkey(canvas, size);
      case 'gb':
        _paintUnitedKingdom(canvas, size);
      case 'us':
        _paintUnitedStates(canvas, size);
      case 'eu':
        _paintEuropeanUnion(canvas, size);
      case 'ru':
        _paintHorizontalTricolor(
          canvas,
          size,
          const Color(0xFFFFFFFF),
          const Color(0xFF0039A6),
          const Color(0xFFD52B1E),
        );
      case 'sa':
        _paintSaudiArabia(canvas, size);
      case 'de':
        _paintHorizontalTricolor(
          canvas,
          size,
          const Color(0xFF000000),
          const Color(0xFFDD0000),
          const Color(0xFFFFCE00),
        );
      case 'fr':
        _paintVerticalTricolor(
          canvas,
          size,
          const Color(0xFF002395),
          const Color(0xFFFFFFFF),
          const Color(0xFFED2939),
        );
      case 'pl':
        _paintHorizontalBicolor(
          canvas,
          size,
          const Color(0xFFFFFFFF),
          const Color(0xFFDC143C),
        );
      case 'bg':
        _paintHorizontalTricolor(
          canvas,
          size,
          const Color(0xFFFFFFFF),
          const Color(0xFF00966E),
          const Color(0xFFD62612),
        );
      default:
        _paintTurkey(canvas, size);
    }
  }

  void _paintTurkey(Canvas canvas, Size s) {
    final redPaint = Paint()..color = const Color(0xFFE30A17);
    final whitePaint = Paint()..color = Colors.white;
    canvas.drawRect(Offset.zero & s, redPaint);

    final h = s.height;
    final outerCenter = Offset(s.width * 0.37, h * 0.5);
    final innerCenter = Offset(s.width * 0.435, h * 0.5);
    final outerPath = Path()
      ..addOval(Rect.fromCircle(center: outerCenter, radius: h * 0.25));
    final innerPath = Path()
      ..addOval(Rect.fromCircle(center: innerCenter, radius: h * 0.20));
    final crescent = Path.combine(
      PathOperation.difference,
      outerPath,
      innerPath,
    );
    canvas.drawPath(crescent, whitePaint);

    _drawFivePointStar(
      canvas,
      center: Offset(s.width * 0.60, h * 0.5),
      outerRadius: h * 0.135,
      rotationRadians: -0.32,
      paint: whitePaint,
    );
  }

  void _paintUnitedKingdom(Canvas canvas, Size s) {
    canvas.drawRect(
      Offset.zero & s,
      Paint()..color = const Color(0xFF012169),
    );

    final whiteDiag = Paint()
      ..color = Colors.white
      ..strokeWidth = s.height * 0.22
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset.zero, Offset(s.width, s.height), whiteDiag);
    canvas.drawLine(Offset(s.width, 0), Offset(0, s.height), whiteDiag);

    final redDiag = Paint()
      ..color = const Color(0xFFC8102E)
      ..strokeWidth = s.height * 0.10
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset.zero, Offset(s.width, s.height), redDiag);
    canvas.drawLine(Offset(s.width, 0), Offset(0, s.height), redDiag);

    final whiteCrossW = s.height * 0.34;
    final whitePaint = Paint()..color = Colors.white;
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(s.width * 0.5, s.height * 0.5),
        width: s.width,
        height: whiteCrossW,
      ),
      whitePaint,
    );
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(s.width * 0.5, s.height * 0.5),
        width: whiteCrossW,
        height: s.height,
      ),
      whitePaint,
    );

    final redCrossW = s.height * 0.20;
    final redPaint = Paint()..color = const Color(0xFFC8102E);
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(s.width * 0.5, s.height * 0.5),
        width: s.width,
        height: redCrossW,
      ),
      redPaint,
    );
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(s.width * 0.5, s.height * 0.5),
        width: redCrossW,
        height: s.height,
      ),
      redPaint,
    );
  }

  void _paintUnitedStates(Canvas canvas, Size s) {
    canvas.drawRect(Offset.zero & s, Paint()..color = Colors.white);
    final stripeH = s.height / 13.0;
    final redPaint = Paint()..color = const Color(0xFFB22234);
    for (var i = 0; i < 13; i += 2) {
      canvas.drawRect(
        Rect.fromLTWH(0, i * stripeH, s.width, stripeH),
        redPaint,
      );
    }

    final cantonW = s.width * 0.44;
    final cantonH = stripeH * 7.0;
    canvas.drawRect(
      Rect.fromLTWH(0, 0, cantonW, cantonH),
      Paint()..color = const Color(0xFF3C3B6E),
    );

    final dotPaint = Paint()..color = Colors.white;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 4; c++) {
        canvas.drawCircle(
          Offset(
            cantonW * (0.16 + c * 0.22),
            cantonH * (0.22 + r * 0.28),
          ),
          s.height * 0.032,
          dotPaint,
        );
      }
    }
  }

  void _paintEuropeanUnion(Canvas canvas, Size s) {
    canvas.drawRect(
      Offset.zero & s,
      Paint()..color = const Color(0xFF003399),
    );
    final goldPaint = Paint()..color = const Color(0xFFFFCC00);
    final center = Offset(s.width * 0.5, s.height * 0.5);
    final ringRadius = s.height * 0.31;
    for (var i = 0; i < 12; i++) {
      final angle = (i * math.pi / 6.0) - (math.pi / 2.0);
      final pos = Offset(
        center.dx + ringRadius * math.cos(angle),
        center.dy + ringRadius * math.sin(angle),
      );
      canvas.drawCircle(pos, s.height * 0.042, goldPaint);
    }
  }

  void _paintSaudiArabia(Canvas canvas, Size s) {
    canvas.drawRect(
      Offset.zero & s,
      Paint()..color = const Color(0xFF006C35),
    );
    final whitePaint = Paint()
      ..color = Colors.white
      ..strokeCap = StrokeCap.round;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          s.width * 0.22,
          s.height * 0.30,
          s.width * 0.56,
          s.height * 0.16,
        ),
        const Radius.circular(1),
      ),
      whitePaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(
        s.width * 0.25,
        s.height * 0.62,
        s.width * 0.50,
        s.height * 0.09,
      ),
      whitePaint,
    );
  }

  void _paintHorizontalTricolor(
    Canvas canvas,
    Size s,
    Color top,
    Color middle,
    Color bottom,
  ) {
    final band = s.height / 3.0;
    canvas.drawRect(Rect.fromLTWH(0, 0, s.width, band), Paint()..color = top);
    canvas.drawRect(
      Rect.fromLTWH(0, band, s.width, band),
      Paint()..color = middle,
    );
    canvas.drawRect(
      Rect.fromLTWH(0, band * 2, s.width, band),
      Paint()..color = bottom,
    );
  }

  void _paintVerticalTricolor(
    Canvas canvas,
    Size s,
    Color left,
    Color center,
    Color right,
  ) {
    final band = s.width / 3.0;
    canvas.drawRect(
      Rect.fromLTWH(0, 0, band, s.height),
      Paint()..color = left,
    );
    canvas.drawRect(
      Rect.fromLTWH(band, 0, band, s.height),
      Paint()..color = center,
    );
    canvas.drawRect(
      Rect.fromLTWH(band * 2, 0, band, s.height),
      Paint()..color = right,
    );
  }

  void _paintHorizontalBicolor(Canvas canvas, Size s, Color top, Color bottom) {
    final half = s.height * 0.5;
    canvas.drawRect(Rect.fromLTWH(0, 0, s.width, half), Paint()..color = top);
    canvas.drawRect(
      Rect.fromLTWH(0, half, s.width, half),
      Paint()..color = bottom,
    );
  }

  void _drawFivePointStar(
    Canvas canvas, {
    required Offset center,
    required double outerRadius,
    required double rotationRadians,
    required Paint paint,
  }) {
    final innerRadius = outerRadius * 0.382;
    final path = Path();
    for (var i = 0; i < 10; i++) {
      final radius = i.isEven ? outerRadius : innerRadius;
      final angle = rotationRadians + (i * math.pi / 5.0) - (math.pi / 2.0);
      final pt = Offset(
        center.dx + radius * math.cos(angle),
        center.dy + radius * math.sin(angle),
      );
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _VectorFlagPainter oldDelegate) =>
      oldDelegate.country != country;
}

