"use client";

import { useState, type ReactNode } from "react";
import type { CircleState } from "@/lib/hooks/useCircle";
import {
  advanceCircle,
  closeCircle,
  endCircle,
  playCircleAgain,
  revealCircleQuestion,
} from "@/lib/circle/actions";

interface CircleHostControlsProps {
  sessionId: string;
  hostId: string;
  state: CircleState;
  participantCount: number;
  onChanged?: () => void;
  // "stage" sits under the question on the host's big screen; "bar" is a
  // slim strip on top of the host's own player screen when they play too.
  variant: "stage" | "bar";
}

// Everything the host can do to move a Circle along, in one place so the
// big-screen view and the host's own phone offer exactly the same steps.
export default function CircleHostControls({
  sessionId,
  hostId,
  state,
  participantCount,
  onChanged,
  variant,
}: CircleHostControlsProps) {
  const { circle, question, answers, hearts, deeperVotes } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const bar = variant === "bar";
  let status: string | null = null;
  let buttons: ReactNode = null;

  if (circle.status === "recap") {
    status = "Game over";
    buttons = (
      <>
        <ControlButton bar={bar} onClick={() => run(() => playCircleAgain(sessionId, circle))} disabled={busy}>
          Play again
        </ControlButton>
        <ControlButton
          bar={bar}
          variant="secondary"
          onClick={() => run(() => closeCircle(sessionId, circle.id))}
          disabled={busy}
        >
          Close game
        </ControlButton>
      </>
    );
  } else if (circle.status === "live" && question) {
    const isLast = state.questionNumber >= circle.settings.questionCount;
    const end = (
      <ControlButton
        bar={bar}
        variant="secondary"
        onClick={() => run(() => endCircle({ sessionId, hostId, circle }))}
        disabled={busy}
      >
        End game
      </ControlButton>
    );
    if (question.phase === "answering") {
      const answered = new Set(answers.map((a) => a.participantId)).size;
      status = `${answered} of ${participantCount} answered`;
      buttons = (
        <>
          <ControlButton
            bar={bar}
            onClick={() =>
              run(() => revealCircleQuestion({ sessionId, circle, question, answers, participantCount }))
            }
            disabled={busy || answers.length === 0}
          >
            Reveal now
          </ControlButton>
          {end}
        </>
      );
    } else {
      status = `Question ${state.questionNumber} of ${circle.settings.questionCount}`;
      buttons = (
        <>
          <ControlButton
            bar={bar}
            onClick={() =>
              run(() => advanceCircle({ sessionId, hostId, circle, question, answers, hearts, deeperVotes }))
            }
            disabled={busy}
          >
            {isLast ? "Finish game" : "Next question"}
          </ControlButton>
          {!isLast && end}
        </>
      );
    }
  }

  if (!buttons) return null;

  if (bar) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-stage-muted">{status}</span>
          <div className="flex shrink-0 gap-2">{buttons}</div>
        </div>
        {error && <p className="text-sm text-ember">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">{buttons}</div>
      {error && <p className="text-sm text-ember">{error}</p>}
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  variant = "primary",
  bar,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  bar: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[10px] font-medium whitespace-nowrap outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        bar ? "px-3 py-1.5 text-sm" : "px-5 py-2.75"
      } ${
        variant === "primary"
          ? "bg-spotlight text-spotlight-ink focus-visible:ring-2 focus-visible:ring-spotlight/60"
          : "border-[1.5px] border-white/30 text-white focus-visible:ring-2 focus-visible:ring-white/60"
      }`}
    >
      {children}
    </button>
  );
}
