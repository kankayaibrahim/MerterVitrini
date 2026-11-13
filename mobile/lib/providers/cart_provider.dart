import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../contracts/commerce_repository.dart';
import '../core/currency_formatter.dart';
import '../core/localization.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'session_provider.dart';

class CartProvider extends ChangeNotifier {
  final ICommerceRepository api;
  final SessionProvider session;

  List<CartItem> _items = const <CartItem>[];
  bool _loading = false;

  CartProvider({required this.api, required this.session});

  List<CartItem> get items => _items;
  bool get loading => _loading;

  int get totalPackages =>
      _items.fold<int>(0, (sum, item) => sum + item.packagesQty);

  int get totalUnits =>
      _items.fold<int>(0, (sum, item) => sum + item.totalUnits);

  /// Multi-currency safe total converted to Turkish Lira (TRY).
  double get totalAmountTry => totalInCurrency('TRY');

  /// Multi-currency safe total converted to the user's selected display currency.
  double get totalInDisplayCurrency => totalInCurrency(session.currencyCode);

  /// Converts every cart item from its native currency into [targetCurrency].
  double totalInCurrency(String targetCurrency) {
    final rates = session.exchangeRates;
    return _items.fold<double>(
      0.0,
      (sum, item) =>
          sum +
          CurrencyFormatter.convert(
            amount: item.lineTotal,
            sourceCurrency: item.currency,
            displayCurrency: targetCurrency,
            ratesToTry: rates,
          ),
    );
  }

  /// Native subtotal per source currency (`{'TRY': 5000, 'USD': 240}`).
  Map<String, double> get currencyBreakdown {
    final breakdown = <String, double>{};
    for (final item in _items) {
      final curr = item.currency.trim().isEmpty
          ? 'TRY'
          : (item.currency.toUpperCase() == 'TL'
                ? 'TRY'
                : item.currency.toUpperCase());
      breakdown[curr] = (breakdown[curr] ?? 0.0) + item.lineTotal;
    }
    return breakdown;
  }

  Future<void> loadCart() async {
    _loading = true;
    notifyListeners();
    try {
      if (session.isCustomerLoggedIn) {
        await _mergeGuestCartIntoServerIfAny();
        _items = await api.fetchServerCart();
      } else {
        _items = await _readLocalCart();
      }
    } catch (_) {
      // Keep current items if network fails.
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> addProductPackages(Product product, int packagesQty) async {
    final pkgs = packagesQty <= 0 ? 1 : packagesQty;
    final unitsPerPkg = product.unitsPerPackage <= 0
        ? 1
        : product.unitsPerPackage;
    final totalUnitsToAdd = pkgs * unitsPerPkg;

    if (session.isCustomerLoggedIn) {
      final existingIdx = _items.indexWhere((it) => it.productId == product.id);
      if (existingIdx >= 0) {
        final existing = _items[existingIdx];
        final newTotalUnits =
            (existing.packagesQty + pkgs) * existing.unitsPerPackage;
        await api.updateServerCartItem(
          itemId: existing.id,
          totalUnitsQuantity: newTotalUnits,
        );
      } else {
        await api.addServerCartItem(
          productId: product.id,
          totalUnitsQuantity: totalUnitsToAdd,
        );
      }
      _items = await api.fetchServerCart();
      notifyListeners();
      session.telemetry.trackMemberEvent(
        eventType: 'cart_add',
        entityType: 'product',
        entityId: product.id,
        title: product.title,
        metadata: {'packages_qty': pkgs, 'units': totalUnitsToAdd},
      );
      return;
    }

    final existingIdx = _items.indexWhere((it) => it.productId == product.id);
    final updated = List<CartItem>.from(_items);
    if (existingIdx >= 0) {
      final cur = updated[existingIdx];
      updated[existingIdx] = cur.copyWith(packagesQty: cur.packagesQty + pkgs);
    } else {
      updated.add(
        CartItem(
          id: 'local_${product.id}',
          productId: product.id,
          title: product.title,
          customSku: product.customSku,
          color: product.color,
          packagesQty: pkgs,
          unitsPerPackage: unitsPerPkg,
          pricePerUnit: product.effectiveUnitPrice,
          imageUrl: product.coverImageUrl,
          currency: product.currency,
          slug: product.slug,
          titleTranslations: product.translations.map(
            (k, v) => MapEntry(k, v.title),
          ),
        ),
      );
    }
    _items = updated;
    await _saveLocalCart();
    notifyListeners();
    session.telemetry.trackMemberEvent(
      eventType: 'cart_add',
      entityType: 'product',
      entityId: product.id,
      title: product.title,
      metadata: {'packages_qty': pkgs, 'units': totalUnitsToAdd},
    );
  }

  /// Adds/updates an accepted negotiated B2B offer in local guest cart when guest.
  Future<void> applyAcceptedOfferLocallyIfGuest({
    required String productId,
    required String title,
    required String customSku,
    required String color,
    required String imageUrl,
    required String slug,
    required int unitsPerPackage,
    required int packagesQty,
    required double offeredUnitPrice,
    required String currency,
  }) async {
    if (session.isCustomerLoggedIn) {
      return;
    }
    final safeUnits = unitsPerPackage <= 0 ? 1 : unitsPerPackage;
    final safePkgs = packagesQty <= 0 ? 1 : packagesQty;
    final offerItem = CartItem(
      id: 'offer_$productId',
      productId: productId,
      title: title,
      customSku: customSku,
      color: color.isEmpty
          ? AppStrings.t(session.languageCode, 'custom_offer_label')
          : color,
      packagesQty: safePkgs,
      unitsPerPackage: safeUnits,
      pricePerUnit: offeredUnitPrice,
      imageUrl: imageUrl,
      currency: currency.isEmpty ? 'TRY' : currency,
      slug: slug,
    );

    final updated = List<CartItem>.from(_items);
    final idx = updated.indexWhere((it) => it.productId == productId);
    if (idx >= 0) {
      updated[idx] = offerItem;
    } else {
      updated.add(offerItem);
    }
    _items = updated;
    await _saveLocalCart();
    notifyListeners();
  }

  Future<void> updateItemPackages(CartItem item, int newPackagesQty) async {
    if (newPackagesQty <= 0) {
      await removeItem(item);
      return;
    }
    if (session.isCustomerLoggedIn) {
      final totalUnits =
          newPackagesQty * (item.unitsPerPackage <= 0 ? 1 : item.unitsPerPackage);
      await api.updateServerCartItem(
        itemId: item.id,
        totalUnitsQuantity: totalUnits,
      );
      _items = await api.fetchServerCart();
      notifyListeners();
      return;
    }
    final updated = _items
        .map(
          (it) => it.productId == item.productId
              ? it.copyWith(packagesQty: newPackagesQty)
              : it,
        )
        .toList();
    _items = updated;
    await _saveLocalCart();
    notifyListeners();
  }

  Future<void> removeItem(CartItem item) async {
    if (session.isCustomerLoggedIn) {
      await api.removeServerCartItem(item.id);
      _items = await api.fetchServerCart();
      notifyListeners();
      return;
    }
    _items = _items.where((it) => it.productId != item.productId).toList();
    await _saveLocalCart();
    notifyListeners();
  }

  Future<void> clearCart() async {
    if (session.isCustomerLoggedIn) {
      await api.clearServerCart();
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('mv_guest_cart');
    }
    _items = const <CartItem>[];
    notifyListeners();
  }

  /// Atomically pushes all cart lines to `/api/v1/store/cart/sync` when authenticated.
  Future<void> syncCartWithServer() async {
    if (!session.isCustomerLoggedIn) {
      await _saveLocalCart();
      return;
    }
    await api.syncServerCart(_items);
    _items = await api.fetchServerCart();
    notifyListeners();
  }

  /// Generates a formatted wholesale `.xlsx` Excel sheet for the current cart.
  Future<Uint8List> exportCartExcel() {
    if (_items.isEmpty) {
      throw ApiException(
        AppStrings.t(session.languageCode, 'err_empty_cart_export'),
        statusCode: 400,
      );
    }
    return api.exportCartExcel(
      lang: session.languageCode,
      displayCurrency: session.currencyCode,
      items: _items,
    );
  }

  Future<void> _mergeGuestCartIntoServerIfAny() async {
    final localItems = await _readLocalCart();
    if (localItems.isEmpty) {
      return;
    }
    try {
      await api.syncServerCart(localItems);
    } catch (_) {
      for (final it in localItems) {
        try {
          await api.addServerCartItem(
            productId: it.productId,
            totalUnitsQuantity: it.totalUnits,
          );
        } catch (_) {}
      }
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('mv_guest_cart');
  }

  Future<List<CartItem>> _readLocalCart() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('mv_guest_cart');
    if (raw == null || raw.isEmpty) {
      return <CartItem>[];
    }
    try {
      final decoded = jsonDecode(raw) as List<dynamic>;
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(CartItem.fromJson)
          .toList();
    } catch (_) {
      return <CartItem>[];
    }
  }

  Future<void> _saveLocalCart() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'mv_guest_cart',
      jsonEncode(_items.map((e) => e.toJson()).toList()),
    );
  }
}
