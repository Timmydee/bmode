"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { Session } from "@/lib/backend";

export default function HostPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sessionsFor, setSessionsFor] = useState<{
    userId: string;
    sessions: Session[];
  } | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    backend.auth.getCurrentUserId().then((id) => {
      setUserId(id);
      setCheckingAuth(false);
    });
    return backend.auth.onAuthChange((id) => setUserId(id));
  }, []);

  useEffect(() => {
    if (!userId) return;
    backend.sessions.listByHost(userId).then((list) => {
      setSessionsFor({ userId, sessions: list });
    });
  }, [userId]);

  const sessions = sessionsFor?.userId === userId ? sessionsFor.sessions : [];
  const loadingSessions = Boolean(userId) && sessionsFor?.userId !== userId;

  async function handleSendMagicLink(event: FormEvent) {
    event.preventDefault();
    setAuthError(null);
    try {
      await backend.auth.signInWithEmail(email);
      setMagicLinkSent(true);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Could not send the link.",
      );
    }
  }

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Give the session a title.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const session = await backend.sessions.create({
        hostId: userId,
        title: trimmed,
      });
      router.push(`/host/${session.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Could not create the session.",
      );
      setCreating(false);
    }
  }

  if (checkingAuth) return null;

  if (!userId) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-20">
        <h1 className="mb-2 font-display text-3xl font-semibold text-ink">
          Sign in to host
        </h1>
        <p className="mb-8 text-ink-soft">
          We’ll email you a link — no password to remember.
        </p>
        {magicLinkSent ? (
          <p className="text-ink">Check {email} for a sign-in link.</p>
        ) : (
          <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
            />
            {authError && <p className="text-sm text-ember">{authError}</p>}
            <button
              type="submit"
              className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
            >
              Send magic link
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="mb-8 font-display text-3xl font-semibold text-ink">
        Your sessions
      </h1>

      <form onSubmit={handleCreateSession} className="mb-3 flex gap-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Session title, e.g. Team offsite"
          className="flex-1 rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create session"}
        </button>
      </form>
      {createError && <p className="mb-6 text-sm text-ember">{createError}</p>}

      {loadingSessions ? (
        <p className="text-ink-soft">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="mt-6 text-ink-soft">
          No sessions yet — create one above to get started.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/host/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-hairline bg-white px-5 py-4"
              >
                <span className="font-medium text-ink">{session.title}</span>
                <StatusBadge status={session.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
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
