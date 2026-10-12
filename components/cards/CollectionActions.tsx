"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/shared/Icon";
import { collectionPath, playPath } from "@/lib/cards/library";
import { useCollection } from "./collection-store";
import { shareLink, shareMessage } from "./share";
import Toast, { useToast } from "./Toast";

// On a shared collection: play it, pass it on, or open it in the library
// to add and remove cards.
export default function CollectionActions({ ids }: { ids: number[] }) {
  const router = useRouter();
  const collection = useCollection();
  const [toast, showToast] = useToast();

  async function share() {
    const result = await shareLink({
      title: `${ids.length} ${ids.length === 1 ? "question" : "questions"} from Bmode`,
      text: "Questions to ask each other",
      path: collectionPath(ids),
    });
    showToast(shareMessage(result));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href={playPath(ids)}
        className="flex items-center justify-center gap-2 rounded-[10px] bg-spotlight px-5 py-3 font-semibold text-spotlight-ink hover:bg-spotlight-hover"
      >
        <Icon name="play" filled className="h-3.5 w-3.5" />
        Play these in a game
      </Link>
      <button
        type="button"
        onClick={share}
        className="flex items-center justify-center gap-2 rounded-[10px] bg-stage-button px-5 py-3 font-semibold text-ink hover:bg-stage-button-hover"
      >
        <Icon name="share" className="h-4 w-4" />
        Share collection
      </button>
      <button
        type="button"
        onClick={() => {
          collection.replace(ids);
          router.push("/cards");
        }}
        className="flex items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-stage-line px-5 py-3 font-semibold text-ink-soft hover:text-ink"
      >
        <Icon name="layers" className="h-4 w-4" />
        Edit in the library
      </button>
      <Toast message={toast} />
    </div>
  );
}
