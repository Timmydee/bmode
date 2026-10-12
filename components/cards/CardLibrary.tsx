"use client";

import { useCallback, useMemo, useState } from "react";
import Icon from "@/components/shared/Icon";
import {
  CARD_CATEGORIES,
  cardCategory,
  cardsInCategory,
  type CardCategoryId,
} from "@/lib/cards/library";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";
import CardFace, { CATEGORY_STYLES } from "./CardFace";
import CardViewer from "./CardViewer";
import CollectionTray from "./CollectionTray";
import { useCollection } from "./collection-store";
import Toast, { useToast } from "./Toast";

// The card library: category tabs, a grid of every question card, a big
// viewer for one card, and the collection being built along the bottom.
export default function CardLibrary({ initialCategory }: { initialCategory: CardCategoryId | null }) {
  const [category, setCategory] = useState<CardCategoryId | null>(initialCategory);
  const [open, setOpen] = useState<number | null>(null);
  const [toast, showToast] = useToast();
  const collection = useCollection();
  const cards = useMemo(() => cardsInCategory(category), [category]);

  function pickCategory(next: CardCategoryId | null) {
    setCategory(next);
    setOpen(null);
    // Keep the tab in the address so a refresh or a shared link lands on it.
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("category", next);
    else url.searchParams.delete("category");
    window.history.replaceState(null, "", url);
  }

  function draw() {
    let next = Math.floor(Math.random() * cards.length);
    if (next === open && cards.length > 1) next = (next + 1) % cards.length;
    setOpen(next);
  }

  function toggle(id: number) {
    if (!collection.toggle(id)) showToast("A collection holds up to 20 cards");
  }

  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <CategoryTab label="All" count={CIRCLE_QUESTIONS.length} selected={category === null} onClick={() => pickCategory(null)} />
          {CARD_CATEGORIES.map((c) => (
            <CategoryTab
              key={c.id}
              label={c.name}
              icon={CATEGORY_STYLES[c.id].icon}
              iconClass={CATEGORY_STYLES[c.id].text}
              count={cardsInCategory(c.id).length}
              selected={category === c.id}
              onClick={() => pickCategory(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {category ? CARD_CATEGORIES.find((c) => c.id === category)?.blurb : "Every card in the deck"}. Tap a card to
          read it big, or tap <Icon name="plus" className="mx-0.5 h-3.5 w-3.5 align-[-2px]" /> to collect it.
        </p>
        <button
          type="button"
          onClick={draw}
          className="flex items-center gap-2 rounded-[10px] bg-stage-button px-4 py-2.5 text-sm font-semibold text-ink hover:bg-stage-button-hover"
        >
          <Icon name="shuffle" className="h-4 w-4" />
          Draw a random card
        </button>
      </div>

      <ul className="grid gap-4 pb-36 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => {
          const selected = collection.has(card.id);
          return (
            <li key={card.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={`Read: ${card.text}`}
                className="block h-full w-full rounded-2xl text-left outline-none transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-blurple focus-visible:ring-offset-4 focus-visible:ring-offset-stage"
              >
                <CardFace
                  text={card.text}
                  category={cardCategory(card)}
                  size="sm"
                  className={`h-full pr-14 ${selected ? "ring-2 ring-live" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => toggle(card.id)}
                aria-pressed={selected}
                aria-label={selected ? "Remove from collection" : "Add to collection"}
                className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blurple ${
                  selected ? "bg-live text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Icon name={selected ? "check" : "plus"} className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {open !== null && cards[open] && (
        <CardViewer cards={cards} index={open} onIndex={setOpen} onClose={close} onToast={showToast} />
      )}
      {open === null && <CollectionTray onToast={showToast} />}
      <Toast message={toast} />
    </>
  );
}

function CategoryTab({
  label,
  count,
  selected,
  onClick,
  icon,
  iconClass = "",
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  icon?: Parameters<typeof Icon>[0]["name"];
  iconClass?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blurple ${
        selected ? "bg-ink text-stage" : "bg-stage-2 text-stage-text hover:bg-stage-hover"
      }`}
    >
      {icon && <Icon name={icon} className={`h-4 w-4 ${selected ? "" : iconClass}`} />}
      {label}
      <span className={`tabular-nums ${selected ? "text-stage/60" : "text-ink-faint"}`}>{count}</span>
    </button>
  );
}
