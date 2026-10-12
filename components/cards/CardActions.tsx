"use client";

import Link from "next/link";
import Icon from "@/components/shared/Icon";
import { cardPath, playPath } from "@/lib/cards/library";
import { useCollection } from "./collection-store";
import { shareLink, shareMessage } from "./share";
import Toast, { useToast } from "./Toast";

// Under a card on its own page: share it, keep it, or play it.
export default function CardActions({ id, text }: { id: number; text: string }) {
  const collection = useCollection();
  const [toast, showToast] = useToast();
  const inCollection = collection.has(id);

  async function share() {
    showToast(shareMessage(await shareLink({ title: "A question from Bmode", text, path: cardPath(id) })));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-[10px] bg-spotlight px-4 py-3 font-semibold text-spotlight-ink hover:bg-spotlight-hover"
        >
          <Icon name="share" className="h-4 w-4" />
          Share card
        </button>
        <Link
          href={playPath([id])}
          className="flex items-center justify-center gap-2 rounded-[10px] bg-stage-button px-4 py-3 font-semibold text-ink hover:bg-stage-button-hover"
        >
          <Icon name="play" filled className="h-3.5 w-3.5" />
          Play in a game
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!collection.toggle(id)) showToast("A collection holds up to 20 cards");
        }}
        aria-pressed={inCollection}
        className={`flex items-center justify-center gap-2 rounded-[10px] border-[1.5px] px-4 py-2.5 text-sm font-semibold ${
          inCollection ? "border-live/60 text-live" : "border-stage-line text-ink-soft hover:text-ink"
        }`}
      >
        <Icon name={inCollection ? "check" : "plus"} className="h-4 w-4" />
        {inCollection ? `In your collection (${collection.ids.length})` : "Add to your collection"}
      </button>
      {inCollection && (
        <Link href="/cards" className="text-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          Keep collecting in the library
        </Link>
      )}
      <Toast message={toast} />
    </div>
  );
}
