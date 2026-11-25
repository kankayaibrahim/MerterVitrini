export const MAX_PRODUCT_VIDEO_BYTES = 50 * 1024 * 1024;

export interface ProductMediaLike {
  readonly image_url?: string;
  readonly media_type?: string;
  readonly is_cover?: boolean;
}

const VIDEO_EXTENSION_REGEX = /\.(?:mp4|webm|m4v|mov)$/i;

/**
 * Strips query string and hash fragment and returns true when the path ends in a supported video extension.
 */
export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const withoutHash = trimmed.split("#")[0] || "";
  const pathOnly = (withoutHash.split("?")[0] || "").trim();
  return VIDEO_EXTENSION_REGEX.test(pathOnly);
}

/**
 * Checks whether a ProductImage-like item represents a video by either explicit media_type or URL extension.
 */
export function isVideoMedia(item?: ProductMediaLike | null): boolean {
  if (!item) return false;
  if (item.media_type?.toLowerCase() === "video") {
    return true;
  }
  return isVideoMediaUrl(item.image_url);
}

/**
 * Checks whether an uploaded browser File is an MP4/WebM video by MIME type or filename extension.
 */
export function isVideoUploadFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("video/")) {
    return true;
  }
  return /\.(?:mp4|webm|m4v|mov)$/i.test(file.name);
}

export function getProductImageItems<T extends ProductMediaLike>(
  items?: readonly T[] | null
): T[] {
  if (!items || items.length === 0) return [];
  return items.filter((item) => Boolean(item.image_url) && !isVideoMedia(item));
}

export function getProductVideoItems<T extends ProductMediaLike>(
  items?: readonly T[] | null
): T[] {
  if (!items || items.length === 0) return [];
  return items.filter((item) => Boolean(item.image_url) && isVideoMedia(item));
}

export function productHasVideo(items?: readonly ProductMediaLike[] | null): boolean {
  return Boolean(items?.some((item) => Boolean(item.image_url) && isVideoMedia(item)));
}

/**
 * Picks the best static photo URL for a product cover/poster, skipping video entries unless none exist.
 */
export function getProductCoverImageUrl(
  items?: readonly ProductMediaLike[] | null,
  fallback: string = "/placeholder.png"
): string {
  const photoItems = getProductImageItems(items);
  if (photoItems.length > 0) {
    const flaggedCover = photoItems.find((item) => item.is_cover)?.image_url;
    return flaggedCover || photoItems[0]?.image_url || fallback;
  }
  return fallback;
}
