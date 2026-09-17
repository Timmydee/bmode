import { supabase } from "./client";
import { mapSessionRow, type SessionRow } from "./mappers";
import type { SessionRepository } from "../contracts";

const UNIQUE_VIOLATION = "23505";

function generateJoinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createSessionRepository(): SessionRepository {
  return {
    async create({ hostId, title }) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const joinCode = generateJoinCode();
        const { data, error } = await supabase
          .from("sessions")
          .insert({ host_id: hostId, title, join_code: joinCode })
          .select()
          .single<SessionRow>();

        if (!error) return mapSessionRow(data);
        if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
      }
      throw new Error("Could not generate a unique join code — please retry.");
    },

    async getById(id) {
      const { data, error } = await supabase
        .from("sessions")
        .select()
        .eq("id", id)
        .maybeSingle<SessionRow>();
      if (error) throw new Error(error.message);
      return data ? mapSessionRow(data) : null;
    },

    async getByJoinCode(code) {
      const { data, error } = await supabase
        .from("sessions")
        .select()
        .eq("join_code", code)
        .maybeSingle<SessionRow>();
      if (error) throw new Error(error.message);
      return data ? mapSessionRow(data) : null;
    },

    async listByHost(hostId) {
      const { data, error } = await supabase
        .from("sessions")
        .select()
        .eq("host_id", hostId)
        .order("created_at", { ascending: false })
        .returns<SessionRow[]>();
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapSessionRow);
    },

    async setStatus(id, status) {
      const { error } = await supabase
        .from("sessions")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setActiveActivity(id, activityId) {
      const { error } = await supabase
        .from("sessions")
        .update({ active_activity_id: activityId })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
