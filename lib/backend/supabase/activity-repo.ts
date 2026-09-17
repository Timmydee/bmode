import { supabase } from "./client";
import {
  mapActivityRow,
  type ActivityRow,
  type PollOptionRow,
} from "./mappers";
import type { ActivityRepository } from "../contracts";

async function fetchPollOptions(activityId: string): Promise<PollOptionRow[]> {
  const { data, error } = await supabase
    .from("poll_options")
    .select()
    .eq("activity_id", activityId)
    .order("order", { ascending: true })
    .returns<PollOptionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function createActivityRepository(): ActivityRepository {
  return {
    async create({ sessionId, kind, prompt, config }) {
      const { count, error: countError } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (countError) throw new Error(countError.message);

      const { data: activityRow, error: insertError } = await supabase
        .from("activities")
        .insert({
          session_id: sessionId,
          kind,
          prompt,
          order: count ?? 0,
          config,
        })
        .select()
        .single<ActivityRow>();
      if (insertError) throw new Error(insertError.message);

      if (kind === "poll") {
        const optionLabels = config.options;
        if (!Array.isArray(optionLabels) || optionLabels.length < 2) {
          throw new Error("A poll needs at least 2 options.");
        }
        const { data: optionRows, error: optionsError } = await supabase
          .from("poll_options")
          .insert(
            optionLabels.map((label: unknown, index: number) => ({
              activity_id: activityRow.id,
              label: String(label),
              order: index,
            })),
          )
          .select()
          .returns<PollOptionRow[]>();
        if (optionsError) throw new Error(optionsError.message);
        return mapActivityRow(activityRow, optionRows ?? []);
      }

      return mapActivityRow(activityRow);
    },

    async listBySession(sessionId) {
      const { data: activityRows, error } = await supabase
        .from("activities")
        .select()
        .eq("session_id", sessionId)
        .order("order", { ascending: true })
        .returns<ActivityRow[]>();
      if (error) throw new Error(error.message);

      return Promise.all(
        (activityRows ?? []).map(async (row) => {
          if (row.kind === "poll") {
            const options = await fetchPollOptions(row.id);
            return mapActivityRow(row, options);
          }
          return mapActivityRow(row);
        }),
      );
    },

    async getById(id) {
      const { data: row, error } = await supabase
        .from("activities")
        .select()
        .eq("id", id)
        .maybeSingle<ActivityRow>();
      if (error) throw new Error(error.message);
      if (!row) return null;

      if (row.kind === "poll") {
        const options = await fetchPollOptions(row.id);
        return mapActivityRow(row, options);
      }
      return mapActivityRow(row);
    },

    async setStatus(id, status) {
      const { error } = await supabase
        .from("activities")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async reorder(sessionId, orderedIds) {
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from("activities")
            .update({ order: index })
            .eq("id", id)
            .eq("session_id", sessionId),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
    },
  };
}
