import { supabase } from "./client";
import type { InsightsRepository } from "../contracts";

// Insert-only: the tables have no select policy, so never chain .select().
export function createInsightsRepository(): InsightsRepository {
  return {
    async recordEvent({ deviceId, event, sessionId }) {
      const { error } = await supabase.from("usage_events").insert({
        device_id: deviceId,
        event,
        session_id: sessionId ?? null,
      });
      if (error) throw new Error(error.message);
    },

    async sendFeedback(draft) {
      const { error } = await supabase.from("feedback").insert({
        device_id: draft.deviceId,
        rating: draft.rating,
        message: draft.message,
        email: draft.email,
        page: draft.page,
        session_id: draft.sessionId,
      });
      if (error) throw new Error(error.message);
    },

    async signUpForEmails(draft) {
      const { error } = await supabase.from("email_signups").insert({
        email: draft.email,
        source: draft.source,
        consent_text: draft.consentText,
        device_id: draft.deviceId,
      });
      // 23505: this address is already on the list, which is what they wanted.
      if (error && error.code !== "23505") throw new Error(error.message);
    },
  };
}
