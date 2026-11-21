import turkeyLocationsData from "@/data/turkeyLocations.json";

interface RawProvinceData {
  readonly name: string;
  readonly districts: readonly string[];
}

export interface TurkeyProvince {
  readonly code: string;
  readonly name: string;
  readonly districts: readonly string[];
}

export const TURKEY_PROVINCES: ReadonlyArray<TurkeyProvince> = Object.entries(
  turkeyLocationsData as Record<string, RawProvinceData>
)
  .map(([code, data]) => ({
    code,
    name: data.name,
    districts: data.districts,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "tr"));

export function getDistrictsForProvince(provinceName?: string | null): readonly string[] {
  const clean = (provinceName || "").trim().toLowerCase();
  if (!clean) return [];
  const match = TURKEY_PROVINCES.find((p) => p.name.toLowerCase() === clean);
  return match ? match.districts : [];
}

export function isKnownTurkeyProvince(provinceName?: string | null): boolean {
  const clean = (provinceName || "").trim().toLowerCase();
  if (!clean) return false;
  return TURKEY_PROVINCES.some((p) => p.name.toLowerCase() === clean);
}

const UNSAFE_URI_PREFIXES = ["javascript:", "data:", "vbscript:"];

export function formatBrandWebsiteUrl(raw?: string | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (UNSAFE_URI_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return "";
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function formatBrandWebsiteLabel(raw?: string | null): string {
  const url = formatBrandWebsiteUrl(raw);
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function extractInstagramUsername(raw?: string | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    const withProto =
      lower.startsWith("http://") || lower.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    try {
      const parsed = new URL(withProto);
      const firstSeg = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || "";
      return firstSeg.replace(/^@+/, "").trim();
    } catch {
      return trimmed.replace(/^@+/, "").trim();
    }
  }
  return trimmed.replace(/^@+/, "").replace(/^\/+|\/+$/g, "").split(/[?#\s]/)[0] || "";
}

export function formatBrandInstagramUrl(raw?: string | null): string {
  const username = extractInstagramUsername(raw);
  if (!username) return "";
  return `https://instagram.com/${encodeURIComponent(username)}`;
}

export function formatBrandInstagramLabel(raw?: string | null): string {
  const username = extractInstagramUsername(raw);
  if (!username) return "";
  return `@${username}`;
}

export function formatBrandLocationLine(
  address?: string | null,
  district?: string | null,
  city?: string | null,
  fallback = ""
): string {
  const addrTrim = (address || "").trim();
  const distTrim = (district || "").trim();
  const cityTrim = (city || "").trim();

  const cityRegionParts = [distTrim, cityTrim].filter(Boolean);
  const regionSuffix = cityRegionParts.join(" / ");

  if (!addrTrim && !regionSuffix) {
    return fallback;
  }
  if (!addrTrim) {
    return regionSuffix;
  }
  if (!regionSuffix) {
    return addrTrim;
  }

  const addrLower = addrTrim.toLowerCase();
  const cityAlreadyIncluded = !cityTrim || addrLower.includes(cityTrim.toLowerCase());
  const distAlreadyIncluded = !distTrim || addrLower.includes(distTrim.toLowerCase());
  if (cityAlreadyIncluded && distAlreadyIncluded) {
    return addrTrim;
  }
  const missingParts: string[] = [];
  if (distTrim && !distAlreadyIncluded) missingParts.push(distTrim);
  if (cityTrim && !cityAlreadyIncluded) missingParts.push(cityTrim);
  return `${addrTrim} — ${missingParts.join(" / ")}`;
}
