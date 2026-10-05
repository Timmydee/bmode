"use client";

import { useState, type FormEvent } from "react";
import type { CircleAnswer } from "@/lib/backend";
import type { CircleState } from "@/lib/hooks/useCircle";
import {
  submitCircleAnswer,
  toggleCircleHeart,
  toggleDeeperVote,
  voteCircleAward,
} from "@/lib/circle/actions";
import { CIRCLE_DEPTH_LABELS, displayName } from "@/lib/game/circle";
import { CIRCLE_ANSWER_MAX_LENGTH, validateCircleAnswer } from "@/lib/game/validation";
import CircleRecap, { CIRCLE_AWARDS } from "./CircleRecap";

interface CirclePlayerViewProps {
  sessionId: string;
  participantId: string;
  state: CircleState;
}

// One player's phone during a Circle (Paper surface): answer privately,
// then react to everyone's answers once they reveal together.
export default function CirclePlayerView({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, question } = state;

  if (circle.status === "recap" && circle.recap) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
        <CircleRecap
          recap={circle.recap}
          awardVotes={state.awardVotes}
          variant="paper"
          highlightParticipantId={participantId}
        />
        <AwardVoting sessionId={sessionId} participantId={participantId} state={state} />
      </div>
    );
  }

  if (!question) {
    return <div className="flex flex-1 items-center justify-center text-ink-soft">Next question coming up…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>
          Question {state.questionNumber} of {circle.settings.questionCount}
        </span>
        <span className="rounded-full bg-paper-2 px-3 py-1 text-ink">{CIRCLE_DEPTH_LABELS[question.depth]}</span>
      </div>
      <h1 className="font-display text-2xl font-bold leading-tight text-ink">{question.text}</h1>
      {question.phase === "answering" ? (
        <Answering
          // Remount per question so a half-typed answer never carries over.
          key={question.id}
          sessionId={sessionId}
          participantId={participantId}
          state={state}
        />
      ) : (
        <Revealed sessionId={sessionId} participantId={participantId} state={state} />
      )}
    </div>
  );
}

function Answering({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, question, answers } = state;
  const mine = answers.find((a) => a.participantId === participantId) ?? null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(mine?.text ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outLoud = circle.settings.answerMode === "out_loud";

  async function send(answer: { text: string | null; skipped: boolean }) {
    if (!question) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitCircleAnswer({
        sessionId,
        circleId: circle.id,
        circleQuestionId: question.id,
        participantId,
        ...answer,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateCircleAnswer(text);
    if (!result.valid) {
      setError(result.error ?? "Check your answer.");
      return;
    }
    void send({ text, skipped: false });
  }

  if (mine && !editing) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-hairline bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-ink">
          {mine.skipped ? "You skipped this one" : outLoud ? "You’re ready" : "Answer locked in"}
        </p>
        {mine.text && <p className="text-ink-soft">“{mine.text}”</p>}
        <p className="text-sm text-ink-faint">
          {answers.length} answered. Everyone sees the answers at the same time.
        </p>
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-ink-soft underline">
          Change my answer
        </button>
      </div>
    );
  }

  if (outLoud) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink-soft">Think of your answer. You’ll say it out loud once everyone is ready.</p>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="button"
          disabled={submitting}
          onClick={() => send({ text: null, skipped: false })}
          className="rounded-[10px] bg-spotlight px-5 py-3 font-medium text-spotlight-ink disabled:opacity-60"
        >
          I’m ready
        </button>
        <SkipButton disabled={submitting} onSkip={() => send({ text: null, skipped: true })} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={CIRCLE_ANSWER_MAX_LENGTH}
        rows={4}
        autoFocus
        placeholder="Your answer stays hidden until everyone’s in"
        className="rounded-[10px] border-[1.5px] border-hairline bg-white px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <p className="text-right text-xs text-ink-faint">
        {text.length}/{CIRCLE_ANSWER_MAX_LENGTH}
      </p>
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-[10px] bg-spotlight px-5 py-3 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {submitting ? "Sending…" : mine ? "Update answer" : "Send answer"}
      </button>
      <SkipButton disabled={submitting} onSkip={() => send({ text: null, skipped: true })} />
    </form>
  );
}

function SkipButton({ disabled, onSkip }: { disabled: boolean; onSkip: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSkip}
      className="rounded-[10px] border-[1.5px] border-hairline px-5 py-3 font-medium text-ink-soft disabled:opacity-60"
    >
      Skip this one (no penalty)
    </button>
  );
}

function Revealed({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, question, answers, hearts, deeperVotes } = state;
  const [error, setError] = useState<string | null>(null);
  if (!question) return null;

  const spotlight = answers.find((a) => a.participantId === question.spotlightParticipantId) ?? null;
  const votedDeeper = deeperVotes.includes(participantId);
  const roomSize = question.participantCount ?? answers.length;

  async function handle(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t go through. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {spotlight && (
        <div className="rounded-xl bg-spotlight/20 p-4 text-spotlight-ink">
          <p className="text-sm font-medium">
            {spotlight.participantId === participantId
              ? "You’re in the spotlight"
              : `Spotlight on ${displayName(spotlight.nickname)}`}
          </p>
          <p>{question.followUp ?? "Tell us more about that."}</p>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {answers.map((answer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            isMine={answer.participantId === participantId}
            hearts={hearts.filter((h) => h.answerId === answer.id).length}
            hearted={hearts.some((h) => h.answerId === answer.id && h.participantId === participantId)}
            onToggleHeart={(on) =>
              handle(() =>
                toggleCircleHeart({
                  sessionId,
                  circleId: circle.id,
                  circleQuestionId: question.id,
                  answerId: answer.id,
                  participantId,
                  on,
                }),
              )
            }
          />
        ))}
      </ul>

      {question.depth < 3 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-white p-4 text-center">
          <p className="text-sm text-ink-soft">
            Go deeper next? It only happens if everyone’s in ({deeperVotes.length} of {roomSize}).
          </p>
          <button
            type="button"
            aria-pressed={votedDeeper}
            onClick={() =>
              handle(() =>
                toggleDeeperVote({
                  sessionId,
                  circleId: circle.id,
                  circleQuestionId: question.id,
                  participantId,
                  on: !votedDeeper,
                }),
              )
            }
            className={`rounded-[10px] px-5 py-2.5 font-medium ${
              votedDeeper ? "bg-live text-live-ink" : "border-[1.5px] border-hairline text-ink"
            }`}
          >
            {votedDeeper ? "You’re in ✓" : "I’m in"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-ember">{error}</p>}
      <p className="text-center text-xs text-ink-faint">The host moves to the next question.</p>
    </div>
  );
}

function AnswerCard({
  answer,
  isMine,
  hearts,
  hearted,
  onToggleHeart,
}: {
  answer: CircleAnswer;
  isMine: boolean;
  hearts: number;
  hearted: boolean;
  onToggleHeart: (on: boolean) => void;
}) {
  const canHeart = !isMine && !answer.skipped;
  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-xl border border-hairline bg-white p-4 ${
        answer.skipped ? "opacity-50" : ""
      }`}
    >
      <div>
        <p className="text-sm text-ink-soft">
          {displayName(answer.nickname)}
          {isMine && " (you)"}
        </p>
        <p className="text-ink">{answer.skipped ? "Skipped" : (answer.text ?? "Sharing out loud")}</p>
      </div>
      {canHeart ? (
        <button
          type="button"
          aria-pressed={hearted}
          aria-label={hearted ? "Remove heart" : "Heart this answer"}
          onClick={() => onToggleHeart(!hearted)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm tabular-nums transition-transform active:scale-90 ${
            hearted ? "bg-spotlight/25 text-spotlight-ink" : "border border-hairline text-ink-soft"
          }`}
        >
          {hearted ? "💛" : "🤍"} {hearts > 0 ? hearts : ""}
        </button>
      ) : (
        hearts > 0 && <span className="shrink-0 text-sm text-ink-soft">💛 {hearts}</span>
      )}
    </li>
  );
}

function AwardVoting({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, awardVotes } = state;
  const [error, setError] = useState<string | null>(null);
  const others = (circle.recap?.players ?? []).filter((p) => p.participantId !== participantId);
  if (others.length === 0) return null;

  async function vote(award: (typeof CIRCLE_AWARDS)[number]["award"], nomineeParticipantId: string) {
    setError(null);
    try {
      await voteCircleAward({ sessionId, circleId: circle.id, participantId, award, nomineeParticipantId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your vote.");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">Hand out awards</h2>
      {CIRCLE_AWARDS.map(({ award, label }) => {
        const myVote = awardVotes.find((v) => v.participantId === participantId && v.award === award);
        return (
          <div key={award} className="flex flex-col gap-2">
            <p className="text-sm text-ink-soft">{label}</p>
            <div className="flex flex-wrap gap-2">
              {others.map((player) => {
                const selected = myVote?.nomineeParticipantId === player.participantId;
                return (
                  <button
                    key={player.participantId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => vote(award, player.participantId)}
                    className={`rounded-[10px] px-4 py-2 text-sm font-medium ${
                      selected ? "bg-spotlight text-spotlight-ink" : "border-[1.5px] border-hairline text-ink"
                    }`}
                  >
                    {displayName(player.nickname)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {error && <p className="text-sm text-ember">{error}</p>}
    </section>
  );
}
