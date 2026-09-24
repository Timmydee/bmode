import { supabase } from "./client";
import {
  mapRoundRow,
  mapRoundQuestionRow,
  type ActivityRow,
  type PollOptionRow,
  type RoundRow,
  type RoundQuestionRow,
} from "./mappers";
import type { RoundRepository } from "../contracts";
import type { PollActivity, RoundQuestion } from "../types";

// Assembles a PollActivity for a round question directly from round-repo's
// own rows, rather than threading round-awareness through
// activity-repo.ts's shared mapActivityRow — keeps activity-repo.ts (and
// every standalone-poll code path through it) at zero diff.
function assembleRoundQuestionActivity(
  activityRow: ActivityRow,
  optionRows: PollOptionRow[],
  roundId: string,
  correctOptionId: string,
): PollActivity {
  return {
    id: activityRow.id,
    sessionId: activityRow.session_id,
    kind: "poll",
    prompt: activityRow.prompt,
    status: activityRow.status,
    order: activityRow.order,
    options: optionRows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((option) => ({ id: option.id, label: option.label })),
    resultsVisibleToParticipants: Boolean(
      activityRow.config.resultsVisibleToParticipants,
    ),
    roundId,
    correctOptionId,
  };
}

// Accepts either the raw row (round-repo's own internal flow) or the
// mapped domain RoundQuestion (every external caller, e.g. the host
// page) — one lookup implementation for both.
async function fetchQuestionActivity(
  roundQuestion: RoundQuestionRow | RoundQuestion,
): Promise<PollActivity | null> {
  const activityId =
    "activity_id" in roundQuestion ? roundQuestion.activity_id : roundQuestion.activityId;
  const roundId = "round_id" in roundQuestion ? roundQuestion.round_id : roundQuestion.roundId;
  const correctOptionId =
    "correct_option_id" in roundQuestion
      ? roundQuestion.correct_option_id
      : roundQuestion.correctOptionId;

  const [{ data: activityRow, error: activityError }, { data: optionRows, error: optionsError }] =
    await Promise.all([
      supabase.from("activities").select().eq("id", activityId).maybeSingle<ActivityRow>(),
      supabase
        .from("poll_options")
        .select()
        .eq("activity_id", activityId)
        .order("order", { ascending: true })
        .returns<PollOptionRow[]>(),
    ]);
  if (activityError) throw new Error(activityError.message);
  if (optionsError) throw new Error(optionsError.message);
  if (!activityRow) return null;

  return assembleRoundQuestionActivity(activityRow, optionRows ?? [], roundId, correctOptionId);
}

export async function fetchRoundQuestions(roundId: string): Promise<RoundQuestionRow[]> {
  const { data, error } = await supabase
    .from("round_questions")
    .select()
    .eq("round_id", roundId)
    .order("order", { ascending: true })
    .returns<RoundQuestionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function createRoundRepository(): RoundRepository {
  return {
    async create({ sessionId, name, timeLimitSeconds, questions }) {
      const { count, error: countError } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (countError) throw new Error(countError.message);
      let nextOrder = count ?? 0;

      const { data: roundRow, error: roundError } = await supabase
        .from("rounds")
        .insert({
          session_id: sessionId,
          name,
          time_limit_seconds: timeLimitSeconds,
        })
        .select()
        .single<RoundRow>();
      if (roundError) throw new Error(roundError.message);

      // Sequential, not transactional (Supabase's JS client has no
      // multi-statement transaction primitive without a server-side RPC
      // function, which the "no business logic in Postgres" rule already
      // rules out) — matches the same accepted limitation in
      // activity-repo.ts's own reorder().
      const roundQuestionRows: RoundQuestionRow[] = [];
      for (const [index, question] of questions.entries()) {
        const { data: activityRow, error: activityError } = await supabase
          .from("activities")
          .insert({
            session_id: sessionId,
            kind: "poll",
            prompt: question.prompt,
            order: nextOrder++,
            config: { options: question.options, resultsVisibleToParticipants: true },
          })
          .select()
          .single<ActivityRow>();
        if (activityError) throw new Error(activityError.message);

        const { data: optionRows, error: optionsError } = await supabase
          .from("poll_options")
          .insert(
            question.options.map((label, optionIndex) => ({
              activity_id: activityRow.id,
              label,
              order: optionIndex,
            })),
          )
          .select()
          .returns<PollOptionRow[]>();
        if (optionsError) throw new Error(optionsError.message);

        const correctOption = (optionRows ?? [])[question.correctOptionIndex];
        if (!correctOption) {
          throw new Error(`Question ${index + 1}: correct answer index out of range.`);
        }

        const { data: roundQuestionRow, error: roundQuestionError } = await supabase
          .from("round_questions")
          .insert({
            round_id: roundRow.id,
            activity_id: activityRow.id,
            order: index,
            correct_option_id: correctOption.id,
          })
          .select()
          .single<RoundQuestionRow>();
        if (roundQuestionError) throw new Error(roundQuestionError.message);

        roundQuestionRows.push(roundQuestionRow);
      }

      return {
        round: mapRoundRow(roundRow),
        questions: roundQuestionRows.map(mapRoundQuestionRow),
      };
    },

    async getById(roundId) {
      const { data, error } = await supabase
        .from("rounds")
        .select()
        .eq("id", roundId)
        .maybeSingle<RoundRow>();
      if (error) throw new Error(error.message);
      return data ? mapRoundRow(data) : null;
    },

    async listBySession(sessionId) {
      const { data, error } = await supabase
        .from("rounds")
        .select()
        .eq("session_id", sessionId)
        .order("order", { ascending: true })
        .returns<RoundRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRoundRow);
    },

    async listQuestions(roundId) {
      const rows = await fetchRoundQuestions(roundId);
      return rows.map(mapRoundQuestionRow);
    },

    async getQuestionActivity(roundQuestion) {
      return fetchQuestionActivity(roundQuestion);
    },

    async activate(roundId) {
      const { error } = await supabase
        .from("rounds")
        .update({ status: "live" })
        .eq("id", roundId);
      if (error) throw new Error(error.message);
    },

    async startQuestion({ roundId, questionIndex, startedAt, endsAt }) {
      const { error } = await supabase
        .from("rounds")
        .update({
          current_question_index: questionIndex,
          current_question_started_at: new Date(startedAt).toISOString(),
          current_question_ends_at: new Date(endsAt).toISOString(),
        })
        .eq("id", roundId);
      if (error) throw new Error(error.message);
    },

    async endRound(roundId) {
      const { error } = await supabase
        .from("rounds")
        .update({
          status: "ended",
          current_question_index: null,
          current_question_started_at: null,
          current_question_ends_at: null,
        })
        .eq("id", roundId);
      if (error) throw new Error(error.message);
    },
  };
}
