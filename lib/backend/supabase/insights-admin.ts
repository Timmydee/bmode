import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InsightsAdminReader } from "../contracts";
import type { EmailSignup, Feedback, InsightsSummary } from "../types";

// Reads usage and feedback with the service role key, which bypasses RLS.
// Server-only: the key must never reach the browser.
let client: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it (Supabase > Project Settings > API) to the server environment.",
    );
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

interface SummaryRow {
  people_today: number;
  people_7d: number;
  people_30d: number;
  people_all: number;
  games_7d: number;
  games_all: number;
  joins_7d: number;
  joins_all: number;
  circles_finished_all: number;
  feedback_all: number;
  rating_avg: number | null;
  tracking_since: string | null;
  daily: { day: string; people: number; games: number; joins: number }[];
}

interface FeedbackRow {
  id: string;
  device_id: string | null;
  rating: number | null;
  message: string;
  email: string | null;
  page: string | null;
  session_id: string | null;
  created_at: string;
}

interface EmailSignupRow {
  id: string;
  email: string;
  source: EmailSignup["source"];
  consent_text: string;
  device_id: string | null;
  created_at: string;
}

export function createInsightsAdminReader(): InsightsAdminReader {
  return {
    async summary(): Promise<InsightsSummary> {
      const { data, error } = await adminClient().rpc("insights_summary");
      if (error) throw new Error(error.message);
      const row = data as SummaryRow;
      return {
        peopleToday: row.people_today,
        people7d: row.people_7d,
        people30d: row.people_30d,
        peopleAll: row.people_all,
        games7d: row.games_7d,
        gamesAll: row.games_all,
        joins7d: row.joins_7d,
        joinsAll: row.joins_all,
        circlesFinishedAll: row.circles_finished_all,
        feedbackAll: row.feedback_all,
        ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
        trackingSince: row.tracking_since,
        daily: row.daily,
      };
    },

    async listFeedback(limit) {
      const { data, error } = await adminClient()
        .from("feedback")
        .select()
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<FeedbackRow[]>();
      if (error) throw new Error(error.message);
      return data.map(
        (row): Feedback => ({
          id: row.id,
          deviceId: row.device_id,
          rating: row.rating,
          message: row.message,
          email: row.email,
          page: row.page,
          sessionId: row.session_id,
          createdAt: row.created_at,
        }),
      );
    },

    async listEmailSignups() {
      const { data, error } = await adminClient()
        .from("email_signups")
        .select()
        .order("created_at", { ascending: false })
        .returns<EmailSignupRow[]>();
      if (error) throw new Error(error.message);
      return data.map(
        (row): EmailSignup => ({
          id: row.id,
          email: row.email,
          source: row.source,
          consentText: row.consent_text,
          deviceId: row.device_id,
          createdAt: row.created_at,
        }),
      );
    },
  };
}
