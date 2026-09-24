"use client";

import { useCountdown } from "@/lib/hooks/useCountdown";

interface CountdownBadgeProps {
  endsAt: number | null;
  serverTimeAtLastSync: number | null;
  variant?: "stage" | "paper" | "ring";
  // Ring variant only — total question duration, needed to compute how
  // much of the ring to draw down.
  totalSeconds?: number;
}

const RING_SIZE = 120;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function CountdownBadge({
  endsAt,
  serverTimeAtLastSync,
  variant = "stage",
  totalSeconds,
}: CountdownBadgeProps) {
  const { remainingMs } = useCountdown(endsAt, serverTimeAtLastSync);
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 5;

  // Color is a supplementary cue only — the number itself, plus this
  // live region, are the real signal, so a screen reader still gets
  // "time's running out" without relying on color.
  const srAnnouncement = urgent ? `${seconds} seconds left` : undefined;

  if (variant === "ring") {
    const total = totalSeconds && totalSeconds > 0 ? totalSeconds : 1;
    const fraction = Math.max(0, Math.min(1, remainingMs / 1000 / total));
    const dashOffset = RING_CIRCUMFERENCE * (1 - fraction);

    return (
      <div className="relative inline-flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            className="text-stage-2"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            className={`transition-[stroke-dashoffset] duration-200 ease-linear ${urgent ? "text-ember" : "text-spotlight"}`}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute font-display text-3xl font-bold tabular-nums text-white">
          {seconds}
        </span>
        <span className="sr-only" role="status" aria-live="assertive">
          {srAnnouncement}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-lg font-bold tabular-nums ${
        urgent
          ? "bg-ember text-white"
          : variant === "stage"
            ? "bg-stage-2 text-white"
            : "bg-paper-2 text-ink"
      }`}
    >
      {seconds}s
      <span className="sr-only" role="status" aria-live="assertive">
        {srAnnouncement}
      </span>
    </span>
  );
}
