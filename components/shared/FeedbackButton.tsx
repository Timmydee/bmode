"use client";

import { useRef, useState, type FormEvent } from "react";
import Icon from "@/components/shared/Icon";

export interface FeedbackSubmission {
  rating: number | null;
  message: string;
  email: string | null;
}

const RATING_LABELS = ["Not for me", "Meh", "Okay", "Good", "Loved it"];
const MAX_MESSAGE = 2000;

// A small "Feedback" pill in the corner that opens a form in a native
// <dialog> (focus trapping, Escape and the backdrop for free, like the QR
// modal). Presentational: the caller decides where the feedback goes.
export default function FeedbackButton({
  onSubmit,
}: {
  onSubmit: (feedback: FeedbackSubmission) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setSent(false);
    setError(null);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Tell us a little about it first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        rating,
        message: trimmed,
        email: email.trim() || null,
      });
      setSent(true);
      setRating(null);
      setMessage("");
      setEmail("");
    } catch {
      setError("That didn't send. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Room at the end of every page so the pill never sits on top of
          the last button. */}
      <div aria-hidden className="h-14 shrink-0" />
      <button
        type="button"
        onClick={open}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-stage-line bg-stage-2/90 px-3 py-1.5 text-xs font-medium text-stage-text shadow-[0_4px_16px_rgb(0_0_0/35%)] backdrop-blur transition-colors hover:bg-stage-hover hover:text-white"
      >
        <Icon name="message" className="h-3.5 w-3.5" />
        Feedback
      </button>
      <dialog
        ref={dialog}
        aria-label="Send feedback"
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-stage-line bg-stage-2 p-0 text-white shadow-[0_24px_64px_rgb(0_0_0/60%)] backdrop:bg-black/70"
      >
        {sent ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-ink">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <p className="font-display text-xl font-bold">Thanks, we got it</p>
            <p className="text-sm text-stage-muted">
              Every note gets read. It helps us make Bmode better.
            </p>
            <button
              type="button"
              onClick={close}
              className="rounded-[10px] bg-stage-button px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-stage-button-hover"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl font-bold">Send feedback</p>
                <p className="mt-1 text-sm text-stage-muted">
                  What worked, what didn&apos;t, what you wish it did.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-2 -mt-1 rounded-lg p-2 text-stage-muted hover:bg-stage-hover hover:text-white"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-stage-text">
                How was it?
              </legend>
              <div className="flex gap-1.5">
                {RATING_LABELS.map((label, index) => {
                  const value = index + 1;
                  const on = rating !== null && value <= rating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} of 5: ${label}`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(rating === value ? null : value)}
                      className={`rounded-lg p-1.5 transition-colors hover:bg-stage-hover ${on ? "text-gold" : "text-stage-muted"}`}
                    >
                      <Icon name="star" filled={on} className="h-7 w-7" />
                    </button>
                  );
                })}
              </div>
              <p className="h-4 text-xs text-stage-muted">
                {rating ? RATING_LABELS[rating - 1] : "Optional"}
              </p>
            </fieldset>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stage-text">
                Your feedback
              </span>
              <textarea
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setError(null);
                }}
                maxLength={MAX_MESSAGE}
                rows={4}
                placeholder="The questions were great, but..."
                className="resize-none rounded-[10px] border-[1.5px] border-stage-line bg-rail px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stage-text">
                Email <span className="font-normal text-stage-muted">(optional, only if you want a reply)</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={200}
                autoComplete="email"
                className="rounded-[10px] border-[1.5px] border-stage-line bg-rail px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
            </label>

            {error && <p className="text-sm text-ember">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink transition-colors hover:bg-spotlight-hover disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send feedback"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
