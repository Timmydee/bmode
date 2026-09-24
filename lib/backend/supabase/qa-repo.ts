import { supabase } from "./client";
import { mapQuestionRow, type QuestionRow } from "./mappers";
import type { QARepository } from "../contracts";

async function fetchUpvoteCounts(
  questionIds: string[],
): Promise<Map<string, number>> {
  if (questionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("question_upvotes")
    .select("question_id")
    .in("question_id", questionIds)
    .returns<{ question_id: string }[]>();
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.question_id, (counts.get(row.question_id) ?? 0) + 1);
  }
  return counts;
}

export function createQARepository(): QARepository {
  return {
    async submit({ activityId, participantId, text }) {
      const { data: participantRow, error: participantError } = await supabase
        .from("participants")
        .select("nickname")
        .eq("id", participantId)
        .single<{ nickname: string | null }>();
      if (participantError) throw new Error(participantError.message);

      const { data, error } = await supabase
        .from("questions")
        .insert({
          activity_id: activityId,
          participant_id: participantId,
          text,
          author_nickname: participantRow.nickname,
        })
        .select()
        .single<QuestionRow>();
      if (error) throw new Error(error.message);

      return mapQuestionRow(data, 0);
    },

    async list(activityId, opts) {
      let query = supabase.from("questions").select().eq("activity_id", activityId);
      if (!opts?.includeHidden) {
        query = query.eq("hidden", false);
      }

      const { data, error } = await query.returns<QuestionRow[]>();
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      const counts = await fetchUpvoteCounts(rows.map((row) => row.id));
      return rows.map((row) => mapQuestionRow(row, counts.get(row.id) ?? 0));
    },

    async upvote(questionId, participantId) {
      const { data: question, error: questionError } = await supabase
        .from("questions")
        .select("participant_id")
        .eq("id", questionId)
        .single<{ participant_id: string }>();
      if (questionError) throw new Error(questionError.message);
      if (question.participant_id === participantId) {
        throw new Error("You can't upvote your own question.");
      }

      const { error } = await supabase.from("question_upvotes").insert({
        question_id: questionId,
        participant_id: participantId,
      });
      if (error) {
        if (error.code === "23505") return; // already upvoted — idempotent
        throw new Error(error.message);
      }
    },

    async removeUpvote(questionId, participantId) {
      const { error } = await supabase
        .from("question_upvotes")
        .delete()
        .eq("question_id", questionId)
        .eq("participant_id", participantId);
      if (error) throw new Error(error.message);
    },

    async getUpvotedQuestionIds(activityId, participantId) {
      const { data, error } = await supabase
        .from("question_upvotes")
        .select("question_id, questions!inner(activity_id)")
        .eq("participant_id", participantId)
        .eq("questions.activity_id", activityId)
        .returns<{ question_id: string }[]>();
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((row) => row.question_id));
    },

    async setAnswered(questionId, answered) {
      const { error } = await supabase
        .from("questions")
        .update({ answered })
        .eq("id", questionId);
      if (error) throw new Error(error.message);
    },

    async setHidden(questionId, hidden) {
      const { error } = await supabase
        .from("questions")
        .update({ hidden })
        .eq("id", questionId);
      if (error) throw new Error(error.message);
    },
  };
}
