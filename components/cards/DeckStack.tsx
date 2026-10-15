import Link from "next/link";
import type { CSSProperties } from "react";
import Icon from "@/components/shared/Icon";
import { cardStockStyle } from "@/lib/cards/card-stock";
import { deckPlayPath, type Deck } from "@/lib/cards/decks";
import { cardCategory } from "@/lib/cards/library";
import CardFace, { CATEGORY_STYLES } from "./CardFace";

// Spread a little further when the deck is hovered, as if about to be
// picked up. Two cards peek out under the top one.
const UNDER = [
  "translate-x-2.5 translate-y-2 rotate-[4deg] group-hover:translate-x-5 group-hover:rotate-[8deg]",
  "-translate-x-2 translate-y-3 -rotate-[3deg] group-hover:-translate-x-4 group-hover:-rotate-[6deg]",
];

export function deckIcon(deck: Deck) {
  return deck.id === "all" ? "layers" : CATEGORY_STYLES[deck.id].icon;
}

export function deckChip(deck: Deck) {
  return deck.id === "all" ? "bg-blurple/25 text-blurple-soft" : CATEGORY_STYLES[deck.id].chip;
}

// One deck on the library page: its cards stacked face up with the first
// question on top (the mixed deck lies face down). Tapping it opens the
// deck to swipe through.
export default function DeckStack({ deck, position, onOpen }: { deck: Deck; position: number; onOpen: () => void }) {
  const [top, ...rest] = deck.cards;
  const under = rest.slice(0, UNDER.length);
  return (
    <article
      className="animate-deal-in flex flex-col gap-5"
      style={{ animationDelay: `${position * 90}ms` } as CSSProperties}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open the ${deck.name} deck, ${deck.cards.length} cards`}
        className="group relative block h-60 w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-blurple focus-visible:ring-offset-4 focus-visible:ring-offset-stage"
      >
        {under
          .map((card, i) => (
            <span
              key={card.id}
              aria-hidden
              style={cardStockStyle(cardCategory(card).id)}
              className={`absolute inset-0 overflow-hidden rounded-2xl shadow-[0_10px_24px_rgb(0_0_0/40%)] ring-1 ring-white/15 transition-transform duration-300 ${UNDER[i]}`}
            >
              <span className="absolute inset-0 bg-black/30" />
            </span>
          ))
          .reverse()}
        <span className="absolute inset-0 transition-transform duration-300 group-hover:-translate-y-2 group-hover:-rotate-1">
          {deck.id === "all" ? (
            // The mixed deck shows its back: it holds every colour at once.
            <span className="card-back-pattern flex h-full flex-col items-center justify-center gap-3 rounded-2xl text-white shadow-[0_12px_32px_rgb(0_0_0/45%)] ring-1 ring-white/20">
              <span aria-hidden className="h-6 w-6 rotate-45 rounded-[4px] bg-blurple" />
              <span className="font-card text-lg font-extrabold tracking-tight">Every deck in one</span>
            </span>
          ) : (
            <CardFace text={top.text} category={cardCategory(top)} size="sm" className="h-full" />
          )}
        </span>
      </button>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${deckChip(deck)}`}>
            <Icon name={deckIcon(deck)} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl leading-tight font-bold text-ink">{deck.name}</h2>
            <p className="truncate text-sm text-ink-soft">
              <span className="tabular-nums">{deck.cards.length}</span> cards
              <span className="text-ink-faint"> · </span>
              {deck.blurb}
            </p>
          </div>
        </div>
        <Link
          href={deckPlayPath(deck.cards)}
          aria-label={`Play the ${deck.name} deck`}
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-stage-button px-3 py-2 text-sm font-semibold text-ink hover:bg-stage-button-hover"
        >
          <Icon name="play" filled className="h-3 w-3" />
          Play
        </Link>
      </div>
    </article>
  );
}
