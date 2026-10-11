import "server-only";
import type { InsightsAdminReader } from "./contracts";
import { createInsightsAdminReader } from "./supabase/insights-admin";

// Server-side swap point, the counterpart of index.ts for code that needs
// privileged reads (the /admin page). Never import this from a client file.
export const adminInsights: InsightsAdminReader = createInsightsAdminReader();
