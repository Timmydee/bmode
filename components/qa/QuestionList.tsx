"use client";

import { useState } from "react";
import { backend } from "@/lib/backend";
import type { AudienceQuestion } from "@/lib/backend";
import { rankQuestions } from "@/lib/game/rank-questions";

interface QuestionListProps {
  sessionId: string;
  activityId: string;
  questions: AudienceQuestion[];
  variant: "stage" | "paper";
  // Presence of currentParticipantId enables upvoting (participant mode).
  currentParticipantId?: string;
  // moderatable enables answered/hide controls and shows hidden questions
  // (host mode).
  moderatable?: boolean;
}

async function fetchAndBroadcastQuestion(
  sessionId: string,
  activityId: string,
  questionId: string,
): Promise<void> {
  const questions = await backend.qa.list(activityId, { includeHidden: true });
  const updated = questions.find((question) => question.id === questionId);
  if (!updated) return;
  await backend.realtime.publish(sessionId, {
    type: "question_updated",
    question: updated,
    serverTime: Date.now(),
  });
}

async function toggleUpvote(
  sessionId: string,
  activityId: string,
  questionId: string,
  participantId: string,
  currentlyUpvoted: boolean,
): Promise<void> {
  if (currentlyUpvoted) {
    await backend.qa.removeUpvote(questionId, participantId);
  } else {
    await backend.qa.upvote(questionId, participantId);
  }
  await fetchAndBroadcastQuestion(sessionId, activityId, questionId);
}

async function setAnsweredAndBroadcast(
  sessionId: string,
  activityId: string,
  questionId: string,
  answered: boolean,
): Promise<void> {
  await backend.qa.setAnswered(questionId, answered);
  await fetchAndBroadcastQuestion(sessionId, activityId, questionId);
}

async function setHiddenAndBroadcast(
  sessionId: string,
  activityId: string,
  questionId: string,
  hidden: boolean,
): Promise<void> {
  await backend.qa.setHidden(questionId, hidden);
  await fetchAndBroadcastQuestion(sessionId, activityId, questionId);
}

export default function QuestionList({
  sessionId,
  activityId,
  questions,
  variant,
  currentParticipantId,
  moderatable,
}: QuestionListProps) {
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const ranked = rankQuestions(questions, {
    includeHidden: Boolean(moderatable),
  });
  const isStage = variant === "stage";

  async function handleToggleUpvote(question: AudienceQuestion) {
    if (!currentParticipantId) return;
    const currentlyUpvoted = upvotedIds.has(question.id);
    setPendingIds((prev) => new Set(prev).add(question.id));
    try {
      await toggleUpvote(
        sessionId,
        activityId,
        question.id,
        currentParticipantId,
        currentlyUpvoted,
      );
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        if (currentlyUpvoted) next.delete(question.id);
        else next.add(question.id);
        return next;
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(question.id);
        return next;
      });
    }
  }

  if (ranked.length === 0) {
    return (
      <p className={isStage ? "text-stage-muted" : "text-ink-soft"}>
        No questions yet.
      </p>
    );
  }

  return (
    <ul className="flex w-full max-w-2xl flex-col gap-3">
      {ranked.map((question) => (
        <li
          key={question.id}
          className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
            isStage
              ? "border-stage-line bg-stage-2"
              : "border-hairline bg-white"
          } ${question.hidden ? "opacity-50" : ""}`}
        >
          <div className="flex-1">
            <p className={isStage ? "text-stage-text" : "text-ink"}>
              {question.text}
            </p>
            <p
              className={`mt-1 text-xs ${isStage ? "text-stage-muted" : "text-ink-faint"}`}
            >
              {question.authorNickname ?? "Anonymous"}
              {question.answered && " · Answered"}
              {question.hidden && " · Hidden"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {currentParticipantId && (
              <button
                type="button"
                disabled={
                  question.participantId === currentParticipantId ||
                  pendingIds.has(question.id)
                }
                onClick={() => handleToggleUpvote(question)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  upvotedIds.has(question.id)
                    ? "border-spotlight bg-spotlight/15 text-spotlight-ink"
                    : isStage
                      ? "border-stage-line text-stage-text"
                      : "border-hairline text-ink"
                }`}
              >
                {question.upvotes}
              </button>
            )}
            {moderatable && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setAnsweredAndBroadcast(
                      sessionId,
                      activityId,
                      question.id,
                      !question.answered,
                    )
                  }
                  className="rounded-lg border border-stage-line px-3 py-1.5 text-sm text-stage-text"
                >
                  {question.answered ? "Mark unanswered" : "Mark answered"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHiddenAndBroadcast(
                      sessionId,
                      activityId,
                      question.id,
                      !question.hidden,
                    )
                  }
                  className="rounded-lg border border-stage-line px-3 py-1.5 text-sm text-stage-text"
                >
                  {question.hidden ? "Unhide" : "Hide"}
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
