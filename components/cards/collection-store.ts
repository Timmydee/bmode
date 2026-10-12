"use client";

import { useSyncExternalStore } from "react";
import { COLLECTION_MAX_CARDS, encodeCollection, parseCollection } from "@/lib/cards/library";

// The collection someone is building in the card library. It lives only in
// this browser (no account needed) so it survives a reload or a trip to a
// card's page; sharing it turns it into a link. Storage can be blocked, so
// every read and write is guarded and the collection still works in memory.
const KEY = "bmode:card-collection";
const EMPTY: number[] = [];

let current: number[] | null = null;
const listeners = new Set<() => void>();

function read(): number[] {
  if (current) return current;
  try {
    current = parseCollection(window.localStorage.getItem(KEY));
  } catch {
    current = [];
  }
  return current;
}

function write(ids: number[]) {
  current = parseCollection(encodeCollection(ids));
  try {
    window.localStorage.setItem(KEY, current.join("-"));
  } catch {
    // Kept in memory for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCollection() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ids,
    full: ids.length >= COLLECTION_MAX_CARDS,
    has: (id: number) => ids.includes(id),
    // Adds the card, or takes it out if it's already in. Returns false when
    // the collection is full and nothing changed.
    toggle: (id: number): boolean => {
      const now = read();
      if (now.includes(id)) {
        write(now.filter((other) => other !== id));
        return true;
      }
      if (now.length >= COLLECTION_MAX_CARDS) return false;
      write([...now, id]);
      return true;
    },
    replace: (next: number[]) => write(next),
    clear: () => write([]),
  };
}
