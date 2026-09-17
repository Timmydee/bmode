import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { RealtimeClient, Unsubscribe } from "../contracts";
import type { SessionEvent } from "../events";

function sessionChannelName(sessionId: string): string {
  return `session:${sessionId}`;
}

// The host also calls trackPresence (see app/host/[sessionId]/page.tsx)
// with this key prefix, purely so a stable client stays subscribed to the
// presence channel and can observe/broadcast participant departures even
// when the last real participant's own tab is the one closing. That
// presence entry is not a participant and must not be counted as one.
const HOST_PRESENCE_KEY_PREFIX = "host:";

function countParticipants(state: Record<string, unknown>): number {
  return Object.keys(state).filter(
    (key) => !key.startsWith(HOST_PRESENCE_KEY_PREFIX),
  ).length;
}

// Broadcast payloads cross the wire as JSON, so any Date field (e.g.
// AudienceQuestion.submittedAt) arrives as a plain ISO string, not a Date
// instance — silently breaking anything that calls .getTime() on it (like
// lib/game/rank-questions.ts). Revive the specific fields known to be
// Dates on the way in, rather than a generic/heuristic string-to-date walk
// that could misfire on unrelated string fields.
function reviveEvent(event: SessionEvent): SessionEvent {
  if (event.type === "question_added" || event.type === "question_updated") {
    return {
      ...event,
      question: {
        ...event.question,
        submittedAt: new Date(event.question.submittedAt),
      },
    };
  }
  return event;
}

// useSession, useActiveActivity and useLiveResults each independently call
// subscribe() for the same session — one underlying Supabase channel per
// session topic is shared across all of them (reference-counted) rather
// than each hook opening its own. Multiple separate channel objects for
// the identical topic proved unreliable in testing (broadcasts didn't
// consistently reach every one of them); one channel fanning out to every
// registered handler is both correct and cheaper.
interface SessionChannelEntry {
  channel: RealtimeChannel;
  handlers: Set<(event: SessionEvent) => void>;
}

const sessionChannels = new Map<string, SessionChannelEntry>();

function getOrCreateSessionChannel(sessionId: string): SessionChannelEntry {
  const existing = sessionChannels.get(sessionId);
  if (existing) return existing;

  const handlers = new Set<(event: SessionEvent) => void>();
  const channel = supabase
    .channel(sessionChannelName(sessionId), {
      config: { broadcast: { self: true } },
    })
    .on("broadcast", { event: "session_event" }, ({ payload }) => {
      const event = reviveEvent(payload as SessionEvent);
      handlers.forEach((handler) => handler(event));
    })
    .subscribe();

  const entry: SessionChannelEntry = { channel, handlers };
  sessionChannels.set(sessionId, entry);
  return entry;
}

export function createSupabaseRealtime(): RealtimeClient {
  return {
    subscribe(sessionId, handler): Unsubscribe {
      const entry = getOrCreateSessionChannel(sessionId);
      entry.handlers.add(handler);

      return () => {
        entry.handlers.delete(handler);
        if (entry.handlers.size === 0) {
          supabase.removeChannel(entry.channel);
          sessionChannels.delete(sessionId);
        }
      };
    },

    async publish(sessionId, event) {
      const channel = supabase.channel(sessionChannelName(sessionId));
      await channel.send({
        type: "broadcast",
        event: "session_event",
        payload: event,
      });
    },

    // Presence has no slot in the SessionEvent union, so a presence change
    // is translated into an explicit participant_joined/participant_left
    // broadcast — that broadcast, not the presence state itself, is what
    // useSession renders.
    //
    // Only the host's own trackPresence call computes and publishes that
    // broadcast. Every presence-tracking client observes the same shared
    // state, so if every client independently published its own count on
    // every sync, concurrent joins would race: two clients converging on
    // the presence state at slightly different times can each broadcast a
    // different count, and whichever broadcast is *delivered* last wins —
    // not whichever is actually current — making the displayed count
    // flicker or revert. A single authoritative publisher (the host, which
    // is present for the session's whole lifetime) avoids that race.
    // Participant clients still call trackPresence so the host can see
    // them; they just don't also publish.
    trackPresence(sessionId, participantId): Unsubscribe {
      const isHost = participantId.startsWith(HOST_PRESENCE_KEY_PREFIX);
      let lastCount = 0;

      let channelBuilder = supabase.channel(`presence:${sessionId}`, {
        config: { presence: { key: participantId } },
      });

      if (isHost) {
        channelBuilder = channelBuilder.on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const count = countParticipants(state);
          if (count === lastCount) return;
          const type = count > lastCount ? "participant_joined" : "participant_left";
          lastCount = count;

          const event: SessionEvent = {
            type,
            participantCount: count,
            serverTime: Date.now(),
          };
          void supabase.channel(sessionChannelName(sessionId)).send({
            type: "broadcast",
            event: "session_event",
            payload: event,
          });
        });
      }

      const channel = channelBuilder.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ participantId });
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
