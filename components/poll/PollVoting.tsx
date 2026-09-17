"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { PollActivity } from "@/lib/backend";
import { validatePollOptionSelection } from "@/lib/game/validation";

interface PollVotingProps {
  activity: PollActivity;
  participantId: string;
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

  const results = await backend.responses.getPollResults(activity.id);
  await backend.realtime.publish(activity.sessionId, {
    type: "poll_results_updated",
    results,
    serverTime: Date.now(),
  });
}

export default function PollVoting({ activity, participantId }: PollVotingProps) {
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-8 font-display text-2xl font-bold leading-tight text-ink">
        {activity.prompt}
      </h1>
      <div className="flex flex-col gap-2.5">
        {activity.options.map((option) => (
          <PollOptionButton
            key={option.id}
            label={option.label}
            selected={selectedOptionId === option.id}
            dimmed={voted && selectedOptionId !== option.id}
            disabled={voted || submitting}
            onSelect={() => handleVote(option.id)}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-ember">{error}</p>}
      {voted && (
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
  onSelect,
}: {
  label: string;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`rounded-xl border-[1.5px] px-4 py-4 text-left text-[15px] font-medium transition-colors disabled:cursor-not-allowed ${
        selected
          ? "border-spotlight bg-spotlight/15 text-spotlight-ink"
          : "border-hairline bg-white text-ink"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      {label}
    </button>
  );
}
