"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CircleState } from "@/lib/hooks/useCircle";
import { advanceCircle, closeCircle, endCircle, revealCircleQuestion } from "@/lib/circle/actions";
import { CIRCLE_DEPTH_LABELS, displayName } from "@/lib/game/circle";
import CircleRecap from "./CircleRecap";

interface CircleHostViewProps {
  sessionId: string;
  hostId: string;
  joinCode: string;
  state: CircleState;
  participantCount: number;
  onChanged?: () => void;
  // The projector view shows the same screen without any controls, and
  // never auto-reveals (only the host's control page drives the game).
  readOnly?: boolean;
}

// The host's Stage screen for a running Circle. It doubles as the shared
// screen (TV or laptop) the group looks at between their own phones.
export default function CircleHostView({
  sessionId,
  hostId,
  joinCode,
  state,
  participantCount,
  onChanged,
  readOnly = false,
}: CircleHostViewProps) {
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

  const answeredIds = new Set(answers.map((a) => a.participantId));
  const everyoneAnswered = participantCount > 0 && answeredIds.size >= participantCount;

  // Reveal on its own once every phone in the room has answered. A ref,
  // not state, guards against firing twice while the reveal is in flight.
  const autoRevealedFor = useRef<string | null>(null);
  useEffect(() => {
    if (readOnly || !question || question.phase !== "answering" || !everyoneAnswered) return;
    if (autoRevealedFor.current === question.id) return;
    autoRevealedFor.current = question.id;
    revealCircleQuestion({ sessionId, circle, question, answers, participantCount }).catch((err) => {
      autoRevealedFor.current = null;
      setError(err instanceof Error ? err.message : "Could not reveal the answers.");
    });
  }, [readOnly, sessionId, circle, question, answers, participantCount, everyoneAnswered]);

  if (circle.status === "recap" && circle.recap) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 py-6">
        <CircleRecap recap={circle.recap} awardVotes={state.awardVotes} variant="stage" />
        <p className="text-sm text-stage-muted">Players can vote for awards on their phones.</p>
        {error && <p className="text-sm text-ember">{error}</p>}
        {!readOnly && (
          <HostButton onClick={() => run(() => closeCircle(sessionId, circle.id))} disabled={busy}>
            Close game
          </HostButton>
        )}
      </div>
    );
  }

  if (!question) {
    return <div className="flex flex-1 items-center justify-center text-stage-muted">Loading the next question…</div>;
  }

  const isLast = state.questionNumber >= circle.settings.questionCount;
  const spotlight = answers.find((a) => a.participantId === question.spotlightParticipantId) ?? null;
  const heartCount = (answerId: string) => hearts.filter((h) => h.answerId === answerId).length;
  const roomSize = question.participantCount ?? participantCount;

  return (
    <div className="flex flex-1 flex-col items-center gap-8 py-6">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-sm text-stage-muted">
        <span>
          {circle.name} · question {state.questionNumber} of {circle.settings.questionCount}
        </span>
        <span className="flex items-center gap-3">
          <span className="rounded-full border border-stage-line px-3 py-1 text-stage-text">
            {CIRCLE_DEPTH_LABELS[question.depth]}
          </span>
          <span className="font-display font-semibold tabular-nums text-spotlight">{circle.pot} ✨ Sparks</span>
        </span>
      </div>

      <h1 className="max-w-[24ch] text-center font-display text-3xl font-bold sm:text-4xl">{question.text}</h1>

      {question.phase === "answering" ? (
        <>
          <p className="text-stage-muted">
            <b className="font-display text-white tabular-nums">{answeredIds.size}</b> of{" "}
            <b className="font-display text-white tabular-nums">{participantCount}</b> answered
            {everyoneAnswered ? ". Revealing…" : ""}
          </p>
          {answers.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {answers.map((answer) => (
                <li key={answer.id} className="rounded-full bg-stage-2 px-3 py-1 text-sm text-stage-text">
                  ✓ {displayName(answer.nickname)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-stage-muted">
            Playing too? Join on your phone with code {joinCode}.
          </p>
          <div className={`flex gap-3 ${readOnly ? "hidden" : ""}`}>
            <HostButton
              onClick={() =>
                run(() => revealCircleQuestion({ sessionId, circle, question, answers, participantCount }))
              }
              disabled={busy || answers.length === 0}
            >
              Reveal now
            </HostButton>
            <HostButton
              variant="secondary"
              onClick={() => run(() => endCircle({ sessionId, hostId, circle }))}
              disabled={busy}
            >
              End game
            </HostButton>
          </div>
        </>
      ) : (
        <>
          <ul className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {answers.map((answer) => (
              <li
                key={answer.id}
                className={`rounded-xl border p-4 ${
                  answer.id === spotlight?.id ? "border-spotlight bg-spotlight/10" : "border-stage-line bg-stage-2"
                } ${answer.skipped ? "opacity-50" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between text-sm text-stage-muted">
                  <span>
                    {displayName(answer.nickname)}
                    {answer.id === spotlight?.id && <span className="ml-2 text-spotlight">Spotlight</span>}
                  </span>
                  {heartCount(answer.id) > 0 && <span>💛 {heartCount(answer.id)}</span>}
                </div>
                <p className="text-lg text-white">
                  {answer.skipped ? "Skipped" : (answer.text ?? "Sharing out loud")}
                </p>
              </li>
            ))}
          </ul>
          {spotlight && (
            <p className="max-w-[40ch] text-center text-stage-text">
              {circle.settings.answerMode === "out_loud"
                ? `${displayName(spotlight.nickname)} goes first. `
                : `Ask ${displayName(spotlight.nickname)}: `}
              {question.followUp ?? "Tell us more about that."}
            </p>
          )}
          {question.depth < 3 && (
            <p className="text-sm text-stage-muted">
              {deeperVotes.length} of {roomSize} want to go deeper. It takes everyone.
            </p>
          )}
          <div className={`flex gap-3 ${readOnly ? "hidden" : ""}`}>
            <HostButton
              onClick={() =>
                run(() =>
                  advanceCircle({ sessionId, hostId, circle, question, answers, hearts, deeperVotes }),
                )
              }
              disabled={busy}
            >
              {isLast ? "Finish game" : "Next question"}
            </HostButton>
            {!isLast && (
              <HostButton
                variant="secondary"
                onClick={() => run(() => endCircle({ sessionId, hostId, circle }))}
                disabled={busy}
              >
                End game
              </HostButton>
            )}
          </div>
        </>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}
    </div>
  );
}

function HostButton({
  onClick,
  disabled,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[10px] px-5 py-2.75 font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "primary"
          ? "bg-spotlight text-spotlight-ink focus-visible:ring-2 focus-visible:ring-spotlight/60"
          : "border-[1.5px] border-white/30 text-white focus-visible:ring-2 focus-visible:ring-white/60"
      }`}
    >
      {children}
    </button>
  );
}
