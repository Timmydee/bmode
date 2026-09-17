import type { Backend } from "./contracts";
import { createSupabaseBackend } from "./supabase";
// import { createSocketIOBackend } from './socketio';   // future

function build(): Backend {
  switch (process.env.NEXT_PUBLIC_BACKEND ?? "supabase") {
    case "supabase":
      return createSupabaseBackend();
    // case 'socketio':
    //   return createSocketIOBackend();
    default:
      throw new Error("Unknown backend");
  }
}

export const backend: Backend = build();
export type { Backend } from "./contracts";
export * from "./types";
export * from "./events";
