import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../core/localization.dart';
import '../providers/session_provider.dart';

class NotificationsBottomSheet extends StatelessWidget {
  const NotificationsBottomSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final items = session.notifications;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.78,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.warmHairline,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      AppStrings.tUpper(lang, 'notifications'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppColors.serifFontFamily,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: AppStrings.letterSpacing(lang, 1.3),
                        color: AppColors.obsidian,
                      ),
                    ),
                  ),
                  if (session.unreadNotificationCount > 0)
                    TextButton(
                      onPressed: () => session.markAllNotificationsRead(),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                      child: Text(
                        AppStrings.tUpper(lang, 'mark_all_read'),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: AppStrings.letterSpacing(lang, 0.7),
                          color: AppColors.editorialGold,
                        ),
                      ),
                    ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close_rounded, size: 19),
                    tooltip: AppStrings.t(lang, 'close'),
                  ),
                ],
              ),
              const Divider(height: 16),
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 42),
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppColors.editorialOffWhite,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusMd),
                          border: Border.all(color: AppColors.cultured),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.notifications_none_rounded,
                          size: 28,
                          color: AppColors.sonicSilver,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        AppStrings.t(lang, 'no_notifications'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.sonicSilver,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final n = items[index];
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: n.isRead ? Colors.white : AppColors.warmIvory,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusMd),
                          border: Border.all(
                            color: n.isRead
                                ? AppColors.cultured
                                : AppColors.champagneGold.withValues(alpha: 0.65),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(top: 5),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: n.isRead
                                    ? AppColors.spanishGray
                                    : AppColors.editorialGold,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    n.title,
                                    style: const TextStyle(
                                      fontFamily: AppColors.serifFontFamily,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13.5,
                                      color: AppColors.obsidian,
                                    ),
                                  ),
                                  if (n.body.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      n.body,
                                      style: const TextStyle(
                                        fontSize: 12.2,
                                        color: AppColors.onyx,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 6),
                                  Text(
                                    dateFmt.format(n.createdAt.toLocal()),
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.mutedAccessible,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
