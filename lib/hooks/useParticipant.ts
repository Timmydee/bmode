"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { getParticipantToken } from "@/lib/identity/participant-token";
import type { Participant } from "@/lib/backend";

interface UseParticipantResult {
  participant: Participant | null;
  loading: boolean;
  join: (nickname: string | null) => Promise<Participant>;
}

interface LookedUpFor {
  sessionId: string;
  participant: Participant | null;
}

// Handles rejoin resilience: on mount, looks up whether this browser already
// holds a participant token for this session (see lib/identity/participant-
// token.ts) before asking the visitor to enter a nickname again.
export function useParticipant(
  sessionId: string | null,
): UseParticipantResult {
  const [lookedUp, setLookedUp] = useState<LookedUpFor | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const token = getParticipantToken(sessionId);

    backend.participants.getByToken(sessionId, token).then((existing) => {
      if (cancelled) return;
      setLookedUp({ sessionId, participant: existing });
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function join(nickname: string | null): Promise<Participant> {
    if (!sessionId) throw new Error("No session to join.");
    const token = getParticipantToken(sessionId);
    const joined = await backend.participants.join({
      sessionId,
      nickname,
      token,
    });
    setLookedUp({ sessionId, participant: joined });
    return joined;
  }

  if (!sessionId) {
    return { participant: null, loading: false, join };
  }

  const isLookedUpForCurrentSession = lookedUp?.sessionId === sessionId;

  return {
    participant: isLookedUpForCurrentSession ? lookedUp.participant : null,
    loading: !isLookedUpForCurrentSession,
    join,
  };
}
