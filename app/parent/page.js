"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../src/lib/http.js";
import { getBrowserSupabaseClient } from "../../src/lib/supabase-browser.js";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1px solid #c8c8c8",
  borderRadius: 8
};

const cardStyle = {
  border: "1px solid #dadada",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff"
};

function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ParentPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [session, setSession] = useState(null);
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nudgeResponse, setNudgeResponse] = useState("");

  const [childForm, setChildForm] = useState({
    child_name: "",
    age: "",
    grade: "",
    subjects: "",
    personality_description: "",
    special_needs: ""
  });

  const [sessionForm, setSessionForm] = useState({
    daily_subjects: "",
    parent_context: "",
    goal_notes: "",
    additional_context: ""
  });

  const [nudgeText, setNudgeText] = useState("");

  async function loadSessionFromSupabase() {
    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession();
    setSession(currentSession ?? null);
  }

  useEffect(() => {
    loadSessionFromSupabase();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function parentRequest(path, options = {}) {
    if (!session?.access_token) {
      throw new Error("Parent session is not available.");
    }

    return apiRequest(path, {
      ...options,
      bearerToken: session.access_token
    });
  }

  async function refreshParentData() {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const profilePayload = await parentRequest("/api/parent/me");
      const childrenPayload = await parentRequest("/api/children");

      setParentProfile(profilePayload.parent);
      setChildren(childrenPayload.children ?? []);

      if (!selectedChildId && childrenPayload.children?.length > 0) {
        setSelectedChildId(childrenPayload.children[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load parent data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshParentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function fetchMessages() {
    if (!activeSession?.session_id || !session?.access_token) {
      return;
    }

    try {
      const payload = await parentRequest(`/api/session/${activeSession.session_id}/messages?limit=150`);
      setMessages(payload.messages ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to fetch messages.");
    }
  }

  useEffect(() => {
    if (!activeSession?.session_id || !session?.access_token) {
      return;
    }

    fetchMessages();
    const timer = setInterval(fetchMessages, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.session_id, session?.access_token]);

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setParentProfile(null);
    setChildren([]);
    setActiveSession(null);
    setMessages([]);
  }

  async function createChild(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await parentRequest("/api/children", {
        method: "POST",
        body: {
          ...childForm,
          age: Number.parseInt(childForm.age, 10),
          subjects: toList(childForm.subjects)
        }
      });

      setChildForm({
        child_name: "",
        age: "",
        grade: "",
        subjects: "",
        personality_description: "",
        special_needs: ""
      });

      await refreshParentData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create child profile.");
    } finally {
      setLoading(false);
    }
  }

  async function startSession(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await parentRequest("/api/session/start", {
        method: "POST",
        body: {
          child_id: selectedChildId,
          daily_subjects: toList(sessionForm.daily_subjects),
          parent_context: sessionForm.parent_context,
          goal_notes: sessionForm.goal_notes,
          additional_context: sessionForm.additional_context
        }
      });

      setActiveSession(payload.session);
      setMessages([]);
      setNudgeResponse("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start session.");
    } finally {
      setLoading(false);
    }
  }

  async function sendNudge(event) {
    event.preventDefault();
    if (!activeSession?.session_id || !nudgeText.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await parentRequest(`/api/session/${activeSession.session_id}/parent-nudge`, {
        method: "POST",
        body: {
          nudge_text: nudgeText.trim(),
          parent_guidance: nudgeText.trim()
        }
      });

      setNudgeResponse(payload.assistant_text || "Nudge sent.");
      setNudgeText("");
      await fetchMessages();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send nudge.");
    } finally {
      setLoading(false);
    }
  }

  async function setOverride(enabled) {
    if (!activeSession?.session_id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await parentRequest(`/api/session/${activeSession.session_id}/override`, {
        method: "POST",
        body: {
          enabled,
          duration_minutes: 15
        }
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update override.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 20, background: "#f6f7fb", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Parent Session Console</h1>

      {!session ? (
        <section style={cardStyle}>
          <p>Sign in with Google to manage child profiles and sessions.</p>
          <button onClick={signInWithGoogle} type="button">
            Continue with Google
          </button>
          {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        </section>
      ) : (
        <>
          <section style={cardStyle}>
            <p style={{ marginTop: 0 }}>
              Signed in as <strong>{session.user?.email}</strong>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={refreshParentData} type="button" disabled={loading}>
                Refresh
              </button>
              <button onClick={signOut} type="button" disabled={loading}>
                Sign out
              </button>
            </div>
            {parentProfile ? (
              <p style={{ marginBottom: 0 }}>
                Parent profile id: <code>{parentProfile.id}</code>
              </p>
            ) : null}
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Create Child Profile</h2>
            <form onSubmit={createChild} style={{ display: "grid", gap: 10 }}>
              <input
                style={inputStyle}
                placeholder="Child name"
                value={childForm.child_name}
                onChange={(event) => setChildForm((prev) => ({ ...prev, child_name: event.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Age"
                type="number"
                min="4"
                max="21"
                value={childForm.age}
                onChange={(event) => setChildForm((prev) => ({ ...prev, age: event.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Grade"
                value={childForm.grade}
                onChange={(event) => setChildForm((prev) => ({ ...prev, grade: event.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Subjects (comma separated)"
                value={childForm.subjects}
                onChange={(event) => setChildForm((prev) => ({ ...prev, subjects: event.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                placeholder="Personality notes"
                value={childForm.personality_description}
                onChange={(event) =>
                  setChildForm((prev) => ({ ...prev, personality_description: event.target.value }))
                }
              />
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                placeholder="Special needs"
                value={childForm.special_needs}
                onChange={(event) => setChildForm((prev) => ({ ...prev, special_needs: event.target.value }))}
              />
              <button type="submit" disabled={loading}>
                Save Child
              </button>
            </form>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Start Session</h2>
            <form onSubmit={startSession} style={{ display: "grid", gap: 10 }}>
              <select
                style={inputStyle}
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
              >
                <option value="">Select child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.first_name} (Grade {child.grade})
                  </option>
                ))}
              </select>

              <input
                style={inputStyle}
                placeholder="Today's subjects (comma separated)"
                value={sessionForm.daily_subjects}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, daily_subjects: event.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                placeholder="Parent context for today"
                value={sessionForm.parent_context}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, parent_context: event.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                placeholder="Goal notes"
                value={sessionForm.goal_notes}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, goal_notes: event.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                placeholder="Additional context"
                value={sessionForm.additional_context}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, additional_context: event.target.value }))}
              />

              <button type="submit" disabled={loading || !selectedChildId}>
                Start Session
              </button>
            </form>

            {activeSession ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#eef4ff" }}>
                <p style={{ margin: "4px 0" }}>
                  Session id: <code>{activeSession.session_id}</code>
                </p>
                <p style={{ margin: "4px 0" }}>
                  Child join code: <strong>{activeSession.join_code}</strong>
                </p>
                <p style={{ margin: "4px 0" }}>Expires at: {activeSession.expires_at}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button type="button" onClick={() => setOverride(true)} disabled={loading}>
                    Enable Direct Answers (15m)
                  </button>
                  <button type="button" onClick={() => setOverride(false)} disabled={loading}>
                    Disable Direct Answers
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {activeSession ? (
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Live Nudge + Transcript</h2>
              <form onSubmit={sendNudge} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Hidden nudge to tutor"
                  value={nudgeText}
                  onChange={(event) => setNudgeText(event.target.value)}
                />
                <button type="submit" disabled={loading || !nudgeText.trim()}>
                  Send
                </button>
              </form>
              {nudgeResponse ? <p style={{ marginTop: 0 }}>Tutor response: {nudgeResponse}</p> : null}

              <div
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: 8,
                  background: "#fafafa",
                  padding: 10,
                  maxHeight: 320,
                  overflow: "auto"
                }}
              >
                {messages.length === 0 ? (
                  <p style={{ margin: 0, color: "#666" }}>No messages yet.</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} style={{ marginBottom: 8 }}>
                      <strong>{message.actor_type}</strong>
                      <span style={{ color: "#777" }}> [{message.visibility_scope}]</span>
                      <div>{message.content}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </>
      )}

      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </main>
  );
}
