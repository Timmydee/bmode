import { supabase } from "./client";
import {
  mapSurveyRow,
  mapSurveyQuestionRow,
  type ActivityRow,
  type PollOptionRow,
  type SurveyRow,
  type SurveyQuestionRow,
} from "./mappers";
import type { SurveyRepository } from "../contracts";
import type { PollActivity } from "../types";

// Assembles a PollActivity for a survey question directly from
// survey-repo's own rows, mirroring round-repo.ts's
// assembleRoundQuestionActivity — keeps activity-repo.ts (and every
// standalone-poll code path through it) at zero diff.
function assembleSurveyQuestionActivity(
  activityRow: ActivityRow,
  optionRows: PollOptionRow[],
  surveyQuestion: SurveyQuestionRow,
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
    surveyId: surveyQuestion.survey_id,
  };
}

async function fetchQuestionActivity(
  surveyQuestion: SurveyQuestionRow,
): Promise<PollActivity> {
  const [{ data: activityRow, error: activityError }, { data: optionRows, error: optionsError }] =
    await Promise.all([
      supabase
        .from("activities")
        .select()
        .eq("id", surveyQuestion.activity_id)
        .single<ActivityRow>(),
      supabase
        .from("poll_options")
        .select()
        .eq("activity_id", surveyQuestion.activity_id)
        .order("order", { ascending: true })
        .returns<PollOptionRow[]>(),
    ]);
  if (activityError) throw new Error(activityError.message);
  if (optionsError) throw new Error(optionsError.message);

  return assembleSurveyQuestionActivity(activityRow, optionRows ?? [], surveyQuestion);
}

export async function fetchSurveyQuestions(
  surveyId: string,
): Promise<SurveyQuestionRow[]> {
  const { data, error } = await supabase
    .from("survey_questions")
    .select()
    .eq("survey_id", surveyId)
    .order("order", { ascending: true })
    .returns<SurveyQuestionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function createSurveyRepository(): SurveyRepository {
  return {
    async create({ sessionId, name, questions }) {
      const { count, error: countError } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (countError) throw new Error(countError.message);
      let nextOrder = count ?? 0;

      const { data: surveyRow, error: surveyError } = await supabase
        .from("surveys")
        .insert({ session_id: sessionId, name })
        .select()
        .single<SurveyRow>();
      if (surveyError) throw new Error(surveyError.message);

      // Sequential, not transactional — same accepted limitation as
      // round-repo.ts's create() (no multi-statement transaction primitive
      // available without a server-side RPC function).
      const surveyQuestionRows: SurveyQuestionRow[] = [];
      for (const question of questions) {
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

        const { error: optionsError } = await supabase.from("poll_options").insert(
          question.options.map((label, optionIndex) => ({
            activity_id: activityRow.id,
            label,
            order: optionIndex,
          })),
        );
        if (optionsError) throw new Error(optionsError.message);

        const { data: surveyQuestionRow, error: surveyQuestionError } = await supabase
          .from("survey_questions")
          .insert({
            survey_id: surveyRow.id,
            activity_id: activityRow.id,
            order: surveyQuestionRows.length,
          })
          .select()
          .single<SurveyQuestionRow>();
        if (surveyQuestionError) throw new Error(surveyQuestionError.message);

        surveyQuestionRows.push(surveyQuestionRow);
      }

      return {
        survey: mapSurveyRow(surveyRow),
        questions: surveyQuestionRows.map(mapSurveyQuestionRow),
      };
    },

    async getById(surveyId) {
      const { data, error } = await supabase
        .from("surveys")
        .select()
        .eq("id", surveyId)
        .maybeSingle<SurveyRow>();
      if (error) throw new Error(error.message);
      return data ? mapSurveyRow(data) : null;
    },

    async listBySession(sessionId) {
      const { data, error } = await supabase
        .from("surveys")
        .select()
        .eq("session_id", sessionId)
        .order("order", { ascending: true })
        .returns<SurveyRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapSurveyRow);
    },

    async listQuestions(surveyId) {
      const rows = await fetchSurveyQuestions(surveyId);
      return rows.map(mapSurveyQuestionRow);
    },

    async activate(surveyId) {
      const { error } = await supabase
        .from("surveys")
        .update({ status: "live", current_question_index: 0 })
        .eq("id", surveyId);
      if (error) throw new Error(error.message);
    },

    async setCurrentQuestionIndex(surveyId, questionIndex) {
      const { error } = await supabase
        .from("surveys")
        .update({ current_question_index: questionIndex })
        .eq("id", surveyId);
      if (error) throw new Error(error.message);
    },

    async endSurvey(surveyId) {
      const { error } = await supabase
        .from("surveys")
        .update({ status: "ended", current_question_index: null })
        .eq("id", surveyId);
      if (error) throw new Error(error.message);
    },
  };
}

// Exported for use by the host page, which needs to resolve a survey
// question's full PollActivity to activate it.
export async function getSurveyQuestionActivity(
  surveyQuestion: SurveyQuestionRow,
): Promise<PollActivity> {
  return fetchQuestionActivity(surveyQuestion);
}
