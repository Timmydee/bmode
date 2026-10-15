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
      <h1 className="mb-6 font-display text-[2.6rem] font-bold leading-[1.02] text-ink sm:max-w-[16ch] sm:text-6xl">
        A question game for friends, couples, and groups.
      </h1>
      <p className="mb-10 max-w-[46ch] text-lg text-ink-soft">
        Discover fun, deep, and thought-provoking questions. Join a game on
        your phone, answer questions, and reveal everyone&apos;s answers
        together. No app download needed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/host?new=1"
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Start a game
        </Link>
        <Link
          href="/cards"
          className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-ink px-5 py-2.75 font-medium text-ink"
        >
          <Icon name="layers" className="h-4 w-4" />
          Browse question cards
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        Got a code from a friend?{" "}
        <Link href="/join" className="font-semibold text-ink underline underline-offset-4">
          Join a game
        </Link>
      </p>
      <p className="mt-10 flex items-center gap-2 font-display text-base font-semibold text-ink-soft">
        <Icon name="heart" className="h-4 w-4 text-spotlight" />
        Helping people connect through better questions.
      </p>
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
