"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildSessionForUi,
  initialActionAlerts,
  initialChildForm,
  initialLoadingState,
  initialSessionForm,
  mergeMessages
} from "./parent-console-shared.js";
import { useParentChildren } from "./useParentChildren.js";
import { useParentGuidanceActions } from "./useParentGuidanceActions.js";
import { useParentSession } from "./useParentSession.js";
import { useParentSessions } from "./useParentSessions.js";
import { useParentTranscriptStream } from "./useParentTranscriptStream.js";

export { mergeMessages, buildSessionForUi } from "./parent-console-shared.js";

export function createUseParentConsole({
  useParentSessionHook = useParentSession,
  useParentTranscriptStreamHook = useParentTranscriptStream,
  useParentChildrenHook = useParentChildren,
  useParentSessionsHook = useParentSessions,
  useParentGuidanceActionsHook = useParentGuidanceActions
} = {}) {
  return function useParentConsole() {
    const [parentProfile, setParentProfile] = useState(null);
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState("");
    const [activeSession, setActiveSession] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(initialLoadingState);
    const [actionAlerts, setActionAlerts] = useState(initialActionAlerts);
    const [childForm, setChildForm] = useState(initialChildForm);
    const [sessionForm, setSessionForm] = useState(initialSessionForm);
    const [nudgeText, setNudgeText] = useState("");

    const setLoadingState = useCallback((key, value) => {
      setLoading((previous) => ({
        ...previous,
        [key]: value
      }));
    }, []);

    const clearActionAlert = useCallback((key) => {
      setActionAlerts((previous) => ({
        ...previous,
        [key]: null
      }));
    }, []);

    const setActionAlert = useCallback((key, tone, message) => {
      setActionAlerts((previous) => ({
        ...previous,
        [key]: {
          tone,
          message
        }
      }));
    }, []);

    const clearParentData = useCallback(() => {
      setParentProfile(null);
      setChildren([]);
      setSelectedChildId("");
      setActiveSession(null);
      setActiveSessions([]);
      setMessages([]);
      setLoading(initialLoadingState);
      setActionAlerts(initialActionAlerts);
    }, []);

    const {
      session,
      needsReauth,
      parentRequest,
      refreshParentSession,
      invalidateParentSession,
      signInWithGoogle,
      signOut
    } = useParentSessionHook({
      onSessionCleared: clearParentData,
      setError
    });

    const fetchParentData = useCallback(async () => {
      if (!session?.access_token) {
        return;
      }

      setLoadingState("refreshParentData", true);
      setError("");

      try {
        const [profilePayload, childrenPayload, sessionsPayload] = await Promise.all([
          parentRequest("/api/parent/me"),
          parentRequest("/api/children"),
          parentRequest("/api/session/active")
        ]);

        setParentProfile(profilePayload.parent);
        const nextChildren = childrenPayload.children ?? [];
        setChildren(nextChildren);
        const nextActiveSessions = sessionsPayload.sessions ?? [];
        setActiveSessions(nextActiveSessions);

        setSelectedChildId((previous) => {
          if (previous && nextChildren.some((child) => child.id === previous)) {
            return previous;
          }
          return nextChildren[0]?.id ?? "";
        });

        setActiveSession((previous) => {
          if (!previous) {
            return previous;
          }

          const matching = nextActiveSessions.find((sessionRow) => sessionRow.session_id === previous.session_id);
          if (!matching) {
            return null;
          }

          return buildSessionForUi(matching, nextChildren, previous);
        });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't load your parent data. Please try again.");
      } finally {
        setLoadingState("refreshParentData", false);
      }
    }, [parentRequest, session?.access_token, setLoadingState]);

    useEffect(() => {
      fetchParentData();
    }, [fetchParentData]);

    const handleStreamSnapshot = useCallback((snapshotMessages) => {
      setMessages(snapshotMessages);
    }, []);

    const handleStreamAppend = useCallback((incomingMessages) => {
      setMessages((previous) => mergeMessages(previous, incomingMessages));
    }, []);

    useParentTranscriptStreamHook({
      activeSessionId: activeSession?.session_id ?? null,
      accessToken: session?.access_token ?? null,
      refreshParentSession,
      invalidateParentSession,
      onSnapshot: handleStreamSnapshot,
      onAppend: handleStreamAppend,
      setError
    });

    const signIn = useCallback(async () => {
      setLoadingState("auth", true);
      try {
        await signInWithGoogle();
      } finally {
        setLoadingState("auth", false);
      }
    }, [setLoadingState, signInWithGoogle]);

    const signOutAction = useCallback(async () => {
      setLoadingState("auth", true);
      try {
        await signOut();
      } finally {
        setLoadingState("auth", false);
      }
    }, [setLoadingState, signOut]);

    const { createChild, updateChild, deleteChild } = useParentChildrenHook({
      parentRequest,
      childForm,
      selectedChildId,
      fetchParentData,
      setLoadingState,
      setError,
      clearActionAlert,
      setActionAlert,
      setChildForm,
      setSelectedChildId
    });

    const { startSession, rejoinSession, endSession, regenerateCode } = useParentSessionsHook({
      parentRequest,
      children,
      selectedChildId,
      sessionForm,
      activeSessionId: activeSession?.session_id,
      setLoadingState,
      setError,
      clearActionAlert,
      setActionAlert,
      setActiveSession,
      setActiveSessions,
      setSelectedChildId,
      setMessages
    });

    const { sendNudge, setOverride } = useParentGuidanceActionsHook({
      parentRequest,
      activeSessionId: activeSession?.session_id,
      nudgeText,
      setNudgeText,
      setLoadingState,
      setError,
      clearActionAlert,
      setActionAlert
    });

    return {
      state: {
        session,
        needsReauth,
        parentProfile,
        children,
        selectedChildId,
        activeSession,
        activeSessions,
        messages,
        error,
        loading,
        actionAlerts,
        busy: Object.values(loading).some(Boolean),
        childForm,
        sessionForm,
        nudgeText
      },
      actions: {
        signInWithGoogle: signIn,
        signOut: signOutAction,
        createChild,
        updateChild,
        deleteChild,
        startSession,
        rejoinSession,
        endSession,
        regenerateCode,
        sendNudge,
        setOverride,
        refreshParentData: fetchParentData,
        setSelectedChildId,
        setChildForm,
        setSessionForm,
        setNudgeText,
        setError
      }
    };
  };
}

export const useParentConsole = createUseParentConsole();
