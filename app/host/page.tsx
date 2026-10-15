"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { Session } from "@/lib/backend";
import { track } from "@/lib/insights";

// What a game is called when the host doesn't name it. Players see it on
// the invite card ("You've been invited to join Game night").
const DEFAULT_TITLE = "Game night";

// Query keys that mean "start a game now": ?new=1 from the landing page's
// "Start a game", ?vibe= from a deck's "Play this deck", ?cards= from the
// card library. They skip this page and land on the Circle setup.
const START_KEYS = ["new", "vibe", "cards"] as const;

export default function HostPage(props: PageProps<"/host">) {
  const searchParams = use(props.searchParams);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const signingInRef = useRef(false);

  const [sessionsFor, setSessionsFor] = useState<{
    userId: string;
    sessions: Session[];
  } | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const autoStart = START_KEYS.some((key) => searchParams[key] !== undefined);
  const autoStartedRef = useRef(false);

  // Hosting needs no sign-up: an anonymous account is created on the first
  // visit and kept by this browser, so the host's games and bonds stay here.
  useEffect(() => {
    backend.auth.getCurrentUserId().then(async (id) => {
      if (id) {
        setUserId(id);
        return;
      }
      if (signingInRef.current) return;
      signingInRef.current = true;
      try {
        await backend.auth.signInAnonymously("");
        setUserId(await backend.auth.getCurrentUserId());
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Could not get you set up.");
      } finally {
        signingInRef.current = false;
      }
    });
    return backend.auth.onAuthChange((id) => {
      if (id) setUserId(id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    backend.sessions.listByHost(userId).then((list) => {
      setSessionsFor({ userId, sessions: list });
    });
  }, [userId]);

  async function createGame(hostId: string, name: string) {
    setCreating(true);
    setCreateError(null);
    try {
      const session = await backend.sessions.create({ hostId, title: name || DEFAULT_TITLE });
      track("host_game", session.id);
      // Carry the deck's vibe and the library's cards over to the Circle form.
      const next = new URLSearchParams();
      for (const key of ["vibe", "cards"]) {
        const value = searchParams[key];
        if (typeof value === "string" && value) next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `/host/${session.id}?${query}` : `/host/${session.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not start the game.");
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!autoStart || !userId || autoStartedRef.current) return;
    autoStartedRef.current = true;
    createGame(userId, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, userId]);

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!userId || creating) return;
    createGame(userId, title.trim());
  }

  const sessions = sessionsFor?.userId === userId ? sessionsFor.sessions : [];
  const loadingSessions = !userId || sessionsFor?.userId !== userId;

  if (authError) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Couldn’t start a game</h1>
        <p className="text-ink-soft">{authError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-center rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Try again
        </button>
      </div>
    );
  }

  if (autoStart && !createError) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft" role="status">
        Setting up your game…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-semibold text-ink">Host a game</h1>
      <p className="mb-8 text-ink-soft">
        You pick the questions, everyone plays on their own phone. No sign-up needed.
      </p>

      <form onSubmit={handleCreate} className="mb-3 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="game-title" className="sr-only">
          Game name (optional)
        </label>
        <input
          id="game-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Name it (optional), e.g. ${DEFAULT_TITLE}`}
          maxLength={60}
          className="flex-1 rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        <button
          type="submit"
          disabled={creating || !userId}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {creating ? "Starting…" : "Start a new game"}
        </button>
      </form>
      {createError && <p className="mb-6 text-sm text-ember">{createError}</p>}

      {loadingSessions ? (
        <p className="mt-6 text-ink-soft">Loading…</p>
      ) : sessions.length > 0 ? (
        <>
          <h2 className="mt-10 mb-3 font-display text-lg font-semibold text-ink">Your games</h2>
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/host/${session.id}`}
                  className="flex items-center justify-between rounded-xl border border-hairline bg-paper-2 px-5 py-4"
                >
                  <span className="font-medium text-ink">{session.title}</span>
                  <StatusBadge status={session.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: Session["status"] }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live-ink px-3 py-1 text-sm font-medium text-live">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        Live
      </span>
    );
  }
  if (status === "ended") {
    return (
      <span className="rounded-full bg-paper-2 px-3 py-1 text-sm font-medium text-ink-soft">
        Ended
      </span>
    );
  }
  return (
    <span className="rounded-full bg-paper-2 px-3 py-1 text-sm font-medium text-ink-soft">
      Draft
    </span>
  );
}
