import type { CircleVibe } from "../backend/types";
import { CIRCLE_QUESTIONS, type BankQuestion } from "../game/circle-questions";
import { CIRCLE_MAX_QUESTIONS } from "../game/validation";

// The question card library: every question in the bank as a card you can
// browse, share on its own, or gather into a collection. It reads the same
// bank the Circle game plays from, so a card always plays as it reads.

export type CardCategoryId = "icebreakers" | "relationships" | "friendships" | "deep" | "fun";

export interface CardCategory {
  id: CardCategoryId;
  name: string;
  blurb: string;
  // The Circle vibe that plays this kind of question best.
  vibe: CircleVibe;
}

export const CARD_CATEGORIES: readonly CardCategory[] = [
  { id: "icebreakers", name: "Icebreakers", blurb: "Easy openers for new faces", vibe: "know" },
  { id: "relationships", name: "Relationships", blurb: "For the two of you", vibe: "couples" },
  { id: "friendships", name: "Friendships", blurb: "For old friends catching up", vibe: "reconnect" },
  { id: "deep", name: "Deep conversations", blurb: "For people ready to open up", vibe: "deeper" },
  { id: "fun", name: "Fun challenges", blurb: "Quick, silly, a little competitive", vibe: "chill" },
];

const CATEGORY_BY_ID = new Map(CARD_CATEGORIES.map((category) => [category.id, category]));

export function cardCategory(question: BankQuestion): CardCategory {
  const id: CardCategoryId = question.couples
    ? "relationships"
    : question.reconnect
      ? "friendships"
      : question.fun
        ? "fun"
        : question.depth >= 2
          ? "deep"
          : "icebreakers";
  return CATEGORY_BY_ID.get(id)!;
}

export function parseCategory(value: string | null | undefined): CardCategoryId | null {
  return value && CATEGORY_BY_ID.has(value as CardCategoryId) ? (value as CardCategoryId) : null;
}

const CARD_BY_ID = new Map(CIRCLE_QUESTIONS.map((question) => [question.id, question]));

export function cardById(id: number): BankQuestion | null {
  return CARD_BY_ID.get(id) ?? null;
}

export function cardsInCategory(category: CardCategoryId | null): BankQuestion[] {
  return CIRCLE_QUESTIONS.filter((question) => !category || cardCategory(question).id === category);
}

// A collection is as long as the longest Circle game, so any collection
// can be played as it stands.
export const COLLECTION_MAX_CARDS = CIRCLE_MAX_QUESTIONS;

// Collections travel as their card ids in the link ("3-12-40"), so they
// need no account and no database. Unknown ids and repeats are dropped,
// order is kept, and anything past the cap is ignored.
export function encodeCollection(ids: readonly number[]): string {
  return parseCollection(ids.join("-")).join("-");
}

export function parseCollection(value: string | null | undefined): number[] {
  if (!value) return [];
  const seen = new Set<number>();
  for (const part of value.split(/[-,.\s]+/)) {
    if (!/^\d{1,4}$/.test(part)) continue;
    const id = Number(part);
    if (CARD_BY_ID.has(id)) seen.add(id);
    if (seen.size === COLLECTION_MAX_CARDS) break;
  }
  return [...seen];
}

export function collectionCards(value: string | null | undefined): BankQuestion[] {
  return parseCollection(value).map((id) => CARD_BY_ID.get(id)!);
}

// The vibe a game started from these cards should use: themed questions
// only ever play in their own vibe, so the most specific theme wins.
export function vibeForCards(cards: readonly BankQuestion[]): CircleVibe {
  if (cards.some((card) => card.couples)) return "couples";
  if (cards.some((card) => card.reconnect)) return "reconnect";
  const categories = new Set(cards.map((card) => cardCategory(card).id));
  if (categories.size === 1) return cardCategory(cards[0]).vibe;
  return "know";
}

export function cardPath(id: number): string {
  return `/cards/${id}`;
}

export function collectionPath(ids: readonly number[]): string {
  return `/cards/set/${encodeCollection(ids)}`;
}

// "Start a game" goes through the normal host flow; /host passes ?cards=
// on to the new session, where the Circle form opens with these cards.
export function playPath(ids: readonly number[]): string {
  const cards = parseCollection(ids.join("-"));
  return `/host?vibe=${vibeForCards(cards.map((id) => CARD_BY_ID.get(id)!))}&cards=${cards.join("-")}`;
}
