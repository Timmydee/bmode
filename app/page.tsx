import Link from "next/link";
import QuestionDeck from "@/components/landing/QuestionDeck";
import { QUESTION_DECKS } from "@/lib/game/question-decks";

export default function Home() {
  return (
    // overflow-x-clip: a tossed card flies past the edge of the screen
    // without making the page scroll sideways.
    <div className="mx-auto w-full max-w-6xl overflow-x-clip px-6 py-12 sm:px-10 sm:py-20">
      <p className="mb-3 text-sm text-ink-soft">Bmode</p>
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
      </section>
    </div>
  );
}
