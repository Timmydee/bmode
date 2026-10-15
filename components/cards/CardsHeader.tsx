import Link from "next/link";

// The top bar on the card pages: home, the library, and the way into a game.
export default function CardsHeader() {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <span aria-hidden className="inline-block h-3 w-3 rotate-45 rounded-[3px] bg-blurple" />
        Bmode
      </Link>
      <nav className="flex items-center gap-1 text-sm font-semibold">
        <Link href="/cards" className="rounded-lg px-3 py-2 text-ink-soft hover:bg-stage-2 hover:text-ink">
          Cards
        </Link>
        <Link href="/host?new=1" className="rounded-lg bg-stage-button px-3 py-2 text-ink hover:bg-stage-button-hover">
          Host a game
        </Link>
      </nav>
    </header>
  );
}
