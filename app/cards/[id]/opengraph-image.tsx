import { cardById, cardCategory } from "@/lib/cards/library";
import { OG_SIZE, renderCardImage } from "@/lib/cards/og-image";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";

export const alt = "A question card from Bmode";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return CIRCLE_QUESTIONS.map((card) => ({ id: String(card.id) }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const card = cardById(Number((await params).id));
  if (!card) return renderCardImage({ text: "Helping people connect through better questions", label: "Bmode", stock: "icebreakers" });
  const category = cardCategory(card);
  return renderCardImage({ text: card.text, label: category.name, stock: category.id });
}
