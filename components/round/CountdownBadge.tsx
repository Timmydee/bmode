"use client";

import { useCountdown } from "@/lib/hooks/useCountdown";

interface CountdownBadgeProps {
  endsAt: number | null;
  serverTimeAtLastSync: number | null;
  variant?: "stage" | "paper";
}

export default function CountdownBadge({
  endsAt,
  serverTimeAtLastSync,
  variant = "stage",
}: CountdownBadgeProps) {
  const { remainingMs } = useCountdown(endsAt, serverTimeAtLastSync);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-lg font-bold ${
        seconds <= 5
          ? "bg-ember text-white"
          : variant === "stage"
            ? "bg-stage-2 text-white"
            : "bg-paper-2 text-ink"
      }`}
    >
      {seconds}s
    </span>
  );
}
