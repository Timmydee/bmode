import { supabase } from "./client";
import { scoreQuestion as computeQuestionScores } from "../../game/scoring";
import { computeLeaderboard } from "../../game/leaderboard";
import type { ScoreRepository } from "../contracts";
import type { QuestionScore } from "../types";

interface QuestionScoreRow {
  id: string;
  activity_id: string;
  participant_id: string;
  option_id: string | null;
  correct: boolean;
  points: number;
  response_time_ms: number | null;
  scored_at: string;
}

function mapQuestionScoreRow(row: QuestionScoreRow): QuestionScore {
  return {
    id: row.id,
    activityId: row.activity_id,
    participantId: row.participant_id,
    optionId: row.option_id,
    correct: row.correct,
    points: row.points,
    responseTimeMs: row.response_time_ms,
    scoredAt: new Date(row.scored_at).getTime(),
  };
}

// Finds which session a round question's activity belongs to, so scoring
// can pull the full participant roster (everyone present when the
// question went live is scored, even with no vote — see scoring.ts).
async function getSessionIdForActivity(activityId: string): Promise<string> {
  const { data, error } = await supabase
    .from("activities")
    .select("session_id")
    .eq("id", activityId)
    .single<{ session_id: string }>();
  if (error) throw new Error(error.message);
  return data.session_id;
}

export function createScoreRepository(): ScoreRepository {
  return {
    async scoreQuestion({ activityId, correctOptionId, questionStartedAt, timeLimitSeconds }) {
      const sessionId = await getSessionIdForActivity(activityId);

      const [{ data: participantRows, error: participantError }, { data: voteRows, error: voteError }] =
        await Promise.all([
          supabase
            .from("participants")
            .select("id")
            .eq("session_id", sessionId)
            .returns<{ id: string }[]>(),
          supabase
            .from("poll_votes")
            .select("participant_id, option_id, submitted_at")
            .eq("activity_id", activityId)
            .returns<{ participant_id: string; option_id: string; submitted_at: string }[]>(),
        ]);
      if (participantError) throw new Error(participantError.message);
      if (voteError) throw new Error(voteError.message);

      const scored = computeQuestionScores({
        correctOptionId,
        questionStartedAt,
        timeLimitSeconds,
        participantIds: (participantRows ?? []).map((row) => row.id),
        votes: (voteRows ?? []).map((row) => ({
          participantId: row.participant_id,
          optionId: row.option_id,
          submittedAt: new Date(row.submitted_at).getTime(),
        })),
      });

      if (scored.length === 0) return [];

      // Upsert on (activity_id, participant_id) so a retried/duplicate
      // call (e.g. the host's tab retrying after a flaky response) doesn't
      // double-score — mirrors poll_votes' own idempotency pattern.
      const { data, error } = await supabase
        .from("question_scores")
        .upsert(
          scored.map((result) => ({
            activity_id: activityId,
            participant_id: result.participantId,
            option_id: result.optionId,
            correct: result.correct,
            points: result.points,
            response_time_ms: result.responseTimeMs,
          })),
          { onConflict: "activity_id,participant_id" },
        )
        .select()
        .returns<QuestionScoreRow[]>();
      if (error) throw new Error(error.message);

      return (data ?? []).map(mapQuestionScoreRow);
    },

    async getLeaderboard(sessionId) {
      const [{ data: participantRows, error: participantError }, { data: scoreRows, error: scoreError }] =
        await Promise.all([
          supabase
            .from("participants")
            .select("id, nickname")
            .eq("session_id", sessionId)
            .returns<{ id: string; nickname: string | null }[]>(),
          supabase
            .from("question_scores")
            .select("participant_id, points, correct, activities!inner(session_id)")
            .eq("activities.session_id", sessionId)
            .returns<{ participant_id: string; points: number; correct: boolean }[]>(),
        ]);
      if (participantError) throw new Error(participantError.message);
      if (scoreError) throw new Error(scoreError.message);

      const board = computeLeaderboard({
        sessionId,
        participants: (participantRows ?? []).map((row) => ({
          id: row.id,
          nickname: row.nickname,
        })),
        scores: (scoreRows ?? []).map((row) => ({
          participantId: row.participant_id,
          points: row.points,
          correct: row.correct,
        })),
      });

      return { ...board, updatedAt: Date.now() };
    },
  };
}
