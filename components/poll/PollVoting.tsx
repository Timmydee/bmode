"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { PollActivity } from "@/lib/backend";
import { validatePollOptionSelection } from "@/lib/game/validation";
import CountdownBadge from "@/components/round/CountdownBadge";

interface PollVotingProps {
  activity: PollActivity;
  participantId: string;
  // Present only for a round question. Absent (the default) for every
  // standalone poll, whose rendering is otherwise byte-for-byte unchanged.
  countdown?: { endsAt: number; serverTime: number };
  revealed?: { correctOptionId: string };
}

async function submitVoteAndBroadcast(
  activity: PollActivity,
  participantId: string,
  optionId: string,
): Promise<void> {
  await backend.responses.submitVote({
    activityId: activity.id,
    participantId,
    optionId,
  });

  // Feature-detected — iOS Safari has no navigator.vibrate; this is a
  // silent no-op there, not an error.
  navigator.vibrate?.(30);

  const results = await backend.responses.getPollResults(activity.id);
  await backend.realtime.publish(activity.sessionId, {
    type: "poll_results_updated",
    results,
    serverTime: Date.now(),
  });
}

export default function PollVoting({
  activity,
  participantId,
  countdown,
  revealed,
}: PollVotingProps) {
  const [checkingPriorVote, setCheckingPriorVote] = useState(true);
  const [voted, setVoted] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    backend.responses.hasResponded(activity.id, participantId).then((responded) => {
      if (cancelled) return;
      setVoted(responded);
      setCheckingPriorVote(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activity.id, participantId]);

  async function handleVote(optionId: string) {
    const validation = validatePollOptionSelection(
      optionId,
      activity.options.map((option) => option.id),
    );
    if (!validation.valid) {
      setError(validation.error ?? "That option isn't available.");
      return;
    }

    setSelectedOptionId(optionId);
    setSubmitting(true);
    setError(null);
    try {
      await submitVoteAndBroadcast(activity, participantId, optionId);
      setVoted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your vote.");
      setSelectedOptionId(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingPriorVote) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  const locked = voted || submitting || Boolean(revealed);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-bold leading-tight text-ink">
          {activity.prompt}
        </h1>
        {countdown && !revealed && (
          <CountdownBadge
            endsAt={countdown.endsAt}
            serverTimeAtLastSync={countdown.serverTime}
            variant="paper"
          />
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {activity.options.map((option) => (
          <PollOptionButton
            key={option.id}
            label={option.label}
            selected={selectedOptionId === option.id}
            dimmed={voted && selectedOptionId !== option.id}
            disabled={locked}
            correct={revealed?.correctOptionId === option.id}
            wrong={
              revealed !== undefined &&
              selectedOptionId === option.id &&
              revealed.correctOptionId !== option.id
            }
            onSelect={() => handleVote(option.id)}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-ember">{error}</p>}
      {voted && !revealed && (
        <p className="mt-6 text-center text-xs text-ink-faint">
          You voted — results shown on the main screen
        </p>
      )}
    </div>
  );
}

function PollOptionButton({
  label,
  selected,
  dimmed,
  disabled,
  correct,
  wrong,
  onSelect,
}: {
  label: string;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  correct?: boolean;
  wrong?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`rounded-xl border-[1.5px] px-4 py-4 text-left text-[15px] font-medium outline-none transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-spotlight/60 disabled:cursor-not-allowed disabled:active:scale-100 ${
        correct
          ? "border-success bg-success/15 text-success-ink"
          : wrong
            ? "border-ember bg-ember/15 text-ember"
            : selected
              ? "border-spotlight bg-spotlight/15 text-spotlight-ink"
              : "border-hairline bg-white text-ink"
      } ${dimmed && !correct && !wrong ? "opacity-50" : ""}`}
    >
      {label}
      {correct && " ✓"}
    </button>
  );
}
