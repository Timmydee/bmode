import type { BankQuestion } from "../game/circle-questions";
import { CARD_CATEGORIES, cardsInCategory, parseCategory, playPath, type CardCategoryId } from "./library";

// The card library shown as decks: one stacked deck per category, plus one
// with every card mixed together. A deck is opened and swiped through one
// card at a time.

export type DeckId = CardCategoryId | "all";

export interface Deck {
  id: DeckId;
  name: string;
  blurb: string;
  cards: readonly BankQuestion[];
}

export const DECKS: readonly Deck[] = [
  ...CARD_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    blurb: category.blurb,
    cards: cardsInCategory(category.id),
  })),
  { id: "all", name: "All cards", blurb: "Every card, mixed together", cards: cardsInCategory(null) },
];

const DECK_BY_ID = new Map(DECKS.map((deck) => [deck.id, deck]));

export function deckById(id: DeckId): Deck {
  return DECK_BY_ID.get(id)!;
}

export function parseDeck(value: string | null | undefined): DeckId | null {
  return value === "all" ? "all" : parseCategory(value);
}

// Where a deck lives in the address bar: /cards?category=fun, plus &card=
// for the card on top, so a refresh or a shared link opens the same card.
export function deckPath(id: DeckId, cardId?: number): string {
  return `/cards?category=${id}${cardId ? `&card=${cardId}` : ""}`;
}

// "Play this deck" starts a game with the next few cards from the one on
// top, so the game plays the cards you were looking at.
export const DECK_PLAY_CARDS = 10;

export function deckPlayPath(cards: readonly BankQuestion[], from = 0): string {
  const count = Math.min(DECK_PLAY_CARDS, cards.length);
  const ids = Array.from({ length: count }, (_, i) => cards[(from + i) % cards.length].id);
  return playPath(ids);
}
