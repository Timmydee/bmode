import { supabase } from "./client";
import {
  mapPollVoteRow,
  mapWordEntryRow,
  type PollOptionRow,
  type PollVoteRow,
  type WordEntryRow,
} from "./mappers";
import type { ResponseRepository } from "../contracts";
import { aggregatePollResults } from "../../game/aggregate-poll";
import { aggregateWordCloudResults } from "../../game/aggregate-wordcloud";
import { normalizeWord } from "../../game/validation";

interface ActivityKindConfigRow {
  kind: "poll" | "wordcloud" | "qa";
  config: Record<string, unknown>;
}

export function createResponseRepository(): ResponseRepository {
  return {
    async submitVote({ activityId, participantId, optionId }) {
      const { error } = await supabase.from("poll_votes").insert({
        activity_id: activityId,
        participant_id: participantId,
        option_id: optionId,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("You've already voted in this poll.");
        }
        throw new Error(error.message);
      }
    },

    async submitWord({ activityId, participantId, word }) {
      const { error } = await supabase.from("word_entries").insert({
        activity_id: activityId,
        participant_id: participantId,
        word: normalizeWord(word),
      });
      if (error) throw new Error(error.message);
    },

    // Doubles as "has this participant used up their allowed responses for
    // this activity": for a poll that's after 1 vote; for a word cloud,
    // after they've reached the activity's maxWordsPerParticipant. This
    // fits the contract's single boolean exactly rather than adding a new
    // method, and — unlike a client-side counter — survives a refresh.
    async hasResponded(activityId, participantId) {
      const { data: activityRow, error: activityError } = await supabase
        .from("activities")
        .select("kind, config")
        .eq("id", activityId)
        .single<ActivityKindConfigRow>();
      if (activityError) throw new Error(activityError.message);

      if (activityRow.kind === "wordcloud") {
        const maxWords =
          typeof activityRow.config.maxWordsPerParticipant === "number"
            ? activityRow.config.maxWordsPerParticipant
            : 1;
        const { count, error } = await supabase
          .from("word_entries")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", activityId)
          .eq("participant_id", participantId);
        if (error) throw new Error(error.message);
        return (count ?? 0) >= maxWords;
      }

      const { count, error } = await supabase
        .from("poll_votes")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", activityId)
        .eq("participant_id", participantId);
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },

    async getPollResults(activityId) {
      const [optionsResult, votesResult] = await Promise.all([
        supabase
          .from("poll_options")
          .select()
          .eq("activity_id", activityId)
          .order("order", { ascending: true })
          .returns<PollOptionRow[]>(),
        supabase
          .from("poll_votes")
          .select()
          .eq("activity_id", activityId)
          .returns<PollVoteRow[]>(),
      ]);
      if (optionsResult.error) throw new Error(optionsResult.error.message);
      if (votesResult.error) throw new Error(votesResult.error.message);

      const options = (optionsResult.data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
      }));
      const votes = (votesResult.data ?? []).map(mapPollVoteRow);

      return aggregatePollResults(activityId, options, votes);
    },

    async getWordCloudResults(activityId) {
      const { data, error } = await supabase
        .from("word_entries")
        .select()
        .eq("activity_id", activityId)
        .returns<WordEntryRow[]>();
      if (error) throw new Error(error.message);

      const entries = (data ?? []).map(mapWordEntryRow);
      return aggregateWordCloudResults(activityId, entries);
    },
  };
}
