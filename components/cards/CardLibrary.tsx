"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DECKS, deckById, deckPath, parseDeck, type DeckId } from "@/lib/cards/decks";
import CollectionTray from "./CollectionTray";
import DeckStack from "./DeckStack";
import DeckViewer from "./DeckViewer";
import Toast, { useToast } from "./Toast";

type Open = { deck: DeckId; card?: number };

function openFromAddress(): Open | null {
  const params = new URLSearchParams(window.location.search);
  const deck = parseDeck(params.get("category"));
  if (!deck) return null;
  const card = Number(params.get("card"));
  return { deck, card: Number.isInteger(card) && card > 0 ? card : undefined };
}

// The card library: a stacked deck for each category. Tapping one opens it
// full screen to swipe through; the collection being built sits along the
// bottom. The open deck and its top card stay in the address, so a refresh,
// a shared link or the phone's back button all do what you'd expect.
export default function CardLibrary({ initialOpen }: { initialOpen: Open | null }) {
  const [open, setOpen] = useState<Open | null>(initialOpen);
  const [toast, showToast] = useToast();
  // Whether opening the deck added a history entry that closing should undo.
  const pushed = useRef(false);

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      setOpen(openFromAddress());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openDeck(deck: DeckId) {
    window.history.pushState(null, "", deckPath(deck));
    pushed.current = true;
    setOpen({ deck });
  }

  const close = useCallback(() => {
    setOpen(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", "/cards");
    }
  }, []);

  const deckId = open?.deck;
  const onCardChange = useCallback(
    (card: number) => {
      if (deckId) window.history.replaceState(window.history.state, "", deckPath(deckId, card));
    },
    [deckId],
  );

  return (
    <>
      <ul className="grid gap-x-6 gap-y-10 pb-36 sm:grid-cols-2 lg:grid-cols-3">
        {DECKS.map((deck, position) => (
          <li key={deck.id} className="min-w-0">
            <DeckStack deck={deck} position={position} onOpen={() => openDeck(deck.id)} />
          </li>
        ))}
      </ul>

      {open && (
        <DeckViewer
          key={open.deck}
          deck={deckById(open.deck)}
          startCardId={open.card}
          onCardChange={onCardChange}
          onClose={close}
          onToast={showToast}
        />
      )}
      {!open && <CollectionTray onToast={showToast} />}
      <Toast message={toast} />
    </>
  );
}
