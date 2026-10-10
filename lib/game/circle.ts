import type {
  CircleBadge,
  CirclePlannedQuestion,
  CircleDepth,
  CircleRecap,
  CircleRewardStyle,
  CircleVibe,
} from "../backend/types";
import { CIRCLE_QUESTIONS, type LibraryQuestion } from "./circle-questions";

// Pure Circle game rules — no Date.now(), no Math.random() at module level,
// no backend imports. Randomness and the clock are passed in so every rule
// here is deterministic under test, same as scoring.ts and leaderboard.ts.

export const CIRCLE_SPARKS = {
  answer: 10,
  heart: 3,
  fullCircle: 20,
  deeper: 15,
} as const;

export const CIRCLE_DEPTH_LABELS: Record<CircleDepth, string> = {
  1: "Light",
  2: "Real",
  3: "Deep",
};

export const CIRCLE_VIBES: Record<CircleVibe, { name: string; description: string; startDepth: CircleDepth }> = {
  chill: { name: "Chill", description: "Easy, fun, no pressure", startDepth: 1 },
  know: { name: "Get to know", description: "New faces, real answers", startDepth: 1 },
  deeper: { name: "Go deeper", description: "For people ready to open up", startDepth: 2 },
  reconnect: { name: "Reconnect", description: "Old friends catching up", startDepth: 1 },
  couples: { name: "Just us two", description: "For couples: questions about each other", startDepth: 1 },
};

// A full 8-question game earns a group very roughly 300-500 Sparks, so a
// new level takes a game or two at first and several games further up.
export const BOND_LEVELS = [
  { name: "Strangers", at: 0 },
  { name: "Acquaintances", at: 300 },
  { name: "Friends", at: 900 },
  { name: "Close", at: 2000 },
  { name: "Kindred", at: 4000 },
] as const;

export type PickedQuestion = CirclePlannedQuestion;

// How often a themed vibe draws from its own questions rather than the
// general library, when it has any left.
const THEMED_SHARE = { reconnect: 0.6, couples: 0.75 } as const;

function vibeTheme(vibe: CircleVibe): "reconnect" | "couples" | null {
  return vibe === "reconnect" || vibe === "couples" ? vibe : null;
}

// Themed questions (Reconnect's catch-ups, couples' questions about each
// other) only ever appear in their own vibe, mixed with general questions.
function isAllowedForVibe(q: LibraryQuestion, vibe: CircleVibe): boolean {
  return (!q.reconnect || vibe === "reconnect") && (!q.couples || vibe === "couples");
}

function poolForVibe(
  pool: readonly LibraryQuestion[],
  vibe: CircleVibe,
  maxDepth: CircleDepth,
  random: () => number,
): LibraryQuestion[] {
  const theme = vibeTheme(vibe);
  const general = pool.filter((q) => !q.reconnect && !q.couples);
  if (!theme) return general;
  const themed = pool.filter((q) => q[theme] && q.depth <= maxDepth);
  if (themed.length > 0 && random() < THEMED_SHARE[theme]) return themed;
  return general;
}

// Without a plan, custom questions alternate with library ones (every second question)
// until they run out, so a host's own questions are spread through the
// game instead of all landing at the start. Library questions are drawn at
// the current depth, never repeating within a game.
export function pickNextQuestion(input: {
  vibe: CircleVibe;
  depth: CircleDepth;
  questionIndex: number; // 0-based index of the question being picked
  usedTexts: string[];
  customQuestions: string[];
  random: () => number;
  library?: readonly LibraryQuestion[];
  plan?: readonly CirclePlannedQuestion[]; // the host's picked questions
}): PickedQuestion {
  const library = input.library ?? CIRCLE_QUESTIONS;
  const used = new Set(input.usedTexts);

  // A host-picked plan is played in order, except that after the group
  // votes to go deeper the next unused question at the new depth jumps
  // the queue. Only once the plan runs out does the library take over.
  const planLeft = (input.plan ?? []).filter((q) => !used.has(q.text));
  if (planLeft.length > 0) {
    return { ...(planLeft.find((q) => q.depth === input.depth) ?? planLeft[0]) };
  }

  const remainingCustom = input.customQuestions.filter((text) => !used.has(text));

  const pool = poolForVibe(
    library.filter((q) => !used.has(q.text)),
    input.vibe,
    input.depth,
    input.random,
  );

  if (remainingCustom.length > 0 && (input.questionIndex % 2 === 1 || pool.length === 0)) {
    return { text: remainingCustom[0], followUp: null, depth: input.depth, source: "custom" };
  }

  let candidates = pool.filter((q) => q.depth === input.depth);
  if (candidates.length === 0) candidates = pool.filter((q) => q.depth <= input.depth);
  if (candidates.length === 0) candidates = pool;
  // Every question at this depth has been used: allow repeats rather than
  // ending the game early.
  if (candidates.length === 0) {
    candidates = library.filter((q) => q.depth === input.depth && isAllowedForVibe(q, input.vibe));
  }

  const picked = candidates[Math.floor(input.random() * candidates.length)] ?? library[0];
  return { text: picked.text, followUp: picked.followUp, depth: picked.depth, source: "library" };
}

// Rotates the spotlight so each player gets a turn before anyone gets a
// second one. Skipped answers are never spotlit.
export function chooseSpotlight(input: {
  answers: { participantId: string; skipped: boolean }[];
  previousSpotlights: string[];
  random: () => number;
}): string | null {
  const candidates = [...new Set(input.answers.filter((a) => !a.skipped).map((a) => a.participantId))];
  if (candidates.length === 0) return null;

  const counts = new Map(candidates.map((id) => [id, 0]));
  for (const id of input.previousSpotlights) {
    if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  }
  const fewest = Math.min(...counts.values());
  const pool = candidates.filter((id) => counts.get(id) === fewest);
  return pool[Math.floor(input.random() * pool.length)] ?? pool[0];
}

// Going deeper needs everyone in the room to agree, and at least two
// people — one person can't consent for a group.
export function isDeeperUnanimous(voteCount: number, participantCount: number): boolean {
  return participantCount >= 2 && voteCount >= participantCount;
}

export function nextDepth(depth: CircleDepth, wentDeeper: boolean): CircleDepth {
  if (!wentDeeper) return depth;
  return Math.min(3, depth + 1) as CircleDepth;
}

export function isFullCircle(answeredCount: number, participantCount: number): boolean {
  return participantCount >= 2 && answeredCount >= participantCount;
}

export interface CircleQuestionTally {
  text: string;
  depth: CircleDepth;
  participantCount: number;
  wentDeeper: boolean;
  answers: { id: string; participantId: string; skipped: boolean }[];
  hearts: { answerId: string; participantId: string }[];
}

export interface CircleQuestionScore {
  pot: number;
  byParticipant: Map<string, number>;
  heartsByParticipant: Map<string, number>; // hearts each person received
  hearts: number;
  fullCircle: boolean;
  wentDeeper: boolean;
}

// Skipping never costs anything, and deep answers earn the same as light
// ones — the reward for going deeper is shared (the group bonus), so
// nobody is paid to overshare.
export function scoreCircleQuestion(tally: CircleQuestionTally): CircleQuestionScore {
  const byParticipant = new Map<string, number>();
  let pot = 0;
  const add = (participantId: string | null, sparks: number) => {
    pot += sparks;
    if (participantId) byParticipant.set(participantId, (byParticipant.get(participantId) ?? 0) + sparks);
  };

  const answered = tally.answers.filter((a) => !a.skipped);
  const answeredById = new Map(answered.map((a) => [a.id, a]));
  for (const answer of answered) add(answer.participantId, CIRCLE_SPARKS.answer);

  let hearts = 0;
  const heartsByParticipant = new Map<string, number>();
  const seen = new Set<string>();
  for (const heart of tally.hearts) {
    const answer = answeredById.get(heart.answerId);
    const key = `${heart.answerId}:${heart.participantId}`;
    if (!answer || answer.participantId === heart.participantId || seen.has(key)) continue;
    seen.add(key);
    hearts++;
    heartsByParticipant.set(answer.participantId, (heartsByParticipant.get(answer.participantId) ?? 0) + 1);
    add(answer.participantId, CIRCLE_SPARKS.heart);
  }

  const answeredPeople = new Set(answered.map((a) => a.participantId)).size;
  const fullCircle = isFullCircle(answeredPeople, tally.participantCount);
  if (fullCircle) add(null, CIRCLE_SPARKS.fullCircle);
  if (tally.wentDeeper) add(null, CIRCLE_SPARKS.deeper);

  return { pot, byParticipant, heartsByParticipant, hearts, fullCircle, wentDeeper: tally.wentDeeper };
}

// The running totals shown on every phone during a game: the group's pot
// and each person's Sparks and hearts so far, current question included.
export function scoreCircleGame(questions: CircleQuestionTally[]): {
  pot: number;
  byParticipant: Map<string, number>;
  heartsByParticipant: Map<string, number>;
} {
  let pot = 0;
  const byParticipant = new Map<string, number>();
  const heartsByParticipant = new Map<string, number>();
  for (const question of questions) {
    const score = scoreCircleQuestion(question);
    pot += score.pot;
    for (const [id, sparks] of score.byParticipant) byParticipant.set(id, (byParticipant.get(id) ?? 0) + sparks);
    for (const [id, count] of score.heartsByParticipant) {
      heartsByParticipant.set(id, (heartsByParticipant.get(id) ?? 0) + count);
    }
  }
  return { pot, byParticipant, heartsByParticipant };
}

// Out loud, nobody's answer is on screen, so the reveal becomes a turn
// order: the spotlight goes first, then everyone else who's ready, in the
// order they got ready. Skippers sit this one out.
export function speakingOrder<T extends { participantId: string; skipped: boolean }>(
  answers: T[],
  spotlightParticipantId: string | null,
): T[] {
  const ready = answers.filter((a) => !a.skipped);
  const first = ready.filter((a) => a.participantId === spotlightParticipantId);
  return [...first, ...ready.filter((a) => a.participantId !== spotlightParticipantId)];
}

// Awards are a vote between the other players, which means nothing with
// only one other person to vote for.
export function circleAwardsEnabled(playerCount: number): boolean {
  return playerCount >= 3;
}

export function describeQuestionScore(score: CircleQuestionScore): string {
  const parts = [`+${score.pot} Sparks`];
  if (score.hearts > 0) parts.push(`${score.hearts} 💛`);
  if (score.fullCircle) parts.push("Full Circle");
  if (score.wentDeeper) parts.push("going deeper");
  return parts.join(" · ");
}

export function computeCircleRecap(input: {
  questions: CircleQuestionTally[];
  participants: { id: string; nickname: string | null }[];
  rewardStyle: CircleRewardStyle;
  bondBefore: number;
  localHour: number; // 0-23, the host's local time when the game ended
}): CircleRecap {
  const totals = new Map<string, number>();
  const heartsReceived = new Map<string, number>();
  let pot = 0;
  let totalHearts = 0;
  let fullCircles = 0;
  let wentDeeper = false;
  let deepAnswered = false;
  let best: { text: string; score: number } | null = null;

  for (const question of input.questions) {
    const score = scoreCircleQuestion(question);
    pot += score.pot;
    totalHearts += score.hearts;
    if (score.fullCircle) fullCircles++;
    if (score.wentDeeper) wentDeeper = true;
    const answered = question.answers.filter((a) => !a.skipped).length;
    if (question.depth === 3 && answered > 0) deepAnswered = true;
    for (const [id, sparks] of score.byParticipant) totals.set(id, (totals.get(id) ?? 0) + sparks);
    for (const [id, count] of score.heartsByParticipant) heartsReceived.set(id, (heartsReceived.get(id) ?? 0) + count);
    for (const answer of question.answers) if (!totals.has(answer.participantId)) totals.set(answer.participantId, 0);
    // Question of the night: the most-loved question per answer given,
    // with deeper questions winning close calls and later ones winning
    // exact ties, so a light opener doesn't win just by going first.
    if (answered > 0) {
      const questionScore = score.hearts / answered + (question.depth - 1) * 0.25;
      if (!best || questionScore >= best.score) best = { text: question.text, score: questionScore };
    }
  }

  const nicknames = new Map(input.participants.map((p) => [p.id, p.nickname]));
  let players = [...totals.entries()].map(([participantId, sparks]) => ({
    participantId,
    nickname: nicknames.get(participantId) ?? null,
    sparks,
    hearts: heartsReceived.get(participantId) ?? 0,
    rank: null as number | null,
  }));

  if (input.rewardStyle === "competitive") {
    // Competitive is won on hearts: everyone earns the same Sparks for
    // answering, so hearts are what actually tells players apart (and the
    // only thing to compete on Out loud). Sparks break ties.
    const beats = (a: (typeof players)[number], b: (typeof players)[number]) =>
      b.hearts - a.hearts || b.sparks - a.sparks;
    players.sort((a, b) => beats(a, b) || displayName(a.nickname).localeCompare(displayName(b.nickname)));
    players = players.map((player, index) => {
      const tiedWith = players.findIndex((p) => beats(p, player) === 0);
      return { ...player, rank: (tiedWith === -1 ? index : tiedWith) + 1 };
    });
  } else {
    // Together style never ranks people against each other.
    players.sort((a, b) => displayName(a.nickname).localeCompare(displayName(b.nickname)));
  }

  const questionsPlayed = input.questions.length;
  const badges: CircleBadge[] = [];
  if (input.bondBefore === 0) {
    badges.push({ id: "icebreaker", icon: "🧊", name: "Icebreaker", detail: "First game as this group" });
  }
  // Badges are only worth having if they take a real game to earn.
  if (questionsPlayed >= 3 && fullCircles === questionsPlayed) {
    badges.push({ id: "full-circle", icon: "⭕", name: "Full Circle", detail: "Everyone answered every question" });
  }
  if (deepAnswered) badges.push({ id: "deep-divers", icon: "🌊", name: "Deep Divers", detail: "Answered a Deep question" });
  if (wentDeeper) badges.push({ id: "all-in", icon: "🤝", name: "All In", detail: "Agreed together to go deeper" });
  if (totalHearts >= Math.max(5, 2 * players.length)) {
    badges.push({ id: "big-hearts", icon: "💛", name: "Big Hearts", detail: `${totalHearts} hearts given` });
  }
  if (input.localHour >= 22 || input.localHour < 4) {
    badges.push({ id: "night-owls", icon: "🌙", name: "Night Owls", detail: "Still talking after 10pm" });
  }

  return {
    pot,
    bondBefore: input.bondBefore,
    bondAfter: input.bondBefore + pot,
    rewardStyle: input.rewardStyle,
    players,
    badges,
    questionOfTheNight: best?.text ?? input.questions[0]?.text ?? null,
    questionsPlayed,
  };
}

export function bondLevel(totalSparks: number): {
  name: string;
  nextName: string | null;
  toNext: number;
  progress: number; // 0-1 within the current level
} {
  let index = 0;
  BOND_LEVELS.forEach((level, i) => {
    if (totalSparks >= level.at) index = i;
  });
  const current = BOND_LEVELS[index];
  const next = BOND_LEVELS[index + 1];
  if (!next) return { name: current.name, nextName: null, toNext: 0, progress: 1 };
  return {
    name: current.name,
    nextName: next.name,
    toNext: next.at - totalSparks,
    progress: (totalSparks - current.at) / (next.at - current.at),
  };
}

// Identifies "the same group" across games without accounts: the sorted,
// case-insensitive set of nicknames. Anonymous players count as "guest".
export function circleGroupKey(nicknames: (string | null)[]): string {
  return nicknames
    .map((n) => (n?.trim() ? n.trim().toLowerCase() : "guest"))
    .sort()
    .join("|")
    .slice(0, 200);
}

export function displayName(nickname: string | null): string {
  return nickname?.trim() || "Guest";
}

// Builds the starting set the host sees in the question picker: a gentle
// warm-up that gets deeper as the game goes on (the first ~40% at the
// vibe's starting depth, the next ~40% one level deeper, the rest deeper
// still). Chill never goes past Real; Reconnect leans on catch-up
// questions and Just us two on questions about each other. The host can then swap, reorder, remove or add to it.
export function suggestQuestionSet(input: {
  vibe: CircleVibe;
  count: number;
  random: () => number;
  library?: readonly LibraryQuestion[];
  avoidTexts?: string[]; // questions this group has already played
}): CirclePlannedQuestion[] {
  const fullLibrary = input.library ?? CIRCLE_QUESTIONS;
  // Leave out what the group has already played, unless that leaves too
  // little to build a game from.
  const avoid = new Set(input.avoidTexts ?? []);
  const fresh = fullLibrary.filter((q) => !avoid.has(q.text) && isAllowedForVibe(q, input.vibe));
  const library = fresh.length >= input.count ? fullLibrary.filter((q) => !avoid.has(q.text)) : fullLibrary;
  const start = CIRCLE_VIBES[input.vibe].startDepth;
  const cap: CircleDepth = input.vibe === "chill" ? 2 : 3;
  const picked: CirclePlannedQuestion[] = [];

  for (let i = 0; i < input.count; i++) {
    const stage = i < Math.ceil(input.count * 0.4) ? 0 : i < Math.ceil(input.count * 0.8) ? 1 : 2;
    const depth = Math.min(cap, start + stage) as CircleDepth;
    const used = new Set(picked.map((q) => q.text));
    const pool = poolForVibe(
      library.filter((q) => !used.has(q.text) && q.depth <= depth),
      input.vibe,
      depth,
      input.random,
    );
    // Prefer the target depth; never go deeper than it.
    const atDepth = pool.filter((q) => q.depth === depth);
    const candidates = atDepth.length > 0 ? atDepth : pool;
    if (candidates.length === 0) continue;
    const q = candidates[Math.floor(input.random() * candidates.length)] ?? candidates[0];
    picked.push({ text: q.text, followUp: q.followUp, depth: q.depth, source: "library" });
  }
  return picked;
}

// A different library question at the same depth, for the picker's swap
// button. Returns null when nothing unused is left at that depth.
export function swapQuestion(input: {
  question: CirclePlannedQuestion;
  vibe: CircleVibe;
  usedTexts: string[];
  random: () => number;
  library?: readonly LibraryQuestion[];
}): CirclePlannedQuestion | null {
  const library = input.library ?? CIRCLE_QUESTIONS;
  const used = new Set(input.usedTexts);
  const pool = library.filter(
    (q) =>
      q.depth === input.question.depth &&
      !used.has(q.text) &&
      isAllowedForVibe(q, input.vibe),
  );
  if (pool.length === 0) return null;
  const q = pool[Math.floor(input.random() * pool.length)] ?? pool[0];
  return { text: q.text, followUp: q.followUp, depth: q.depth, source: "library" };
}
