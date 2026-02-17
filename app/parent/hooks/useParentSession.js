"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isParentAuthFailure } from "../../../src/lib/auth-failures.js";
import { apiRequest } from "../../../src/lib/http.js";
import { getBrowserSupabaseClient } from "../../../src/lib/supabase-browser.js";

export function useParentSession({ onSessionCleared, setError }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [session, setSession] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const invalidateParentSession = useCallback(
    async (message = "Parent session expired. Please sign in again.") => {
      await supabase.auth.signOut();
      setSession(null);
      onSessionCleared();
      setNeedsReauth(true);
      setError(message);
    },
    [onSessionCleared, setError, supabase]
  );

  const refreshParentSession = useCallback(async () => {
    const {
      data: { session: refreshedSession },
      error: refreshError
    } = await supabase.auth.refreshSession();

    if (refreshError || !refreshedSession?.access_token) {
      return null;
    }

    setSession(refreshedSession);
    return refreshedSession;
  }, [supabase]);

  const parentRequest = useCallback(
    async (path, options = {}) => {
      const runRequest = (accessToken) =>
        apiRequest(path, {
          ...options,
          bearerToken: accessToken
        });

      if (!session?.access_token) {
        throw new Error("Parent session is not available.");
      }

      try {
        return await runRequest(session.access_token);
      } catch (requestError) {
        if (!isParentAuthFailure(requestError)) {
          throw requestError;
        }

        const refreshedSession = await refreshParentSession();
        if (refreshedSession?.access_token) {
          return runRequest(refreshedSession.access_token);
        }

        await invalidateParentSession();
        throw new Error("Parent session expired. Please sign in again.");
      }
    },
    [invalidateParentSession, refreshParentSession, session?.access_token]
  );

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setNeedsReauth(false);
  }, [setError, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    onSessionCleared();
    setNeedsReauth(false);
  }, [onSessionCleared, supabase]);

  useEffect(() => {
    async function loadInitialSession() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();
      setSession(currentSession ?? null);
    }

    loadInitialSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      if (nextSession) {
        setNeedsReauth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return {
    session,
    needsReauth,
    parentRequest,
    refreshParentSession,
    invalidateParentSession,
    signInWithGoogle,
    signOut
  };
}
