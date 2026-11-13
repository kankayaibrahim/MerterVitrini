import React from "react";
import Link from "next/link";
import { Home, ShoppingBag, Building2 } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center select-none bg-white">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-salmon-pink/10 text-salmon-pink rounded-full text-xs font-black tracking-widest uppercase">
            HTTP 404
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-eerie-black tracking-tight font-serif">
            Sayfa Bulunamadı
          </h1>
          <p className="text-sm text-sonic-silver font-medium">
            Page Not Found • Страница не найдена • الصفحة غير موجودة
          </p>
        </div>

        <p className="text-xs sm:text-sm text-davys-gray leading-relaxed">
          Aradığınız toptan giyim sayfası, kategori veya ürün yayından kaldırılmış ya da adresi değişmiş olabilir. 
          Doğrudan imalatçı firmalarımızdan toptan seri siparişi vermek için aşağıdaki bağlantıları kullanabilirsiniz.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-eerie-black text-white hover:bg-black rounded-lg text-xs font-bold tracking-wider transition-all duration-200 shadow-sm no-underline active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Ana Sayfa / Home</span>
          </Link>

          <Link
            href="/tr/tum-urunler"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cultured text-onyx hover:bg-cultured/80 border border-border-light rounded-lg text-xs font-bold tracking-wider transition-all duration-200 no-underline active:scale-95"
          >
            <ShoppingBag className="w-4 h-4 text-accent-gold" />
            <span>Tüm Ürünler / Catalog</span>
          </Link>

          <Link
            href="/ureticiler"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-onyx hover:bg-cultured/50 border border-cultured rounded-lg text-xs font-bold tracking-wider transition-all duration-200 no-underline active:scale-95"
          >
            <Building2 className="w-4 h-4 text-sonic-silver" />
            <span>Üreticiler / Brands</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
