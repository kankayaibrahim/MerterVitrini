"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  Globe,
  Layers,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  GLOBAL_B2B_SEO_MATRIX,
  normalizeSeoLang,
  safeJsonLd,
  type SupportedSeoLang,
} from "@/utils/seoHelpers";

interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

interface PillarCard {
  readonly title: string;
  readonly body: string;
}

interface B2BKnowledgeContent {
  readonly badge: string;
  readonly heading: string;
  readonly intro: string;
  readonly keywordLabel: string;
  readonly suppliersCta: string;
  readonly rfqCta: string;
  readonly b2bGuideCta: string;
  readonly faqHeading: string;
  readonly pillars: readonly [PillarCard, PillarCard, PillarCard, PillarCard];
  readonly faqs: readonly FaqEntry[];
}

const KNOWLEDGE_COPY: Record<SupportedSeoLang, B2BKnowledgeContent> = {
  tr: {
    badge: "KÜRESEL B2B TEKSTİL TEDARİK REHBERİ • MERTER İSTANBUL",
    heading:
      "Merter Fabrikalarından Doğrudan Seri Toptan Giyim, Fason Üretim ve Uluslararası İhracat",
    intro:
      "Merter Vitrini; İstanbul Merter, Güngören ve Zeytinburnu tekstil üreticilerini dünya genelindeki butikler, zincir mağazalar, toptancılar ve e-ticaret markalarıyla aracısız buluşturan resmi B2B dijital showroom platformudur. Tüm koleksiyonlar şeffaf paket/seri oranları, gerçek firma unvanları ve doğrulanmış fabrika fiyatlarıyla sunulur.",
    keywordLabel: "Küresel Ticari Arama Odağı:",
    suppliersCta: "Doğrulanmış Üreticileri İncele",
    rfqCta: "Toptan Alım İlanı (RFQ) Aç",
    b2bGuideCta: "B2B Toptan Alım Rehberi",
    faqHeading: "Toptan Alıcılar İçin Sıkça Sorulan Sorular (SSS)",
    pillars: [
      {
        title: "Asortili Seri & Paket Sistemi",
        body: "Ürünler tekli perakende yerine üretici standartlarında beden serisi (ör. S-M-L-XL veya 36-42 paket içi 4-8 adet) halinde satılır.",
      },
      {
        title: "Doğrulanmış Merter Fabrikaları",
        body: "Aracı komisyonu olmadan doğrudan üretici firmayla WhatsApp, telefon veya canlı B2B sohbet üzerinden pazarlık yapın.",
      },
      {
        title: "Düşük MOQ & Private Label (OEM)",
        body: "Hazır stok serilerin yanı sıra kendi markanız (dokuma etiket, karton etiket, özel kalıp) için fason ve Private Label üretim talep edin.",
      },
      {
        title: "Avrupa, BDT & MENA Konsolide Kargo",
        body: "Farklı üreticilerden seçtiğiniz seriler Merter lojistik merkezinde tek sevkiyatta birleştirilerek ATR, EUR.1 ve ETGB belgeleriyle sevk edilir.",
      },
    ],
    faqs: [
      {
        question: "Merter Vitrini'nde toptan giyim siparişi nasıl verilir, seri (paket) ne demektir?",
        answer:
          "B2B toptan tekstil ticaretinde ürünler beden serisi (paket) halinde satılır. Örneğin 1:2:2:1 oranlı 6'lı bir pakette S, M, L ve XL bedenler dengeli dağılır. Ürün sayfasında seri adedini seçerek doğrudan üreticiye sipariş veya proforma teklif talebi gönderebilirsiniz.",
      },
      {
        question: "Avrupa, Rusya/BDT ve Orta Doğu ülkelerine kargo ve gümrükleme yapıyor musunuz?",
        answer:
          "Evet. İstanbul Merter anlaşmalı uluslararası hava, kara ve ekspres kargo acenteleriyle Almanya, Fransa, Polonya, Bulgaristan başta olmak üzere tüm AB ülkelerine (ATR/EUR.1 ile), Rusya, Kazakistan, Özbekistan (kargo/karayolu) ve Körfez/MENA ülkelerine kapıya teslim ihracat yapılır.",
      },
      {
        question: "Minimum sipariş adedi (MOQ) ve Private Label (özel etiket) üretim şartları nedir?",
        answer:
          "Hazır stok koleksiyonlarda minimum alım genellikle 1 seri (4-8 adet) kadar düşüktür. Kendi markanızla Private Label veya fason üretim taleplerinde ise üreticiye göre model/renk başına 100-300 adet aralığında esnek MOQ uygulanır.",
      },
      {
        question: "Farklı Merter üreticilerinden aldığım ürünleri tek kargoda birleştirebilir miyim?",
        answer:
          "Evet. Birden fazla doğrulanmış Merter üreticisinden verdiğiniz siparişler konsolidasyon merkezinde tek palet veya kolide birleştirilerek uluslararası navlun maliyetiniz %40'a varan oranda düşürülür.",
      },
    ],
  },
  en: {
    badge: "GLOBAL B2B APPAREL SOURCING HUB • MERTER ISTANBUL",
    heading:
      "Direct Turkish Wholesale Clothing Manufacturers, Size-Run Packs & Worldwide Export",
    intro:
      "Merter Vitrini connects international fashion boutiques, retail chains, and online brands directly with verified clothing factories in Merter, Istanbul — Europe and Eurasia's premier ready-to-wear manufacturing district. Source wholesale women's dresses, modest fashion, two-piece sets, and men's streetwear at direct ex-factory prices.",
    keywordLabel: "Global B2B Sourcing Focus:",
    suppliersCta: "Browse Verified Manufacturers",
    rfqCta: "Post a Buying Request (RFQ)",
    b2bGuideCta: "B2B Wholesale Guide",
    faqHeading: "Frequently Asked Questions on Turkish Wholesale Clothing",
    pillars: [
      {
        title: "Assorted Size-Run Packs (Series)",
        body: "Apparel is sold in factory-sealed wholesale packs (e.g., 4 to 8 pieces covering S-M-L-XL or EU 36-42) ready for boutique retail.",
      },
      {
        title: "Zero-Middleman Factory Access",
        body: "See each manufacturer's real trade name, showroom address in Merter, and negotiate directly via WhatsApp or live B2B chat.",
      },
      {
        title: "Low MOQ & Private Label OEM",
        body: "Order in-stock packs starting from 1 series or commission custom private label production with custom woven labels and hangtags.",
      },
      {
        title: "Consolidated EU, CIS & MENA Cargo",
        body: "Combine orders from multiple Merter factories into one consolidated shipment with full export documentation (ATR, EUR.1, Commercial Invoice).",
      },
    ],
    faqs: [
      {
        question: "How does size-run pack (series) wholesale purchasing work in Turkey?",
        answer:
          "Turkish wholesale apparel is sold by series (packs) per color. Each pack includes a complete size ratio (such as 1xS, 2xM, 2xL, 1xXL = 6 pieces). You simply choose how many packs you want, and pricing is calculated transparently per unit and per pack.",
      },
      {
        question: "Do you ship wholesale clothing from Istanbul to Europe, UK, USA, CIS, and the Middle East?",
        answer:
          "Yes. Verified Merter logistics partners provide door-to-door air express (DHL/UPS/FedEx), road freight to EU countries with ATR customs certificates, specialized cargo lines to CIS markets, and air/sea freight to MENA, UK, and North America.",
      },
      {
        question: "What is the Minimum Order Quantity (MOQ) for ready stock vs. private label?",
        answer:
          "For ready-to-ship wholesale collections, MOQ starts from just 1 size-run pack per style. For custom private label (OEM/ODM) manufacturing with your own brand labels, typical MOQs range between 100 and 300 pieces per model.",
      },
      {
        question: "Can I consolidate orders from multiple Merter manufacturers into one shipment?",
        answer:
          "Yes. You can source dresses, knitwear, and outerwear from multiple Merter showrooms and consolidate all packages through a single Merter export cargo forwarder to minimize international shipping costs.",
      },
    ],
  },
  ru: {
    badge: "ОПТОВЫЕ ПОСТАВКИ ОДЕЖДЫ ИЗ ТУРЦИИ • МЕРТЕР СТАМБУЛ",
    heading:
      "Одежда оптом из Турции напрямую от фабрик Мертера: размерные ряды, пошив и карго в СНГ",
    intro:
      "Merter Vitrini — официальная B2B-платформа оптового текстильного района Мертер (Стамбул). Мы напрямую соединяем бутики, селлеров маркетплейсов и оптовиков из России, Казахстана, Беларуси, Узбекистана и Европы с проверенными турецкими фабриками женской и мужской одежды без посредников и скрытых наценок.",
    keywordLabel: "Популярные B2B направления:",
    suppliersCta: "Каталог фабрик Мертера",
    rfqCta: "Разместить заявку на закупку (RFQ)",
    b2bGuideCta: "Условия оптовых закупок",
    faqHeading: "Частые вопросы по оптовым закупкам одежды из Турции",
    pillars: [
      {
        title: "Закупка размерными рядами (сериями)",
        body: "Все модели поставляются фабричными упаковками (сериями по 4–8 единиц, например S-M-L-XL или 36–42) в одном цвете.",
      },
      {
        title: "Прямые контакты фабрик без посредников",
        body: "Открытые названия производителей Мертера, реальные адреса шоурумов и прямая связь в WhatsApp и онлайн-чате.",
      },
      {
        title: "Низкий MOQ и пошив Private Label",
        body: "Готовый товар со склада от 1 серии или контрактное производство (отшив под вашим брендом и бирками для ритейла и маркетплейсов).",
      },
      {
        title: "Консолидация и карго в РФ и СНГ",
        body: "Сборка заказов от разных фабрик Стамбула на одном складе и отправка проверенными авиа- и авто-карго компаниями с документами.",
      },
    ],
    faqs: [
      {
        question: "Что такое выкуп одежды размерными рядами (сериями) на фабриках Мертера?",
        answer:
          "Турецкие фабрики продают одежду оптом сериями (упаковками). В одну серию входят все размеры модели в одном цвете (например, 42-44-46-48 или S-M-L-XL). На карточке товара указана цена за единицу и точное количество штук в серии.",
      },
      {
        question: "Как осуществляется доставка оптовых заказов из Стамбула в Россию, Казахстан и страны СНГ?",
        answer:
          "Заказы передаются вашему карго-перевозчику в Стамбуле (Мертер / Лалели) либо отправляются аккредитованными логистическими партнерами платформы (авиа-экспресс 3–5 дней, авто-карго 10–16 дней) с полным сопровождением.",
      },
      {
        question: "Какой минимальный заказ (MOQ) и можно ли отшивать одежду под своим брендом (Private Label)?",
        answer:
          "Для готовых коллекций со склада минимальный заказ составляет от 1 размерного ряда. Для контрактного пошива под собственной торговой маркой (СТМ / Private Label) фабрики принимают заказы от 100–300 единиц на модель.",
      },
      {
        question: "Можно ли объединить товары от разных производителей Мертера в одну отправку?",
        answer:
          "Да, вы можете закупать коллекции у нескольких фабрик Мертера и консолидировать их в один груз в логистическом хабе в Стамбуле, экономя на международной доставке.",
      },
    ],
  },
  ar: {
    badge: "منصة التوريد بالجملة من تركيا • مارتر إسطنبول",
    heading:
      "ملابس تركية بالجملة مباشرة من مصانع مارتر إسطنبول بنظام السيري والباكيدج وشحن دولي",
    intro:
      "منصة مارتر فيتريني (Merter Vitrini) هي المعرض الرقمي الرسمي لربط تجار الجملة وأصحاب البوتيكات والمتاجر في الشرق الأوسط والخليج وشمال أفريقيا وأوروبا مباشرة مع مصانع الملابس الجاهزة المعتمدة في حي مارتر بإسطنبول بدون وسطاء أو عمولات إضافية.",
    keywordLabel: "تخصصات التوريد بالجملة:",
    suppliersCta: "تصفح المصانع المعتمدة",
    rfqCta: "أضف طلب شراء بالجملة (RFQ)",
    b2bGuideCta: "دليل الشراء بالجملة B2B",
    faqHeading: "الأسئلة الشائعة حول استيراد الملابس التركية بالجملة",
    pillars: [
      {
        title: "البيع بنظام الباكيدج (السيري)",
        body: "تُباع الموديلات في حزم مصنعية متكاملة المقاسات (من 4 إلى 8 قطع لكل لون، مثل S-M-L-XL أو 38-44) جاهزة للعرض في متجرك.",
      },
      {
        title: "تواصل مباشر مع المصنع التركي",
        body: "أسماء المصانع الحقيقية وعناوين صالات العرض في مارتر متاحة بالكامل مع إمكانية التفاوض المباشر عبر واتساب أو المحادثة الفورية.",
      },
      {
        title: "تصنيع خاص (Private Label) وكميات مرنة",
        body: "اطلب من المخزون الجاهز ابتداءً من سيري واحد، أو اطلب تصنيعاً خاصاً بعلامتك التجارية وتيكت متجرك الخاص.",
      },
      {
        title: "تجميع الشحنات والتخليص الجمركي",
        body: "تجميع طلباتك من عدة مصانع في مارتر ضمن شحنة جوية أو برية أو بحرية واحدة إلى الخليج والعراق والأردن والمغرب العربي وأوروبا.",
      },
    ],
    faqs: [
      {
        question: "ما هو نظام السيري (الباكيدج) في شراء الملابس التركية بالجملة؟",
        answer:
          "في تجارة الجملة في مارتر إسطنبول تُباع الملابس بنظام السيري (حزمة مقاسات متسلسلة للون الواحد مثل S-M-L-XL). يظهر في صفحة كل منتج عدد القطع داخل السيري وسعر القطعة وإجمالي سعر الباكيدج بوضوح.",
      },
      {
        question: "هل يتوفر شحن دولي وتخليص جمركي إلى الدول العربية وأوروبا؟",
        answer:
          "نعم، نوفر عبر شركات الشحن المعتمدة في مارتر شحناً جوياً سريعاً وبرياً وبحرياً من الباب إلى الباب إلى السعودية، الإمارات، الكويت، قطر، العراق، ليبيا، الجزائر، المغرب، الأردن وكافة دول الاتحاد الأوروبي.",
      },
      {
        question: "ما هو الحد الأدنى للطلب وهل يمكن التصنيع باسم علامتي الخاصة؟",
        answer:
          "للبضائع الجاهزة يبدأ الحد الأدنى من باكيدج (سيري) واحد أو حسب شرط المصنع الموضح. أما لتصنيع العلامات الخاصة (Private Label) فيبدأ عادة من 100 إلى 300 قطعة للموديل الواحد.",
      },
      {
        question: "هل يمكن تجميع مشترياتي من عدة مصانع في إسطنبول في شحنة واحدة؟",
        answer:
          "بالتأكيد، يمكنك الشراء من عدة مصانع في مارتر وتجميع كافة الطرود لدى شركة الشحن المعتمدة لإرسالها في بوليصة شحن موحدة وتقليل تكلفة الشحن الدولي.",
      },
    ],
  },
  de: {
    badge: "B2B TEXTILBESCHAFFUNG TÜRKEI • MERTER ISTANBUL",
    heading:
      "Großhandel Mode aus Merter Istanbul direkt ab Werk: Serienpakete, Private Label & EU-Export",
    intro:
      "Merter Vitrini verbindet Modeboutiquen, Filialisten und Online-Händler im DACH-Raum und ganz Europa direkt mit verifizierten Bekleidungsherstellern im Istanbuler Textilzentrum Merter — transparent, ohne Zwischenhändler und zu echten Fabrikpreisen.",
    keywordLabel: "B2B-Großhandelsschwerpunkte:",
    suppliersCta: "Geprüfte Hersteller entdecken",
    rfqCta: "Kaufgesuch (RFQ) erstellen",
    b2bGuideCta: "B2B-Einkaufsleitfaden",
    faqHeading: "Häufige Fragen zum B2B-Modegroßhandel aus der Türkei",
    pillars: [
      {
        title: "Sortierte Größenserien (Packs)",
        body: "Verkauf in fabrikgepackten Serien (z. B. 4–8 Stück pro Farbe in S-M-L-XL oder 36–42) für optimale Bestandsplanung.",
      },
      {
        title: "Direktkontakt zu Merter Fabriken",
        body: "Offene Herstellerprofile mit Showroom-Adresse in Istanbul und direkter Verhandlung via WhatsApp oder B2B-Live-Chat.",
      },
      {
        title: "Niedrige MOQ & Private Label OEM",
        body: "Sofort lieferbare Lagerware ab 1 Serie sowie individuelle Private-Label-Produktion mit eigenen Webetiketten.",
      },
      {
        title: "Konsolidierter EU-Versand mit ATR",
        body: "Bündelung mehrerer Herstellerbestellungen in einer Sendung inklusive ATR-Warenverkehrsbescheinigung für zollfreien EU-Import.",
      },
    ],
    faqs: [
      {
        question: "Wie funktioniert der Einkauf in Serienpaketen (Größenläufen)?",
        answer:
          "Im türkischen B2B-Textilgroßhandel werden Artikel in vorassortierten Größenserien je Farbe geliefert (z. B. 1xS, 2xM, 2xL, 1xXL). Auf jeder Produktseite sehen Sie transparent den Stückpreis sowie den Gesamtpreis pro Paket.",
      },
      {
        question: "Werden Bestellungen mit ATR-Zolldokumenten nach Deutschland, Österreich und in die Schweiz geliefert?",
        answer:
          "Ja. Unsere verifizierten Logistikpartner in Merter wickeln Luftfracht-Express und LKW-Transporte inklusive ATR-Bescheinigung (für die EU) bzw. EUR.1 und Handelsrechnung zuverlässig bis an Ihre Geschäftsadresse ab.",
      },
      {
        question: "Wie hoch ist die Mindestbestellmenge (MOQ) für Lagerware und Private Label?",
        answer:
          "Sofort verfügbare Kollektionen können oft schon ab 1 Serienpaket bestellt werden. Für Private-Label-Produktionen nach Ihren Vorgaben liegt das MOQ je nach Hersteller meist bei 100–300 Stück pro Modell.",
      },
      {
        question: "Kann ich Waren verschiedener Merter Hersteller in einer Lieferung bündeln?",
        answer:
          "Ja, Bestellungen bei unterschiedlichen Herstellern in Merter werden im Logistikzentrum konsolidiert, sodass Sie nur eine internationale Frachtsendung erhalten.",
      },
    ],
  },
  fr: {
    badge: "APPROVISIONNEMENT TEXTILE B2B • MERTER ISTANBUL",
    heading:
      "Grossiste Prêt-à-Porter Turquie en Direct des Usines de Merter : Séries, Marque Blanche & Export",
    intro:
      "Merter Vitrini met en relation directe les boutiques de prêt-à-porter, grossistes et marques e-commerce de France, Belgique, Suisse, Europe et Afrique du Nord avec les fabricants vérifiés du quartier textile de Merter à Istanbul, sans intermédiaire.",
    keywordLabel: "Axes d’approvisionnement B2B :",
    suppliersCta: "Voir les fabricants vérifiés",
    rfqCta: "Publier un appel d’offres (RFQ)",
    b2bGuideCta: "Guide d’achat B2B",
    faqHeading: "Questions fréquentes sur l’achat de vêtements en gros en Turquie",
    pillars: [
      {
        title: "Vente par séries de tailles (Packs)",
        body: "Les collections sont vendues par lots assortis (4 à 8 pièces par couleur couvrant S-M-L-XL ou 36-42).",
      },
      {
        title: "Accès direct aux usines de Merter",
        body: "Identité réelle des fabricants, adresses des showrooms à Istanbul et négociation directe sur WhatsApp ou chat B2B.",
      },
      {
        title: "Faible MOQ & Fabrication Private Label",
        body: "Stock immédiat dès 1 série ou confection à façon sous votre propre griffe et étiquettes personnalisées.",
      },
      {
        title: "Groupage Cargo Europe & Maghreb",
        body: "Consolidation de vos achats multi-fournisseurs en un seul envoi aérien ou routier avec certificats ATR / EUR.1.",
      },
    ],
    faqs: [
      {
        question: "Comment fonctionne l’achat en gros par série (paquet) chez les fabricants turcs ?",
        answer:
          "Chaque article est conditionné en série complète de tailles pour une couleur donnée (par ex. S, M, L, XL). Le calculateur B2B affiche instantanément le nombre d’unités par série et le prix total hors taxes.",
      },
      {
        question: "Livrez-vous en France, en Belgique, en Suisse et au Maghreb avec dédouanement ?",
        answer:
          "Oui, les transitaires partenaires basés à Merter assurent le transport express aérien et routier vers toute l’Union européenne (avec certificat ATR), la Suisse et l’Afrique du Nord.",
      },
      {
        question: "Quel est le minimum de commande (MOQ) pour le stock prêt et le Private Label ?",
        answer:
          "Sur les collections en stock, vous pouvez commander dès 1 série selon le fabricant. Pour une production Private Label personnalisée, le MOQ varie généralement de 100 à 300 pièces par modèle.",
      },
      {
        question: "Puis-je regrouper les commandes de plusieurs ateliers de Merter ?",
        answer:
          "Oui, vos colis provenant de différents showrooms de Merter peuvent être regroupés en une seule expédition internationale afin d’optimiser vos frais de transport.",
      },
    ],
  },
  pl: {
    badge: "CENTRUM HURTOWE ODZIEŻY Z TURCJI • MERTER STAMBUŁ",
    heading:
      "Hurtownia Odzieży Tureckiej Merter Stambuł — Zakupy w Paczkach Prosto z Fabryk i Szybki Eksport",
    intro:
      "Merter Vitrini łączy polskie butiki, hurtownie i marki modowe bezpośrednio ze zweryfikowanymi producentami odzieży z dzielnicy Merter w Stambule. Kupuj sukienki, komplety damskie i odzież męską w cenach fabrycznych bez pośredników.",
    keywordLabel: "Kluczowe kierunki hurtowe B2B:",
    suppliersCta: "Zobacz zweryfikowanych producentów",
    rfqCta: "Dodaj zapytanie ofertowe (RFQ)",
    b2bGuideCta: "Przewodnik zakupów B2B",
    faqHeading: "Najczęstsze pytania o import odzieży hurtowej z Turcji",
    pillars: [
      {
        title: "Sprzedaż w paczkach (seriach rozmiarowych)",
        body: "Produkty sprzedawane są w fabrycznych zestawach rozmiarów (np. 4–8 szt. S-M-L-XL lub 36–42 w jednym kolorze).",
      },
      {
        title: "Bezpośredni kontakt z fabrykami Merter",
        body: "Pełna jawność nazw producentów, adresów showroomów w Stambule oraz bezpośredni czat i WhatsApp.",
      },
      {
        title: "Niskie MOQ i szycie Private Label",
        body: "Gotowe kolekcje już od 1 paczki lub produkcja pod własną marką z Twoimi metkami żakardowymi.",
      },
      {
        title: "Transport konsolidowany do Polski z ATR",
        body: "Łączenie zamówień od wielu tureckich dostawców w jedną przesyłkę kurierską lub spedycyjną ze świadectwem ATR.",
      },
    ],
    faqs: [
      {
        question: "Na czym polega zakup odzieży tureckiej w paczkach (seriach)?",
        answer:
          "W sprzedaży hurtowej B2B jedna paczka (seria) zawiera pełną rozmiarówkę danego modelu w wybranym kolorze (np. S, M, L, XL). Na karcie produktu widzisz dokładny przelicznik sztuk oraz cenę jednostkową i za całą paczkę.",
      },
      {
        question: "Jak wygląda wysyłka hurtowa ze Stambułu do Polski i odprawa celna?",
        answer:
          "Sprawdzeni spedytorzy z Merter realizują szybki transport lotniczy i drogowy do Polski wraz z dokumentem ATR (0% cła w Unii Europejskiej na odzież pochodzenia tureckiego) oraz fakturą eksportową.",
      },
      {
        question: "Jakie jest minimalne zamówienie (MOQ) na gotowy towar i Private Label?",
        answer:
          "Kolekcje z magazynu dostępne są już od 1 serii rozmiarowej. Przy szyciu pod własną marką (Private Label) minimalny nakład wynosi zazwyczaj 100–300 sztuk na model.",
      },
      {
        question: "Czy mogę połączyć zamówienia od kilku producentów z Merter w jedną paczkę zbiorczą?",
        answer:
          "Tak, zakupy z różnych showroomów w Merter można skonsolidować w jednym magazynie spedycyjnym w Stambule, co znacząco obniża koszt dostawy do Polski.",
      },
    ],
  },
  bg: {
    badge: "B2B ЦЕНТЪР ЗА ТУРСКА КОНФЕКЦИЯ • МЕРТЕР ИСТАНБУЛ",
    heading:
      "Дрехи на едро от Турция (Мертер Истанбул) — Директно от фабриките на серии и бърз внос",
    intro:
      "Merter Vitrini свързва български бутици, търговци на едро и онлайн магазини директно с проверени производители на облекло от текстилния квартал Мертер в Истанбул — без посредници, с реални фабрични цени и прозрачни условия.",
    keywordLabel: "Основни B2B категории на едро:",
    suppliersCta: "Разгледайте проверените фабрики",
    rfqCta: "Публикувайте запитване (RFQ)",
    b2bGuideCta: "Ръководство за B2B поръчки",
    faqHeading: "Често задавани въпроси за търговия на едро с дрехи от Турция",
    pillars: [
      {
        title: "Продажба на размерни серии (пакети)",
        body: "Моделите се предлагат във фабрични серии (4–8 бр. в пакет, напр. S-M-L-XL или 36–42 за един цвят).",
      },
      {
        title: "Директна връзка с фабриките в Мертер",
        body: "Виждате реалното търговско име, адреса на шоурума в Истанбул и преговаряте директно по WhatsApp или чат.",
      },
      {
        title: "Нисък минимум и Private Label производство",
        body: "Готова стока на склад от 1 серия или ушиване на ишлеме / собствена марка с ваши етикети.",
      },
      {
        title: "Консолидирано карго до България с ATR",
        body: "Обединяване на пратки от няколко производители в Мертер и експресна сухопътна доставка до България с ATR сертификат.",
      },
    ],
    faqs: [
      {
        question: "Какво означава покупка на дрехи на серии (пакети) от Мертер Истанбул?",
        answer:
          "В B2B търговията на едро всяка серия съдържа пълна номерация от даден модел и цвят (напр. S, M, L, XL). В страницата на продукта се показва точният брой артикули в пакета и цената за брой и за серия.",
      },
      {
        question: "Как се извършва доставката от Истанбул до България и митническото оформяне?",
        answer:
          "Чрез лицензирани карго и логистични партньори в Мертер стоката се доставя за 24–72 часа сухопътно до България с пълен комплект експортни документи и сертификат ATR за безмитен внос в ЕС.",
      },
      {
        question: "Какво е минималното количество за поръчка (MOQ) и предлагате ли Private Label?",
        answer:
          "За налични колекции минималната поръчка започва от 1 серия. За производство под ваш собствен бранд (Private Label) обичайният минимум е 100–300 броя на модел.",
      },
      {
        question: "Мога ли да обединя поръчки от различни турски фабрики в една пратка?",
        answer:
          "Да, всички поръчки от различни шоуруми в Мертер могат да се консолидират в един общ транспорт, за да спестите от логистични разходи.",
      },
    ],
  },
};

interface GlobalB2BSeoKnowledgeSectionProps {
  readonly lang: string;
}

export default function GlobalB2BSeoKnowledgeSection({
  lang,
}: GlobalB2BSeoKnowledgeSectionProps) {
  const safeLang = normalizeSeoLang(lang, "en");
  const copy = KNOWLEDGE_COPY[safeLang];
  const seoMatrix = GLOBAL_B2B_SEO_MATRIX[safeLang];
  const [openIndex, setOpenIndex] = useState<number>(0);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const icons = [Layers, ShieldCheck, PackageCheck, Truck] as const;
  const querySuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;

  return (
    <section
      aria-labelledby="global-b2b-seo-heading"
      className="mt-10 mb-6 bg-white border border-cultured p-6 sm:p-10 text-onyx"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />

      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F8F6F2] border border-cultured text-[10px] font-extrabold uppercase tracking-[2px] text-accent-gold">
            <Globe className="w-3.5 h-3.5" />
            <span>{copy.badge}</span>
          </span>
          <h2
            id="global-b2b-seo-heading"
            className="font-serif font-bold text-xl sm:text-2xl text-eerie-black leading-snug"
          >
            {copy.heading}
          </h2>
          <p className="text-xs sm:text-sm text-sonic-silver leading-relaxed max-w-4xl mx-auto">
            {copy.intro}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {copy.pillars.map((pillar, idx) => {
            const IconComp = icons[idx] || Building2;
            return (
              <article
                key={pillar.title}
                className="p-5 bg-[#FAFAFA] border border-cultured flex flex-col gap-2"
              >
                <div className="w-8 h-8 bg-white border border-cultured flex items-center justify-center text-accent-gold">
                  <IconComp className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-eerie-black">
                  {pillar.title}
                </h3>
                <p className="text-xs text-sonic-silver leading-relaxed">
                  {pillar.body}
                </p>
              </article>
            );
          })}
        </div>

        <div className="border-t border-cultured pt-6">
          <h3 className="font-serif font-bold text-base sm:text-lg text-eerie-black mb-4 text-center">
            {copy.faqHeading}
          </h3>
          <div className="divide-y divide-cultured border border-cultured bg-[#FCFCFC]">
            {copy.faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-left bg-transparent border-none cursor-pointer hover:bg-white transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-bold text-eerie-black">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-sonic-silver shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={
                      isOpen
                        ? "px-4 sm:px-6 pb-4 text-xs sm:text-sm text-sonic-silver leading-relaxed"
                        : "sr-only"
                    }
                  >
                    {faq.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-cultured text-xs">
          <p className="text-[11px] text-sonic-silver leading-relaxed">
            <strong className="text-eerie-black">{copy.keywordLabel}</strong>{" "}
            {seoMatrix.keywords}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
            <Link
              href={`/ureticiler${querySuffix}`}
              className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-[11px] font-bold uppercase tracking-wider no-underline transition-colors"
            >
              {copy.suppliersCta}
            </Link>
            <Link
              href={`/alim-talepleri${querySuffix}`}
              className="px-4 py-2 bg-white hover:bg-[#F8F6F2] text-eerie-black border border-black/20 text-[11px] font-bold uppercase tracking-wider no-underline transition-colors"
            >
              {copy.rfqCta}
            </Link>
            <Link
              href={`/${safeLang}/b2b`}
              className="px-4 py-2 bg-white hover:bg-[#F8F6F2] text-eerie-black border border-cultured text-[11px] font-bold uppercase tracking-wider no-underline transition-colors"
            >
              {copy.b2bGuideCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
