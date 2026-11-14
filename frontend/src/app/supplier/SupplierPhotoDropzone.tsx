"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  UploadCloud,
  Trash2,
  GripVertical,
  ClipboardPaste,
  Loader2,
  Star,
} from "lucide-react";

export function filterAcceptedImageFiles(
  fileList: FileList | readonly File[] | null | undefined
): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter((file) => {
    if (file.type && file.type.startsWith("image/")) {
      return true;
    }
    return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  });
}

export function extractClipboardImageFiles(
  clipboardData: DataTransfer | null | undefined
): File[] {
  if (!clipboardData) return [];
  const extracted: File[] = [];
  if (clipboardData.items) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) extracted.push(file);
      }
    }
  }
  if (extracted.length === 0 && clipboardData.files) {
    return filterAcceptedImageFiles(clipboardData.files);
  }
  return extracted;
}

export function reorderImageList(
  list: readonly string[],
  fromIdx: number,
  toIdx: number
): string[] {
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= list.length ||
    toIdx >= list.length
  ) {
    return [...list];
  }
  const copy = [...list];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return copy;
}

export async function uploadSupplierImageFile(
  token: string,
  file: File
): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/v1/supplier/upload-image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || "Görsel yüklenemedi.");
  }
  const data = (await res.json()) as { image_url?: string };
  return data.image_url || "";
}

export async function performMultiImageUpload(
  files: readonly File[],
  token: string | null,
  setLoading: (v: boolean) => void,
  onUploaded: (urls: string[]) => void,
  onError?: (message: string) => void
): Promise<void> {
  if (files.length === 0 || !token) return;
  setLoading(true);
  try {
    const uploadedResults = await Promise.all(
      files.map((file) => uploadSupplierImageFile(token, file))
    );
    const uploadedUrls = uploadedResults.filter((url): url is string => Boolean(url));
    if (uploadedUrls.length > 0) {
      onUploaded(uploadedUrls);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Görsel yüklenemedi.";
    if (onError) {
      onError(msg);
    } else {
      alert(msg);
    }
  } finally {
    setLoading(false);
  }
}

function hasExternalFileTransfer(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types).includes("Files");
}

export interface SupplierPhotoDropzoneProps {
  readonly images: readonly string[];
  readonly uploading: boolean;
  readonly onUploadFiles: (files: File[]) => void | Promise<void>;
  readonly onReorderImages: (fromIdx: number, toIdx: number) => void;
  readonly onSetCoverImage: (idx: number) => void;
  readonly onRemoveImage: (idx: number) => void;
  readonly enablePaste?: boolean;
  readonly maxImages?: number;
  readonly stepNumber?: number;
  readonly title?: string;
  readonly subtitle?: string;
  readonly inputId?: string;
  readonly largeDropzone?: boolean;
  readonly showCoverBadge?: boolean;
}

export function SupplierPhotoDropzone({
  images,
  uploading,
  onUploadFiles,
  onReorderImages,
  onSetCoverImage,
  onRemoveImage,
  enablePaste = true,
  maxImages,
  stepNumber,
  title = "Ürün Fotoğrafları (Sürükle-Bırak, Ctrl+V & Sırala)",
  subtitle = "Sürükleyerek sırayı değiştirin • İlk görsel vitrin kapağı olur",
  inputId = "supp-express-photos",
  largeDropzone = false,
  showCoverBadge = true,
}: SupplierPhotoDropzoneProps) {
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [draggingThumbIdx, setDraggingThumbIdx] = useState<number | null>(null);
  const [dragOverThumbIdx, setDragOverThumbIdx] = useState<number | null>(null);
  const [pasteNotice, setPasteNotice] = useState("");
  const [limitNotice, setLimitNotice] = useState("");

  const dispatchFiles = React.useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0 || uploading) return;
      if (maxImages !== undefined) {
        const remaining = Math.max(0, maxImages - images.length);
        if (remaining === 0) {
          setLimitNotice(`En fazla ${maxImages} fotoğraf yükleyebilirsiniz.`);
          return;
        }
        if (incoming.length > remaining) {
          setLimitNotice(
            `En fazla ${maxImages} fotoğraf sınırından dolayı ilk ${remaining} görsel yükleniyor.`
          );
          void onUploadFiles(incoming.slice(0, remaining));
          return;
        }
      }
      setLimitNotice("");
      void onUploadFiles(incoming);
    },
    [images.length, maxImages, onUploadFiles, uploading]
  );

  useEffect(() => {
    if (!enablePaste) return;
    const handleWindowPaste = (e: ClipboardEvent) => {
      const files = extractClipboardImageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      setPasteNotice(`Panodan ${files.length} görsel algılandı!`);
      setTimeout(() => setPasteNotice(""), 3000);
      dispatchFiles(files);
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [dispatchFiles, enablePaste]);

  const handleContainerDragEnter = (e: React.DragEvent<HTMLElement>) => {
    if (draggingThumbIdx !== null || !hasExternalFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    setIsFileDragActive(true);
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (draggingThumbIdx !== null || !hasExternalFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isFileDragActive) {
      setIsFileDragActive(true);
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsFileDragActive(false);
    }
  };

  const handleContainerDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsFileDragActive(false);
    if (draggingThumbIdx !== null) {
      setDraggingThumbIdx(null);
      setDragOverThumbIdx(null);
      return;
    }
    const files = filterAcceptedImageFiles(e.dataTransfer.files);
    dispatchFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterAcceptedImageFiles(e.target.files);
    dispatchFiles(files);
    e.target.value = "";
  };

  const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    setDraggingThumbIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    if (draggingThumbIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverThumbIdx !== idx) {
      setDragOverThumbIdx(idx);
    }
  };

  const handleCardDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragActive(false);
    if (draggingThumbIdx !== null) {
      if (draggingThumbIdx !== targetIdx) {
        onReorderImages(draggingThumbIdx, targetIdx);
      }
      setDraggingThumbIdx(null);
      setDragOverThumbIdx(null);
      return;
    }
    const files = filterAcceptedImageFiles(e.dataTransfer.files);
    dispatchFiles(files);
  };

  const handleCardDragEnd = () => {
    setDraggingThumbIdx(null);
    setDragOverThumbIdx(null);
  };

  const isAtMax = maxImages !== undefined && images.length >= maxImages;

  const dropLabelContent = (
    <label
      htmlFor={inputId}
      className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
        largeDropzone ? "min-h-40 p-6 w-full" : "col-span-2 min-h-28 p-3"
      } ${
        isFileDragActive
          ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/25 scale-[1.01]"
          : uploading || isAtMax
            ? "border-slate-300 bg-slate-100/80 opacity-75 pointer-events-none"
            : "border-slate-300 hover:border-emerald-600 bg-white hover:bg-emerald-50/30"
      }`}
    >
      {uploading ? (
        <Loader2 size={largeDropzone ? 28 : 22} className="text-emerald-600 animate-spin mb-1.5" />
      ) : (
        <UploadCloud
          size={largeDropzone ? 32 : 22}
          className={isFileDragActive ? "text-emerald-600 animate-bounce mb-1.5" : "text-slate-700 mb-1.5"}
        />
      )}

      <span className="text-xs font-extrabold text-slate-900">
        {isFileDragActive
          ? "Resimleri Buraya Bırakın — Otomatik WebP & Optimizasyon"
          : uploading
            ? "Fotoğraflar Optimize Edilip Yükleniyor..."
            : largeDropzone
              ? "1–30 Ürün Fotoğrafını Buraya Sürükleyin, Seçin veya Ctrl+V Yapıştırın"
              : "Fotoğraf Seç, Sürükle veya Ctrl+V"}
      </span>

      <span className="text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1.5 flex-wrap">
        <span>JPG, PNG, WEBP</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
          <ClipboardPaste size={11} />
          WhatsApp / Ekran Görüntüsü Ctrl+V
        </span>
      </span>

      <input
        id={inputId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        disabled={uploading || isAtMax}
        className="hidden"
      />
    </label>
  );

  return (
    <section
      onDragEnter={handleContainerDragEnter}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
      className={`p-4 rounded-xl border transition-all flex flex-col gap-3 relative ${
        isFileDragActive
          ? "bg-emerald-50/70 border-emerald-500 ring-4 ring-emerald-500/20"
          : "bg-slate-50/80 border-slate-200/90"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {stepNumber !== undefined && (
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
              {stepNumber}
            </span>
          )}
          <div>
            <span className="text-xs font-extrabold text-slate-900 block">{title}</span>
            <span className="text-[10px] text-slate-500 block">{subtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pasteNotice && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold animate-in fade-in">
              {pasteNotice}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
            {images.length}
            {maxImages ? ` / ${maxImages}` : ""} görsel
          </span>
        </div>
      </div>

      {limitNotice && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
          {limitNotice}
        </div>
      )}

      {largeDropzone && dropLabelContent}

      <div
        className={
          largeDropzone
            ? "grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5"
            : "grid grid-cols-2 sm:grid-cols-5 gap-2.5"
        }
      >
        {!largeDropzone && dropLabelContent}

        {images.map((imgUrl, idx) => {
          const isBeingDragged = draggingThumbIdx === idx;
          const isDragOver = dragOverThumbIdx === idx && draggingThumbIdx !== idx;

          return (
            <div
              key={`${imgUrl}-${idx}`}
              draggable={!uploading}
              onDragStart={(e) => handleCardDragStart(e, idx)}
              onDragOver={(e) => handleCardDragOver(e, idx)}
              onDragLeave={() => {
                if (dragOverThumbIdx === idx) setDragOverThumbIdx(null);
              }}
              onDrop={(e) => handleCardDrop(e, idx)}
              onDragEnd={handleCardDragEnd}
              className={`relative h-28 rounded-xl overflow-hidden border bg-white group select-none transition-all cursor-grab active:cursor-grabbing ${
                isDragOver
                  ? "border-2 border-emerald-500 ring-2 ring-emerald-500/40 scale-[1.03]"
                  : idx === 0 && showCoverBadge
                    ? "border-2 border-slate-900 shadow-xs"
                    : "border-slate-200"
              } ${isBeingDragged ? "opacity-45 scale-95" : ""}`}
            >
              <Image
                src={imgUrl}
                alt={`Ürün görseli ${idx + 1}`}
                fill
                sizes="160px"
                className="object-cover pointer-events-none"
              />

              {showCoverBadge && idx === 0 ? (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-extrabold tracking-wide shadow-xs">
                  KAPAK
                </span>
              ) : (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-bold">
                  #{idx + 1}
                </span>
              )}

              <span
                className="absolute top-1.5 right-1.5 p-1 rounded bg-white/85 text-slate-700 shadow-xs opacity-80 group-hover:opacity-100"
                title="Sürükleyerek sıralayın"
              >
                <GripVertical size={12} />
              </span>

              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-between gap-1">
                {showCoverBadge && idx !== 0 ? (
                  <button
                    type="button"
                    onClick={() => onSetCoverImage(idx)}
                    className="px-2 py-1 rounded bg-white/95 hover:bg-white text-slate-900 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer shadow-xs"
                    title="Kapak fotoğrafı yap"
                  >
                    <Star size={10} />
                    <span>Kapak Yap</span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={() => onRemoveImage(idx)}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Görseli kaldır"
                >
                  <Trash2 size={11} />
                  <span>Sil</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
