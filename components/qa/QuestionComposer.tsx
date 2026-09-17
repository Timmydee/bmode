"use client";

import { useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { QAActivity } from "@/lib/backend";
import { validateQuestion } from "@/lib/game/validation";

interface QuestionComposerProps {
  activity: QAActivity;
  participantId: string;
}

async function submitQuestionAndBroadcast(
  activity: QAActivity,
  participantId: string,
  text: string,
): Promise<void> {
  const question = await backend.qa.submit({
    activityId: activity.id,
    participantId,
    text,
  });
  await backend.realtime.publish(activity.sessionId, {
    type: "question_added",
    question,
    serverTime: Date.now(),
  });
}

export default function QuestionComposer({
  activity,
  participantId,
}: QuestionComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateQuestion(text);
    if (!validation.valid) {
      setError(validation.error ?? "That question isn't allowed.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitQuestionAndBroadcast(activity, participantId, text.trim());
      setText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit your question.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(event) => {
          setError(null);
          setText(event.target.value);
        }}
        placeholder="Ask a question…"
        maxLength={280}
        rows={3}
        className="resize-none rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Ask"}
      </button>
    </form>
  );
}
