"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FlipCard } from "@/components/circle/Cards";
import Icon from "@/components/shared/Icon";
import { cardCategory, cardPath } from "@/lib/cards/library";
import type { BankQuestion } from "@/lib/game/circle-questions";
import CardFace from "./CardFace";
import { useCollection } from "./collection-store";
import { shareLink, shareMessage } from "./share";

// One card, big, over the library: it turns over when it opens, and the
// arrows (or arrow keys) step through the cards in the current category.
export default function CardViewer({
  cards,
  index,
  onIndex,
  onClose,
  onToast,
}: {
  cards: readonly BankQuestion[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onToast: (message: string | null) => void;
}) {
  const card = cards[index];
  const category = cardCategory(card);
  const collection = useCollection();
  const inCollection = collection.has(card.id);
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = (by: -1 | 1) => onIndex((index + by + cards.length) % cards.length);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % cards.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + cards.length) % cards.length);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, cards.length, onIndex, onClose]);

  async function share() {
    const result = await shareLink({
      title: "A question from Bmode",
      text: card.text,
      path: cardPath(card.id),
    });
    onToast(shareMessage(result));
  }

  function toggle() {
    if (!collection.toggle(card.id)) onToast("A collection holds up to 20 cards");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Question card"
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-floating/95 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <p className="text-sm text-ink-soft tabular-nums">
          {index + 1} of {cards.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-stage-2 text-ink outline-none hover:bg-stage-hover focus-visible:ring-2 focus-visible:ring-blurple"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <div
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-4 py-4 sm:px-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div>
          <FlipCard key={card.id}>
            <CardFace text={card.text} category={category} size="lg" className="card-face h-full" />
          </FlipCard>
        </div>
        <p className="px-1 text-ink-soft">
          <span className="font-semibold text-ink">Then ask: </span>
          {card.followUp}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-6 sm:px-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-spotlight px-4 py-3 font-semibold text-spotlight-ink hover:bg-spotlight-hover"
          >
            <Icon name="share" className="h-4 w-4" />
            Share card
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={inCollection}
            aria-label={inCollection ? "Remove from collection" : "Add to collection"}
            className={`flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold ${
              inCollection ? "bg-live/20 text-live" : "bg-stage-button text-ink hover:bg-stage-button-hover"
            }`}
          >
            <Icon name={inCollection ? "check" : "plus"} className="h-4 w-4" />
            {inCollection ? "Collected" : "Collect"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous card"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stage-2 text-ink hover:bg-stage-hover"
          >
            <Icon name="chevron-left" className="h-5 w-5" />
          </button>
          <Link
            href={cardPath(card.id)}
            className="text-sm font-medium text-ink-soft underline decoration-ink-soft/50 underline-offset-4 hover:text-ink"
          >
            Open this card&apos;s page
          </Link>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next card"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stage-2 text-ink hover:bg-stage-hover"
          >
            <Icon name="chevron-right" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
