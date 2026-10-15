"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Icon from "@/components/shared/Icon";
import { deckPlayPath, type Deck } from "@/lib/cards/decks";
import { cardCategory, cardPath } from "@/lib/cards/library";
import type { BankQuestion } from "@/lib/game/circle-questions";
import CardFace from "./CardFace";
import { useCollection } from "./collection-store";
import { deckChip, deckIcon } from "./DeckStack";
import { shareLink, shareMessage } from "./share";

// A drag this far, or a quick flick, moves to the next card.
const SWIPE_DISTANCE = 80;
const FLICK_SPEED = 0.45; // px per ms
const LEAVE_MS = 320;
// Cards under the top one, peeking out below it.
const DEPTH = 3;

type Pointer = { id: number; x: number; lastX: number; lastT: number; speed: number; width: number };

// A deck opened full screen: the cards sit in a stack and you swipe the top
// one away to the left for the next card, or pull the last one back in from
// the left. Arrow buttons and arrow keys do the same.
export default function DeckViewer({
  deck,
  startCardId,
  onCardChange,
  onClose,
  onToast,
}: {
  deck: Deck;
  startCardId?: number;
  onCardChange: (id: number) => void;
  onClose: () => void;
  onToast: (message: string | null) => void;
}) {
  const [cards, setCards] = useState<readonly BankQuestion[]>(deck.cards);
  const [index, setIndex] = useState(() => Math.max(0, deck.cards.findIndex((card) => card.id === startCardId)));
  // How far the top card is being dragged, while a finger is down.
  const [drag, setDrag] = useState<number | null>(null);
  // The card just swiped away, flying off the left edge.
  const [leaving, setLeaving] = useState<{ card: BankQuestion; fromX: number; key: number } | null>(null);
  // The card just pulled back, sliding in from where it was dragged to.
  const [returning, setReturning] = useState<{ fromX: number; key: number } | null>(null);
  const [swiped, setSwiped] = useState(false);
  // The stack's width when the drag began, for pulling the last card back.
  const [width, setWidth] = useState(400);
  const pointer = useRef<Pointer | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const collection = useCollection();

  const count = cards.length;
  const card = cards[index];
  const previous = cards[(index - 1 + count) % count];
  const inCollection = collection.has(card.id);

  const next = useCallback(
    (fromX = 0) => {
      setLeaving({ card: cards[index], fromX, key: Date.now() });
      setReturning(null);
      setIndex((index + 1) % count);
      setDrag(null);
      setSwiped(true);
    },
    [cards, index, count],
  );

  const back = useCallback(
    (fromX?: number) => {
      const width = stackRef.current?.offsetWidth ?? 400;
      setReturning({ fromX: fromX ?? -(width + 48), key: Date.now() });
      setLeaving(null);
      setIndex((index - 1 + count) % count);
      setDrag(null);
      setSwiped(true);
    },
    [index, count],
  );

  useEffect(() => onCardChange(card.id), [card.id, onCardChange]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  // Where the pulled-back card sits for a drag to the right: off the left
  // edge at first, then catching up with the finger.
  function pullX(dx: number, width: number): number {
    return Math.min(0, -(width + 48) + dx * 2.5);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      lastX: event.clientX,
      lastT: event.timeStamp,
      speed: 0,
      width: stackRef.current?.offsetWidth ?? 400,
    };
    setWidth(pointer.current.width);
    setDrag(0);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    const dt = event.timeStamp - p.lastT;
    if (dt > 0) p.speed = (event.clientX - p.lastX) / dt;
    p.lastX = event.clientX;
    p.lastT = event.timeStamp;
    setDrag(event.clientX - p.x);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    pointer.current = null;
    const dx = event.clientX - p.x;
    // A flick only counts while still moving that way when let go.
    const recent = event.timeStamp - p.lastT < 80 ? p.speed : 0;
    if (dx < -SWIPE_DISTANCE || (dx < -20 && recent < -FLICK_SPEED)) next(dx);
    else if (dx > SWIPE_DISTANCE || (dx > 20 && recent > FLICK_SPEED)) back(pullX(dx, p.width));
    else setDrag(null);
  }

  function onPointerCancel() {
    pointer.current = null;
    setDrag(null);
  }

  async function share() {
    const result = await shareLink({ title: "A question from Bmode", text: card.text, path: cardPath(card.id) });
    onToast(shareMessage(result));
  }

  function toggle() {
    if (!collection.toggle(card.id)) onToast("A collection holds up to 20 cards");
  }

  function shuffle() {
    const order = [...cards];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setCards(order);
    setIndex(0);
    setLeaving(null);
    setReturning(null);
    onToast("Deck shuffled");
  }

  const dragging = drag !== null;
  const left = dragging && drag < 0 ? drag : 0;
  const right = dragging && drag > 0 ? drag : 0;
  // How far a left swipe has gone, 0 to 1: the cards underneath rise to meet it.
  const progress = Math.min(1, -left / SWIPE_DISTANCE);
  const stack = Array.from({ length: Math.min(DEPTH, count) }, (_, depth) => cards[(index + depth) % count]);
  const settle = "transform 320ms cubic-bezier(0.2, 0.8, 0.3, 1.05)";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${deck.name} deck`} className="fixed inset-0 z-50 flex animate-fade-in flex-col overflow-hidden bg-floating/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <span className={`flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${deckChip(deck)}`}>
          <Icon name={deckIcon(deck)} className="h-4 w-4" />
          <span className="truncate">{deck.name}</span>
        </span>
        <div className="flex items-center gap-3">
          <p className="text-sm text-ink-soft tabular-nums">
            {index + 1} of {count}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close deck"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stage-2 text-ink outline-none hover:bg-stage-hover focus-visible:ring-2 focus-visible:ring-blurple"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-4">
        <div
          ref={stackRef}
          className="relative h-[min(24rem,48svh)] touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {stack
            .map((stacked, depth) => {
              const top = depth === 0;
              const lift = top ? 0 : depth - progress;
              const style: CSSProperties = top
                ? {
                    transform: `translateX(${left}px) rotate(${left / 18}deg)`,
                    transition: dragging ? "none" : settle,
                    zIndex: DEPTH,
                    cursor: dragging ? "grabbing" : "grab",
                  }
                : {
                    transform: `translateY(${lift * 16}px) scale(${1 - lift * 0.05})`,
                    transition: dragging ? "none" : settle,
                    zIndex: DEPTH - depth,
                  };
              const enter = top && returning ? returning : null;
              return (
                <div
                  key={stacked.id}
                  aria-hidden={!top}
                  className={`absolute inset-0 origin-bottom ${enter ? "animate-deck-return" : ""}`}
                  style={
                    enter
                      ? ({ ...style, "--from-x": `${enter.fromX}px`, "--from-r": `${enter.fromX / 30}deg` } as CSSProperties)
                      : style
                  }
                >
                  <CardFace
                    text={stacked.text}
                    category={cardCategory(stacked)}
                    size="lg"
                    className={`h-full ${top ? "" : "brightness-[0.8]"}`}
                  />
                </div>
              );
            })
            .reverse()}

          {right > 0 && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                zIndex: DEPTH + 1,
                transform: `translateX(${pullX(right, width)}px) rotate(${pullX(right, width) / 30}deg)`,
              }}
            >
              <CardFace text={previous.text} category={cardCategory(previous)} size="lg" className="h-full" />
            </div>
          )}

          {leaving && (
            <div
              key={leaving.key}
              aria-hidden
              className="animate-deck-swipe pointer-events-none absolute inset-0"
              style={
                {
                  zIndex: DEPTH + 1,
                  "--from-x": `${leaving.fromX}px`,
                  "--from-r": `${leaving.fromX / 18}deg`,
                } as CSSProperties
              }
            >
              <CardFace text={leaving.card.text} category={cardCategory(leaving.card)} size="lg" className="h-full" />
            </div>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          Card {index + 1} of {count}: {card.text}
        </p>
        <div className="mt-6 flex min-h-12 flex-col justify-start px-1">
          {swiped ? (
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">Then ask: </span>
              {card.followUp}
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-ink-faint">
              <Icon name="arrow-left" className="h-4 w-4" />
              Swipe for the next card
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-6 sm:px-6">
        <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => back()}
            aria-label="Previous card"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-stage-2 text-ink hover:bg-stage-hover"
          >
            <Icon name="chevron-left" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-spotlight px-3 py-3 font-semibold text-spotlight-ink hover:bg-spotlight-hover"
          >
            <Icon name="share" className="h-4 w-4" />
            Share
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={inCollection}
            aria-label={inCollection ? "Remove from collection" : "Add to collection"}
            className={`flex items-center justify-center gap-2 rounded-[10px] px-3 py-3 font-semibold ${
              inCollection ? "bg-live/20 text-live" : "bg-stage-button text-ink hover:bg-stage-button-hover"
            }`}
          >
            <Icon name={inCollection ? "check" : "plus"} className="h-4 w-4" />
            {inCollection ? "Collected" : "Collect"}
          </button>
          <button
            type="button"
            onClick={() => next()}
            aria-label="Next card"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-stage-2 text-ink hover:bg-stage-hover"
          >
            <Icon name="chevron-right" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm font-medium">
          <button
            type="button"
            onClick={shuffle}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-ink-soft hover:bg-stage-2 hover:text-ink"
          >
            <Icon name="shuffle" className="h-4 w-4" />
            Shuffle
          </button>
          <Link
            href={cardPath(card.id)}
            className="px-2 py-2 text-ink-soft underline decoration-ink-soft/50 underline-offset-4 hover:text-ink"
          >
            Card page
          </Link>
          <Link
            href={deckPlayPath(cards, index)}
            className="flex items-center gap-1.5 rounded-lg bg-stage-button px-3 py-2 text-ink hover:bg-stage-button-hover"
          >
            <Icon name="play" filled className="h-3 w-3" />
            Play this deck
          </Link>
        </div>
      </div>
    </div>
  );
}
