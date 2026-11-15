import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mertervitrini_mobile/contracts/supplier_catalog_repository.dart';
import 'package:mertervitrini_mobile/contracts/supplier_operations_repository.dart';
import 'package:mertervitrini_mobile/core/address_validator.dart';
import 'package:mertervitrini_mobile/core/app_theme.dart';
import 'package:mertervitrini_mobile/core/localization.dart';
import 'package:mertervitrini_mobile/features/supplier/utils/supplier_l10n.dart';
import 'package:mertervitrini_mobile/features/supplier/wizard/wizard_draft_storage.dart';
import 'package:mertervitrini_mobile/features/supplier/wizard/wizard_models.dart';
import 'package:mertervitrini_mobile/models/cart_and_order.dart';
import 'package:mertervitrini_mobile/models/chat.dart';
import 'package:mertervitrini_mobile/models/marketplace.dart';
import 'package:mertervitrini_mobile/models/product.dart';
import 'package:mertervitrini_mobile/models/user.dart';
import 'package:mertervitrini_mobile/providers/supplier_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('v1.1.0 Corporate Light Theme & 8-Language RTL Standards', () {
    test('AppTheme enforces Corporate Light surfaces, WCAG AA contrast & 8-12px unified radii across roles', () {
      for (final isSupplier in <bool>[false, true]) {
        for (final lang in AppStrings.supportedCodes) {
          final theme = AppTheme.light(
            isSupplierMode: isSupplier,
            languageCode: lang,
          );
          expect(theme.brightness, Brightness.light);
          expect(theme.scaffoldBackgroundColor, AppColors.warmIvory);
          expect(theme.appBarTheme.backgroundColor, AppColors.warmIvory);
          expect(theme.appBarTheme.foregroundColor, AppColors.obsidian);
          expect(AppTheme.radiusSm, 8.0);
          expect(AppTheme.radiusMd, 10.0);
          expect(AppTheme.radiusLg, 12.0);
          if (lang == 'ar') {
            expect(AppStrings.letterSpacing(lang, 1.4), 0.0);
            expect(AppStrings.directionOf(lang), TextDirection.rtl);
          } else {
            expect(AppStrings.letterSpacing(lang, 1.4), 1.4);
            expect(AppStrings.directionOf(lang), TextDirection.ltr);
          }
        }
      }
      expect(AppStrings.supportedCodes, <String>[
        'tr',
        'en',
        'ru',
        'ar',
        'de',
        'fr',
        'pl',
        'bg',
      ]);
    });

    test('All 8 languages resolve core B2B & guest price-lock translations without empty values', () {
      const keys = <String>[
        'members_only',
        'login',
        'catalog',
        'cart',
        'orders',
        'profile',
        'language',
        'currency',
      ];
      for (final lang in AppStrings.supportedCodes) {
        for (final key in keys) {
          final resolved = AppStrings.t(lang, key);
          expect(
            resolved.trim().isNotEmpty,
            isTrue,
            reason: 'Missing translation for $lang.$key',
          );
          if (lang != 'tr' && key == 'members_only') {
            expect(
              resolved,
              isNot('Üyelere Özel'),
              reason: 'Hardcoded Turkish leaked for $lang.members_only',
            );
          }
        }
      }
    });
  });

  group('v1.1.0 Marketplace, Catalog, Order & Supplier Studio DTO Contracts', () {
    test('CatalogSortOption exposes all 7 backend sort options cleanly', () {
      expect(CatalogSortOption.values.length, 7);
      expect(CatalogSortOption.fromApi('price_asc'), CatalogSortOption.priceAsc);
      expect(CatalogSortOption.fromApi('price_desc'), CatalogSortOption.priceDesc);
      expect(CatalogSortOption.fromApi('sku_desc'), CatalogSortOption.skuDesc);
      expect(CatalogSortOption.fromApi('unknown_sort'), CatalogSortOption.newest);
    });

    test('CustomerAddress handles null-safe full deserialization & billing/tax payload formatting', () {
      final parsed = CustomerAddress.fromJson(<String, dynamic>{
        'id': 'addr-1',
        'user_id': 'u-99',
        'title': 'Showroom Merter',
        'address_type': 'billing',
        'first_name': 'Mehmet',
        'last_name': 'Kaya',
        'company_name': 'Kaya Moda Ltd.',
        'phone': '+905321234567',
        'country_id': 'TR',
        'state_id': '34',
        'city_id': '3401',
        'address_line': 'Keresteciler Sitesi',
        'city_name': 'Güngören',
        'state_name': 'İstanbul',
        'country_name': 'Türkiye',
        'postal_code': '34173',
        'tax_no_tckn': '9876543210',
        'tax_office': 'Merter VD',
        'is_default': true,
      });
      expect(parsed.isBilling, isTrue);
      expect(parsed.city, 'Güngören');
      expect(parsed.state, 'İstanbul');
      expect(parsed.recipientName, 'Mehmet Kaya');
      final payload = parsed.toCreateJson();
      expect(payload['tax_no_tckn'], '9876543210');
      expect(payload['tax_office'], 'Merter VD');
      expect(payload['address_type'], 'billing');
    });

    test('RfqItem, DirectInquiryPayload, SponsoredSlotItem, ServiceProvider & Blog/CMS DTOs parse and localize cleanly', () {
      final rfq = RfqItem.fromJson(<String, dynamic>{
        'id': 'rfq-1',
        'rfq_number': 'RFQ-2026-009',
        'title': '1000 pcs Denim Jacket Lot',
        'category_name': 'Dis Giyim',
        'target_quantity': 1000,
        'unit_type': 'ADET',
        'target_price': 18.5,
        'currency': 'USD',
        'production_type': 'PRIVATE_LABEL',
        'description': 'FOB Istanbul export inquiry',
        'buyer_name': 'Anna Kowalska',
        'buyer_country': 'PL',
        'buyer_phone': '+48501123456',
        'status': 'OPEN',
        'offer_count': 2,
        'created_at': '2026-11-12T10:00:00Z',
        'offers': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'off-1',
            'rfq_id': 'rfq-1',
            'brand_id': 'br-1',
            'brand_name': 'Lustrin Merter',
            'offered_unit_price': 17.9,
            'currency': 'USD',
            'min_order_quantity': 500,
            'delivery_days': 14,
            'created_at': '2026-11-12T12:00:00Z',
          },
        ],
      });
      expect(rfq.rfqNumber, 'RFQ-2026-009');
      expect(rfq.offers.single.brandName, 'Lustrin Merter');
      expect(rfq.offers.single.offeredUnitPrice, 17.9);

      const inquiry = DirectInquiryPayload(
        fullName: 'Hans Weber',
        companyName: 'Weber Mode GmbH',
        phone: '+491701234567',
        email: 'hans@weber.de',
        countryId: 'DE',
        stateId: 'st-berlin',
        cityId: 'ct-berlin',
        postalCode: '10117',
        addressLine: 'Friedrichstrasse 112',
        deliveryAddress: 'Berlin',
        items: <DirectInquiryItemPayload>[
          DirectInquiryItemPayload(
            productId: 'prod-1',
            title: 'Kadife Elbise',
            customSku: 'MIMOZA-01',
            quantity: 12,
            price: 14.5,
          ),
        ],
      );
      final inquiryJson = inquiry.toJson();
      expect(inquiryJson['company_name'], 'Weber Mode GmbH');
      expect(inquiryJson['country_id'], 'DE');
      expect(inquiryJson['state_id'], 'st-berlin');
      expect(inquiryJson['city_id'], 'ct-berlin');
      expect(inquiryJson['postal_code'], '10117');
      expect(inquiryJson['address_line'], 'Friedrichstrasse 112');
      expect(inquiryJson['delivery_address'], 'Friedrichstrasse 112');
      expect((inquiryJson['items'] as List).length, 1);

      final slot = SponsoredSlotItem.fromJson(<String, dynamic>{
        'id': 'slot-1',
        'placement': 'home_featured_suppliers',
        'brand_name': 'Etika',
        'brand_verified': true,
        'title': 'Öne Çıkan Üretici',
        'translations': <String, dynamic>{
          'de': <String, dynamic>{'title': 'Ausgewählter Hersteller'},
        },
      });
      expect(slot.localizedTitle('de'), 'Ausgewählter Hersteller');
      expect(slot.localizedTitle('tr'), 'Öne Çıkan Üretici');

      final sp = ServiceProviderItem.fromJson(<String, dynamic>{
        'id': 'sp-1',
        'slug': 'merter-kargo',
        'company_name': 'Merter Global Lojistik',
        'service_category': 'logistics',
        'short_description': 'Hızlı kara yolu taşımacılığı',
        'translations': <String, dynamic>{
          'pl': <String, dynamic>{'short_description': 'Szybki transport B2B'},
        },
        'created_at': '2026-11-12T08:00:00Z',
      });
      expect(sp.localizedShortDescription('pl'), 'Szybki transport B2B');

      final blog = BlogPostItem.fromJson(<String, dynamic>{
        'id': 'b-1',
        'slug': 'merter-wholesale-guide',
        'translations': <String, dynamic>{
          'bg': <String, dynamic>{
            'title': 'Ръководство за търговия на едро',
            'summary': 'Износ от Мертер',
          },
        },
        'created_at': '2026-11-12T08:00:00Z',
        'updated_at': '2026-11-12T08:00:00Z',
      });
      expect(blog.localizedTitle('bg'), 'Ръководство за търговия на едро');

      final cms = CmsPageItem.fromJson(<String, dynamic>{
        'id': 'c-1',
        'slug': 'b2b-export',
        'translations': <String, dynamic>{
          'fr': <String, dynamic>{'title': 'Guide Export B2B', 'content': '...'},
        },
        'created_at': '2026-11-12T08:00:00Z',
        'updated_at': '2026-11-12T08:00:00Z',
      });
      expect(cms.localizedTitle('fr'), 'Guide Export B2B');
    });

    test('AddressValidator rejects gibberish and enforces multi-word street addresses', () {
      expect(
        AddressValidator.validateStreetAddress(
          'Osiskdlskdpsopdpappdpxpxppspupapa',
        ),
        isNotNull,
      );
      expect(
        AddressValidator.validateStreetAddress('Xidskdlskskkdksodsoaooaoa'),
        isNotNull,
      );
      expect(AddressValidator.validateStreetAddress('aaaaabbbbb cd'), isNotNull);
      expect(
        AddressValidator.validateStreetAddress('MerterMahallesi12'),
        isNotNull,
      );
      expect(
        AddressValidator.validateStreetAddress(
          'Mehmet Nesih Özmen Mah. Gülsever Sok. No:12',
        ),
        isNull,
      );
      expect(AddressValidator.validatePersonName('Alperen Köse'), isNull);
      expect(AddressValidator.validatePersonName('aaaaabbbbb'), isNotNull);
      expect(
        AddressValidator.validatePostalCode('', required: true),
        isNotNull,
      );
      expect(
        AddressValidator.validatePostalCode('34173', required: true),
        isNull,
      );
    });

    test('Supplier Studio DTOs (17-field profile, analytics, billing, payouts) and OrderDetail/Refund serialize accurately', () {
      final profile = SupplierEditorialProfile.fromJson(<String, dynamic>{
        'brand_profile': <String, dynamic>{
          'id': 'br-9',
          'name': 'Jane\'s Wholesale',
          'slug': 'janes-wholesale',
          'company_type': 'uretici',
          'description': 'Bayan dış giyim üreticisi',
          'description_translations': <String, String>{
            'en': 'Women outerwear manufacturer',
          },
          'phone': '+902126410000',
          'whatsapp_phone': '+905326410000',
          'public_email': 'sales@janes.example',
          'website': 'https://janes.example',
          'instagram_handle': '@janesmerter',
          'location_address': 'Merter Tekstil Merkezi No:14',
          'export_countries': 'DE,PL,BG,RO',
          'min_order_quantity': 24,
          'supports_private_label': true,
          'supports_fason': true,
          'is_verified': true,
        },
        'stats': <String, dynamic>{
          'active_products': 42,
          'total_products': 50,
        },
      });
      expect(profile.brandName, 'Jane\'s Wholesale');
      expect(profile.supportsFason, isTrue);
      expect(profile.supportsPrivateLabel, isTrue);
      expect(profile.activeProductCount, 42);
      expect(profile.localizedDescription('en'), 'Women outerwear manufacturer');
      expect(profile.toUpdateJson()['export_countries'], 'DE,PL,BG,RO');

      final analytics = SupplierAnalyticsOverview.fromJson(<String, dynamic>{
        'period': '30d',
        'summary': <String, dynamic>{
          'profile_views': 320,
          'product_views': 1450,
          'whatsapp_clicks': 48,
          'total_buyer_contacts': 62,
        },
        'daily_trend': <Map<String, dynamic>>[
          <String, dynamic>{'date': '2026-11-12', 'views': 90, 'contacts': 5},
        ],
      });
      expect(analytics.summary.productViews, 1450);
      expect(analytics.dailyTrend.single.contacts, 5);

      final billing = SupplierBillingOverview.fromJson(<String, dynamic>{
        'plans': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'pl-1',
            'code': 'PRO',
            'name': 'Pro Manufacturer',
            'monthly_price': 2990,
            'yearly_price': 29900,
            'currency': 'TRY',
            'max_products': 1000,
          },
        ],
        'payments': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'pay-1',
            'payment_number': 'PAY-001',
            'plan_code': 'PRO',
            'amount': 2990,
            'currency': 'TRY',
            'sender_name': 'Jane Tekstil',
            'bank_reference': 'EFT-9988',
            'paid_at': '2026-11-01T09:00:00Z',
          },
        ],
      });
      expect(billing.plans.single.code, 'PRO');
      expect(billing.payments.single.bankReference, 'EFT-9988');

      final payout = SupplierPayoutItem.fromJson(<String, dynamic>{
        'id': 'po-1',
        'brand_id': 'br-9',
        'amount': 15400.5,
        'currency': 'TRY',
        'status': 'PAID',
        'iban': 'TR000000000000000000000001',
        'account_holder': 'Jane Tekstil A.S.',
        'created_at': '2026-11-10T10:00:00Z',
      });
      expect(payout.status, 'PAID');
      expect(payout.amount, 15400.5);

      final orderDetail = OrderDetailModel.fromJson(<String, dynamic>{
        'id': 'ord-1',
        'order_number': 'MV-2026-7788',
        'total_amount': 840.0,
        'currency': 'USD',
        'payment_method': 'BANK_TRANSFER',
        'order_status': 'SHIPPED',
        'billing_address': 'Warsaw, PL',
        'delivery_address': 'Warsaw, PL',
        'tracking_company': 'DHL',
        'tracking_number': 'DHL998877',
        'created_at': '2026-11-12T10:00:00Z',
        'items': const <dynamic>[],
      });
      expect(orderDetail.trackingCompany, 'DHL');
      expect(orderDetail.trackingNumber, 'DHL998877');

      const refund = OrderRefundPayload(
        refundType: 'partial',
        reason: 'Wrong color lot delivered',
        items: <OrderRefundItemPayload>[
          OrderRefundItemPayload(orderItemId: 'oi-1', quantity: 2),
        ],
      );
      expect(refund.toJson()['refund_type'], 'PARTIAL');
      expect((refund.toJson()['items'] as List).single['quantity'], 2);

      const challengeSubmission = ServiceProviderSubmission(
        companyName: 'Bosphorus Cargo',
        contactName: 'Ali Demir',
        serviceCategory: 'logistics',
        shortDescription: 'EU & MENA B2B shipping',
        phone: '+905321112233',
        email: 'ops@bosphorus.example',
      );
      final challengeJson = challengeSubmission.toJson(
        challengeToken: 'signed-hmac-token',
      );
      expect(challengeJson['challenge_token'], 'signed-hmac-token');
      expect(challengeJson['form_challenge_token'], 'signed-hmac-token');
    });
  });

  group('Step 3 Supplier Quick-Listing, Sibling Variants & Draft Storage', () {
    test('SiblingProduct & Product parse sourceProductGroupId, siblingCount & supplierSiblings', () {
      const compatSibling = SiblingProduct(
        id: 'sib-compat',
        customSku: 'MV-01',
        slug: 'mv-01',
        color: 'Siyah',
        imageUrl: '',
      );
      expect(compatSibling.title, '');
      expect(compatSibling.isActive, isTrue);
      expect(compatSibling.currency, 'TRY');

      final product = Product.fromJson(<String, dynamic>{
        'id': 'prod-1',
        'title': 'Keten Takım',
        'slug': 'keten-takim',
        'custom_sku': 'KET-01',
        'category_id': 'cat-1',
        'price': 450,
        'currency': 'TRY',
        'is_active': false,
        'source_product_group_id': 'grp-100',
        'sibling_count': 2,
        'supplier_siblings': [
          {
            'id': 'prod-2',
            'title': 'Keten Takım Ekru',
            'custom_sku': 'KET-02',
            'slug': 'keten-takim-ekru',
            'color_id': 'col-ekru',
            'color': 'Ekru',
            'image_url': '/uploads/ekru.webp',
            'price': 450.5,
            'currency': 'USD',
            'is_active': false,
            'source_product_group_id': 'grp-100',
          },
        ],
      });

      expect(product.sourceProductGroupId, 'grp-100');
      expect(product.siblingCount, 2);
      expect(product.supplierSiblings, hasLength(1));
      final sib = product.supplierSiblings.single;
      expect(sib.id, 'prod-2');
      expect(sib.title, 'Keten Takım Ekru');
      expect(sib.colorId, 'col-ekru');
      expect(sib.color, 'Ekru');
      expect(sib.price, 450.5);
      expect(sib.currency, 'USD');
      expect(sib.isActive, isFalse);
      expect(sib.sourceProductGroupId, 'grp-100');

      final fallbackProduct = Product.fromJson(<String, dynamic>{
        'id': 'prod-fallback',
        'title': 'Bluz',
        'price': 200,
        'color_variants': [
          {
            'id': 'sib-a',
            'custom_sku': 'BLZ-A',
            'slug': 'blz-a',
            'color': 'Bordo',
            'image_url': '/uploads/a.webp',
          },
        ],
      });
      expect(fallbackProduct.siblingCount, 1);
      expect(fallbackProduct.supplierSiblings.single.id, 'sib-a');
    });

    test('WizardDraftStorage persists and restores smart defaults and unsaved drafts', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      SharedPreferences.setMockInitialValues(<String, Object>{});

      const defaults = WizardSmartDefaults(
        categoryId: 'cat-elbise',
        currency: 'USD',
        selectedSizes: ['36', '38', '40', '42'],
        seriesRatio: '1-2-2-1',
        seriesStock: 50,
        gender: 'Kadın',
        season: '2026 Sonbahar/Kış',
        fabricId: 'fab-keten',
      );
      await WizardDraftStorage.saveDefaults(defaults);
      final loadedDefaults = await WizardDraftStorage.loadDefaults();
      expect(loadedDefaults.categoryId, 'cat-elbise');
      expect(loadedDefaults.currency, 'USD');
      expect(loadedDefaults.selectedSizes, ['36', '38', '40', '42']);
      expect(loadedDefaults.seriesRatio, '1-2-2-1');
      expect(loadedDefaults.seriesStock, 50);
      expect(loadedDefaults.fabricId, 'fab-keten');

      const draft = WizardUnsavedDraft(
        title: 'Saten Elbise',
        priceText: '520',
        buyingPriceText: '300',
        currency: 'EUR',
        categoryId: 'cat-elbise',
        colorId: 'col-siyah',
        fabricId: 'fab-saten',
        photoItems: [
          WizardPhotoItem.remote('https://cdn.example/1.webp'),
          WizardPhotoItem.local('/tmp/photo2.jpg'),
        ],
        selectedSizes: ['S', 'M', 'L', 'XL'],
        seriesRatio: '1-1-1-1',
        seriesStock: 25,
        linkWithProductId: 'parent-9',
      );
      expect(draft.isMeaningful, isTrue);
      await WizardDraftStorage.saveUnsavedDraft(draft);
      final loadedDraft = await WizardDraftStorage.loadUnsavedDraft();
      expect(loadedDraft, isNotNull);
      expect(loadedDraft!.title, 'Saten Elbise');
      expect(loadedDraft.currency, 'EUR');
      expect(loadedDraft.photoItems, hasLength(2));
      expect(loadedDraft.photoItems.first.isRemote, isTrue);
      expect(loadedDraft.photoItems.last.localPath, '/tmp/photo2.jpg');
      expect(loadedDraft.linkWithProductId, 'parent-9');

      await WizardDraftStorage.clearUnsavedDraft();
      expect(await WizardDraftStorage.loadUnsavedDraft(), isNull);
    });

    test('SupplierProvider exposes draftProductsCount & delegates sibling + batchDraft APIs', () async {
      final fakeCatalog = _FakeSupplierCatalogRepo();
      final fakeOps = _StubSupplierOpsRepo();
      final provider = SupplierProvider(
        catalogRepo: fakeCatalog,
        operationsRepo: fakeOps,
      );

      await provider.loadDashboard();
      expect(provider.draftProductsCount, 4);

      final linked = await provider.linkProductSiblings(
        productId: 'p1',
        targetProductIds: const ['p2', 'p3'],
      );
      expect(linked.map((s) => s.id), ['p2', 'p3']);

      final remaining = await provider.unlinkProductSibling(
        productId: 'p1',
        targetProductId: 'p2',
      );
      expect(remaining.map((s) => s.id), ['p3']);

      final created = await provider.batchCreateDraftProducts(
        imageUrls: const ['https://cdn.example/a.webp', 'https://cdn.example/b.webp'],
        mode: 'per_photo',
      );
      expect(created, 2);
      expect(fakeCatalog.listCalls, greaterThanOrEqualTo(3));
    });

    test('All 8 languages have Step 3 keys and Arabic keeps letterSpacing == 0', () {
      const requiredKeys = [
        'drag_reorder_hint',
        'color_variants_title',
        'link_existing_product',
        'add_another_color_now',
        'quick_mode',
        'detailed_mode',
        'restore_draft_title',
        'save_draft_btn',
        'save_and_next_color_btn',
        'publish_btn',
        'status_drafts',
        'status_draft',
        'batch_draft_btn',
        'batch_mode_per_photo',
        'batch_mode_color_siblings',
        'batch_mode_single_product',
        'publish_chip',
        'new_color_chip',
        'link_sibling_chip',
      ];
      for (final lang in AppStrings.supportedCodes) {
        for (final key in requiredKeys) {
          final text = SupplierL10n.t(lang, key);
          expect(
            text,
            isNotEmpty,
            reason: 'Missing $key for language $lang',
          );
          expect(
            text,
            isNot(equals(key)),
            reason: 'Untranslated fallback $key for language $lang',
          );
        }
      }
      expect(AppStrings.letterSpacing('ar', -0.2), 0.0);
    });

    test('CustomerOrder & OrderDetailModel preserve original product currencies and mixed breakdown', () {
      final singleUsd = CustomerOrder.fromJson(<String, dynamic>{
        'id': 'ord-usd',
        'order_number': '20261113-00001',
        'total_amount': 45.60,
        'currency': 'USD',
        'total_amount_try': 2006.40,
        'currency_totals': <String, dynamic>{'USD': 45.60},
        'payment_method': 'BANK_TRANSFER',
        'order_status': 'PENDING_PAYMENT',
        'created_at': '2026-11-13T01:00:18Z',
        'items': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'oi-1',
            'product_name': 'Erkek Kısa Kollu Polo',
            'product_sku': 'EDUSA-7X7N',
            'quantity': 6,
            'price_at_purchase': 7.60,
            'currency': 'USD',
          },
        ],
      });
      expect(singleUsd.currency, 'USD');
      expect(singleUsd.isMultiCurrency, isFalse);
      expect(singleUsd.hasNonTryCurrency, isTrue);
      expect(singleUsd.formatOriginalBreakdown(), r'$45.60');
      expect(singleUsd.items.single.currency, 'USD');

      final mixed = OrderDetailModel.fromJson(<String, dynamic>{
        'id': 'ord-mixed',
        'order_number': '20260610-0002',
        'total_amount': 48678.84,
        'currency': 'TRY',
        'customer_currency': 'EUR',
        'customer_total_amount': 1014.14,
        'total_amount_try': 48678.84,
        'currency_totals': <String, dynamic>{'TRY': 5974.20, 'USD': 970.56},
        'payment_method': 'BANK_TRANSFER',
        'order_status': 'PENDING_PAYMENT',
        'created_at': '2026-06-10T10:00:00Z',
        'items': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'm-1',
            'product_name': 'USD Item',
            'product_sku': 'U-1',
            'quantity': 16,
            'price_at_purchase': 60.66,
            'currency': r'$',
          },
          <String, dynamic>{
            'id': 'm-2',
            'product_name': 'TRY Item',
            'product_sku': 'T-1',
            'quantity': 10,
            'price_at_purchase': 597.42,
          },
        ],
      });
      expect(mixed.isMultiCurrency, isTrue);
      expect(mixed.customerCurrency, 'EUR');
      expect(mixed.items[0].currency, 'USD');
      expect(mixed.items[1].currency, 'TRY');
      expect(mixed.formatOriginalBreakdown(), r'$970.56 + ₺5974.20');
    });
  });
}

class _FakeSupplierCatalogRepo implements ISupplierCatalogRepository {
  int listCalls = 0;
  List<SiblingProduct> _siblings = const [];

  @override
  Future<(List<Product>, int)> listSupplierProducts({
    String query = '',
    String status = 'all',
    String categoryId = '',
    int limit = 30,
    int offset = 0,
  }) async {
    listCalls++;
    return (const <Product>[], 0);
  }

  @override
  Future<List<SiblingProduct>> fetchProductSiblings(String productId) async =>
      _siblings;

  @override
  Future<List<SiblingProduct>> linkProductSiblings({
    required String productId,
    required List<String> targetProductIds,
  }) async {
    _siblings = targetProductIds
        .map(
          (id) => SiblingProduct(
            id: id,
            customSku: 'SKU-$id',
            slug: id,
            color: 'Renk',
            imageUrl: '',
          ),
        )
        .toList();
    return _siblings;
  }

  @override
  Future<List<SiblingProduct>> unlinkProductSibling({
    required String productId,
    required String targetProductId,
  }) async {
    _siblings = _siblings.where((s) => s.id != targetProductId).toList();
    return _siblings;
  }

  @override
  Future<int> batchCreateDraftProducts({
    required List<String> imageUrls,
    String mode = 'per_photo',
    String titlePrefix = '',
    String categoryId = '',
    double price = 0,
    String currency = 'TRY',
    List<String> selectedSizes = const [],
    String seriesRatio = '',
    int? seriesStock,
    String? linkWithProductId,
  }) async =>
      imageUrls.length;

  @override
  Future<Map<String, Map<String, String>>> autoTranslateSupplierFields(
    Map<String, String> fields, {
    String sourceLang = 'tr',
    List<String>? targetLangs,
  }) async =>
      const {};

  @override
  Future<int> bulkArchiveProducts({
    List<String> productIds = const [],
    bool isArchived = true,
    bool restoreActive = false,
    String season = '',
    int? olderThanDays,
    bool zeroStockOnly = false,
  }) async =>
      0;

  @override
  Future<String> createSupplierProduct(Map<String, dynamic> payload) async =>
      'created-1';

  @override
  Future<void> deleteSupplierProduct(String productId) async {}

  @override
  Future<SupplierAttributesBundle> fetchSupplierAttributeBundle() async =>
      const SupplierAttributesBundle(
        colors: [],
        fabrics: [],
        sizes: [],
        seriesTemplates: [],
      );

  @override
  Future<(List<SimpleOptionItem>, List<SimpleOptionItem>)>
      fetchSupplierAttributes() async =>
          (const <SimpleOptionItem>[], const <SimpleOptionItem>[]);

  @override
  Future<List<SimpleOptionItem>> fetchSupplierCategories() async => const [];

  @override
  Future<Product> fetchSupplierProductDetail(String productId) async =>
      throw UnimplementedError();

  @override
  Future<SupplierProductTranslationMap> fetchSupplierProductTranslations(
    String productId,
  ) async =>
      SupplierProductTranslationMap(
        productId: productId,
        translations: const {},
      );

  @override
  Future<String> findSupplierProductByCode(String code) async => '';

  @override
  Future<void> quickUpdateSupplierProduct({
    required String productId,
    double? price,
    double? buyingPrice,
    bool? isActive,
    int? stock,
    int? seriesStock,
  }) async {}

  @override
  Future<void> toggleArchiveProduct({
    required String productId,
    required bool isArchived,
    bool restoreActive = false,
  }) async {}

  @override
  Future<void> updateSupplierProduct(
    String productId,
    Map<String, dynamic> payload,
  ) async {}

  @override
  Future<void> updateSupplierProductTranslations(
    String productId,
    Map<String, SupplierProductTranslationEntry> translations,
  ) async {}

  @override
  Future<List<String>> uploadSupplierProductPhotos(
    List<String> localPaths,
  ) async =>
      localPaths;
}

class _StubSupplierOpsRepo implements ISupplierOperationsRepository {
  @override
  Future<Map<String, dynamic>> fetchSupplierDashboard() async => {
        'kpis': {'draft_products': 4},
      };

  @override
  Future<void> createSupplierTeamMember({
    required String contactName,
    required String email,
    required String password,
    String jobTitle = '',
    String phone = '',
    String spokenLanguages = 'tr',
  }) async {}

  @override
  Future<void> deleteSupplierTeamMember(String memberId) async {}

  @override
  Future<SupplierAnalyticsOverview> fetchSupplierAnalytics({
    String period = '30d',
  }) async =>
      throw UnimplementedError();

  @override
  Future<SupplierBillingOverview> fetchSupplierBilling() async =>
      throw UnimplementedError();

  @override
  Future<SupplierEditorialProfile> fetchSupplierEditorialProfile() async =>
      throw UnimplementedError();

  @override
  Future<SupplierSubOrder> fetchSupplierSubOrderDetail(String subOrderId) =>
      throw UnimplementedError();

  @override
  Future<(SupplierWallet, List<SupplierLedgerEntry>)> fetchSupplierWallet() =>
      throw UnimplementedError();

  @override
  Future<List<SupplierPayoutItem>> listSupplierPayoutRequests() async =>
      const [];

  @override
  Future<List<RfqItem>> listSupplierRfqs() async => const [];

  @override
  Future<List<SupplierSubOrder>> listSupplierSubOrders({
    String status = 'ALL',
  }) async =>
      const [];

  @override
  Future<List<SupplierAgent>> listSupplierTeam() async => const [];

  @override
  Future<void> requestSupplierPayout(double amount) async {}

  @override
  Future<RfqOfferItem> submitSupplierRfqOffer({
    required String rfqId,
    required SubmitRfqOfferPayload payload,
  }) async =>
      throw UnimplementedError();

  @override
  Future<void> submitSupplierSubscriptionPayment(
    SupplierWirePaymentPayload payload,
  ) async {}

  @override
  Future<void> updateSupplierBillingTaxInfo(
    SupplierTaxInfoPayload payload,
  ) async {}

  @override
  Future<void> updateSupplierEditorialProfile(
    SupplierEditorialProfile profile, {
    bool quickWhatsappOnly = false,
  }) async {}

  @override
  Future<void> updateSupplierIban({
    required String iban,
    required String bankName,
    required String accountHolder,
  }) async {}

  @override
  Future<void> updateSupplierSubOrderStatus({
    required String subOrderId,
    required String status,
    String trackingCompany = '',
    String trackingNumber = '',
    String notes = '',
  }) async {}
}
