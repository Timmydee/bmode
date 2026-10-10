"use client";

import type { CircleAnswer } from "@/lib/backend";
import type { CircleState } from "@/lib/hooks/useCircle";
import { displayName, speakingOrder } from "@/lib/game/circle";
import CircleHostControls from "./CircleHostControls";
import CircleRecap from "./CircleRecap";
import Icon from "@/components/shared/Icon";
import {
  AnswerCard,
  Avatar,
  CardBack,
  CardSlot,
  Embed,
  FlipCard,
  QuestionCard,
  ReactionPill,
  SparksPill,
  channelName,
} from "./Cards";

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

// How long each answer card waits before turning over on reveal, so the
// cards flip one after another instead of all at once.
const FLIP_STAGGER_MS = 350;

// The host's big screen for a running Circle. It doubles as the shared
// screen (TV or laptop) the group looks at between their own phones: a
// channel-style header, the black question card in the middle of the
// table, face-down cards as people play, and a member list on the side.
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
    return <div className="flex flex-1 items-center justify-center text-stage-muted">Dealing the next card…</div>;
  }

  const outLoud = circle.settings.answerMode === "out_loud";
  const answeredIds = new Set(answers.map((a) => a.participantId));
  const everyoneAnswered = participantCount > 0 && answeredIds.size >= participantCount;
  const stillThinking = Math.max(0, participantCount - answeredIds.size);
  const spotlight = answers.find((a) => a.participantId === question.spotlightParticipantId) ?? null;
  const heartCount = (answerId: string) => hearts.filter((h) => h.answerId === answerId).length;
  const roomSize = question.participantCount ?? participantCount;
  const answering = question.phase === "answering";

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rail pb-3">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-bold text-white">
          <span aria-hidden className="text-2xl font-normal text-stage-muted">
            #
          </span>
          <span className="truncate">{channelName(circle.name)}</span>
          <span className="hidden h-5 w-px bg-stage-line sm:block" />
          <span className="hidden text-sm font-medium text-stage-muted sm:block">
            Question {state.questionNumber} of {circle.settings.questionCount}
          </span>
        </h2>
        <span className="flex items-center gap-2">
          <span className="text-sm text-stage-muted sm:hidden">
            {state.questionNumber}/{circle.settings.questionCount}
          </span>
          <SparksPill value={state.totals.pot} label="Sparks the group has earned" />
        </span>
      </header>

      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <main className="flex min-w-0 flex-col items-center gap-8">
          {answering ? (
            <>
              <QuestionCard text={question.text} depth={question.depth} size="lg" className="w-full max-w-2xl" />
              <Table answers={answers} stillThinking={stillThinking} />
              <p className="text-stage-muted">
                <b className="font-display text-white tabular-nums">{answeredIds.size}</b> of{" "}
                <b className="font-display text-white tabular-nums">{participantCount}</b>{" "}
                {outLoud ? "ready" : "answered"}
                {everyoneAnswered ? ". Flipping the cards…" : ""}
              </p>
              {onPlay ? (
                <button type="button" onClick={onPlay} className="text-sm text-blurple-soft hover:underline">
                  Playing too? Play on this device
                </button>
              ) : (
                <p className="text-sm text-stage-muted">
                  Join on your phone with code <span className="font-display font-bold text-white">{joinCode}</span>
                </p>
              )}
            </>
          ) : outLoud ? (
            <>
              <QuestionCard text={question.text} depth={question.depth} className="w-full max-w-xl" />
              <section className="w-full max-w-md">
                <h3 className="mb-2 flex items-center gap-2 px-2 text-xs font-bold tracking-wide text-stage-muted uppercase">
                  <Icon name="volume" className="h-4 w-4" /> Speaking order
                </h3>
                <ol className="flex flex-col gap-1">
                  {speakingOrder(answers, question.spotlightParticipantId).map((answer, index) => (
                    <li
                      key={answer.id}
                      className={`flex animate-deal-in items-center justify-between gap-3 rounded-md px-3 py-2.5 ${
                        index === 0 ? "bg-stage-hover" : ""
                      }`}
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <span className="flex items-center gap-3 text-lg text-white">
                        <span className="w-4 text-right font-display text-sm font-bold tabular-nums text-stage-muted">
                          {index + 1}
                        </span>
                        <Avatar name={displayName(answer.nickname)} speaking={index === 0} />
                        {displayName(answer.nickname)}
                      </span>
                      {heartCount(answer.id) > 0 && (
                        <ReactionPill count={heartCount(answer.id)} label="hearts" tone="dark" />
                      )}
                    </li>
                  ))}
                </ol>
              </section>
              {spotlight && (
                <Embed title={`Once everyone’s shared, ask ${displayName(spotlight.nickname)}`} className="w-full max-w-md">
                  {question.followUp ?? "Tell us more about that."}
                </Embed>
              )}
              <DeeperCount depth={question.depth} votes={deeperVotes.length} roomSize={roomSize} />
            </>
          ) : (
            <>
              <QuestionCard text={question.text} depth={question.depth} className="w-full max-w-xl" />
              <ul className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {answers.map((answer, index) => (
                  <li key={answer.id}>
                    <FlipCard delayMs={index * FLIP_STAGGER_MS}>
                      <AnswerCard
                        text={answer.text}
                        nickname={displayName(answer.nickname)}
                        skipped={answer.skipped}
                        spotlight={answer.id === spotlight?.id}
                        size="lg"
                      >
                        {heartCount(answer.id) > 0 && (
                          <ReactionPill count={heartCount(answer.id)} label="hearts" />
                        )}
                      </AnswerCard>
                    </FlipCard>
                  </li>
                ))}
              </ul>
              {spotlight && (
                <Embed title={`Ask ${displayName(spotlight.nickname)}`} className="w-full max-w-xl">
                  {question.followUp ?? "Tell us more about that."}
                </Embed>
              )}
              <DeeperCount depth={question.depth} votes={deeperVotes.length} roomSize={roomSize} />
            </>
          )}
          {controls}
        </main>

        <MemberList
          answers={answers}
          answering={answering}
          stillThinking={stillThinking}
          heartCount={heartCount}
        />
      </div>
    </div>
  );
}

// The middle of the table while people answer: a face-down card for each
// answer in, and an empty place for everyone still thinking.
function Table({ answers, stillThinking }: { answers: CircleAnswer[]; stillThinking: number }) {
  if (answers.length === 0 && stillThinking === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-4" aria-label="Cards played">
      {answers.map((answer, index) => (
        <li key={answer.id} className="flex flex-col items-center gap-2">
          <CardBack
            label={`${displayName(answer.nickname)} played a card`}
            tilt={index % 2 === 0 ? -3 : 3}
            className="animate-deal-in"
          />
          <span className="max-w-28 truncate text-sm text-stage-text">{displayName(answer.nickname)}</span>
        </li>
      ))}
      {Array.from({ length: Math.min(stillThinking, 8) }, (_, index) => (
        <li key={`slot-${index}`} className="flex flex-col items-center gap-2">
          <CardSlot />
          <span className="text-sm text-stage-muted">Thinking…</span>
        </li>
      ))}
    </ul>
  );
}

// Discord's member list, down the right of the big screen: who has played
// a card, and how many are still thinking.
function MemberList({
  answers,
  answering,
  stillThinking,
  heartCount,
}: {
  answers: CircleAnswer[];
  answering: boolean;
  stillThinking: number;
  heartCount: (answerId: string) => number;
}) {
  return (
    <aside className="hidden flex-col gap-4 rounded-lg bg-stage-2 p-3 lg:flex">
      <section>
        <h3 className="mb-1 px-2 text-xs font-bold tracking-wide text-stage-muted uppercase">
          {answering ? "Played" : "This round"} — {answers.length}
        </h3>
        <ul className="flex flex-col">
          {answers.map((answer) => (
            <li key={answer.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
              <Avatar name={displayName(answer.nickname)} presence="online" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-stage-text">
                  {displayName(answer.nickname)}
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-stage-muted">
                  {answer.skipped ? (
                    "Passed"
                  ) : answering ? (
                    "Played a card"
                  ) : heartCount(answer.id) > 0 ? (
                    <>
                      <Icon name="heart" filled className="h-3 w-3 text-fuchsia" />
                      {heartCount(answer.id)} {heartCount(answer.id) === 1 ? "heart" : "hearts"}
                    </>
                  ) : (
                    "Card revealed"
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {answering && stillThinking > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-xs font-bold tracking-wide text-stage-muted uppercase">
            Thinking — {stillThinking}
          </h3>
          <p className="flex items-center gap-3 px-2 py-1.5 text-sm text-stage-muted">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-stage-button text-white">
              …
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-stage-2 bg-gold" />
            </span>
            Still writing
          </p>
        </section>
      )}
    </aside>
  );
}

function DeeperCount({ depth, votes, roomSize }: { depth: number; votes: number; roomSize: number }) {
  if (depth >= 3) return null;
  const share = roomSize > 0 ? Math.min(1, votes / roomSize) : 0;
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <p className="text-sm text-stage-muted">
        {votes} of {roomSize} want to go deeper. It takes everyone.
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stage-line">
        <div className="h-full rounded-full bg-live transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
