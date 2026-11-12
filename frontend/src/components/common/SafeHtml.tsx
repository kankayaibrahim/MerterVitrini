"use client";
import React, { useState, useEffect, useMemo } from "react";

interface SafeHtmlProps {
  readonly html: string;
  readonly className?: string;
  readonly as?: "div" | "article" | "section" | "span";
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-950">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/__(.*?)__/g, '<strong class="font-bold text-zinc-950">$1</strong>')
    .replace(/_(.*?)_/g, '<em class="italic">$1</em>');
}

function isAlreadyHtml(trimmed: string): boolean {
  return (
    trimmed.startsWith("<") &&
    (trimmed.includes("</p>") ||
      trimmed.includes("</div>") ||
      trimmed.includes("</h2>") ||
      trimmed.includes("</h3>"))
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
        out.push('<ul class="space-y-2 my-3 pl-5 list-disc text-zinc-700">');
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
  const trimmed = raw.trim();

  if (isAlreadyHtml(trimmed)) {
    return raw;
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

  return parseMarkdownLines(raw.split(/\r?\n/));
}

const BLOCKED_CONTAINER_TAGS_REGEX =
  /<\s*(script|iframe|object|embed|form|applet|style|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_STANDALONE_TAGS_REGEX =
  /<\s*\/?\s*(script|iframe|object|embed|form|applet|meta|base|link|input|button|textarea|select)\b[^>]*>/gi;
const INLINE_EVENT_ATTR_REGEX =
  /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SRCDOC_ATTR_REGEX =
  /\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URI_ATTR_REGEX =
  /\s+(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*))/gi;

/**
 * Deterministic server-safe HTML sanitizer used synchronously for SSR and initial
 * hydration before DOMPurify upgrades sanitization on the client.
 */
export function stripDangerousHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  let cleaned = rawHtml;
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned
      .replace(BLOCKED_CONTAINER_TAGS_REGEX, "")
      .replace(BLOCKED_STANDALONE_TAGS_REGEX, "")
      .replace(INLINE_EVENT_ATTR_REGEX, "")
      .replace(SRCDOC_ATTR_REGEX, "")
      .replace(DANGEROUS_URI_ATTR_REGEX, ' $1="#"');
  }
  return cleaned;
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
