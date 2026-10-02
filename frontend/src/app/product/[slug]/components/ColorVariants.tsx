import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types/store";
import { getResizedImageUrl } from "@/app/utils";
import { translateColor } from "@/app/i18n";

interface ColorVariantsProps {
  readonly product: Product;
  readonly lang: string;
  readonly t: (key: string, lang: string) => string;
}

export default function ColorVariants({ product, lang, t }: ColorVariantsProps) {
  const activeColor = product.color || "Standart";

  return (
    <div>
      <span className="block text-[11px] uppercase font-extrabold text-eerie-black mb-2 tracking-[0.5px] select-none">
        {t("available_colors", lang)}
      </span>
      <div className="flex gap-3 flex-wrap">
        {/* Current viewed product */}
        <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 bg-white transition-all scale-[1.03] shadow-sm border-salmon-pink select-none">
          <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured relative">
            <Image
              src={getResizedImageUrl(
                product.images?.find((img) => img.is_cover)?.image_url ||
                  product.images?.[0]?.image_url ||
                  "/placeholder.png",
                80,
                106
              )}
              alt={translateColor(activeColor, lang)}
              width={48}
              height={56}
              unoptimized
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-0 inset-x-0 bg-salmon-pink text-white text-[8px] font-extrabold py-0.5 text-center uppercase tracking-[0.3px]">
              {t("active", lang)}
            </span>
          </div>
          <span className="text-[10px] font-bold text-eerie-black truncate max-w-[56px] text-center">
            {translateColor(activeColor, lang)}
          </span>
        </div>

        {/* Sibling color variants */}
        {product.color_variants?.map((sib) => (
          <Link
            key={sib.id}
            href={`/product/${sib.slug || sib.id}`}
            className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 border-transparent bg-white hover:border-[#e2e8f0] transition-all hover:scale-[1.03] opacity-80 hover:opacity-100 cursor-pointer select-none"
          >
            <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured">
              <Image
                src={getResizedImageUrl(sib.image_url || "/placeholder.png", 80, 106)}
                alt={translateColor(sib.color, lang)}
                width={48}
                height={56}
                unoptimized
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[10px] font-bold text-sonic-silver truncate max-w-[56px] text-center">
              {translateColor(sib.color, lang)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
