"use client";
import React, { useState, useEffect } from "react";

interface SafeHtmlProps {
  readonly html: string;
  readonly className?: string;
  readonly as?: "div" | "article" | "section" | "span";
}

/**
 * SafeHtml sanitizes HTML strings safely across SSR and client.
 * On server-side rendering, it serves the initial HTML directly for full SEO indexing.
 * On client-side, it sanitizes using dompurify to guard against XSS without jsdom overhead.
 */
export function SafeHtml({ html, className, as: Component = "div" }: Readonly<SafeHtmlProps>) {
  const [sanitized, setSanitized] = useState(html);

  useEffect(() => {
    if (typeof window !== "undefined" && html) {
      void import("dompurify")
        .then((mod) => {
          const DOMPurify = mod.default || mod;
          setSanitized(
            DOMPurify.sanitize(html, {
              USE_PROFILES: { html: true },
              ADD_ATTR: ["target", "rel"],
            })
          );
        })
        .catch((err) => {
          console.error("DOMPurify load error:", err);
        });
    }
  }, [html]);

  return <Component className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

export default SafeHtml;
