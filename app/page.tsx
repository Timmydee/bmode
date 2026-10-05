import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
      <p className="mb-3 text-sm text-ink-soft">Bmode</p>
      <h1 className="mb-6 max-w-[13ch] font-display text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
        Helping people connect through better questions
      </h1>
      <p className="mb-12 max-w-[58ch] text-lg text-ink-soft">
        Start a Circle with friends or your partner: everyone answers the same
        question on their own phone, then the answers reveal together. Earn
        Sparks, grow your bond, and go deeper when everyone’s in. Polls, word
        clouds and Q&amp;A are still here for bigger rooms. No account and no
        app install.
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
