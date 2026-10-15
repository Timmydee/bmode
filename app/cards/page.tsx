import type { Metadata } from "next";
import CardLibrary from "@/components/cards/CardLibrary";
import CardsHeader from "@/components/cards/CardsHeader";
import { parseDeck } from "@/lib/cards/decks";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";

export const metadata: Metadata = {
  title: "Question cards",
  description: `Browse ${CIRCLE_QUESTIONS.length} conversation questions for couples, friends and groups: icebreakers, deep questions and fun challenges. Share a card or a whole collection, no sign-up.`,
  alternates: { canonical: "/cards" },
};

export default async function CardsPage(props: PageProps<"/cards">) {
  const { category, card } = await props.searchParams;
  const deck = parseDeck(typeof category === "string" ? category : null);
  const cardId = Number(card);
  const initialOpen = deck ? { deck, card: Number.isInteger(cardId) && cardId > 0 ? cardId : undefined } : null;
  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-clip px-4 py-6 sm:px-10 sm:py-10">
      <CardsHeader />
      <h1 className="mb-3 font-display text-[2.4rem] leading-[1.05] font-bold text-ink sm:text-5xl">Question cards</h1>
      <p className="mb-8 max-w-[52ch] text-lg text-ink-soft">
        Pick a deck and swipe through it. Send a card to a friend, or collect a few and turn them into a game.
      </p>
      <CardLibrary initialOpen={initialOpen} />
    </div>
  );
}
