"use client";
import React, { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

interface SafeHtmlProps {
  readonly html: string;
  readonly className?: string;
  readonly as?: "div" | "article" | "section" | "span";
}

/**
 * SafeHtml sanitizes HTML strings using isomorphic-dompurify
 * preventing Cross-Site Scripting (XSS) while preserving safe markup.
 */
export function SafeHtml({ html, className, as: Component = "div" }: Readonly<SafeHtmlProps>) {
  const sanitized = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel"],
    });
  }, [html]);

  return <Component className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

export default SafeHtml;
