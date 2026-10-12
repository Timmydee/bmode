import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CardFace from "@/components/cards/CardFace";
import CardsHeader from "@/components/cards/CardsHeader";
import CollectionActions from "@/components/cards/CollectionActions";
import { FlipCard } from "@/components/circle/Cards";
import { cardCategory, cardPath, collectionCards, collectionPath } from "@/lib/cards/library";

// A shared collection: the cards someone picked, in their order. The link
// itself carries the card ids, so nothing is stored anywhere.
function heading(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"} to ask each other`;
}

export async function generateMetadata(props: PageProps<"/cards/set/[ids]">): Promise<Metadata> {
  const cards = collectionCards((await props.params).ids);
  if (cards.length === 0) return {};
  const title = heading(cards.length);
  const description = `A Bmode collection, starting with: ${cards[0].text}`;
  return {
    title,
    description,
    alternates: { canonical: collectionPath(cards.map((card) => card.id)) },
    // Collections are made by visitors, so they stay out of search results;
    // the single card pages are what gets indexed.
    robots: { index: false, follow: true },
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function CollectionPage(props: PageProps<"/cards/set/[ids]">) {
  const cards = collectionCards((await props.params).ids);
  if (cards.length === 0) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-10 sm:py-10">
      <CardsHeader />
      <p className="mb-2 text-sm font-semibold tracking-wide text-blurple-soft uppercase">A Bmode collection</p>
      <h1 className="mb-3 font-display text-[2.2rem] leading-[1.05] font-bold text-ink sm:text-5xl">
        {heading(cards.length)}
      </h1>
      <p className="mb-8 max-w-[50ch] text-lg text-ink-soft">
        Ask them over dinner, on a walk, or play them as a game where everyone answers on their own phone.
      </p>
      <CollectionActions ids={cards.map((card) => card.id)} />

      <ol className="mt-10 grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <li key={card.id} className="flex flex-col gap-2">
            <span className="font-display text-sm font-bold text-ink-faint tabular-nums">{index + 1}</span>
            <Link href={cardPath(card.id)} className="block h-full rounded-2xl transition-transform hover:-translate-y-1">
              <FlipCard delayMs={150 + index * 90}>
                <CardFace text={card.text} category={cardCategory(card)} size="sm" className="card-face h-full" />
              </FlipCard>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
