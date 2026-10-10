"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { CircleAnswer } from "@/lib/backend";
import type { CircleState } from "@/lib/hooks/useCircle";
import {
  submitCircleAnswer,
  toggleCircleHeart,
  toggleDeeperVote,
  voteCircleAward,
} from "@/lib/circle/actions";
import { sparkFeedback } from "@/lib/circle/feedback";
import { circleAwardsEnabled, displayName, speakingOrder } from "@/lib/game/circle";
import { CIRCLE_ANSWER_MAX_LENGTH, validateCircleAnswer } from "@/lib/game/validation";
import CircleRecap, { CIRCLE_AWARDS } from "./CircleRecap";
import {
  AnswerCard,
  Avatar,
  CardBack,
  Embed,
  FlipCard,
  QuestionCard,
  ReactionPill,
  SparksPill,
  channelName,
} from "./Cards";

// Answer cards on a phone turn over a little faster than on the big screen.
const FLIP_STAGGER_MS = 250;

interface CirclePlayerViewProps {
  sessionId: string;
  participantId: string;
  state: CircleState;
}

// One player's phone during a Circle: the black question card on top,
// your answer written on a white card and played face down, then every
// card turned over together for reactions.
export default function CirclePlayerView({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, question } = state;
  const toasts = useSparkToasts(state, participantId);

  if (circle.status !== "live" && circle.recap) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
        <CircleRecap
          recap={circle.recap}
          awardVotes={state.awardVotes}
          variant="paper"
          highlightParticipantId={participantId}
        />
        <AwardVoting sessionId={sessionId} participantId={participantId} state={state} />
        {circle.status === "ended" && (
          <p className="text-center text-sm text-ink-faint">Thanks for playing. The host can deal another game.</p>
        )}
      </div>
    );
  }

  if (!question) {
    return <div className="flex flex-1 items-center justify-center text-ink-soft">Dealing the next card…</div>;
  }

  const competitive = circle.settings.rewardStyle === "competitive";
  const mySparks = state.totals.byParticipant.get(participantId) ?? 0;
  const myHearts = state.totals.heartsByParticipant.get(participantId) ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-3 pb-10">
      <header className="flex items-center justify-between gap-2 border-b border-rail pb-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="text-xl text-ink-faint">
            #
          </span>
          <span className="truncate font-display font-bold text-ink">{channelName(circle.name)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-ink-faint">
            Question {state.questionNumber} of {circle.settings.questionCount}
          </span>
          {competitive ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-fuchsia/15 px-2.5 py-1 font-display text-sm font-bold tabular-nums text-fuchsia"
              title="Hearts you’ve received"
            >
              {myHearts} 💛
              <span className="sr-only">hearts, {mySparks} Sparks</span>
            </span>
          ) : (
            <SparksPill value={state.totals.pot} label="Sparks the group has earned" />
          )}
        </span>
      </header>
      <SparkToasts toasts={toasts} />
      <h1 className="sr-only">{question.text}</h1>
      <QuestionCard text={question.text} depth={question.depth} />
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

interface Toast {
  id: number;
  text: string;
}

// Turns each new reward (see lib/circle/feedback.ts) into a short-lived
// toast. The previous state is kept in state, not a ref, and compared
// during render, React's pattern for reacting to a changed prop.
function useSparkToasts(state: CircleState, participantId: string): Toast[] {
  const [seen, setSeen] = useState(state);
  const [toasts, setToasts] = useState<Toast[]>([]);
  if (seen !== state) {
    setSeen(state);
    const messages = sparkFeedback(seen, state, participantId);
    // Rewards belong to the question they were earned on; drop any still
    // queued once the game moves on.
    if (seen.question?.id !== state.question?.id) setToasts([]);
    if (messages.length > 0) {
      setToasts((current) => {
        let id = current.at(-1)?.id ?? 0;
        return [...current, ...messages.map((text) => ({ id: ++id, text }))];
      });
    }
  }

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((current) => current.slice(1)), 2200);
    return () => clearTimeout(timer);
  }, [toasts]);

  return toasts;
}

function SparkToasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.slice(0, 2).map((toast) => (
        <p
          key={toast.id}
          className="animate-toast-in rounded-lg border-l-4 border-gold bg-floating px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_8px_24px_rgb(0_0_0/50%)]"
        >
          {toast.text}
        </p>
      ))}
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
      <div className="flex flex-col items-center gap-4 rounded-lg bg-paper-2 p-6 text-center">
        <CardBack tilt={-4} className="animate-deal-in" />
        <p className="font-display text-lg font-bold text-ink">
          {mine.skipped ? "You passed on this one" : outLoud ? "You’re ready" : "Your card is on the table"}
        </p>
        {mine.text && <p className="text-ink-soft">“{mine.text}”</p>}
        <PlayedBy answers={answers} />
        <p className="text-sm text-ink-faint">Every card turns over at the same time.</p>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-blurple-soft hover:underline">
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
          className="rounded-[4px] bg-blurple px-5 py-3 font-semibold text-white transition-colors hover:bg-spotlight-hover disabled:opacity-60"
        >
          I’m ready
        </button>
        <SkipButton disabled={submitting} onSkip={() => send({ text: null, skipped: true })} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* The answer is written straight onto a white card. */}
      <label className="flex min-h-44 flex-col justify-between gap-3 rounded-2xl bg-card-white p-5 text-card-ink shadow-[0_8px_24px_rgb(0_0_0/35%)] focus-within:ring-4 focus-within:ring-blurple/60">
        <span className="sr-only">Your answer</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CIRCLE_ANSWER_MAX_LENGTH}
          rows={3}
          autoFocus
          placeholder="Write your card…"
          className="resize-none bg-transparent font-card text-xl leading-snug font-extrabold tracking-tight text-card-ink outline-none placeholder:text-card-muted/70"
        />
        <span className="flex items-center justify-between text-xs font-semibold text-card-muted">
          <span>Hidden until everyone’s in</span>
          <span className="tabular-nums">
            {text.length}/{CIRCLE_ANSWER_MAX_LENGTH}
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-[4px] bg-blurple px-5 py-3 font-semibold text-white transition-colors hover:bg-spotlight-hover disabled:opacity-60"
      >
        {submitting ? "Playing…" : mine ? "Update my card" : "Play this card"}
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
      className="rounded-[4px] bg-stage-button px-5 py-3 font-semibold text-white transition-colors hover:bg-stage-button-hover disabled:opacity-60"
    >
      Pass on this one (no penalty)
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
  const outLoud = circle.settings.answerMode === "out_loud";
  const answeredThis = answers.some((a) => a.participantId === participantId);
  const heartProps = (answer: CircleAnswer) => ({
    hearts: hearts.filter((h) => h.answerId === answer.id).length,
    hearted: hearts.some((h) => h.answerId === answer.id && h.participantId === participantId),
    onToggleHeart: (on: boolean) =>
      handle(() =>
        toggleCircleHeart({
          sessionId,
          circleId: circle.id,
          circleQuestionId: question.id,
          answerId: answer.id,
          participantId,
          on,
        }),
      ),
  });

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
      {!answeredThis && (
        <Embed accent="live" title="Welcome in">
          You’re dealt in from the next question. Here’s what everyone said to this one.
        </Embed>
      )}

      {outLoud ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 px-1 text-xs font-bold tracking-wide text-ink-faint uppercase">
              <span aria-hidden>🔊</span> Speaking order
            </h2>
            <ol className="flex flex-col gap-1">
              {speakingOrder(answers, question.spotlightParticipantId).map((answer, index) => (
                <SpeakerCard
                  key={answer.id}
                  answer={answer}
                  position={index + 1}
                  isMine={answer.participantId === participantId}
                  {...heartProps(answer)}
                />
              ))}
            </ol>
          </section>
          {spotlight && (
            <Embed
              title={
                spotlight.participantId === participantId
                  ? "Once everyone’s shared, you get the follow-up"
                  : `Once everyone’s shared, ask ${displayName(spotlight.nickname)}`
              }
            >
              {question.followUp ?? "Tell us more about that."}
            </Embed>
          )}
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {answers.map((answer, index) => (
              <PlayedCard
                key={answer.id}
                answer={answer}
                index={index}
                isMine={answer.participantId === participantId}
                spotlight={answer.participantId === question.spotlightParticipantId}
                {...heartProps(answer)}
              />
            ))}
          </ul>

          {spotlight && (
            <Embed
              title={
                spotlight.participantId === participantId
                  ? "You’re in the spotlight"
                  : `Spotlight on ${displayName(spotlight.nickname)}`
              }
            >
              {question.followUp ?? "Tell us more about that."}
            </Embed>
          )}
        </>
      )}

      {question.depth < 3 && (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-paper-2 p-4 text-center">
          <p className="text-sm text-ink-soft">
            Go deeper next? It only happens if everyone’s in ({deeperVotes.length} of {roomSize}).
          </p>
          <div className="flex -space-x-1.5" aria-hidden>
            {answers
              .filter((a) => deeperVotes.includes(a.participantId))
              .map((a) => (
                <span key={a.id} className="rounded-full ring-2 ring-paper-2">
                  <Avatar name={displayName(a.nickname)} size="sm" />
                </span>
              ))}
          </div>
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
            className={`rounded-[4px] px-5 py-2.5 font-semibold transition-colors ${
              votedDeeper ? "bg-live text-live-ink" : "bg-stage-button text-white hover:bg-stage-button-hover"
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

// Who has played a card so far, as a row of avatars.
function PlayedBy({ answers }: { answers: CircleAnswer[] }) {
  if (answers.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex -space-x-1.5" aria-hidden>
        {answers.map((a) => (
          <span key={a.id} className="rounded-full ring-2 ring-paper-2">
            <Avatar name={displayName(a.nickname)} size="sm" />
          </span>
        ))}
      </div>
      <p className="text-sm text-ink-soft">{answers.length} played</p>
    </div>
  );
}

function PlayedCard({
  answer,
  index,
  isMine,
  spotlight,
  hearts,
  hearted,
  onToggleHeart,
}: {
  answer: CircleAnswer;
  index: number;
  isMine: boolean;
  spotlight: boolean;
  hearts: number;
  hearted: boolean;
  onToggleHeart: (on: boolean) => void;
}) {
  const canHeart = !isMine && !answer.skipped;
  return (
    <li>
      <FlipCard delayMs={index * FLIP_STAGGER_MS}>
        <AnswerCard
          text={answer.text}
          nickname={displayName(answer.nickname)}
          skipped={answer.skipped}
          isMine={isMine}
          spotlight={spotlight}
        >
          {canHeart ? (
            <ReactionPill
              emoji={hearted ? "💛" : "🤍"}
              count={hearts}
              active={hearted}
              label={hearted ? "Remove heart" : "Heart this answer"}
              onClick={() => onToggleHeart(!hearted)}
            />
          ) : (
            hearts > 0 && <ReactionPill emoji="💛" count={hearts} label="hearts" />
          )}
        </AnswerCard>
      </FlipCard>
    </li>
  );
}

function SpeakerCard({
  answer,
  position,
  isMine,
  hearts,
  hearted,
  onToggleHeart,
}: {
  answer: CircleAnswer;
  position: number;
  isMine: boolean;
  hearts: number;
  hearted: boolean;
  onToggleHeart: (on: boolean) => void;
}) {
  const name = displayName(answer.nickname);
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ${
        position === 1 ? "bg-stage-hover" : "bg-paper-2"
      }`}
    >
      <p className="flex min-w-0 items-center gap-3 text-ink">
        <span className="w-3 text-right font-display text-sm font-bold tabular-nums text-ink-faint">{position}</span>
        <Avatar name={name} speaking={position === 1} />
        <span className="truncate font-medium">
          {name}
          {isMine && " (you)"}
        </span>
      </p>
      {isMine ? (
        hearts > 0 && <ReactionPill emoji="💛" count={hearts} label="hearts" tone="dark" />
      ) : (
        <button
          type="button"
          aria-pressed={hearted}
          onClick={() => onToggleHeart(!hearted)}
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-sm font-semibold transition-transform active:scale-90 ${
            hearted ? "border-blurple bg-blurple/15 text-blurple-soft" : "border-transparent bg-stage text-ink-soft"
          }`}
        >
          {hearted ? "💛 Loved it" : "🤍 Loved what they said"}
        </button>
      )}
    </li>
  );
}

function AwardVoting({ sessionId, participantId, state }: CirclePlayerViewProps) {
  const { circle, awardVotes } = state;
  const [error, setError] = useState<string | null>(null);
  const players = circle.recap?.players ?? [];
  const others = players.filter((p) => p.participantId !== participantId);
  if (!circleAwardsEnabled(players.length) || others.length === 0) return null;

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
      <h2 className="font-display text-lg font-bold text-ink">Hand out awards</h2>
      {CIRCLE_AWARDS.map(({ award, label }) => {
        const myVote = awardVotes.find((v) => v.participantId === participantId && v.award === award);
        return (
          <div key={award} className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-wide text-ink-faint uppercase">{label}</p>
            <div className="flex flex-wrap gap-2">
              {others.map((player) => {
                const selected = myVote?.nomineeParticipantId === player.participantId;
                return (
                  <button
                    key={player.participantId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => vote(award, player.participantId)}
                    className={`flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors ${
                      selected ? "bg-blurple text-white" : "bg-paper-2 text-ink hover:bg-stage-hover"
                    }`}
                  >
                    <Avatar name={displayName(player.nickname)} size="sm" />
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
