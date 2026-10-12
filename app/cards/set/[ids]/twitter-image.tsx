import { cardCategory, collectionCards } from "@/lib/cards/library";
import { OG_SIZE, renderCardImage } from "@/lib/cards/og-image";

export const alt = "A collection of question cards from Bmode";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ ids: string }> }) {
  const cards = collectionCards((await params).ids);
  if (cards.length === 0) return renderCardImage({ text: "Helping people connect through better questions", label: "Bmode", stock: "icebreakers" });
  const [first, ...rest] = cards.map(cardCategory);
  return renderCardImage({
    text: cards[0].text,
    label: first.name,
    stock: first.id,
    more: rest.length,
    behind: rest.slice(0, 2).map((category) => category.id),
  });
}
