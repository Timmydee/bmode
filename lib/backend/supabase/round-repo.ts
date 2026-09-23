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
import type { PollActivity } from "../types";

// Assembles a PollActivity for a round question directly from round-repo's
// own rows, rather than threading round-awareness through
// activity-repo.ts's shared mapActivityRow — keeps activity-repo.ts (and
// every standalone-poll code path through it) at zero diff.
function assembleRoundQuestionActivity(
  activityRow: ActivityRow,
  optionRows: PollOptionRow[],
  roundQuestion: RoundQuestionRow,
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
    roundId: roundQuestion.round_id,
    correctOptionId: roundQuestion.correct_option_id,
  };
}

async function fetchQuestionActivity(
  roundQuestion: RoundQuestionRow,
): Promise<PollActivity> {
  const [{ data: activityRow, error: activityError }, { data: optionRows, error: optionsError }] =
    await Promise.all([
      supabase
        .from("activities")
        .select()
        .eq("id", roundQuestion.activity_id)
        .single<ActivityRow>(),
      supabase
        .from("poll_options")
        .select()
        .eq("activity_id", roundQuestion.activity_id)
        .order("order", { ascending: true })
        .returns<PollOptionRow[]>(),
    ]);
  if (activityError) throw new Error(activityError.message);
  if (optionsError) throw new Error(optionsError.message);

  return assembleRoundQuestionActivity(activityRow, optionRows ?? [], roundQuestion);
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

// Exported for use by score-repo.ts and the host page, which both need to
// resolve a round question's full PollActivity (e.g. to know its
// correctOptionId) without re-deriving the assembly logic.
export async function getRoundQuestionActivity(
  roundQuestion: RoundQuestionRow,
): Promise<PollActivity> {
  return fetchQuestionActivity(roundQuestion);
}
