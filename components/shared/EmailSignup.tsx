"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { backend, type EmailSignupSource } from "@/lib/backend";
import { getDeviceId } from "@/lib/identity/device-id";

// The promise shown next to the button, saved with each signup so it's
// clear later what someone agreed to. Change it here if the emails change.
export const EMAIL_CONSENT_TEXT =
  "We'll email you new questions and Bmode news. Unsubscribe anytime.";

// "signed-up" hides the box for good; "dismissed" hides it on this browser
// until they clear storage. Both are per browser, never sent anywhere.
const STORAGE_KEY = "bmode:email-signup";
type StoredState = "signed-up" | "dismissed" | null;

const listeners = new Set<() => void>();
function readStored(): StoredState {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "signed-up" || value === "dismissed" ? value : null;
  } catch {
    return null;
  }
}
function writeStored(value: Exclude<StoredState, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: the box just shows again next time.
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// What hosts see on their recap, after a game they ran.
export const HOST_SIGNUP_COPY = {
  heading: "Want fresh questions for next time?",
  blurb: "Get new questions and game ideas in your inbox every week.",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface EmailSignupProps {
  source: EmailSignupSource;
  heading: string;
  blurb: string;
  // Lets the person hide the box ("Not now"), for spots shown after every game.
  dismissible?: boolean;
  className?: string;
}

// An opt-in email box: one field, one button, and the exact promise
// underneath. Hidden on browsers that already signed up.
export default function EmailSignup({ source, heading, blurb, dismissible = false, className = "" }: EmailSignupProps) {
  // "unknown" on the server and the first client render, so the box only
  // appears once we know this browser hasn't already signed up.
  const stored = useSyncExternalStore<StoredState | "unknown">(subscribe, readStored, () => "unknown");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status !== "done" && stored !== null) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 200) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      await backend.insights.signUpForEmails({
        email: trimmed,
        source,
        consentText: EMAIL_CONSENT_TEXT,
        deviceId: getDeviceId(),
      });
      setStatus("done");
      writeStored("signed-up");
    } catch {
      setStatus("idle");
      setError("Couldn't sign you up just now. Try again in a moment.");
    }
  }

  return (
    <section
      aria-labelledby={`email-signup-${source}`}
      className={`flex flex-col gap-3 rounded-2xl border border-stage-line bg-stage-2 p-6 ${className}`}
    >
      {status === "done" ? (
        <p role="status" className="font-display text-lg font-bold text-ink">
          You&apos;re on the list. Thanks!
        </p>
      ) : (
        <>
          <div>
            <h2 id={`email-signup-${source}`} className="font-display text-lg font-bold text-ink">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{blurb}</p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`email-${source}`} className="sr-only">
              Your email
            </label>
            <input
              id={`email-${source}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              maxLength={200}
              className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-rail px-4 py-2.5 text-ink outline-none placeholder:text-ink-faint focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-[10px] bg-spotlight px-5 py-2.5 font-medium text-spotlight-ink disabled:opacity-60"
            >
              {status === "sending" ? "Signing up…" : "Sign me up"}
            </button>
          </form>
          {error && <p className="text-sm text-ember">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-faint">{EMAIL_CONSENT_TEXT}</p>
            {dismissible && (
              <button
                type="button"
                onClick={() => writeStored("dismissed")}
                className="shrink-0 text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                Not now
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
