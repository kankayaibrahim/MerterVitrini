import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../contracts/commerce_repository.dart';
import '../models/cart_and_order.dart';
import '../models/product.dart';
import 'session_provider.dart';

/// ISP + DIP Compliant Cart State Manager:
/// Depends exclusively on [ICommerceRepository] rather than supplier/chat APIs.
class CartProvider extends ChangeNotifier {
  final ICommerceRepository api;
  final SessionProvider session;

  List<CartItem> _items = <CartItem>[];
  bool _loading = false;

  CartProvider({required this.api, required this.session});

  List<CartItem> get items => _items;
  bool get loading => _loading;

  int get totalPackages =>
      _items.fold<int>(0, (sum, item) => sum + item.packagesQty);

  int get totalUnits =>
      _items.fold<int>(0, (sum, item) => sum + item.totalUnits);

  double get totalAmountTry =>
      _items.fold<double>(0.0, (sum, item) => sum + item.lineTotal);

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
      // Keep current items if network fails
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
      return;
    }

    final existingIdx = _items.indexWhere((it) => it.productId == product.id);
    if (existingIdx >= 0) {
      final cur = _items[existingIdx];
      _items[existingIdx] = cur.copyWith(packagesQty: cur.packagesQty + pkgs);
    } else {
      _items.add(
        CartItem(
          id: 'local_${product.id}',
          productId: product.id,
          title: product.title,
          customSku: product.customSku,
          color: product.color,
          packagesQty: pkgs,
          unitsPerPackage: unitsPerPkg,
          pricePerUnit: product.effectiveUnitPrice,
          weightPerUnit: 0.35,
          imageUrl: product.coverImageUrl,
          currency: product.currency,
          slug: product.slug,
        ),
      );
    }
    await _saveLocalCart();
    notifyListeners();
  }

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
      _items = await api.fetchServerCart();
      notifyListeners();
      return;
    }

    final units = unitsPerPackage <= 0 ? 1 : unitsPerPackage;
    final pkgs = packagesQty <= 0 ? 1 : packagesQty;
    final idx = _items.indexWhere((e) => e.productId == productId);
    final updatedItem = CartItem(
      id: 'offer_$productId',
      productId: productId,
      title: title,
      customSku: customSku,
      color: color.isEmpty ? 'Özel Teklif' : color,
      packagesQty: pkgs,
      unitsPerPackage: units,
      pricePerUnit: offeredUnitPrice,
      weightPerUnit: 0.35,
      imageUrl: imageUrl,
      currency: currency,
      slug: slug,
    );
    if (idx >= 0) {
      _items[idx] = updatedItem;
    } else {
      _items.add(updatedItem);
    }
    await _saveLocalCart();
    notifyListeners();
  }

  Future<void> updateItemPackages(CartItem item, int newPackagesQty) async {
    if (newPackagesQty <= 0) {
      await removeItem(item);
      return;
    }
    if (session.isCustomerLoggedIn) {
      await api.updateServerCartItem(
        itemId: item.id,
        totalUnitsQuantity: newPackagesQty * item.unitsPerPackage,
      );
      _items = await api.fetchServerCart();
      notifyListeners();
      return;
    }
    final idx = _items.indexWhere((e) => e.id == item.id);
    if (idx >= 0) {
      _items[idx] = _items[idx].copyWith(packagesQty: newPackagesQty);
      await _saveLocalCart();
      notifyListeners();
    }
  }

  Future<void> removeItem(CartItem item) async {
    if (session.isCustomerLoggedIn) {
      await api.removeServerCartItem(item.id);
      _items = await api.fetchServerCart();
      notifyListeners();
      return;
    }
    _items.removeWhere((e) => e.id == item.id);
    await _saveLocalCart();
    notifyListeners();
  }

  Future<void> clearCart() async {
    if (session.isCustomerLoggedIn) {
      await api.clearServerCart();
    }
    _items = <CartItem>[];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('mv_guest_cart');
    notifyListeners();
  }

  Future<void> _mergeGuestCartIntoServerIfAny() async {
    final localItems = await _readLocalCart();
    if (localItems.isEmpty) {
      return;
    }
    for (final it in localItems) {
      try {
        await api.addServerCartItem(
          productId: it.productId,
          totalUnitsQuantity: it.totalUnits,
        );
      } catch (_) {}
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
    final encoded = jsonEncode(_items.map((e) => e.toJson()).toList());
    await prefs.setString('mv_guest_cart', encoded);
  }
}
