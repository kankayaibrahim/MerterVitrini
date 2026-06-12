import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";
import { Product } from "@/types/store";

interface ProductImageGalleryProps {
  images: Product["images"];
  title: string;
  lang: string;
  t: (key: string, lang: string) => string;
}

export default function ProductImageGallery({
  images,
  title,
  lang,
  t,
}: ProductImageGalleryProps) {
  const [mainImg, setMainImg] = useState<string>("/placeholder.png");
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // Set default cover image when images prop changes
  useEffect(() => {
    let cover = "/placeholder.png";
    if (images && images.length > 0) {
      const coverObj = images.find((img) => img.is_cover) || images[0];
      cover = coverObj.image_url;
    }
    setMainImg(cover);
  }, [images]);

  const handleOpenLightbox = () => {
    const idx = images?.findIndex((img) => img.image_url === mainImg) ?? 0;
    setLightboxIndex(idx >= 0 ? idx : 0);
    setIsLightboxOpen(true);
  };

  // Keyboard controls for lightbox navigation
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % (images?.length || 1));
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + (images?.length || 1)) % (images?.length || 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, images]);

  return (
    <>
      {/* Left Column - Image Gallery */}
      <div className="flex flex-col gap-4 md:max-w-[550px] w-full md:mx-auto">
        <div
          onClick={handleOpenLightbox}
          className="aspect-[4/5] max-h-[460px] md:max-h-[680px] rounded-[12px] overflow-hidden bg-[#fafafa] border border-cultured relative shadow-inner cursor-zoom-in group flex items-center justify-center"
        >
          <img
            src={getResizedImageUrl(mainImg, 600, 800)}
            alt={title}
            className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:scale-105"
          />
        </div>

        {images && images.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-none select-none">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setMainImg(img.image_url)}
                className={`w-16 h-20 rounded-[5px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                  mainImg === img.image_url
                    ? "border-salmon-pink scale-[1.03] shadow-sm"
                    : "border-transparent opacity-65 hover:opacity-100"
                }`}
              >
                <img
                  src={getResizedImageUrl(img.image_url, 80, 106)}
                  alt="thumb"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* C. LIGHTBOX PREMIUM IMAGE GALLERY POPUP */}
      {isLightboxOpen && images && images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-200 select-none">
          {/* Top Bar */}
          <div className="flex justify-between items-center text-white w-full max-w-[1720px] mx-auto z-10">
            <span className="text-xs font-extrabold tracking-wider bg-white/10 px-3.5 py-1.5 rounded-[5px]">
              {lightboxIndex + 1} / {images.length}
            </span>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-grow flex items-center justify-center relative w-full max-w-5xl mx-auto my-4">
            {/* Left navigation arrow */}
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
                }}
                className="absolute left-2 md:left-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Middle Image display */}
            <div
              className="w-full h-full flex items-center justify-center p-2 relative"
              onClick={() => setIsLightboxOpen(false)}
            >
              <img
                src={images.at(lightboxIndex)?.image_url || ""}
                alt={title}
                className="max-w-full max-h-[70vh] md:max-h-[75vh] object-contain rounded-[8px] shadow-2xl transition-all duration-300 transform scale-100 ease-out"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Right navigation arrow */}
            {images.length > 1 && (
              <button
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

          {/* Bottom Thumbnails row */}
          {images.length > 1 && (
            <div className="w-full max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto py-3 scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-14 h-18 rounded-[4px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                    lightboxIndex === idx
                      ? "border-salmon-pink scale-105 shadow-md opacity-100"
                      : "border-transparent opacity-40 hover:opacity-100"
                  }`}
                >
                  <img src={img.image_url} alt="thumb" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
