/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";
import { Product } from "@/types/store";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import ProductFavoriteButton from "./ProductFavoriteButton";

interface ProductImageGalleryProps {
  readonly images: Product["images"];
  readonly title: string;
  readonly lang: string;
  readonly t: (key: string, lang: string) => string;
  readonly productId?: string;
}

const GALLERY_FALLBACKS: Record<
  SupportedSeoLang,
  { zoom: string; close: string; prev: string; next: string }
> = {
  tr: { zoom: "Görseli büyüt", close: "Kapat", prev: "Önceki görsel", next: "Sonraki görsel" },
  en: { zoom: "Zoom image", close: "Close", prev: "Previous image", next: "Next image" },
  ru: { zoom: "Увеличить фото", close: "Закрыть", prev: "Предыдущее фото", next: "Следующее фото" },
  ar: { zoom: "تكبير الصورة", close: "إغلاق", prev: "الصورة السابقة", next: "الصورة التالية" },
  de: { zoom: "Bild vergrößern", close: "Schließen", prev: "Vorheriges Bild", next: "Nächstes Bild" },
  fr: { zoom: "Agrandir l'image", close: "Fermer", prev: "Image précédente", next: "Image suivante" },
  pl: { zoom: "Powiększ zdjęcie", close: "Zamknij", prev: "Poprzednie zdjęcie", next: "Następne zdjęcie" },
  bg: { zoom: "Увеличи снимката", close: "Затвори", prev: "Предишна снимка", next: "Следваща снимка" },
};

function resolveGalleryLabel(
  tFn: (key: string, lang: string) => string,
  key: string,
  lang: string,
  fallback: string
): string {
  const translated = tFn(key, lang);
  if (!translated || translated === key) return fallback;
  return translated;
}

export default function ProductImageGallery({
  images,
  title,
  lang,
  t,
  productId,
}: ProductImageGalleryProps) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const fb = GALLERY_FALLBACKS[safeLang];
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const defaultCover =
    images?.find((img) => img.is_cover)?.image_url ||
    images?.[0]?.image_url ||
    "/placeholder.png";

  const mainImg =
    selectedImg && images?.some((img) => img.image_url === selectedImg)
      ? selectedImg
      : defaultCover;

  const handleOpenLightbox = () => {
    const idx = images?.findIndex((img) => img.image_url === mainImg) ?? 0;
    setLightboxIndex(Math.max(0, idx));
    setIsLightboxOpen(true);
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const totalCount = images?.length || 1;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % totalCount);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + totalCount) % totalCount);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, images]);

  const zoomLabel = resolveGalleryLabel(t, "zoom_image", lang, fb.zoom);
  const closeLabel = resolveGalleryLabel(t, "close", lang, fb.close);
  const prevLabel = resolveGalleryLabel(t, "prev", lang, fb.prev);
  const nextLabel = resolveGalleryLabel(t, "next", lang, fb.next);

  return (
    <>
      <div className="flex flex-col gap-4 md:max-w-[550px] w-full md:mx-auto">
        <div className="relative w-full">
          <button
            type="button"
            aria-label={zoomLabel}
            onClick={handleOpenLightbox}
            className="aspect-[4/5] max-h-[460px] md:max-h-[680px] rounded-[12px] overflow-hidden bg-[#fafafa] border border-cultured relative shadow-inner cursor-zoom-in group flex items-center justify-center w-full p-0"
          >
            <img
              src={getResizedImageUrl(mainImg, 600, 800)}
              alt={title}
              width={600}
              height={800}
              loading="eager"
              fetchPriority="high"
              className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:scale-105"
            />
          </button>
          {productId && (
            <div className="absolute top-3 right-3 z-20">
              <ProductFavoriteButton
                productId={productId}
                title={title}
                lang={safeLang}
                imageUrl={mainImg}
                variant="icon"
              />
            </div>
          )}
        </div>

        {images && images.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-none select-none">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                aria-label={`${title} - ${idx + 1}`}
                onClick={() => setSelectedImg(img.image_url)}
                className={`w-16 h-20 rounded-[5px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                  mainImg === img.image_url
                    ? "border-salmon-pink scale-[1.03] shadow-sm"
                    : "border-transparent opacity-65 hover:opacity-100"
                }`}
              >
                <img
                  src={getResizedImageUrl(img.image_url, 80, 106)}
                  alt={`${title} ${idx + 1}`}
                  width={80}
                  height={106}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && images && images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-200 select-none">
          <div className="flex justify-between items-center text-white w-full max-w-[1720px] mx-auto z-10">
            <span className="text-xs font-extrabold tracking-wider bg-white/10 px-3.5 py-1.5 rounded-[5px]">
              {lightboxIndex + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-grow flex items-center justify-center relative w-full max-w-5xl mx-auto my-4">
            {images.length > 1 && (
              <button
                type="button"
                aria-label={prevLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
                }}
                className="absolute left-2 md:left-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="w-full h-full flex items-center justify-center p-2 relative">
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => setIsLightboxOpen(false)}
                className="absolute inset-0 w-full h-full cursor-default bg-transparent border-none p-0 z-0"
              />
              <img
                src={images.at(lightboxIndex)?.image_url || ""}
                alt={title}
                className="max-w-full max-h-[70vh] md:max-h-[75vh] object-contain rounded-[8px] shadow-2xl transition-all duration-300 transform scale-100 ease-out relative z-10 pointer-events-auto"
              />
            </div>

            {images.length > 1 && (
              <button
                type="button"
                aria-label={nextLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % images.length);
                }}
                className="absolute right-2 md:right-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="w-full max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto py-3 scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`${title} - ${idx + 1}`}
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-14 h-18 rounded-[4px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                    lightboxIndex === idx
                      ? "border-salmon-pink scale-105 shadow-md opacity-100"
                      : "border-transparent opacity-40 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={`${title} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
