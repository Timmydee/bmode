import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
      <p className="mb-3 text-sm text-ink-soft">Game Night</p>
      <h1 className="mb-6 max-w-[11ch] font-display text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
        Live audience input, right from the room
      </h1>
      <p className="mb-12 max-w-[58ch] text-lg text-ink-soft">
        Run polls, word clouds, and moderated Q&amp;A from your laptop or
        projector — your audience joins from their own phones, no account and
        no app install.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/host"
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Host a session
        </Link>
        <Link
          href="/join"
          className="rounded-[10px] border-[1.5px] border-ink px-5 py-2.75 font-medium text-ink"
        >
          Join with a code
        </Link>
      </div>
    </div>
  );
}
