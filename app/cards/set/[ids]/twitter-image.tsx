import { cardCategory, collectionCards } from "@/lib/cards/library";
import { OG_SIZE, renderCardImage } from "@/lib/cards/og-image";

export const alt = "A collection of question cards from Bmode";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ ids: string }> }) {
  const cards = collectionCards((await params).ids);
  if (cards.length === 0) return renderCardImage({ text: "Helping people connect through better questions", label: "Bmode" });
  return renderCardImage({ text: cards[0].text, label: cardCategory(cards[0]).name, more: cards.length - 1 });
}
