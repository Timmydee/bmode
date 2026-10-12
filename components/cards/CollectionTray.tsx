"use client";

import Link from "next/link";
import Icon from "@/components/shared/Icon";
import { COLLECTION_MAX_CARDS, collectionPath, playPath } from "@/lib/cards/library";
import { useCollection } from "./collection-store";
import { shareLink, shareMessage } from "./share";

// The bar along the bottom once a card is in the collection: how many,
// and the three things to do with them.
export default function CollectionTray({ onToast }: { onToast: (message: string | null) => void }) {
  const collection = useCollection();
  const count = collection.ids.length;
  if (count === 0) return null;

  async function share() {
    const result = await shareLink({
      title: `${count} ${count === 1 ? "question" : "questions"} from Bmode`,
      text: "Questions to ask each other",
      path: collectionPath(collection.ids),
    });
    onToast(shareMessage(result));
  }

  return (
    // Sits above the feedback pill in the bottom-left corner.
    <div className="fixed inset-x-0 bottom-14 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-xl animate-toast-in items-center gap-2 rounded-2xl border border-stage-line bg-floating/95 p-2 pl-3 shadow-[0_12px_32px_rgb(0_0_0/55%)] backdrop-blur">
        <Link
          href={collectionPath(collection.ids)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 text-sm font-semibold text-ink"
        >
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-blurple px-1.5 font-display tabular-nums text-white">
            {count}
          </span>
          <span className="truncate">
            {count === 1 ? "card" : "cards"}
            <span className="font-normal text-ink-faint"> / {COLLECTION_MAX_CARDS}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={collection.clear}
          aria-label="Clear the collection"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-stage-hover hover:text-ink"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-1.5 rounded-lg bg-stage-button px-3 py-2.5 text-sm font-semibold text-ink hover:bg-stage-button-hover"
        >
          <Icon name="share" className="h-4 w-4" />
          Share
        </button>
        <Link
          href={playPath(collection.ids)}
          className="flex items-center gap-1.5 rounded-lg bg-spotlight px-3 py-2.5 text-sm font-semibold text-spotlight-ink hover:bg-spotlight-hover"
        >
          <Icon name="play" filled className="h-3.5 w-3.5" />
          Play
        </Link>
      </div>
    </div>
  );
}
