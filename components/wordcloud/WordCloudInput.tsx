"use client";

import { useEffect, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { WordCloudActivity } from "@/lib/backend";
import { validateWord } from "@/lib/game/validation";

interface WordCloudInputProps {
  activity: WordCloudActivity;
  participantId: string;
}

async function submitWordAndBroadcast(
  activity: WordCloudActivity,
  participantId: string,
  word: string,
): Promise<void> {
  await backend.responses.submitWord({
    activityId: activity.id,
    participantId,
    word,
  });

  const results = await backend.responses.getWordCloudResults(activity.id);
  await backend.realtime.publish(activity.sessionId, {
    type: "wordcloud_updated",
    results,
    serverTime: Date.now(),
  });
}

export default function WordCloudInput({
  activity,
  participantId,
}: WordCloudInputProps) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [maxedOut, setMaxedOut] = useState(false);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    backend.responses.hasResponded(activity.id, participantId).then((responded) => {
      if (cancelled) return;
      setMaxedOut(responded);
      setCheckingStatus(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activity.id, participantId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateWord(word);
    if (!validation.valid) {
      setError(validation.error ?? "That word isn't allowed.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitWordAndBroadcast(activity, participantId, word);
      setSubmittedWords((prev) => [...prev, word.trim().toLowerCase()]);
      setWord("");
      const responded = await backend.responses.hasResponded(
        activity.id,
        participantId,
      );
      setMaxedOut(responded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit your word.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingStatus) {
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
      {maxedOut ? (
        <p className="text-center text-sm text-ink-faint">
          You submitted your words — results shown on the main screen
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={word}
            onChange={(event) => {
              setError(null);
              setWord(event.target.value);
            }}
            placeholder="One word…"
            maxLength={24}
            autoFocus
            className="rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
          />
          {error && <p className="text-sm text-ember">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit word"}
          </button>
        </form>
      )}
      {submittedWords.length > 0 && (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {submittedWords.map((submittedWord) => (
            <li
              key={submittedWord}
              className="rounded-full bg-spotlight/15 px-3 py-1 text-sm text-spotlight-ink"
            >
              {submittedWord}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
