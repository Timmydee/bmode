"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { backend, type PremiumAction, type PremiumPlace } from "@/lib/backend";
import { getDeviceId } from "@/lib/identity/device-id";
import { PLUS_PRICE, PREMIUM_DECKS, PREMIUM_PRICE, type PremiumDeck } from "@/lib/cards/premium";
import Icon from "@/components/shared/Icon";

// Locked premium decks: a fake-door test of whether anyone would pay.
// Nothing is for sale yet. Tapping a deck explains that and asks for an
// email to get early access. Every view, tap and email is counted for the
// Premium decks panel on /admin.

export const PREMIUM_CONSENT_TEXT =
  "We'll email you when premium decks launch, plus new questions and Bmode news. Unsubscribe anytime.";

// Per browser, so someone already on the list isn't asked again.
const STORAGE_KEY = "bmode:premium-early-access";
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function onEarlyAccessList(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

// Counting must never get in the way, so failures (no storage, no
// migration yet) are swallowed, like track() in lib/insights.ts.
function record(action: PremiumAction, place: PremiumPlace, deckId: string | null = null) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  backend.insights.recordPremiumInterest({ deviceId, deckId, action, place }).catch(() => {});
}

// The sheet that opens from a locked deck, plus the "view" count for the
// place it's used in. Shared by the library section and the picker list.
function usePremiumSheet(place: PremiumPlace) {
  const [deck, setDeck] = useState<PremiumDeck | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  useEffect(() => {
    record("view", place);
  }, [place]);

  function open(next: PremiumDeck) {
    record("tap", place, next.id);
    setAlreadyOnList(onEarlyAccessList());
    setDeck(next);
  }

  const sheet = (
    <PremiumDeckSheet
      key={deck?.id ?? "closed"}
      deck={deck}
      place={place}
      alreadyOnList={alreadyOnList}
      onClose={() => setDeck(null)}
    />
  );
  return { open, sheet };
}

/** The locked decks on /cards, under the free ones. */
export function PremiumLibrarySection() {
  const { open, sheet } = usePremiumSheet("cards");
  return (
    <section aria-labelledby="premium-decks" className="pb-14">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="premium-decks" className="font-display text-2xl font-bold text-ink">
          Premium decks
        </h2>
        <p className="text-sm text-ink-soft">
          {PREMIUM_PRICE} each, or all of them with Bmode Plus
        </p>
      </div>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {PREMIUM_DECKS.map((deck, position) => (
          <li key={deck.id} className="min-w-0">
            <LockedDeck deck={deck} position={position} onOpen={() => open(deck)} />
          </li>
        ))}
      </ul>
      {sheet}
    </section>
  );
}

/** A compact list of the locked decks in the host's question picker. */
export function PremiumPickerList() {
  const { open, sheet } = usePremiumSheet("picker");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-stage-muted">Premium decks</span>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PREMIUM_DECKS.map((deck) => (
          <li key={deck.id}>
            <button
              type="button"
              onClick={() => open(deck)}
              className="flex w-full items-center gap-3 rounded-xl border border-stage-line bg-stage-2 px-3 py-2.5 text-left hover:border-white/30"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Icon name="lock" className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-white">{deck.name}</span>
                <span className="block truncate text-xs text-stage-muted">{deck.blurb}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-gold">{PREMIUM_PRICE}</span>
            </button>
          </li>
        ))}
      </ul>
      {sheet}
    </div>
  );
}

// A deck lying face down with its lock showing, the teaser card peeking
// out on top.
function LockedDeck({ deck, position, onOpen }: { deck: PremiumDeck; position: number; onOpen: () => void }) {
  return (
    <article
      className="animate-deal-in flex flex-col gap-5"
      style={{ animationDelay: `${position * 90}ms` } as CSSProperties}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${deck.name}, a premium deck, ${PREMIUM_PRICE}. Locked.`}
        className="group relative block h-60 w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-stage"
      >
        <span
          aria-hidden
          className="card-back-pattern absolute inset-0 translate-x-2.5 translate-y-2 rotate-[4deg] rounded-2xl ring-1 ring-white/15 transition-transform duration-300 group-hover:translate-x-5 group-hover:rotate-[8deg]"
        />
        <span className="card-back-pattern absolute inset-0 flex flex-col justify-between rounded-2xl p-5 text-white shadow-[0_12px_32px_rgb(0_0_0/45%)] ring-1 ring-gold/40 transition-transform duration-300 group-hover:-translate-y-2 group-hover:-rotate-1">
          <span className="flex items-center justify-between">
            <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">Premium</span>
            <Icon name="lock" className="h-5 w-5 text-gold" />
          </span>
          <span className="font-card text-lg leading-snug font-extrabold tracking-tight">{deck.teaser}</span>
          <span className="text-xs text-white/60">1 of {deck.cardCount} cards</span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight font-bold text-ink">{deck.name}</h3>
          <p className="truncate text-sm text-ink-soft">{deck.blurb}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          tabIndex={-1}
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-stage-button px-3 py-2 text-sm font-semibold text-ink hover:bg-stage-button-hover"
        >
          <Icon name="lock" className="h-3.5 w-3.5" />
          {PREMIUM_PRICE}
        </button>
      </div>
    </article>
  );
}

function PremiumDeckSheet({
  deck,
  place,
  alreadyOnList,
  onClose,
}: {
  deck: PremiumDeck | null;
  place: PremiumPlace;
  alreadyOnList: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">(alreadyOnList ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  // A native <dialog>, like the QR code modal: focus trapping, Escape and
  // the backdrop for free. It opens whenever a deck is picked.
  useEffect(() => {
    if (deck && !dialog.current?.open) dialog.current?.showModal();
  }, [deck]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!deck) return;
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
        source: "premium_deck",
        consentText: PREMIUM_CONSENT_TEXT,
        deviceId: getDeviceId(),
      });
      record("email", place, deck.id);
      try {
        window.localStorage.setItem(STORAGE_KEY, "yes");
      } catch {
        // Storage blocked: they'd just be asked again next time.
      }
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Couldn't add you just now. Try again in a moment.");
    }
  }

  // Portalled to <body>: the picker sits inside the Circle form, and this
  // sheet has a form of its own, which can't nest inside another.
  if (!deck) return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-label={`${deck.name}, premium deck`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-stage-line bg-stage-2 p-0 text-white shadow-[0_24px_64px_rgb(0_0_0/60%)] backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
              <Icon name="lock" className="h-3 w-3" />
              Premium deck
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold">{deck.name}</h2>
            <p className="text-sm text-stage-muted">
              {deck.blurb} · {deck.cardCount} cards
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="rounded-lg p-1.5 text-stage-muted hover:bg-stage-hover hover:text-white"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <p className="card-back-pattern rounded-xl p-4 font-card text-lg leading-snug font-extrabold tracking-tight ring-1 ring-gold/40">
          {deck.teaser}
        </p>

        <p className="text-sm text-stage-text">
          <span className="font-semibold text-white">{PREMIUM_PRICE}</span> for this deck, or every premium deck
          with <span className="font-semibold text-white">Bmode Plus</span> for {PLUS_PRICE}.
        </p>

        {status === "done" ? (
          <p role="status" className="rounded-xl bg-rail p-4 text-sm text-white">
            You&apos;re on the early-access list. We&apos;ll email you when premium decks are ready, with your first
            deck free.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded-xl bg-rail p-4">
            <p className="text-sm text-white">
              Premium decks aren&apos;t ready yet. Leave your email for early access, and your first deck is free.
            </p>
            <label htmlFor={`premium-email-${place}`} className="sr-only">
              Your email
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={`premium-email-${place}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                maxLength={200}
                className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-[10px] bg-spotlight px-5 py-2.5 font-medium text-spotlight-ink disabled:opacity-60"
              >
                {status === "sending" ? "Adding…" : "Get early access"}
              </button>
            </div>
            {error && <p className="text-sm text-ember">{error}</p>}
            <p className="text-xs text-stage-muted">{PREMIUM_CONSENT_TEXT}</p>
          </form>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
