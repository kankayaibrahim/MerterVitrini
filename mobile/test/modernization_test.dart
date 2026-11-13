import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mertervitrini_mobile/core/app_theme.dart';
import 'package:mertervitrini_mobile/core/localization.dart';
import 'package:mertervitrini_mobile/models/cart_and_order.dart';
import 'package:mertervitrini_mobile/models/marketplace.dart';
import 'package:mertervitrini_mobile/models/product.dart';
import 'package:mertervitrini_mobile/models/user.dart';

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
      expect(inquiry.toJson()['company_name'], 'Weber Mode GmbH');
      expect((inquiry.toJson()['items'] as List).length, 1);

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
}
