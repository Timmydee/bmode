import { supabase } from "./client";
import type { AuthClient } from "../contracts";

export function createAuthClient(): AuthClient {
  return {
    async signInAnonymously(email) {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { email } },
      });
      if (error) throw new Error(error.message);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async getCurrentUserId() {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },

    onAuthChange(cb) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(session?.user?.id ?? null);
      });
      return () => subscription.unsubscribe();
    },
  };
}
