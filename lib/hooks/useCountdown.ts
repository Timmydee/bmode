"use client";

import { useEffect, useRef, useState } from "react";

interface CountdownResult {
  remainingMs: number; // 0 once expired, never negative
  expired: boolean;
}

const TICK_MS = 200;

// The only place Date.now()/setInterval live for the rounds feature — the
// react-hooks/purity rule flags Date.now() reachable from a component-level
// closure (even indirectly, e.g. via a .map()-created onClick), so every
// clock read for countdowns is centralized here, outside any component.
//
// Clock skew is derived once per sync point (whenever the caller passes a
// fresh serverTime, e.g. from a round_started/round_question_advanced
// broadcast) rather than trusting the viewer's local clock against the
// server-anchored `endsAt`.
interface TickState {
  endsAt: number;
  serverTimeAtLastSync: number;
  remainingMs: number;
}

export function useCountdown(
  endsAt: number | null,
  serverTimeAtLastSync: number | null,
): CountdownResult {
  const [tick, setTick] = useState<TickState | null>(null);
  const skewRef = useRef(0);

  useEffect(() => {
    if (endsAt === null || serverTimeAtLastSync === null) return;

    skewRef.current = serverTimeAtLastSync - Date.now();

    function computeTick() {
      const now = Date.now() + skewRef.current;
      setTick({
        endsAt: endsAt!,
        serverTimeAtLastSync: serverTimeAtLastSync!,
        remainingMs: Math.max(0, endsAt! - now),
      });
    }

    computeTick();
    const interval = setInterval(computeTick, TICK_MS);
    return () => clearInterval(interval);
  }, [endsAt, serverTimeAtLastSync]);

  // Only trust `tick` when it was computed for the current endsAt/sync
  // pair — avoids a synchronous setState in the effect body for the
  // "countdown inactive" (endsAt === null) case, which the
  // react-hooks/set-state-in-effect rule flags; instead we derive
  // "inactive" by the tick simply not matching current props.
  const isCurrent =
    tick !== null && tick.endsAt === endsAt && tick.serverTimeAtLastSync === serverTimeAtLastSync;

  if (!isCurrent) {
    return { remainingMs: 0, expired: false };
  }
  return { remainingMs: tick.remainingMs, expired: tick.remainingMs <= 0 };
}
