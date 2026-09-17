import type { Backend } from "../contracts";
import { createActivityRepository } from "./activity-repo";
import { createAuthClient } from "./auth";
import { createParticipantRepository } from "./participant-repo";
import { createQARepository } from "./qa-repo";
import { createResponseRepository } from "./response-repo";
import { createSupabaseRealtime } from "./realtime";
import { createSessionRepository } from "./session-repo";

export function createSupabaseBackend(): Backend {
  return {
    sessions: createSessionRepository(),
    participants: createParticipantRepository(),
    activities: createActivityRepository(),
    responses: createResponseRepository(),
    qa: createQARepository(),
    realtime: createSupabaseRealtime(),
    auth: createAuthClient(),
  };
}
