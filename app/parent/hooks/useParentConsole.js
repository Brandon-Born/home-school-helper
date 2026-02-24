"use client";

import { useCallback, useEffect, useState } from "react";
import { runAsyncActionStatus } from "./parent-action-status.js";
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

const DEFAULT_BILLING_STATE = Object.freeze({
  enabled: false,
  provider: null,
  subscription: null
});

function normalizeBillingState(payload) {
  const billing = payload?.billing;
  if (!billing || typeof billing !== "object") {
    return { ...DEFAULT_BILLING_STATE };
  }

  return {
    enabled: Boolean(billing.enabled),
    provider: billing.provider ?? null,
    subscription: billing.subscription ?? null
  };
}

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
    const [privacySummary, setPrivacySummary] = useState(null);
    const [privacyRequests, setPrivacyRequests] = useState([]);
    const [billing, setBilling] = useState({ ...DEFAULT_BILLING_STATE });
    const [selectedChildId, setSelectedChildId] = useState("");
    const [activeSession, setActiveSession] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(initialLoadingState);
    const [parentDataLoaded, setParentDataLoaded] = useState(false);
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
      setPrivacySummary(null);
      setPrivacyRequests([]);
      setBilling({ ...DEFAULT_BILLING_STATE });
      setSelectedChildId("");
      setActiveSession(null);
      setActiveSessions([]);
      setMessages([]);
      setLoading(initialLoadingState);
      setParentDataLoaded(false);
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
        const [profilePayload, childrenPayload, sessionsPayload, privacyPayload, privacyRequestsPayload, billingResult] = await Promise.all([
          parentRequest("/api/parent/me"),
          parentRequest("/api/children"),
          parentRequest("/api/session/active"),
          parentRequest("/api/privacy/child-data-summary"),
          parentRequest("/api/privacy/requests"),
          parentRequest("/api/billing/subscription")
            .then((payload) => ({ ok: true, payload }))
            .catch(() => ({ ok: false, payload: null }))
        ]);

        setParentProfile(profilePayload.parent);
        const nextChildren = childrenPayload.children ?? [];
        setChildren(nextChildren);
        const nextActiveSessions = sessionsPayload.sessions ?? [];
        setActiveSessions(nextActiveSessions);
        setPrivacySummary(privacyPayload.summary ?? null);
        setPrivacyRequests(privacyRequestsPayload.requests ?? []);
        setBilling(normalizeBillingState(billingResult.payload));

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
        setParentDataLoaded(true);
        setLoadingState("refreshParentData", false);
      }
    }, [parentRequest, session?.access_token, setLoadingState]);

    useEffect(() => {
      if (!session?.access_token) {
        setParentDataLoaded(true);
        return;
      }
      setParentDataLoaded(false);
    }, [session?.access_token]);

    useEffect(() => {
      fetchParentData();
    }, [fetchParentData]);

    const handleStreamSnapshot = useCallback((snapshotMessages) => {
      setMessages(snapshotMessages);
    }, []);

    const handleStreamAppend = useCallback((incomingMessages) => {
      setMessages((previous) => mergeMessages(previous, incomingMessages));
    }, []);

    const applyConsentToParentProfile = useCallback((consent) => {
      if (!consent) {
        return;
      }

      setParentProfile((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          coppa_consent_required: consent.required,
          coppa_consent_status: consent.status,
          coppa_consent_updated_at: consent.updated_at,
          coppa_policy_version: consent.policy_version,
          coppa_consent_method: consent.method
        };
      });
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

    const grantCoppaConsent = useCallback(async () => {
      const outcome = await runAsyncActionStatus({
        actionKey: "consent",
        setLoadingState,
        setError,
        clearActionAlert,
        setActionAlert,
        fallbackErrorMessage: "We couldn't record parental consent. Please try again.",
        run: async () => {
          try {
            return await parentRequest("/api/billing/checkout-session", {
              method: "POST"
            });
          } catch {
            return parentRequest("/api/privacy/consent", {
              method: "POST",
              body: {
                action: "grant"
              }
            });
          }
        },
        onSuccess: (payload) => {
          const checkoutUrl = payload?.checkout?.url;
          if (typeof checkoutUrl === "string" && checkoutUrl) {
            if (typeof window !== "undefined" && window.location) {
              window.location.assign(checkoutUrl);
            }
            return "Redirecting to secure checkout…";
          }

          applyConsentToParentProfile(payload?.consent);
          return "Parental consent confirmed.";
        }
      });

      return outcome.ok;
    }, [applyConsentToParentProfile, clearActionAlert, parentRequest, setActionAlert, setError, setLoadingState]);

    const revokeCoppaConsent = useCallback(async () => {
      const outcome = await runAsyncActionStatus({
        actionKey: "consent",
        setLoadingState,
        setError,
        clearActionAlert,
        setActionAlert,
        fallbackErrorMessage: "We couldn't revoke parental consent. Please try again.",
        run: async () =>
          parentRequest("/api/privacy/consent", {
            method: "POST",
            body: {
              action: "revoke"
            }
          }),
        onSuccess: (payload) => {
          applyConsentToParentProfile(payload?.consent);
          return "Parental consent revoked. New child profiles and sessions are now blocked.";
        }
      });

      return outcome.ok;
    }, [applyConsentToParentProfile, clearActionAlert, parentRequest, setActionAlert, setError, setLoadingState]);

    const startBillingCheckout = useCallback(async () => {
      const outcome = await runAsyncActionStatus({
        actionKey: "consent",
        setLoadingState,
        setError,
        clearActionAlert,
        setActionAlert,
        fallbackErrorMessage: "We couldn't start secure billing checkout. Please try again.",
        run: async () =>
          parentRequest("/api/billing/checkout-session", {
            method: "POST"
          }),
        onSuccess: (payload) => {
          const url = payload?.checkout?.url;
          if (typeof url === "string" && url) {
            if (typeof window !== "undefined" && window.location) {
              window.location.assign(url);
            }
            return "Redirecting to secure checkout…";
          }

          return "Billing checkout is ready.";
        }
      });

      return outcome.ok ? outcome.result : null;
    }, [clearActionAlert, parentRequest, setActionAlert, setError, setLoadingState]);

    const openBillingPortal = useCallback(async () => {
      const outcome = await runAsyncActionStatus({
        actionKey: "consent",
        setLoadingState,
        setError,
        clearActionAlert,
        setActionAlert,
        fallbackErrorMessage: "We couldn't open billing management. Please try again.",
        run: async () =>
          parentRequest("/api/billing/portal-session", {
            method: "POST"
          }),
        onSuccess: (payload) => {
          const url = payload?.portal?.url;
          if (typeof url === "string" && url) {
            if (typeof window !== "undefined" && window.location) {
              window.location.assign(url);
            }
            return "Opening billing management…";
          }

          return "Billing management is ready.";
        }
      });

      return outcome.ok ? outcome.result : null;
    }, [clearActionAlert, parentRequest, setActionAlert, setError, setLoadingState]);

    const requestPrivacyExport = useCallback(
      async ({ reason = "" } = {}) => {
        const outcome = await runAsyncActionStatus({
          actionKey: "privacyAction",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't prepare your export. Please try again.",
          run: async () =>
            parentRequest("/api/privacy/export", {
              method: "POST",
              body: {
                reason
              }
            }),
          onSuccess: async (payload) => {
            if (payload?.export_snapshot?.summary) {
              setPrivacySummary(payload.export_snapshot.summary);
            }
            await fetchParentData();
            return "Export snapshot generated.";
          }
        });

        return outcome.ok ? outcome.result : null;
      },
      [clearActionAlert, fetchParentData, parentRequest, setActionAlert, setError, setLoadingState]
    );

    const requestPrivacyDelete = useCallback(
      async ({ reason = "", confirmPhrase = "" } = {}) => {
        const outcome = await runAsyncActionStatus({
          actionKey: "privacyAction",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't delete child data. Please try again.",
          run: async () =>
            parentRequest("/api/privacy/delete", {
              method: "POST",
              body: {
                reason,
                confirm_phrase: confirmPhrase
              }
            }),
          onSuccess: async () => {
            await fetchParentData();
            setSelectedChildId("");
            setActiveSession(null);
            setMessages([]);
            return "Child data deleted.";
          }
        });

        return outcome.ok ? outcome.result : null;
      },
      [clearActionAlert, fetchParentData, parentRequest, setActionAlert, setError, setLoadingState]
    );

    const coppaConsentRequired = parentProfile?.coppa_consent_required !== false;
    const coppaConsentStatus = String(parentProfile?.coppa_consent_status || "pending").toLowerCase();
    const hasCoppaConsent = !coppaConsentRequired || coppaConsentStatus === "granted";
    const billingEnabled = Boolean(billing?.enabled);
    const billingSubscription = billing?.subscription ?? null;
    const billingHasAccess = !billingEnabled || Boolean(billingSubscription?.has_access);

    return {
      state: {
        session,
        needsReauth,
        parentProfile,
        privacySummary,
        privacyRequests,
        billing,
        billingEnabled,
        billingSubscription,
        billingHasAccess,
        children,
        selectedChildId,
        activeSession,
        activeSessions,
        messages,
        error,
        loading,
        parentDataLoaded,
        actionAlerts,
        coppaConsentRequired,
        coppaConsentStatus,
        hasCoppaConsent,
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
        grantCoppaConsent,
        revokeCoppaConsent,
        startBillingCheckout,
        openBillingPortal,
        requestPrivacyExport,
        requestPrivacyDelete,
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
