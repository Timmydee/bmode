"use client";

import type { CircleState } from "@/lib/hooks/useCircle";
import { CIRCLE_DEPTH_LABELS, displayName, speakingOrder } from "@/lib/game/circle";
import CircleHostControls from "./CircleHostControls";
import CircleRecap from "./CircleRecap";

interface CircleHostViewProps {
  sessionId: string;
  hostId: string;
  joinCode: string;
  state: CircleState;
  participantCount: number;
  onChanged?: () => void;
  // Offered while the host is only watching: switch to playing on this
  // device, with the host controls in a bar on top.
  onPlay?: () => void;
  // The projector view shows the same screen without any controls.
  readOnly?: boolean;
}

// The host's Stage screen for a running Circle. It doubles as the shared
// screen (TV or laptop) the group looks at between their own phones.
// Auto-reveal is driven by the host page (useCircleAutoReveal), so it
// keeps working when the host plays on their own phone instead.
export default function CircleHostView({
  sessionId,
  hostId,
  joinCode,
  state,
  participantCount,
  onChanged,
  onPlay,
  readOnly = false,
}: CircleHostViewProps) {
  const { circle, question, answers, hearts, deeperVotes } = state;
  const controls = readOnly ? null : (
    <CircleHostControls
      sessionId={sessionId}
      hostId={hostId}
      state={state}
      participantCount={participantCount}
      onChanged={onChanged}
      variant="stage"
    />
  );

  if (circle.status !== "live" && circle.recap) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 py-6">
        <CircleRecap recap={circle.recap} awardVotes={state.awardVotes} variant="stage" />
        {circle.status === "recap" && (
          <p className="text-sm text-stage-muted">Players can vote for awards on their phones.</p>
        )}
        {controls}
      </div>
    );
  }

  if (!question) {
    return <div className="flex flex-1 items-center justify-center text-stage-muted">Loading the next question…</div>;
  }

  const outLoud = circle.settings.answerMode === "out_loud";
  const answeredIds = new Set(answers.map((a) => a.participantId));
  const everyoneAnswered = participantCount > 0 && answeredIds.size >= participantCount;
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
          <span className="font-display font-semibold tabular-nums text-spotlight">{state.totals.pot} ✨ Sparks</span>
        </span>
      </div>

      <h1 className="max-w-[24ch] text-center font-display text-3xl font-bold sm:text-4xl">{question.text}</h1>

      {question.phase === "answering" ? (
        <>
          <p className="text-stage-muted">
            <b className="font-display text-white tabular-nums">{answeredIds.size}</b> of{" "}
            <b className="font-display text-white tabular-nums">{participantCount}</b>{" "}
            {outLoud ? "ready" : "answered"}
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
          {onPlay ? (
            <button type="button" onClick={onPlay} className="text-xs text-stage-muted underline">
              Playing too? Play on this device
            </button>
          ) : (
            <p className="text-xs text-stage-muted">Join on your phone with code {joinCode}.</p>
          )}
        </>
      ) : outLoud ? (
        <>
          <ol className="flex w-full max-w-md flex-col gap-2">
            {speakingOrder(answers, question.spotlightParticipantId).map((answer, index) => (
              <li
                key={answer.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  index === 0 ? "border-spotlight bg-spotlight/10" : "border-stage-line bg-stage-2"
                }`}
              >
                <span className="text-lg text-white">
                  <span className="mr-3 font-display font-semibold tabular-nums text-stage-muted">{index + 1}</span>
                  {displayName(answer.nickname)}
                </span>
                {heartCount(answer.id) > 0 && <span className="text-sm text-stage-muted">💛 {heartCount(answer.id)}</span>}
              </li>
            ))}
          </ol>
          {spotlight && (
            <p className="max-w-[40ch] text-center text-stage-text">
              Once everyone’s shared, ask {displayName(spotlight.nickname)}: {question.followUp ?? "Tell us more about that."}
            </p>
          )}
          <DeeperCount depth={question.depth} votes={deeperVotes.length} roomSize={roomSize} />
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
                <p className="text-lg text-white">{answer.skipped ? "Skipped" : answer.text}</p>
              </li>
            ))}
          </ul>
          {spotlight && (
            <p className="max-w-[40ch] text-center text-stage-text">
              Ask {displayName(spotlight.nickname)}: {question.followUp ?? "Tell us more about that."}
            </p>
          )}
          <DeeperCount depth={question.depth} votes={deeperVotes.length} roomSize={roomSize} />
        </>
      )}
      {controls}
    </div>
  );
}

function DeeperCount({ depth, votes, roomSize }: { depth: number; votes: number; roomSize: number }) {
  if (depth >= 3) return null;
  return (
    <p className="text-sm text-stage-muted">
      {votes} of {roomSize} want to go deeper. It takes everyone.
    </p>
  );
}
