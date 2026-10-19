import type { PremiumInterestRow, PremiumPlace } from "../backend/types";

// Premium decks, shown locked as a fake-door test: they look buyable, but
// tapping one only asks for an email to get early access. What people tap
// tells us whether anyone would pay before payments are built. Only the
// teaser question is written; the rest of each deck doesn't exist yet.

export type PremiumDeckId = "after-dark" | "miles-apart" | "no-small-talk" | "birthday-night";

export interface PremiumDeck {
  id: PremiumDeckId;
  name: string;
  blurb: string;
  teaser: string;
  cardCount: number;
}

export const PREMIUM_PRICE = "$3.99";
export const PLUS_PRICE = "$24.99 a year";

export const PREMIUM_DECKS: readonly PremiumDeck[] = [
  {
    id: "after-dark",
    name: "After Dark",
    blurb: "For couples, a little spicier",
    teaser: "What's a moment between us you still replay in your head?",
    cardCount: 30,
  },
  {
    id: "no-small-talk",
    name: "No Small Talk",
    blurb: "The deepest questions for close friends",
    teaser: "What's something you've never told me because you thought I'd see you differently?",
    cardCount: 30,
  },
  {
    id: "miles-apart",
    name: "Miles Apart",
    blurb: "For long-distance friends and partners",
    teaser: "What would our perfect ordinary Tuesday look like if we lived in the same city?",
    cardCount: 30,
  },
  {
    id: "birthday-night",
    name: "Birthday Night",
    blurb: "A whole game about one person",
    teaser: "What's the bravest thing the birthday person did this year?",
    cardCount: 30,
  },
];

const PREMIUM_BY_ID = new Map(PREMIUM_DECKS.map((deck) => [deck.id, deck]));

export function premiumDeckById(id: string): PremiumDeck | undefined {
  return PREMIUM_BY_ID.get(id as PremiumDeckId);
}

export interface PremiumPlaceStats {
  viewers: number; // distinct browsers that saw the locked decks
  tappers: number; // distinct browsers that tapped any locked deck
  emails: number; // distinct browsers that left an email
}

export interface PremiumDeckStats {
  id: PremiumDeckId;
  name: string;
  tappers: number;
  emails: number;
}

export interface PremiumInterestSummary {
  places: Record<PremiumPlace, PremiumPlaceStats>;
  total: PremiumPlaceStats;
  decks: PremiumDeckStats[];
}

// Everything counts distinct browsers, so someone tapping the same deck
// five times counts once.
export function summarizePremiumInterest(rows: readonly PremiumInterestRow[]): PremiumInterestSummary {
  const distinct = (filter: (row: PremiumInterestRow) => boolean) =>
    new Set(rows.filter(filter).map((row) => row.deviceId)).size;
  const stats = (place: PremiumPlace | null): PremiumPlaceStats => {
    const here = (row: PremiumInterestRow) => place === null || row.place === place;
    return {
      viewers: distinct((row) => here(row) && row.action === "view"),
      tappers: distinct((row) => here(row) && row.action === "tap"),
      emails: distinct((row) => here(row) && row.action === "email"),
    };
  };
  return {
    places: { cards: stats("cards"), picker: stats("picker") },
    total: stats(null),
    decks: PREMIUM_DECKS.map((deck) => ({
      id: deck.id,
      name: deck.name,
      tappers: distinct((row) => row.deckId === deck.id && row.action === "tap"),
      emails: distinct((row) => row.deckId === deck.id && row.action === "email"),
    })),
  };
}

/** Share of viewers who tapped, as a whole percent, or null with no viewers. */
export function tapRate(stats: PremiumPlaceStats): number | null {
  return stats.viewers === 0 ? null : Math.round((stats.tappers / stats.viewers) * 100);
}
