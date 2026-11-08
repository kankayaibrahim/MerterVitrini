import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../models/chat.dart';
import '../../providers/chat_provider.dart';
import '../../providers/session_provider.dart';
import '../../widgets/luxury_icons.dart';
import 'chat_conversation_screen.dart';

class ChatRoomsScreen extends StatefulWidget {
  final bool asSupplier;

  const ChatRoomsScreen({super.key, required this.asSupplier});

  @override
  State<ChatRoomsScreen> createState() => _ChatRoomsScreenState();
}

class _ChatRoomsScreenState extends State<ChatRoomsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ChatProvider>().loadRoomsForCurrentRole();
    });
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final session = context.watch<SessionProvider>();
    final rooms = widget.asSupplier ? chat.supplierRooms : chat.customerRooms;
    final dateFmt = DateFormat('HH:mm');

    return Column(
      children: [
        if (widget.asSupplier && session.isSupplierLoggedIn)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: AppColors.cultured)),
            ),
            child: Row(
              children: [
                _ScopeButton(
                  label: 'TÜM MESAJLAR',
                  selected: chat.supplierScope == 'all',
                  onTap: () => chat.setSupplierScope('all'),
                ),
                const SizedBox(width: 8),
                _ScopeButton(
                  label: 'BANA ATANANLAR',
                  selected: chat.supplierScope == 'mine',
                  onTap: () => chat.setSupplierScope('mine'),
                ),
                const Spacer(),
                Container(
                  width: 7,
                  height: 7,
                  color: chat.isRealtimeConnected
                      ? AppColors.emerald
                      : AppColors.champagneGold,
                ),
                const SizedBox(width: 6),
                Text(
                  chat.isRealtimeConnected ? 'CANLI' : 'BAĞLANIYOR',
                  style: const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.9,
                    color: AppColors.sonicSilver,
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: AppColors.editorialOffWhite,
              border: Border(bottom: BorderSide(color: AppColors.cultured)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'B2B ÜRETİCİ PAZARLIK HATTI',
                  style: TextStyle(
                    fontFamily: AppColors.serifFontFamily,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: AppColors.obsidian,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 6.5,
                      height: 6.5,
                      color: chat.isRealtimeConnected
                          ? AppColors.emerald
                          : AppColors.champagneGold,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      chat.isRealtimeConnected ? 'AKTİF' : 'HAZIR',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.9,
                        color: AppColors.editorialGold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.obsidian,
            onRefresh: chat.loadRoomsForCurrentRole,
            child: chat.loadingRooms && rooms.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.obsidian,
                    ),
                  )
                : rooms.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 96),
                          Center(
                            child: Container(
                              width: 70,
                              height: 70,
                              decoration: BoxDecoration(
                                color: AppColors.editorialOffWhite,
                                border: Border.all(color: AppColors.cultured),
                              ),
                              alignment: Alignment.center,
                              child: const LuxuryIcon(
                                kind: LuxuryIconKind.concierge,
                                size: 30,
                                color: AppColors.obsidian,
                                accentColor: AppColors.champagneGold,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Center(
                            child: Text(
                              'HENÜZ AKTİF GÖRÜŞME YOK',
                              style: TextStyle(
                                fontFamily: AppColors.serifFontFamily,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.6,
                                color: AppColors.obsidian,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 36),
                            child: Text(
                              widget.asSupplier
                                  ? 'Müşterilerden gelen B2B seri fiyat ve stok soruları burada listelenir.'
                                  : 'Ürün detay sayfasındaki "Tedarikçiye Sor / Özel Seri Teklifi İste" alanından doğrudan üretici temsilcisine bağlanabilirsiniz.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.sonicSilver,
                                height: 1.45,
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        itemCount: rooms.length,
                        separatorBuilder: (context, index) =>
                            const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final room = rooms[index];
                          return _RoomTile(
                            room: room,
                            asSupplier: widget.asSupplier,
                            timeLabel: dateFmt.format(
                              room.lastMessageAt.toLocal(),
                            ),
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => ChatConversationScreen(
                                    room: room,
                                    asSupplier: widget.asSupplier,
                                  ),
                                ),
                              );
                              if (context.mounted) {
                                context
                                    .read<ChatProvider>()
                                    .loadRoomsForCurrentRole();
                              }
                            },
                          );
                        },
                      ),
          ),
        ),
      ],
    );
  }
}

class _ScopeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ScopeButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.obsidian : AppColors.editorialOffWhite,
          border: Border.all(
            color: selected ? AppColors.obsidian : AppColors.cultured,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9.8,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.9,
            color: selected ? Colors.white : AppColors.onyx,
          ),
        ),
      ),
    );
  }
}

class _RoomTile extends StatelessWidget {
  final ChatRoom room;
  final bool asSupplier;
  final String timeLabel;
  final VoidCallback onTap;

  const _RoomTile({
    required this.room,
    required this.asSupplier,
    required this.timeLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final unread =
        asSupplier ? room.unreadSupplierCount : room.unreadCustomerCount;
    final title = asSupplier
        ? room.customerName
        : (room.supplierUserName.isNotEmpty
            ? '${room.supplierName} • ${room.supplierUserName}'
            : room.supplierName);
    final subtitleBadge = asSupplier
        ? (room.supplierUserName.isNotEmpty
            ? 'TEMSİLCİ: ${room.supplierUserName.toUpperCase()}'
            : 'GENEL MAĞAZA HATTI')
        : (room.supplierUserLanguages.isNotEmpty
            ? '${room.supplierUserTitle.toUpperCase()} (${room.supplierUserLanguages.toUpperCase()})'
            : 'DOĞRUDAN ÜRETİCİ HATTI');

    final darkCrest = unread > 0 || asSupplier;

    return ListTile(
      onTap: onTap,
      tileColor: unread > 0 ? AppColors.editorialIvory : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: darkCrest ? AppColors.obsidian : AppColors.editorialOffWhite,
          border: Border.all(
            color: darkCrest
                ? AppColors.champagneGold.withValues(alpha: 0.65)
                : AppColors.cultured,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          title.isNotEmpty ? title.characters.first.toUpperCase() : 'M',
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: darkCrest ? Colors.white : AppColors.obsidian,
          ),
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w700,
                fontSize: 14,
                color: AppColors.obsidian,
              ),
            ),
          ),
          Text(
            timeLabel,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.spanishGray,
            ),
          ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 3),
          Text(
            subtitleBadge,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: AppColors.editorialGold,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  room.lastMessagePreview.isEmpty
                      ? 'Görüşme başlatıldı'
                      : room.lastMessagePreview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: unread > 0
                        ? AppColors.obsidian
                        : AppColors.sonicSilver,
                    fontWeight:
                        unread > 0 ? FontWeight.w700 : FontWeight.normal,
                  ),
                ),
              ),
              if (unread > 0)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2.5,
                  ),
                  color: AppColors.obsidian,
                  child: Text(
                    '$unread',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
