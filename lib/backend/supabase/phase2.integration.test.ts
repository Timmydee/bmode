// Phase 2 Definition of done, run against a real Supabase project: create a
// session, retrieve it by join code, join as a participant, retrieve that
// participant by token — all through the Backend interface.
//
// Skipped automatically until NEXT_PUBLIC_SUPABASE_URL is set (see
// .env.local.example). Run with: npm test
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const hasCredentials = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

describe.skipIf(!hasCredentials)("Phase 2: Supabase sessions + participants", () => {
  afterAll(async () => {
    const { supabase } = await import("./client");
    await supabase.auth.signOut();
  });

  it("creates a session, joins a participant, and rejoins by token — via the Backend interface only", async () => {
    // Sign-in + several sequential round trips can occasionally exceed the
    // 5s default on a free-tier project; this hits real network I/O, not
    // pure logic, so a longer timeout is appropriate here specifically.
    const email = process.env.PHASE2_TEST_HOST_EMAIL;
    const password = process.env.PHASE2_TEST_HOST_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Set PHASE2_TEST_HOST_EMAIL and PHASE2_TEST_HOST_PASSWORD in .env.local (a user created via Supabase Auth -> Users -> Add user) to run this test.",
      );
    }

    // Sign in as a real host would (magic link isn't scriptable headlessly)
    // so the "hosts create their own sessions" RLS policy is exercised for
    // real, not bypassed.
    const { supabase } = await import("./client");
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.user) {
      throw new Error(
        `Could not sign in as test host: ${signInError?.message}`,
      );
    }
    const hostId = signInData.user.id;

    const { backend } = await import("../index");

    const title = `Test session ${randomUUID()}`;
    const session = await backend.sessions.create({ hostId, title });
    expect(session.title).toBe(title);
    expect(session.status).toBe("draft");
    expect(session.joinCode).toMatch(/^\d{6}$/);

    const fetchedByCode = await backend.sessions.getByJoinCode(
      session.joinCode,
    );
    expect(fetchedByCode?.id).toBe(session.id);

    const token = randomUUID();
    const participant = await backend.participants.join({
      sessionId: session.id,
      nickname: "Test Participant",
      token,
    });
    expect(participant.sessionId).toBe(session.id);
    expect(participant.nickname).toBe("Test Participant");

    const rejoined = await backend.participants.getByToken(session.id, token);
    expect(rejoined?.id).toBe(participant.id);

    const count = await backend.participants.countBySession(session.id);
    expect(count).toBe(1);
  }, 20000);
});
