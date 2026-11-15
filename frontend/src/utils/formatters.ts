import { CategoryNode } from "../types/integration";

export const DEFAULT_MERTER_ADDRESS =
  "Merter Tekstil Merkezi, Mehmet Nesih Özmen Mah., Güngören / İstanbul";

export const DEFAULT_MERTER_EMAIL = "info@mertervitrini.com.tr";

/**
 * Fixes malformed apostrophe title-casing such as "Women' S" / "Women'S" -> "Women's"
 * and "WOMEN' S" -> "WOMEN'S".
 */
export function fixApostropheCase(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/([a-z\u00E0-\u024F])\s*['’]\s*[sS]\b/g, "$1's")
    .replace(/([A-Z])\s*['’]\s+(S)\b/g, "$1'$2");
}

/**
 * Formats brand / English technical labels in uppercase in JS so CSS `uppercase`
 * under `<html lang="tr">` never turns ASCII `i` into dotted `İ` (e.g. "ETİKA FASHİON", "ANDROİD").
 */
export function formatAsciiSafeUpper(text: string | undefined | null): string {
  if (!text) return "";
  return fixApostropheCase(text).toUpperCase();
}

export function sanitizePublicStoreEmail(rawEmail: string | undefined | null): string {
  const trimmed = (rawEmail || "").trim();
  if (!trimmed) {
    return DEFAULT_MERTER_EMAIL;
  }
  return trimmed;
}

export function sanitizePublicStoreAddress(rawAddress: string | undefined | null): string {
  const trimmed = (rawAddress || "").trim();
  if (!trimmed) {
    return DEFAULT_MERTER_ADDRESS;
  }
  return trimmed;
}

export function resolveAddressLocality(rawAddress: string | undefined | null): string {
  const normalized = sanitizePublicStoreAddress(rawAddress);
  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const istanbulIndex = parts.findIndex(
    (part) => part.toLocaleLowerCase("tr-TR") === "istanbul" || part.toLowerCase() === "istanbul"
  );
  if (istanbulIndex > 0) {
    const beforeCity = parts[istanbulIndex - 1].replace(/,/g, " ").trim();
    const tokens = beforeCity.split(/\s+/).filter(Boolean);
    const lastToken = tokens.at(-1);
    if (lastToken) {
      return lastToken;
    }
  }
  return "İstanbul";
}

export const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export const getDuration = (started: string, completed: string | null): string => {
  const end = completed ? new Date(completed).getTime() : Date.now();
  const diffMs = end - new Date(started).getTime();
  const seconds = Math.floor(diffMs / 1000);
  const suffix = completed ? "" : " (Devam ediyor...)";
  
  if (seconds < 0) return `0 sn${suffix}`;
  if (seconds < 60) return `${seconds} sn${suffix}`;
  const mins = Math.floor(seconds / 60);
  return `${mins} dk ${seconds % 60} sn${suffix}`;
};

export const getFlatCategoriesList = (
  nodes: CategoryNode[],
  depth = 0
): { id: string; title: string; depth: number; node_path: string }[] => {
  let list: { id: string; title: string; depth: number; node_path: string }[] = [];
  nodes.forEach(node => {
    list.push({ id: node.id, title: node.title, depth, node_path: node.node_path });
    if (node.children && node.children.length > 0) {
      list = [...list, ...getFlatCategoriesList(node.children, depth + 1)];
    }
  });
  return list;
};
