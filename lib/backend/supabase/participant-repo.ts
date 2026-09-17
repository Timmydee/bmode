import { supabase } from "./client";
import { mapParticipantRow, type ParticipantRow } from "./mappers";
import type { ParticipantRepository } from "../contracts";

export function createParticipantRepository(): ParticipantRepository {
  return {
    async join({ sessionId, nickname, token }) {
      const { data, error } = await supabase
        .from("participants")
        .upsert(
          { session_id: sessionId, nickname, token },
          { onConflict: "session_id,token" },
        )
        .select()
        .single<ParticipantRow>();
      if (error) throw new Error(error.message);
      return mapParticipantRow(data);
    },

    async getByToken(sessionId, token) {
      const { data, error } = await supabase
        .from("participants")
        .select()
        .eq("session_id", sessionId)
        .eq("token", token)
        .maybeSingle<ParticipantRow>();
      if (error) throw new Error(error.message);
      return data ? mapParticipantRow(data) : null;
    },

    async countBySession(sessionId) {
      const { count, error } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async listBySession(sessionId) {
      const { data, error } = await supabase
        .from("participants")
        .select()
        .eq("session_id", sessionId)
        .order("joined_at", { ascending: true })
        .returns<ParticipantRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapParticipantRow);
    },
  };
}
