import type { CSSProperties } from "react";
import { CIRCLE_QUESTIONS } from "../game/circle-questions";
import { cardCategory, type CardCategoryId } from "./library";

// The card stock each kind of question is printed on. Every category has
// its own rich colour and a faint pattern, so a spread of cards looks
// varied but still reads as one deck: same type, same white ink, same
// layout. Both gradient stops keep white text above WCAG AA for the large
// question type, and the darker stop sits under the small labels.
//
// These are plain hex values (not Tailwind tokens) because the link
// preview images in lib/cards/og-image.tsx draw the same stock.

export interface CardStock {
  light: string; // top-left of the gradient
  dark: string; // bottom-right of the gradient
  tint: string; // the category colour lifted for text on the indigo page
  pattern: string; // CSS background-image layers drawn over the gradient
  patternSize: string;
}

const INK = "rgb(255 255 255 / 9%)";
const INK_FAINT = "rgb(255 255 255 / 5%)";

export const CARD_STOCK: Record<CardCategoryId, CardStock> = {
  // Cobalt with a dot grid: light and open.
  icebreakers: {
    light: "#2F5BE0",
    dark: "#16287A",
    tint: "#93B0FF",
    pattern: `radial-gradient(circle, ${INK} 1.5px, transparent 2px)`,
    patternSize: "18px 18px",
  },
  // Rose with rings rippling out from a corner.
  relationships: {
    light: "#D02A6C",
    dark: "#6B0E3B",
    tint: "#FF8DBC",
    pattern: `repeating-radial-gradient(circle at 100% 100%, transparent 0 22px, ${INK} 22px 24px)`,
    patternSize: "auto",
  },
  // Burnt orange with soft diagonal stripes.
  friendships: {
    light: "#C94D16",
    dark: "#7C2A0A",
    tint: "#FFAE7F",
    pattern: `repeating-linear-gradient(-45deg, ${INK_FAINT} 0 10px, transparent 10px 20px)`,
    patternSize: "auto",
  },
  // Midnight teal with scattered specks, like a night sky.
  deep: {
    light: "#0F6273",
    dark: "#05232C",
    tint: "#6CD3E2",
    pattern: [
      `radial-gradient(circle at 20% 30%, ${INK} 1.5px, transparent 2px)`,
      `radial-gradient(circle at 70% 65%, ${INK} 1px, transparent 1.5px)`,
      `radial-gradient(circle at 45% 85%, ${INK_FAINT} 1.5px, transparent 2px)`,
    ].join(", "),
    patternSize: "64px 64px",
  },
  // Electric violet with a checker: the loud one.
  fun: {
    light: "#7A3BE6",
    dark: "#35128A",
    tint: "#C2A4FF",
    pattern: `conic-gradient(${INK_FAINT} 25%, transparent 0 50%, ${INK_FAINT} 0 75%, transparent 0)`,
    patternSize: "28px 28px",
  },
};

// Inline style for a card face printed on this stock.
export function cardStockStyle(id: CardCategoryId): CSSProperties {
  const stock = CARD_STOCK[id];
  return {
    backgroundColor: stock.dark,
    backgroundImage: `${stock.pattern}, linear-gradient(135deg, ${stock.light}, ${stock.dark})`,
    backgroundSize: `${stock.patternSize}, 100% 100%`,
  };
}

const CATEGORY_BY_TEXT = new Map(CIRCLE_QUESTIONS.map((question) => [question.text, cardCategory(question).id]));

// The stock for a question met outside the library (a game, the landing
// decks, a recap). Bank questions use their category; questions a host
// wrote themselves go by how deep they are.
export function stockForQuestion(text: string, depth?: number): CardCategoryId {
  return CATEGORY_BY_TEXT.get(text) ?? (depth && depth >= 2 ? "deep" : "icebreakers");
}
