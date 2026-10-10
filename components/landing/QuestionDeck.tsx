"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { FlipCard, QuestionCard } from "@/components/circle/Cards";
import Icon, { type IconName } from "@/components/shared/Icon";
import type { QuestionDeck as Deck } from "@/lib/game/question-decks";

const STYLES: Record<Deck["id"], { icon: IconName; chip: string; dot: string }> = {
  relationship: { icon: "heart", chip: "bg-fuchsia/15 text-fuchsia", dot: "bg-fuchsia" },
  friendship: { icon: "smile", chip: "bg-gold/15 text-gold", dot: "bg-gold" },
  tribe: { icon: "flame", chip: "bg-blurple/20 text-blurple-soft", dot: "bg-blurple" },
};

// Decks deal in one after another, then each turns over a new card every
// few seconds, staggered so the three never flip at the same moment.
const DEAL_STAGGER_MS = 150;
const FIRST_DRAW_MS = 3200;
const DRAW_STAGGER_MS = 1400;
const DRAW_EVERY_MS = 4200;
const TOSS_MS = 450;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// One sample deck on the landing page: a stack of black cards showing a
// real question. Tapping the card (or waiting) tosses it aside and turns
// over the next one.
export default function QuestionDeck({ deck, position }: { deck: Deck; position: number }) {
  const style = STYLES[deck.id];
  const [state, setState] = useState<{ index: number; draws: number; tossed: number | null }>({
    index: 0,
    draws: 0,
    tossed: null,
  });
  // Hovering or focusing the deck holds the current card; tapping it hands
  // control to the viewer for good.
  const [held, setHeld] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  const draw = useCallback(() => {
    setState((current) => ({
      index: (current.index + 1) % deck.questions.length,
      draws: current.draws + 1,
      tossed: current.index,
    }));
  }, [deck.questions.length]);

  useEffect(() => {
    if (!autoplay || held || prefersReducedMotion()) return;
    const wait = state.draws === 0 ? FIRST_DRAW_MS + position * DRAW_STAGGER_MS : DRAW_EVERY_MS;
    const timer = setTimeout(draw, wait);
    return () => clearTimeout(timer);
  }, [autoplay, held, state.draws, position, draw]);

  useEffect(() => {
    if (state.tossed === null) return;
    const timer = setTimeout(() => setState((current) => ({ ...current, tossed: null })), TOSS_MS);
    return () => clearTimeout(timer);
  }, [state.draws, state.tossed]);

  const question = deck.questions[state.index];
  const tossed = state.tossed === null ? null : deck.questions[state.tossed];

  return (
    <article
      className="animate-deal-in flex flex-col gap-5"
      style={{ animationDelay: `${position * DEAL_STAGGER_MS}ms` } as CSSProperties}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon name={style.icon} className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-xl font-bold text-ink">{deck.name}</h3>
          <p className="text-sm text-ink-soft">{deck.tagline}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setAutoplay(false);
          draw();
        }}
        aria-label={`${deck.name} question: ${question.text} Show another`}
        className="group relative h-64 w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-blurple focus-visible:ring-offset-4 focus-visible:ring-offset-stage"
      >
        {/* The rest of the deck, peeking out under the top card. */}
        <span aria-hidden className="card-back-pattern absolute inset-0 translate-x-2 translate-y-3 rotate-3 rounded-2xl ring-1 ring-white/10" />
        <span aria-hidden className="card-back-pattern absolute inset-0 -translate-x-1 translate-y-1.5 -rotate-2 rounded-2xl ring-1 ring-white/10" />
        <span className="absolute inset-0 transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:-rotate-1">
          <FlipCard
            key={state.draws}
            delayMs={state.draws === 0 ? 350 + position * DEAL_STAGGER_MS : 0}
          >
            <QuestionCard text={question.text} depth={question.depth} className="card-face h-full" />
          </FlipCard>
        </span>
        {tossed && (
          <span aria-hidden className="animate-card-toss pointer-events-none absolute inset-0">
            <QuestionCard text={tossed.text} depth={tossed.depth} className="h-full" />
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-4">
        <span aria-hidden className="flex items-center gap-1.5">
          {deck.questions.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === state.index ? `w-5 ${style.dot}` : "w-1.5 bg-stage-line"
              }`}
            />
          ))}
        </span>
        <Link
          href={`/host?vibe=${deck.vibe}`}
          aria-label={`Play the ${deck.name} deck`}
          className="inline-flex items-center gap-2 rounded-[10px] bg-stage-button px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-stage-button-hover"
        >
          Play this deck
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
