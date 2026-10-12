import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlipCard } from "@/components/circle/Cards";
import CardActions from "@/components/cards/CardActions";
import CardFace, { CATEGORY_STYLES } from "@/components/cards/CardFace";
import CardsHeader from "@/components/cards/CardsHeader";
import Icon from "@/components/shared/Icon";
import { cardById, cardCategory, cardPath, cardsInCategory } from "@/lib/cards/library";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";

// One question card on its own page, the page a shared card link opens.
// Every card is built ahead of time; unknown ids are a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return CIRCLE_QUESTIONS.map((card) => ({ id: String(card.id) }));
}

function load(id: string) {
  return /^\d+$/.test(id) ? cardById(Number(id)) : null;
}

export async function generateMetadata(props: PageProps<"/cards/[id]">): Promise<Metadata> {
  const card = load((await props.params).id);
  if (!card) return {};
  const category = cardCategory(card);
  const description = `Then ask: ${card.followUp} One of the ${category.name.toLowerCase()} question cards on Bmode.`;
  return {
    title: card.text,
    description,
    alternates: { canonical: cardPath(card.id) },
    openGraph: { type: "article", title: card.text, description, url: cardPath(card.id) },
    twitter: { title: card.text, description },
  };
}

export default async function CardPage(props: PageProps<"/cards/[id]">) {
  const card = load((await props.params).id);
  if (!card) notFound();
  const category = cardCategory(card);
  const style = CATEGORY_STYLES[category.id];
  const more = cardsInCategory(category.id).filter((other) => other.id !== card.id);
  // A stable handful of neighbours, so the page is the same on every build.
  const start = more.findIndex((other) => other.id > card.id);
  const related = [...more.slice(Math.max(start, 0)), ...more.slice(0, Math.max(start, 0))].slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-10 sm:py-10">
      <CardsHeader />
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <Link
          href={`/cards?category=${category.id}`}
          className={`flex w-max items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${style.chip}`}
        >
          <Icon name={style.icon} className="h-4 w-4" />
          {category.name}
        </Link>
        <h1 className="sr-only">{card.text}</h1>
        <FlipCard delayMs={250}>
          <CardFace text={card.text} category={category} size="lg" className="card-face h-full" />
        </FlipCard>
        <p className="px-1 text-lg text-ink-soft">
          <span className="font-semibold text-ink">Then ask: </span>
          {card.followUp}
        </p>
        <CardActions id={card.id} text={card.text} />

        <section className="mt-6 rounded-2xl bg-stage-2 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-xl font-bold text-ink">Make it a game</h2>
          <p className="text-ink-soft">
            On Bmode everyone answers on their own phone, then the cards flip together. No app, no sign-up for players.
          </p>
        </section>
      </div>

      <section className="mx-auto mt-14 max-w-6xl pb-24">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-ink">More {category.name.toLowerCase()}</h2>
          <Link href="/cards" className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
            All cards
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {related.map((other) => (
            <li key={other.id}>
              <Link
                href={cardPath(other.id)}
                className="block h-full rounded-2xl transition-transform hover:-translate-y-1"
              >
                <CardFace text={other.text} category={category} size="sm" className="h-full" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
