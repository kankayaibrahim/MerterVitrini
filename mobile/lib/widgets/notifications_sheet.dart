import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/app_theme.dart';
import '../providers/session_provider.dart';
import 'luxury_icons.dart';

class NotificationsBottomSheet extends StatefulWidget {
  const NotificationsBottomSheet({super.key});

  @override
  State<NotificationsBottomSheet> createState() =>
      _NotificationsBottomSheetState();
}

class _NotificationsBottomSheetState extends State<NotificationsBottomSheet> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().refreshNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final items = session.notifications;
    final fmt = DateFormat('dd.MM.yyyy HH:mm');

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'BİLDİRİM MERKEZİ',
                  style: TextStyle(
                    fontFamily: AppColors.serifFontFamily,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.8,
                    color: AppColors.obsidian,
                  ),
                ),
                Row(
                  children: [
                    if (session.unreadNotificationCount > 0)
                      TextButton(
                        onPressed: () => session.markAllNotificationsRead(),
                        child: const Text(
                          'TÜMÜNÜ OKUNDU İŞARETLE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: AppColors.editorialGold,
                          ),
                        ),
                      ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close_rounded, size: 19),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(height: 16),
            if (items.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 44),
                child: Column(
                  children: [
                    LuxuryIcon(
                      kind: LuxuryIconKind.bell,
                      size: 36,
                      color: AppColors.spanishGray,
                      accentColor: AppColors.champagneGold,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Henüz yeni bildiriminiz bulunmuyor.',
                      style: TextStyle(
                        color: AppColors.sonicSilver,
                        fontSize: 13,
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
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final n = items[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 2,
                        vertical: 8,
                      ),
                      leading: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: n.isRead
                              ? AppColors.editorialOffWhite
                              : AppColors.editorialIvory,
                          border: Border.all(
                            color: n.isRead
                                ? AppColors.cultured
                                : AppColors.champagneGold
                                    .withValues(alpha: 0.6),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: LuxuryIcon(
                          kind: n.notificationType.contains('chat')
                              ? LuxuryIconKind.concierge
                              : LuxuryIconKind.orders,
                          size: 17,
                          color: AppColors.obsidian,
                          accentColor: AppColors.champagneGold,
                        ),
                      ),
                      title: Text(
                        n.title,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              n.isRead ? FontWeight.w600 : FontWeight.w800,
                          color: AppColors.obsidian,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 3),
                          Text(
                            n.body,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.sonicSilver,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            fmt.format(n.createdAt.toLocal()),
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: AppColors.spanishGray,
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
    );
  }
}
