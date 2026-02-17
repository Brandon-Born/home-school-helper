"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../src/lib/http.js";

const STORAGE_KEY = "child_session_access";

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

export default function ChildPage() {
  const [sessionAccess, setSessionAccess] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [studentInput, setStudentInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed?.session_id && parsed?.child_session_token) {
        setSessionAccess(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function fetchMessages() {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    try {
      const payload = await apiRequest(`/api/session/${sessionAccess.session_id}/messages?limit=150`, {
        bearerToken: sessionAccess.child_session_token
      });
      setMessages(payload.messages ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to fetch messages.");
    }
  }

  useEffect(() => {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    fetchMessages();
    const timer = setInterval(fetchMessages, 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAccess?.session_id, sessionAccess?.child_session_token]);

  async function joinSession(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await apiRequest("/api/session/join", {
        method: "POST",
        body: {
          code: joinCode,
          device_fingerprint: deviceFingerprint || null
        }
      });

      const access = payload.session_access;
      setSessionAccess(access);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
      setJoinCode("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to join session.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTurn(event) {
    event.preventDefault();
    if (!sessionAccess?.session_id || !studentInput.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await apiRequest(`/api/session/${sessionAccess.session_id}/child-turn`, {
        method: "POST",
        bearerToken: sessionAccess.child_session_token,
        body: {
          student_input: studentInput.trim()
        }
      });

      setMessages((previous) => [
        ...previous,
        {
          id: `local-child-${Date.now()}`,
          actor_type: "child",
          visibility_scope: "child_and_parent",
          content: studentInput.trim()
        },
        {
          id: `local-assistant-${Date.now() + 1}`,
          actor_type: "assistant",
          visibility_scope: "child_and_parent",
          content: payload.assistant_text
        }
      ]);

      setStudentInput("");
      await fetchMessages();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send turn.");
    } finally {
      setLoading(false);
    }
  }

  function leaveSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSessionAccess(null);
    setMessages([]);
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 20, background: "#f5fff8", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Child Tutor Surface</h1>

      {!sessionAccess ? (
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Join Session</h2>
          <form onSubmit={joinSession} style={{ display: "grid", gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="Session code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Device fingerprint (optional)"
              value={deviceFingerprint}
              onChange={(event) => setDeviceFingerprint(event.target.value)}
            />
            <button type="submit" disabled={loading || !joinCode.trim()}>
              Join
            </button>
          </form>
        </section>
      ) : (
        <>
          <section style={cardStyle}>
            <p style={{ marginTop: 0 }}>
              Connected to session <code>{sessionAccess.session_id}</code>
            </p>
            <p style={{ marginBottom: 12 }}>Token expires at: {sessionAccess.expires_at}</p>
            <button type="button" onClick={leaveSession}>
              Leave Session
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Ask the Tutor</h2>
            <form onSubmit={sendTurn} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Type your question"
                value={studentInput}
                onChange={(event) => setStudentInput(event.target.value)}
              />
              <button type="submit" disabled={loading || !studentInput.trim()}>
                Send
              </button>
            </form>

            <div
              style={{
                border: "1px solid #e3e3e3",
                borderRadius: 8,
                background: "#fafafa",
                padding: 10,
                maxHeight: 360,
                overflow: "auto"
              }}
            >
              {messages.length === 0 ? (
                <p style={{ margin: 0, color: "#666" }}>No messages yet.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} style={{ marginBottom: 8 }}>
                    <strong>{message.actor_type}</strong>
                    <div>{message.content}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </main>
  );
}
