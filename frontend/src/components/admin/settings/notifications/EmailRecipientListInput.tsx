"use client";

import React, { useState } from "react";
import { Mail, Plus, X } from "lucide-react";

interface EmailRecipientListInputProps {
  readonly label: string;
  readonly helperText: string;
  readonly emails: readonly string[];
  readonly quickSuggestions?: readonly string[];
  readonly placeholder?: string;
  readonly tone?: "to" | "cc";
  readonly onChange: (nextEmails: string[]) => void;
}

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseEmailTokens(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of parts) {
    if (SIMPLE_EMAIL_PATTERN.test(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

function resolveChipStyle(tone: "to" | "cc"): string {
  if (tone === "cc") {
    return "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700";
  }
  return "bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-800/70";
}

export default function EmailRecipientListInput({
  label,
  helperText,
  emails,
  quickSuggestions = [],
  placeholder = "ornek@domain.com yazıp Enter'a basın...",
  tone = "to",
  onChange,
}: EmailRecipientListInputProps) {
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const appendEmails = (candidates: readonly string[]) => {
    const existing = new Set(emails.map((item) => item.toLowerCase()));
    const next = [...emails];
    for (const candidate of candidates) {
      const normalized = candidate.trim().toLowerCase();
      if (normalized && !existing.has(normalized)) {
        existing.add(normalized);
        next.push(normalized);
      }
    }
    onChange(next);
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setInputError(null);
      return;
    }
    const { valid, invalid } = parseEmailTokens(trimmed);
    if (invalid.length > 0) {
      setInputError(`Geçersiz e-posta adresi: ${invalid.join(", ")}`);
      return;
    }
    appendEmails(valid);
    setDraft("");
    setInputError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitDraft();
    }
  };

  const handleRemove = (target: string) => {
    onChange(emails.filter((item) => item.toLowerCase() !== target.toLowerCase()));
  };

  const unusedSuggestions = quickSuggestions.filter(
    (s) => !emails.some((existing) => existing.toLowerCase() === s.toLowerCase())
  );

  const chipStyle = resolveChipStyle(tone);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Mail size={13} className="text-zinc-400" />
          <span>{label}</span>
          <span className="text-[11px] font-semibold text-zinc-400">({emails.length})</span>
        </span>
        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {unusedSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => appendEmails([suggestion])}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 transition-colors cursor-pointer"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-2.5 flex flex-col gap-2">
        {emails.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {emails.map((email) => (
              <span
                key={email}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${chipStyle}`}
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(email)}
                  aria-label={`${email} adresini kaldır`}
                  className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400 px-1">
            Bu listede tanımlı alıcı yok.
          </span>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
            placeholder={placeholder}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-violet-500"
          />
          <button
            type="button"
            onClick={commitDraft}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus size={13} />
            <span>Ekle</span>
          </button>
        </div>
      </div>

      {inputError ? (
        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{inputError}</span>
      ) : (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{helperText}</span>
      )}
    </div>
  );
}
