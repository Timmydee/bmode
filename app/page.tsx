import type { Metadata } from "next";
import Link from "next/link";
import BetaNote from "@/components/landing/BetaNote";
import QuestionDeck from "@/components/landing/QuestionDeck";
import Icon from "@/components/shared/Icon";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";
import { QUESTION_DECKS } from "@/lib/game/question-decks";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    // overflow-x-clip: a tossed card flies past the edge of the screen
    // without making the page scroll sideways.
    <div className="mx-auto w-full max-w-6xl overflow-x-clip px-6 py-12 sm:px-10 sm:py-20">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          Bmode
          <span className="rounded-full border border-spotlight/50 bg-spotlight/25 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase leading-none tracking-[0.08em] text-ink">
            Beta
          </span>
        </p>
        <nav aria-label="Main">
          <Link
            href="/cards"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-stage-2 hover:text-ink"
          >
            <Icon name="layers" className="h-4 w-4" />
            Cards
          </Link>
        </nav>
      </div>
      <h1 className="mb-6 font-display text-[2.6rem] font-bold leading-[1.02] text-ink sm:max-w-[13ch] sm:text-6xl lg:max-w-[20ch]">
        Helping people connect through better questions
      </h1>
      <p className="mb-10 max-w-[40ch] text-lg text-ink-soft">
        Everyone answers on their own phone, then the cards flip together. No
        app needed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/host"
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Host a session
        </Link>
        <Link
          href="/join"
          className="rounded-[10px] border-[1.5px] border-ink px-5 py-2.75 font-medium text-ink"
        >
          Join with a code
        </Link>
      </div>
      <Link
        href="/cards"
        className="group mt-8 flex max-w-md items-center gap-4 rounded-2xl border border-stage-line bg-stage-2 p-4 transition-colors hover:bg-stage-hover"
      >
        <span aria-hidden className="relative h-14 w-11 shrink-0">
          <span className="card-back-pattern absolute inset-0 rotate-6 rounded-lg ring-1 ring-white/10" />
          <span className="absolute inset-0 flex -rotate-3 items-end p-1.5 rounded-lg bg-card-black ring-1 ring-white/20 transition-transform group-hover:-rotate-6">
            <span className="h-2 w-2 rotate-45 rounded-[2px] bg-blurple" />
          </span>
        </span>
        <span className="flex-1">
          <span className="block font-display font-bold text-ink">Just want some good questions?</span>
          <span className="block text-sm text-ink-soft">
            Browse {CIRCLE_QUESTIONS.length} question cards and share them. No game needed.
          </span>
        </span>
        <Icon name="arrow-right" className="h-5 w-5 text-ink-soft transition-transform group-hover:translate-x-1" />
      </Link>
      <BetaNote />

      <section aria-labelledby="decks-heading" className="mt-16 sm:mt-20">
        <h2 id="decks-heading" className="font-display text-3xl font-bold text-ink">
          Pick a deck
        </h2>
        <p className="mt-2 mb-10 text-ink-soft">Tap a card to see another question.</p>
        <div className="grid max-w-md gap-14 lg:max-w-none lg:grid-cols-3 lg:gap-10">
          {QUESTION_DECKS.map((deck, position) => (
            <QuestionDeck key={deck.id} deck={deck} position={position} />
          ))}
        </div>
        <Link
          href="/cards"
          className="mt-12 inline-flex items-center gap-2 rounded-[10px] bg-stage-button px-5 py-2.75 font-medium text-ink hover:bg-stage-button-hover"
        >
          See all {CIRCLE_QUESTIONS.length} question cards
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
