import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/cart_and_order.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';
import 'order_detail_screen.dart';

class CustomerOrdersScreen extends StatefulWidget {
  const CustomerOrdersScreen({super.key});

  @override
  State<CustomerOrdersScreen> createState() => _CustomerOrdersScreenState();
}

class _CustomerOrdersScreenState extends State<CustomerOrdersScreen> {
  List<CustomerOrder> _orders = <CustomerOrder>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/orders',
            pageTitle: 'Customer Orders',
          );
      _loadOrders();
    });
  }

  Future<void> _loadOrders() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list =
          await context.read<SessionProvider>().api.listCustomerOrders();
      if (!mounted) return;
      setState(() => _orders = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  (Color, Color) _statusColors(String raw) {
    switch (raw.toUpperCase()) {
      case 'PENDING_PAYMENT':
      case 'PENDING':
        return (AppColors.editorialGold, AppColors.warmIvory);
      case 'PAYMENT_NOTIFIED':
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PREPARING':
        return (AppColors.obsidian, AppColors.editorialOffWhite);
      case 'SHIPPED':
      case 'DELIVERED':
      case 'COMPLETED':
        return (AppColors.emerald, AppColors.emeraldLight);
      case 'CANCELLED':
        return (AppColors.danger, AppColors.dangerLight);
      default:
        return (AppColors.sonicSilver, AppColors.editorialOffWhite);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final dateFmt = DateFormat('dd.MM.yyyy HH:mm');

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'orders'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14.5,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
        actions: [
          IconButton(
            onPressed: _loadOrders,
            icon: const Icon(Icons.refresh_rounded, size: 20),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _loadOrders,
                )
              : _orders.isEmpty
                  ? EditorialEmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: AppStrings.t(lang, 'empty'),
                      subtitle: UiText.pick(
                        lang,
                        tr: 'Henüz verilmiş toptan siparişiniz bulunmuyor.',
                        en: 'You have not placed any wholesale orders yet.',
                        ru: 'У вас пока нет оптовых заказов.',
                        ar: 'لم تقم بتقديم أي طلبات جملة حتى الآن.',
                        de: 'Sie haben noch keine Großhandelsbestellungen aufgegeben.',
                        fr: 'Vous n’avez pas encore passé de commande en gros.',
                        pl: 'Nie złożyłeś jeszcze żadnych zamówień hurtowych.',
                        bg: 'Все още нямате направени поръчки на едро.',
                      ),
                    )
                  : RefreshIndicator(
                      color: AppColors.obsidian,
                      onRefresh: _loadOrders,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _orders.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final order = _orders[index];
                          final colors = _statusColors(order.orderStatus);

                          return EditorialCard(
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => OrderDetailScreen(
                                    orderId: order.id,
                                    initialOrder: order,
                                  ),
                                ),
                              );
                              if (mounted) await _loadOrders();
                            },
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        order.orderNumber,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: AppColors.serifFontFamily,
                                          fontSize: 15.5,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    EditorialBadge(
                                      label: UiText.statusLabel(
                                        lang,
                                        order.orderStatus,
                                      ),
                                      textColor: colors.$1,
                                      backgroundColor: colors.$2,
                                      languageCode: lang,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  dateFmt.format(order.createdAt.toLocal()),
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.sonicSilver,
                                  ),
                                ),
                                if (order.items.isNotEmpty) ...[
                                  const Divider(height: 18),
                                  ...order.items.take(2).map(
                                        (it) => Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 8),
                                          child: Row(
                                            children: [
                                              SmartNetworkImage(
                                                imageUrl: it.imageUrl,
                                                width: 40,
                                                height: 50,
                                                borderRadius:
                                                    BorderRadius.circular(
                                                  AppColors.radiusSm,
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      it.productName,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        fontSize: 12.5,
                                                      ),
                                                    ),
                                                    Text(
                                                      '${it.productSku} • ${it.quantity} ${AppStrings.t(lang, 'piece')}',
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        color: AppColors
                                                            .sonicSilver,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                ],
                                const Divider(height: 16),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        session.formatPrice(
                                          order.totalAmount,
                                          sourceCurrency: order.currency,
                                        ),
                                        style: const TextStyle(
                                          fontSize: 16.5,
                                          fontWeight: FontWeight.w900,
                                          color: AppColors.obsidian,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      AppStrings.t(lang, 'order_detail'),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.editorialGold,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.arrow_forward_rounded,
                                      size: 15,
                                      color: AppColors.editorialGold,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
