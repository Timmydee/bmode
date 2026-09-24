"use client";

import { useState } from "react";

interface JoinCodeProps {
  code: string;
  className?: string;
  // Adds a small copy button next to the code — off by default so
  // existing inline usages (e.g. "Join at {host} {code}") don't sprout an
  // unexpected interactive element; opt in where the code is the main
  // focus (host control room, presenter screen).
  copyable?: boolean;
}

export default function JoinCode({ code, className, copyable }: JoinCodeProps) {
  const formatted = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (older browser, insecure context) —
      // fail silently rather than surface an error for a convenience
      // feature; the code is still visible to copy by hand.
    }
  }

  if (!copyable) {
    return (
      <span
        className={`font-display font-semibold tracking-[0.08em] ${className ?? ""}`}
      >
        {formatted}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`font-display font-semibold tracking-[0.08em] ${className ?? ""}`}
      >
        {formatted}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy join code"
        className="rounded-md px-1.5 py-0.5 text-xs font-medium text-stage-muted outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-spotlight/60"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
