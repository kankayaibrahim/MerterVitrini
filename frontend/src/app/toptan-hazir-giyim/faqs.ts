export interface PillarFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const TOPTAN_HAZIR_GIYIM_FAQS: readonly PillarFaqItem[] = [
  {
    question: "Toptan hazır giyim siparişlerinde seri (asorti) sistemi nasıl işler?",
    answer:
      "Türkiye ve Merter toptan hazır giyim sektöründe ürünler tek adet değil, bir modelin farklı bedenlerini (örneğin S-M-L-XL veya 36-38-40-42) içeren kapalı seri paketleri halinde satılır. Bir seride genellikle 3 ila 8 adet ürün bulunur ve stok miktarları seri adedi üzerinden hesaplanır.",
  },
  {
    question: "Merter Vitrini'nde aracı komisyonu var mıdır?",
    answer:
      "Hayır. Merter Vitrini açık üretici vitrini modeliyle çalışır; toptan hazır giyim üreticilerinin firma ünvanı, showroom adresi, WhatsApp hattı ve IBAN bilgileri alıcıya şeffaf biçimde sunulur. Alıcılar doğrudan imalatçıyla aracısız çalışır.",
  },
  {
    question: "Butik veya Trendyol / Instagram mağazası için minimum kaç adet alım gerekir?",
    answer:
      "Hazır stoklu koleksiyonlarda birçok Merter üreticisi model başına 1 veya 2 seri (yaklaşık 4–8 parça) ile deneme ve butik siparişi kabul etmektedir. Özel etiket (Private Label) ve fason imalatta minimum üretim adedi modele ve kumaşa göre genellikle renk başına 100–300 adet aralığındadır.",
  },
  {
    question: "Merter, Laleli, Osmanbey ve Giyimkent toptan piyasaları arasındaki fark nedir?",
    answer:
      "Merter kadın günlük/trend giyim, ikili takım, triko ve erkek sokak modasında üretim merkezidir. Laleli ve Osmanbey daha çok ihracat odaklı abiye, klasik takım ve üst segment trikoya yoğunlaşır; Giyimkent ise kumaş, yan sanayi ve büyük depo ofislerine ev sahipliği yapar.",
  },
  {
    question: "Online toptan hazır giyim alırken XML entegrasyonu sağlanıyor mu?",
    answer:
      "Evet. Merter Vitrini üzerinden çalışan birçok üretici güncel stok ve seri fiyatlarını dijital katalog üzerinden sunar. Ayrıca e-ticaret ve pazaryeri entegrasyonları için standart ürün verileriyle hızlı stok senkronizasyonu yapılır.",
  },
  {
    question: "Yurtdışı toptan hazır giyim ihracatında ATR, EUR.1 ve kargo konsolidasyonu nasıl yapılır?",
    answer:
      "Avrupa Birliği, Balkanlar, BDT ve Orta Doğu'dan alım yapan firmalar farklı Merter üreticilerinden seçtikleri ürünleri İstanbul'da tek bir kargo paketinde birleştirebilir (konsolidasyon). İhracatçı üreticiler sipariş hacmine göre ATR, EUR.1 ve menşe belgelerini düzenler.",
  },
];
