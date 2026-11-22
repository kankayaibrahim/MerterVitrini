"use client";
import React, { useState, useEffect, useMemo } from "react";

interface SafeHtmlProps {
  readonly html: string;
  readonly className?: string;
  readonly as?: "div" | "article" | "section" | "span";
}

const SAFE_ESCAPED_TAG_NAMES = new Set([
  "p", "br", "strong", "b", "em", "i", "u",
  "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6",
  "div", "span", "table", "thead", "tbody", "tr", "th", "td", "hr",
]);

const ESCAPED_TAG_TOKEN_REGEX = /&lt;(\/?)([a-z][a-z0-9]{0,5}) ?(\/?)&gt;/gi;

const BLOCK_HTML_TAG_REGEX =
  /<\/?(?:p|div|ul|ol|li|h[1-6]|table|thead|tbody|tr|th|td|section|article|blockquote|hr)\b[^>]*>/i;

const INLINE_HTML_TAG_REGEX =
  /<\/?(?:br|strong|b|em|i|u|span|a)\b[^>]*>/i;

export const PRODUCT_DESCRIPTION_HTML_CLASS =
  "text-sonic-silver leading-relaxed font-normal break-words " +
  "[&_p]:mb-3 [&_p:last-child]:mb-0 " +
  "[&_h2]:font-sans [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:text-eerie-black [&_h2]:mt-5 [&_h2]:mb-2 [&_h2:first-child]:mt-0 " +
  "[&_h3]:font-sans [&_h3]:text-sm [&_h3]:font-extrabold [&_h3]:text-eerie-black [&_h3]:mt-5 [&_h3]:mb-2 [&_h3:first-child]:mt-0 " +
  "[&_h4]:font-sans [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-eerie-black [&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4:first-child]:mt-0 " +
  "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-3 [&_ul]:space-y-1.5 " +
  "[&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-3 [&_ol]:space-y-1.5 " +
  "[&_li]:leading-relaxed [&_li::marker]:text-zinc-400 " +
  "[&_strong]:font-bold [&_strong]:text-eerie-black " +
  "[&_b]:font-bold [&_b]:text-eerie-black " +
  "[&_a]:text-salmon-pink [&_a]:underline [&_a]:font-semibold " +
  "[&_hr]:my-4 [&_hr]:border-cultured " +
  "[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 " +
  "[&_th]:border [&_th]:border-cultured [&_th]:bg-zinc-50 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-start [&_th]:font-bold [&_th]:text-eerie-black " +
  "[&_td]:border [&_td]:border-cultured [&_td]:px-2.5 [&_td]:py-1.5";

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-950">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/__(.*?)__/g, '<strong class="font-bold text-zinc-950">$1</strong>')
    .replace(/_(.*?)_/g, '<em class="italic">$1</em>');
}

function decodeEscapedFormattingTags(raw: string): string {
  if (BLOCK_HTML_TAG_REGEX.test(raw) || INLINE_HTML_TAG_REGEX.test(raw)) {
    return raw;
  }
  return raw.replace(
    ESCAPED_TAG_TOKEN_REGEX,
    (fullMatch, closeSlash: string, tagName: string, selfSlash: string) =>
      SAFE_ESCAPED_TAG_NAMES.has(tagName.toLowerCase())
        ? `<${closeSlash}${tagName}${selfSlash}>`
        : fullMatch
  );
}

function renderHeading(line: string): string | null {
  if (line.startsWith("### ")) {
    return `<h3 class="text-base md:text-lg font-bold text-zinc-950 mt-6 mb-2 flex items-center gap-2">${formatInlineMarkdown(line.slice(4))}</h3>`;
  }
  if (line.startsWith("## ")) {
    return `<h2 class="text-lg md:text-xl font-extrabold text-zinc-950 mt-6 mb-3 pb-1.5 border-b border-zinc-100">${formatInlineMarkdown(line.slice(3))}</h2>`;
  }
  if (line.startsWith("# ")) {
    return `<h2 class="text-xl md:text-2xl font-black text-zinc-950 mt-7 mb-3">${formatInlineMarkdown(line.slice(2))}</h2>`;
  }
  return null;
}

function renderParagraphs(trimmed: string): string {
  return trimmed
    .split(/\n\s*\n/)
    .map(p => `<p class="leading-relaxed my-2.5 text-zinc-700">${p.trim().replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function parseMarkdownLines(lines: string[]): string {
  const out: string[] = [];
  let inList = false;

  const closeListIfNeeded = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeListIfNeeded();
      continue;
    }

    const heading = renderHeading(line);
    if (heading) {
      closeListIfNeeded();
      out.push(heading);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        out.push('<ul class="space-y-2 my-3 ps-5 list-disc text-zinc-700">');
        inList = true;
      }
      out.push(`<li class="leading-relaxed">${formatInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeListIfNeeded();
    out.push(`<p class="leading-relaxed text-zinc-700 my-2.5">${formatInlineMarkdown(line)}</p>`);
  }

  closeListIfNeeded();
  return out.join("\n");
}

export function convertMarkdownToHtml(raw: string): string {
  if (!raw) return "";
  const normalized = decodeEscapedFormattingTags(raw);
  const trimmed = normalized.trim();

  if (BLOCK_HTML_TAG_REGEX.test(trimmed)) {
    return normalized;
  }

  if (INLINE_HTML_TAG_REGEX.test(trimmed)) {
    return /<br\s*\/?>/i.test(trimmed) ? normalized : renderParagraphs(trimmed);
  }

  const hasMarkdown =
    trimmed.includes("# ") ||
    trimmed.includes("## ") ||
    trimmed.includes("### ") ||
    trimmed.includes("- ") ||
    trimmed.includes("* ") ||
    trimmed.includes("**");

  if (!hasMarkdown) {
    return renderParagraphs(trimmed);
  }

  return parseMarkdownLines(normalized.split(/\r?\n/));
}

const BLOCKED_CONTAINER_TAGS = new Set([
  "script", "iframe", "object", "embed", "form", "applet", "style", "svg", "math",
]);
const BLOCKED_STANDALONE_TAGS = new Set([
  "script", "iframe", "object", "embed", "form", "applet",
  "meta", "base", "link", "input", "button", "textarea", "select",
]);
const URI_ATTR_NAMES = new Set(["href", "src", "xlink:href", "action", "formaction"]);

function isAsciiWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

function isTagNameChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  const isLower = code >= 97 && code <= 122;
  const isUpper = code >= 65 && code <= 90;
  const isDigit = code >= 48 && code <= 57;
  return isLower || isUpper || isDigit || ch === "-" || ch === ":";
}

function skipWhitespace(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && isAsciiWhitespace(text[i])) {
    i += 1;
  }
  return i;
}

function startsLikeTag(html: string, ltPos: number): boolean {
  const next = html[ltPos + 1];
  if (!next) return false;
  if (next === "/" || next === "!" || next === "?") return true;
  const code = next.codePointAt(0) ?? 0;
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function readTagHeader(
  html: string,
  ltPos: number
): { rawName: string; name: string; isClosing: boolean; afterNamePos: number } {
  let i = skipWhitespace(html, ltPos + 1);
  let isClosing = false;
  if (i < html.length && html[i] === "/") {
    isClosing = true;
    i = skipWhitespace(html, i + 1);
  }
  const nameStart = i;
  while (i < html.length && isTagNameChar(html[i])) {
    i += 1;
  }
  const rawName = html.slice(nameStart, i);
  return { rawName, name: rawName.toLowerCase(), isClosing, afterNamePos: i };
}

function nextQuoteState(currentQuote: string, ch: string): string {
  if (ch !== '"' && ch !== "'") {
    return currentQuote;
  }
  if (!currentQuote) {
    return ch;
  }
  return currentQuote === ch ? "" : currentQuote;
}

function findTagEnd(html: string, ltPos: number): number {
  let quote = "";
  for (let i = ltPos + 1; i < html.length; i += 1) {
    const ch = html[i];
    quote = nextQuoteState(quote, ch);
    if (!quote && ch === ">") {
      return i;
    }
    if (!quote && ch === "<" && startsLikeTag(html, i)) {
      return -1;
    }
  }
  return -1;
}

function matchesClosingContainerTag(lowerHtml: string, ltPos: number, tagName: string): number {
  const afterSlash = skipWhitespace(lowerHtml, ltPos + 2);
  if (!lowerHtml.startsWith(tagName, afterSlash)) {
    return -1;
  }
  const afterName = afterSlash + tagName.length;
  const boundary = lowerHtml[afterName];
  if (boundary !== ">" && !isAsciiWhitespace(boundary ?? "")) {
    return -1;
  }
  const closeEnd = lowerHtml.indexOf(">", afterName);
  return closeEnd === -1 ? -1 : closeEnd + 1;
}

function findClosingTagEnd(lowerHtml: string, tagName: string, searchFrom: number): number {
  let pos = searchFrom;
  while (pos < lowerHtml.length) {
    const lt = lowerHtml.indexOf("</", pos);
    if (lt === -1) {
      return lowerHtml.length;
    }
    const endPos = matchesClosingContainerTag(lowerHtml, lt, tagName);
    if (endPos !== -1) {
      return endPos;
    }
    pos = lt + 2;
  }
  return lowerHtml.length;
}

function stripBlockedContainerElements(html: string): string {
  const lower = html.toLowerCase();
  const out: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const lt = html.indexOf("<", cursor);
    if (lt === -1) {
      out.push(html.slice(cursor));
      break;
    }
    out.push(html.slice(cursor, lt));

    const header = readTagHeader(html, lt);
    if (!header.isClosing && BLOCKED_CONTAINER_TAGS.has(header.name)) {
      const openEnd = findTagEnd(html, lt);
      if (openEnd === -1) {
        return out.join("");
      }
      cursor = findClosingTagEnd(lower, header.name, openEnd + 1);
      continue;
    }

    out.push("<");
    cursor = lt + 1;
  }
  return out.join("");
}

function normalizeUriForCheck(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.codePointAt(i) ?? 0;
    if (code > 32) {
      out += raw[i].toLowerCase();
    }
  }
  return out;
}

function isDangerousUri(rawValue: string): boolean {
  const normalized = normalizeUriForCheck(rawValue);
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text/html")
  );
}

function readQuotedValue(slice: string, quotePos: number): { raw: string; unquoted: string; nextPos: number } {
  const quoteChar = slice[quotePos];
  const closePos = slice.indexOf(quoteChar, quotePos + 1);
  if (closePos === -1) {
    return {
      raw: slice.slice(quotePos),
      unquoted: slice.slice(quotePos + 1),
      nextPos: slice.length,
    };
  }
  return {
    raw: slice.slice(quotePos, closePos + 1),
    unquoted: slice.slice(quotePos + 1, closePos),
    nextPos: closePos + 1,
  };
}

function readAttributeValue(slice: string, start: number): { raw: string; unquoted: string; nextPos: number } {
  const i = skipWhitespace(slice, start);
  const first = slice[i];
  if (first === '"' || first === "'") {
    return readQuotedValue(slice, i);
  }
  let end = i;
  while (end < slice.length && !isAsciiWhitespace(slice[end])) {
    end += 1;
  }
  const value = slice.slice(i, end);
  return { raw: value, unquoted: value, nextPos: end };
}

function formatSanitizedAttribute(
  name: string,
  val: { raw: string; unquoted: string } | null
): string | null {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith("on") || lowerName === "srcdoc") {
    return null;
  }
  if (val && URI_ATTR_NAMES.has(lowerName) && isDangerousUri(val.unquoted)) {
    return `${name}="#"`;
  }
  return val ? `${name}=${val.raw}` : name;
}

function readAttrNameEnd(attrSlice: string, start: number): number {
  let i = start;
  while (i < attrSlice.length && !isAsciiWhitespace(attrSlice[i]) && attrSlice[i] !== "=") {
    i += 1;
  }
  return i;
}

function sanitizeTagAttributes(attrSlice: string): string {
  const kept: string[] = [];
  let i = 0;

  while (i < attrSlice.length) {
    i = skipWhitespace(attrSlice, i);
    if (i >= attrSlice.length) break;

    const nameEnd = readAttrNameEnd(attrSlice, i);
    const name = attrSlice.slice(i, nameEnd);
    i = skipWhitespace(attrSlice, nameEnd);

    let val: { raw: string; unquoted: string } | null = null;
    if (i < attrSlice.length && attrSlice[i] === "=") {
      const parsed = readAttributeValue(attrSlice, i + 1);
      val = { raw: parsed.raw, unquoted: parsed.unquoted };
      i = parsed.nextPos;
    }

    if (name) {
      const formatted = formatSanitizedAttribute(name, val);
      if (formatted) kept.push(formatted);
    }
  }
  return kept.join(" ");
}

function hasSelfClosingSlash(trimmedInner: string): boolean {
  if (!trimmedInner.endsWith("/")) {
    return false;
  }
  if (trimmedInner.length === 1) {
    return true;
  }
  const prev = trimmedInner.at(-2) ?? "";
  return isAsciiWhitespace(prev) || prev === '"' || prev === "'";
}

function sanitizeSingleTag(tag: string): string {
  if (tag.startsWith("<!--") || tag.startsWith("<!") || tag.startsWith("<?")) {
    return tag;
  }
  const header = readTagHeader(tag, 0);
  if (!header.rawName) {
    return tag;
  }
  if (BLOCKED_STANDALONE_TAGS.has(header.name)) {
    return "";
  }
  if (header.isClosing) {
    return tag;
  }

  let inner = tag.slice(header.afterNamePos, -1);
  const trimmedEnd = inner.trimEnd();
  const isSelfClosing = hasSelfClosingSlash(trimmedEnd);
  if (isSelfClosing) {
    inner = trimmedEnd.slice(0, -1);
  }

  const sanitizedAttrs = sanitizeTagAttributes(inner);
  const attrPart = sanitizedAttrs ? ` ${sanitizedAttrs}` : "";
  const closePart = isSelfClosing ? "/>" : ">";
  return `<${header.rawName}${attrPart}${closePart}`;
}

function sanitizeHtmlTags(html: string): string {
  const out: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const lt = html.indexOf("<", cursor);
    if (lt === -1) {
      out.push(html.slice(cursor));
      break;
    }
    out.push(html.slice(cursor, lt));

    const gt = startsLikeTag(html, lt) ? findTagEnd(html, lt) : -1;
    if (gt === -1) {
      out.push("<");
      cursor = lt + 1;
      continue;
    }

    out.push(sanitizeSingleTag(html.slice(lt, gt + 1)));
    cursor = gt + 1;
  }
  return out.join("");
}

function applyFixedPointPass(input: string, transform: (val: string) => string): string {
  let current = input;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = transform(current);
    if (next === current) {
      return next;
    }
    current = next;
  }
  return current;
}

/**
 * Deterministic server-safe HTML sanitizer used synchronously for SSR and initial
 * hydration before DOMPurify upgrades sanitization on the client.
 */
export function stripDangerousHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return applyFixedPointPass(rawHtml, (val) =>
    sanitizeHtmlTags(applyFixedPointPass(val, stripBlockedContainerElements))
  );
}

/**
 * SafeHtml sanitizes HTML and Markdown strings safely across SSR and client.
 * On server-side rendering and initial hydration, it synchronously strips all dangerous
 * tags, event handlers, and script URIs while preserving semantic SEO HTML.
 * On client-side, it upgrades sanitization using DOMPurify.
 */
export function SafeHtml({ html, className, as: Component = "div" }: Readonly<SafeHtmlProps>) {
  const processedHtml = useMemo(() => convertMarkdownToHtml(html), [html]);
  const serverSafeHtml = useMemo(() => stripDangerousHtml(processedHtml), [processedHtml]);
  const [purified, setPurified] = useState<{ source: string; output: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !processedHtml) {
      return;
    }
    let cancelled = false;
    void import("dompurify")
      .then((mod) => {
        if (cancelled) return;
        const DOMPurify = mod.default || mod;
        const cleanOutput = DOMPurify.sanitize(processedHtml, {
          USE_PROFILES: { html: true },
          ADD_ATTR: ["target", "rel", "class"],
        });
        setPurified({ source: processedHtml, output: cleanOutput });
      })
      .catch((err) => {
        console.error("DOMPurify load error:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [processedHtml]);

  const sanitized = purified?.source === processedHtml ? purified.output : serverSafeHtml;

  return <Component className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

export default SafeHtml;
