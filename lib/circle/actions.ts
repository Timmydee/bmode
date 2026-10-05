import { backend } from "@/lib/backend";
import type {
  Circle,
  CircleAnswer,
  CircleAward,
  CircleHeart,
  CircleQuestion,
} from "@/lib/backend";
import {
  chooseSpotlight,
  circleGroupKey,
  computeCircleRecap,
  isDeeperUnanimous,
  nextDepth,
  pickNextQuestion,
  scoreCircleQuestion,
  type CircleQuestionTally,
} from "@/lib/game/circle";

// The host's browser drives a Circle, the same way it drives rounds and
// surveys: every step reads the current state, applies a rule from
// lib/game/circle.ts, writes the result, then broadcasts circle_updated so
// every phone refetches. Participants only ever write their own answers,
// hearts and votes.

async function publishUpdated(sessionId: string, circleId: string): Promise<void> {
  await backend.realtime.publish(sessionId, {
    type: "circle_updated",
    circleId,
    serverTime: Date.now(),
  });
}

async function addNextQuestion(
  circle: Circle,
  depth: Circle["depth"],
  played: CircleQuestion[],
): Promise<CircleQuestion> {
  const picked = pickNextQuestion({
    vibe: circle.settings.vibe,
    depth,
    questionIndex: played.length,
    usedTexts: played.map((q) => q.text),
    customQuestions: circle.settings.customQuestions,
    random: Math.random,
  });
  return backend.circles.addQuestion({
    circleId: circle.id,
    order: played.length,
    ...picked,
  });
}

export async function startCircle(sessionId: string, circle: Circle): Promise<void> {
  const played = await backend.circles.listQuestions(circle.id);
  const question = await addNextQuestion(circle, circle.depth, played);
  await backend.circles.updateCircle(circle.id, {
    status: "live",
    currentQuestionId: question.id,
  });
  await publishUpdated(sessionId, circle.id);
}

export async function revealCircleQuestion(input: {
  sessionId: string;
  circle: Circle;
  question: CircleQuestion;
  answers: CircleAnswer[];
  participantCount: number;
}): Promise<void> {
  const played = await backend.circles.listQuestions(input.circle.id);
  const spotlight = chooseSpotlight({
    answers: input.answers,
    previousSpotlights: played
      .map((q) => q.spotlightParticipantId)
      .filter((id): id is string => Boolean(id)),
    random: Math.random,
  });
  const answeredPeople = new Set(input.answers.map((a) => a.participantId)).size;
  await backend.circles.updateQuestion(input.question.id, {
    phase: "revealed",
    spotlightParticipantId: spotlight,
    // Whoever is in the room when the answers reveal is "everyone" for
    // the Full Circle bonus and the go-deeper vote.
    participantCount: Math.max(input.participantCount, answeredPeople),
  });
  await publishUpdated(input.sessionId, input.circle.id);
}

function tallyFor(
  question: CircleQuestion,
  answers: CircleAnswer[],
  hearts: CircleHeart[],
  wentDeeper: boolean,
): CircleQuestionTally {
  const own = answers.filter((a) => a.circleQuestionId === question.id);
  const ownIds = new Set(own.map((a) => a.id));
  return {
    text: question.text,
    depth: question.depth,
    participantCount: question.participantCount ?? own.length,
    wentDeeper,
    answers: own.map((a) => ({ id: a.id, participantId: a.participantId, skipped: a.skipped })),
    hearts: hearts.filter((h) => ownIds.has(h.answerId)),
  };
}

// Scores the revealed question, then either draws the next one (one level
// deeper if the whole room voted for it) or ends the game.
export async function advanceCircle(input: {
  sessionId: string;
  hostId: string;
  circle: Circle;
  question: CircleQuestion;
  answers: CircleAnswer[];
  hearts: CircleHeart[];
  deeperVotes: string[];
}): Promise<void> {
  const { circle, question } = input;
  const wentDeeper =
    question.depth < 3 &&
    isDeeperUnanimous(input.deeperVotes.length, question.participantCount ?? 0);
  const score = scoreCircleQuestion(tallyFor(question, input.answers, input.hearts, wentDeeper));

  await backend.circles.updateQuestion(question.id, { phase: "done", wentDeeper });

  const played = await backend.circles.listQuestions(circle.id);
  if (played.length >= circle.settings.questionCount) {
    await endCircle({ sessionId: input.sessionId, hostId: input.hostId, circle });
    return;
  }

  const depth = nextDepth(question.depth, wentDeeper);
  const next = await addNextQuestion(circle, depth, played);
  await backend.circles.updateCircle(circle.id, {
    currentQuestionId: next.id,
    depth,
    pot: circle.pot + score.pot,
  });
  await publishUpdated(input.sessionId, circle.id);
}

// Totals the game from the database (not from the running pot), so ending
// early or reloading the host page mid-game still gives the right recap.
export async function endCircle(input: {
  sessionId: string;
  hostId: string;
  circle: Circle;
}): Promise<void> {
  const { circle } = input;
  const questions = (await backend.circles.listQuestions(circle.id)).filter(
    (q) => q.phase !== "answering",
  );
  const answers = await backend.circles.listAnswers(questions.map((q) => q.id));
  const hearts = await backend.circles.listHearts(answers.map((a) => a.id));
  const participants = await backend.participants.listBySession(input.sessionId);

  const players = participants.filter((p) => answers.some((a) => a.participantId === p.id));
  const groupKey = circleGroupKey(players.map((p) => p.nickname));
  const bondBefore = players.length > 0 ? await backend.circles.getBond(input.hostId, groupKey) : 0;

  const recap = computeCircleRecap({
    questions: questions.map((q) => tallyFor(q, answers, hearts, q.wentDeeper)),
    participants,
    rewardStyle: circle.settings.rewardStyle,
    bondBefore,
    localHour: new Date().getHours(),
  });

  if (players.length > 0) await backend.circles.saveBond(input.hostId, groupKey, recap.bondAfter);
  for (const question of questions) {
    if (question.phase !== "done") await backend.circles.updateQuestion(question.id, { phase: "done" });
  }
  await backend.circles.updateCircle(circle.id, {
    status: "recap",
    currentQuestionId: null,
    pot: recap.pot,
    bondPrior: bondBefore,
    recap,
  });
  await publishUpdated(input.sessionId, circle.id);
}

export async function closeCircle(sessionId: string, circleId: string): Promise<void> {
  await backend.circles.updateCircle(circleId, { status: "ended" });
  await publishUpdated(sessionId, circleId);
}

/* ---------- Participant side ---------- */

async function publishAnswersChanged(
  sessionId: string,
  circleId: string,
  circleQuestionId: string | null,
): Promise<void> {
  await backend.realtime.publish(sessionId, {
    type: "circle_answers_changed",
    circleId,
    circleQuestionId,
    serverTime: Date.now(),
  });
}

export async function submitCircleAnswer(input: {
  sessionId: string;
  circleId: string;
  circleQuestionId: string;
  participantId: string;
  text: string | null;
  skipped: boolean;
}): Promise<void> {
  await backend.circles.submitAnswer({
    circleQuestionId: input.circleQuestionId,
    participantId: input.participantId,
    text: input.text?.trim() || null,
    skipped: input.skipped,
  });
  navigator.vibrate?.(30);
  await publishAnswersChanged(input.sessionId, input.circleId, input.circleQuestionId);
}

export async function toggleCircleHeart(input: {
  sessionId: string;
  circleId: string;
  circleQuestionId: string;
  answerId: string;
  participantId: string;
  on: boolean;
}): Promise<void> {
  await backend.circles.setHeart(input);
  await publishAnswersChanged(input.sessionId, input.circleId, input.circleQuestionId);
}

export async function toggleDeeperVote(input: {
  sessionId: string;
  circleId: string;
  circleQuestionId: string;
  participantId: string;
  on: boolean;
}): Promise<void> {
  await backend.circles.setDeeperVote(input);
  await publishAnswersChanged(input.sessionId, input.circleId, input.circleQuestionId);
}

export async function voteCircleAward(input: {
  sessionId: string;
  circleId: string;
  participantId: string;
  award: CircleAward;
  nomineeParticipantId: string;
}): Promise<void> {
  await backend.circles.voteAward(input);
  await publishAnswersChanged(input.sessionId, input.circleId, null);
}
