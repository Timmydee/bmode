import { supabase } from "./client";
import {
  mapCircleAnswerRow,
  mapCircleQuestionRow,
  mapCircleRow,
  type CircleAnswerRow,
  type CircleQuestionRow,
  type CircleRow,
} from "./mappers";
import type { CircleRepository } from "../contracts";
import type { CircleAward, CircleAwardVote, CircleHeart } from "../types";

export function createCircleRepository(): CircleRepository {
  return {
    async create({ sessionId, name, settings }) {
      const { count, error: countError } = await supabase
        .from("circles")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (countError) throw new Error(countError.message);

      const { data, error } = await supabase
        .from("circles")
        .insert({
          session_id: sessionId,
          name,
          settings,
          order: count ?? 0,
          depth: settings.vibe === "deeper" ? 2 : 1,
        })
        .select()
        .single<CircleRow>();
      if (error) throw new Error(error.message);
      return mapCircleRow(data);
    },

    async getById(circleId) {
      const { data, error } = await supabase
        .from("circles")
        .select()
        .eq("id", circleId)
        .maybeSingle<CircleRow>();
      if (error) throw new Error(error.message);
      return data ? mapCircleRow(data) : null;
    },

    async listBySession(sessionId) {
      const { data, error } = await supabase
        .from("circles")
        .select()
        .eq("session_id", sessionId)
        .order("order", { ascending: true })
        .returns<CircleRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCircleRow);
    },

    async listQuestions(circleId) {
      const { data, error } = await supabase
        .from("circle_questions")
        .select()
        .eq("circle_id", circleId)
        .order("order", { ascending: true })
        .returns<CircleQuestionRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCircleQuestionRow);
    },

    async listAnswers(circleQuestionIds) {
      if (circleQuestionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("circle_answers")
        .select("*, participants(nickname)")
        .in("circle_question_id", circleQuestionIds)
        .order("submitted_at", { ascending: true })
        .returns<CircleAnswerRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCircleAnswerRow);
    },

    async listHearts(answerIds) {
      if (answerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("circle_hearts")
        .select("answer_id, participant_id")
        .in("answer_id", answerIds)
        .returns<{ answer_id: string; participant_id: string }[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (row): CircleHeart => ({ answerId: row.answer_id, participantId: row.participant_id }),
      );
    },

    async listDeeperVotes(circleQuestionId) {
      const { data, error } = await supabase
        .from("circle_deeper_votes")
        .select("participant_id")
        .eq("circle_question_id", circleQuestionId)
        .returns<{ participant_id: string }[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.participant_id);
    },

    async listAwardVotes(circleId) {
      const { data, error } = await supabase
        .from("circle_award_votes")
        .select("circle_id, participant_id, award, nominee_participant_id")
        .eq("circle_id", circleId)
        .returns<
          { circle_id: string; participant_id: string; award: CircleAward; nominee_participant_id: string }[]
        >();
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (row): CircleAwardVote => ({
          circleId: row.circle_id,
          participantId: row.participant_id,
          award: row.award,
          nomineeParticipantId: row.nominee_participant_id,
        }),
      );
    },

    async addQuestion({ circleId, order, text, followUp, depth, source }) {
      const { data, error } = await supabase
        .from("circle_questions")
        .insert({ circle_id: circleId, order, text, follow_up: followUp, depth, source })
        .select()
        .single<CircleQuestionRow>();
      if (error) throw new Error(error.message);
      return mapCircleQuestionRow(data);
    },

    async updateCircle(circleId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.currentQuestionId !== undefined) row.current_question_id = patch.currentQuestionId;
      if (patch.depth !== undefined) row.depth = patch.depth;
      if (patch.pot !== undefined) row.pot = patch.pot;
      if (patch.bondPrior !== undefined) row.bond_prior = patch.bondPrior;
      if (patch.recap !== undefined) row.recap = patch.recap;
      const { error } = await supabase.from("circles").update(row).eq("id", circleId);
      if (error) throw new Error(error.message);
    },

    async updateQuestion(circleQuestionId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.phase !== undefined) row.phase = patch.phase;
      if (patch.spotlightParticipantId !== undefined) {
        row.spotlight_participant_id = patch.spotlightParticipantId;
      }
      if (patch.participantCount !== undefined) row.participant_count = patch.participantCount;
      if (patch.wentDeeper !== undefined) row.went_deeper = patch.wentDeeper;
      const { error } = await supabase
        .from("circle_questions")
        .update(row)
        .eq("id", circleQuestionId);
      if (error) throw new Error(error.message);
    },

    async getBond(hostId, groupKey) {
      const { data, error } = await supabase
        .from("circle_bonds")
        .select("sparks")
        .eq("host_id", hostId)
        .eq("group_key", groupKey)
        .maybeSingle<{ sparks: number }>();
      if (error) throw new Error(error.message);
      return data?.sparks ?? 0;
    },

    async saveBond(hostId, groupKey, sparks) {
      const { error } = await supabase.from("circle_bonds").upsert({
        host_id: hostId,
        group_key: groupKey,
        sparks,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },

    async submitAnswer({ circleQuestionId, participantId, text, skipped }) {
      // Upsert so a player can change their answer until the reveal (RLS
      // rejects the write once the question has moved past 'answering').
      const { error } = await supabase.from("circle_answers").upsert(
        {
          circle_question_id: circleQuestionId,
          participant_id: participantId,
          text,
          skipped,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "circle_question_id,participant_id" },
      );
      if (error) throw new Error(error.message);
    },

    async setHeart({ answerId, participantId, on }) {
      const { error } = on
        ? await supabase
            .from("circle_hearts")
            .upsert({ answer_id: answerId, participant_id: participantId }, { ignoreDuplicates: true })
        : await supabase
            .from("circle_hearts")
            .delete()
            .eq("answer_id", answerId)
            .eq("participant_id", participantId);
      if (error) throw new Error(error.message);
    },

    async setDeeperVote({ circleQuestionId, participantId, on }) {
      const { error } = on
        ? await supabase
            .from("circle_deeper_votes")
            .upsert(
              { circle_question_id: circleQuestionId, participant_id: participantId },
              { ignoreDuplicates: true },
            )
        : await supabase
            .from("circle_deeper_votes")
            .delete()
            .eq("circle_question_id", circleQuestionId)
            .eq("participant_id", participantId);
      if (error) throw new Error(error.message);
    },

    async voteAward({ circleId, participantId, award, nomineeParticipantId }) {
      const { error } = await supabase.from("circle_award_votes").upsert(
        {
          circle_id: circleId,
          participant_id: participantId,
          award,
          nominee_participant_id: nomineeParticipantId,
        },
        { onConflict: "circle_id,participant_id,award" },
      );
      if (error) throw new Error(error.message);
    },
  };
}
