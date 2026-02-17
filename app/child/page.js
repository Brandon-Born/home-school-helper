"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventStreamError, openEventStream } from "../../src/lib/event-stream.js";
import { ApiRequestError, apiFormRequest, apiRequest } from "../../src/lib/http.js";

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

function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getCloudSttSupport() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function isChildTokenFailure(error) {
  if (error instanceof EventStreamError || error instanceof ApiRequestError) {
    if ([401, 403, 404, 410].includes(error.status)) {
      return true;
    }

    if (error.code === "invalid_child_session_token" || error.code === "missing_authorization") {
      return true;
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("token") && (message.includes("invalid") || message.includes("expired"));
}

export default function ChildPage() {
  const [sessionAccess, setSessionAccess] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [studentInput, setStudentInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState("");
  const [speechSupport, setSpeechSupport] = useState({
    cloudStt: false,
    browserStt: false,
    cloudTts: false,
    browserTts: false
  });
  const [isListening, setIsListening] = useState(false);
  const [isCloudRecording, setIsCloudRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recognitionRef = useRef(null);
  const voiceBaseInputRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const playbackAudioRef = useRef(null);
  const playbackUrlRef = useRef(null);
  const spokenAssistantMessageIdsRef = useRef(new Set());

  const voiceStatus = useMemo(() => {
    if (speechSupport.cloudStt && speechSupport.cloudTts) {
      return "Cloud speech active: Google STT V2 + Chirp 3 TTS.";
    }

    if (speechSupport.cloudStt) {
      return "Cloud STT active. Tutor audio uses browser fallback.";
    }

    if (speechSupport.browserStt && speechSupport.browserTts) {
      return "Browser voice fallback active.";
    }

    if (speechSupport.browserStt) {
      return "Browser voice input fallback active.";
    }

    if (speechSupport.browserTts) {
      return "Browser audio playback fallback active.";
    }

    return "Voice unavailable in this browser. Text mode only.";
  }, [speechSupport]);

  function revokePlaybackResources() {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }

    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
  }

  function stopBrowserVoiceCapture() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognitionRef.current = null;
    try {
      recognition.stop();
    } catch {
      // Ignore redundant stop calls.
    }
  }

  function stopCloudVoiceCapture() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    mediaRecorderRef.current = null;
    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } catch {
      // Ignore redundant stop calls.
    }
  }

  function stopAllVoiceCapture() {
    stopBrowserVoiceCapture();
    stopCloudVoiceCapture();

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsCloudRecording(false);
  }

  function clearChildSession(message) {
    stopAllVoiceCapture();
    revokePlaybackResources();
    spokenAssistantMessageIdsRef.current = new Set();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.speechSynthesis?.cancel();
    }

    setSessionAccess(null);
    setMessages([]);
    setLoading(false);
    setVoiceBusy(false);
    setStudentInput("");
    setError(message || "");
  }

  function speakTextFallback(text) {
    if (!speechSupport.browserTts || typeof window === "undefined") {
      return;
    }

    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return;
    }

    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis?.speak(utterance);
  }

  async function playCloudTts(text) {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    const response = await fetch(`/api/session/${sessionAccess.session_id}/speech/synthesize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionAccess.child_session_token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiRequestError(payload?.message || "Unable to synthesize speech.", {
        status: response.status,
        code: payload?.error || null,
        payload
      });
    }

    const audioBlob = await response.blob();
    revokePlaybackResources();

    const objectUrl = URL.createObjectURL(audioBlob);
    playbackUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    playbackAudioRef.current = audio;

    audio.onended = () => {
      revokePlaybackResources();
    };

    await audio.play();
  }

  function speakAssistantMessages(incoming = []) {
    if (!autoSpeak) {
      return;
    }

    const freshAssistantMessages = incoming.filter(
      (message) => message.actor_type === "assistant" && !spokenAssistantMessageIdsRef.current.has(message.id)
    );

    for (const message of freshAssistantMessages) {
      spokenAssistantMessageIdsRef.current.add(message.id);
    }

    const latest = freshAssistantMessages[freshAssistantMessages.length - 1];
    if (!latest) {
      return;
    }

    void (async () => {
      try {
        if (speechSupport.cloudTts) {
          await playCloudTts(latest.content);
          return;
        }
      } catch (speechError) {
        if (isChildTokenFailure(speechError)) {
          clearChildSession("Session token expired or invalid. Rejoin with a fresh code.");
          return;
        }
      }

      speakTextFallback(latest.content);
    })();
  }

  async function transcribeCloudRecording(audioBlob) {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, "utterance.webm");

    const payload = await apiFormRequest(`/api/session/${sessionAccess.session_id}/speech/transcribe`, {
      method: "POST",
      bearerToken: sessionAccess.child_session_token,
      formData
    });

    const transcript = String(payload?.transcript || "").trim();
    if (!transcript) {
      throw new Error("No speech transcript detected. Try speaking closer to the microphone.");
    }

    const baseInput = studentInput.trim();
    setStudentInput([baseInput, transcript].filter(Boolean).join(" "));
  }

  async function startCloudVoiceCapture() {
    if (!speechSupport.cloudStt || isCloudRecording || voiceBusy) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true
        }
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Voice recording failed.");
        setIsCloudRecording(false);
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        setIsCloudRecording(false);

        if (mediaStreamRef.current) {
          for (const track of mediaStreamRef.current.getTracks()) {
            track.stop();
          }
          mediaStreamRef.current = null;
        }

        if (chunks.length === 0) {
          return;
        }

        setVoiceBusy(true);
        try {
          await transcribeCloudRecording(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
          setError("");
        } catch (speechError) {
          if (isChildTokenFailure(speechError)) {
            clearChildSession("Session token expired or invalid. Rejoin with a fresh code.");
            return;
          }

          setError(speechError instanceof Error ? speechError.message : "Voice transcription failed.");
        } finally {
          setVoiceBusy(false);
        }
      };

      recorder.start();
      setError("");
      setIsCloudRecording(true);
    } catch {
      setError("Microphone access is required for voice input.");
    }
  }

  function startBrowserVoiceCapture() {
    if (!speechSupport.browserStt || isListening || voiceBusy) {
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setError("Speech recognition is unavailable in this browser.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    voiceBaseInputRef.current = studentInput.trim();
    voiceFinalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = voiceFinalTranscriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      voiceFinalTranscriptRef.current = finalTranscript;
      setStudentInput([voiceBaseInputRef.current, finalTranscript, interimTranscript].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. Enable mic access to use voice input.");
      } else {
        setError(`Voice input failed: ${event.error}`);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    try {
      recognitionRef.current = recognition;
      setError("");
      setIsListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError("Unable to start voice capture.");
    }
  }

  function startVoiceCapture() {
    if (speechSupport.cloudStt) {
      void startCloudVoiceCapture();
      return;
    }

    startBrowserVoiceCapture();
  }

  function stopVoiceCapture() {
    if (isCloudRecording) {
      stopCloudVoiceCapture();
      return;
    }

    stopBrowserVoiceCapture();
  }

  useEffect(() => {
    setSpeechSupport({
      cloudStt: getCloudSttSupport(),
      browserStt: Boolean(getSpeechRecognitionCtor()),
      cloudTts: typeof window !== "undefined" && typeof Audio !== "undefined",
      browserTts: typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
    });

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

    return () => {
      stopAllVoiceCapture();
      revokePlaybackResources();
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    let disposed = false;
    let reconnectTimer;
    let streamAbortController;

    const connect = async () => {
      streamAbortController = new AbortController();

      try {
        await openEventStream({
          path: `/api/session/${sessionAccess.session_id}/stream?limit=200`,
          bearerToken: sessionAccess.child_session_token,
          signal: streamAbortController.signal,
          onEvent: ({ event, data }) => {
            if (disposed) {
              return;
            }

            if (event === "snapshot") {
              const incoming = data.messages ?? [];
              setMessages(incoming);
              setError("");

              spokenAssistantMessageIdsRef.current = new Set(
                incoming.filter((message) => message.actor_type === "assistant").map((message) => message.id)
              );
              return;
            }

            if (event === "message_append") {
              const incoming = data.messages ?? [];
              setMessages((previous) => mergeMessages(previous, incoming));
              speakAssistantMessages(incoming);
              return;
            }

            if (event === "error") {
              setError(data?.message || "Stream error.");
            }
          }
        });
      } catch (streamError) {
        if (disposed) {
          return;
        }

        if (isChildTokenFailure(streamError)) {
          clearChildSession("Session token expired or invalid. Rejoin with a fresh code.");
          return;
        }

        setError(streamError instanceof Error ? streamError.message : "Stream disconnected.");
        reconnectTimer = window.setTimeout(connect, 1800);
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (streamAbortController) {
        streamAbortController.abort();
      }
    };
  }, [autoSpeak, sessionAccess?.session_id, sessionAccess?.child_session_token, speechSupport.cloudTts]);

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
      spokenAssistantMessageIdsRef.current = new Set();
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
      await apiRequest(`/api/session/${sessionAccess.session_id}/child-turn`, {
        method: "POST",
        bearerToken: sessionAccess.child_session_token,
        body: {
          student_input: studentInput.trim()
        }
      });

      setStudentInput("");
    } catch (requestError) {
      if (isChildTokenFailure(requestError)) {
        clearChildSession("Session token expired or invalid. Rejoin with a fresh code.");
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "Unable to send turn.");
    } finally {
      setLoading(false);
    }
  }

  function leaveSession() {
    clearChildSession("");
  }

  const listeningLabel = isCloudRecording
    ? "Recording... release to transcribe"
    : isListening
      ? "Listening... release to stop"
      : "Hold to talk";

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
            <p style={{ marginBottom: 12 }}>{voiceStatus}</p>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={leaveSession}>
                Leave Session
              </button>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(event) => setAutoSpeak(event.target.checked)}
                  disabled={!speechSupport.cloudTts && !speechSupport.browserTts}
                />
                Auto-speak tutor replies
              </label>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Ask the Tutor</h2>
            <form onSubmit={sendTurn} style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Type your question"
                  value={studentInput}
                  onChange={(event) => setStudentInput(event.target.value)}
                />
                <button type="submit" disabled={loading || voiceBusy || !studentInput.trim()}>
                  Send
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    startVoiceCapture();
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    stopVoiceCapture();
                  }}
                  onPointerCancel={(event) => {
                    event.preventDefault();
                    stopVoiceCapture();
                  }}
                  onPointerLeave={(event) => {
                    if (isCloudRecording || isListening) {
                      event.preventDefault();
                      stopVoiceCapture();
                    }
                  }}
                  disabled={voiceBusy || (!speechSupport.cloudStt && !speechSupport.browserStt)}
                  style={{
                    background: isCloudRecording || isListening ? "#fee4e2" : "#eef4ff",
                    border: "1px solid #d0d5dd",
                    borderRadius: 8,
                    padding: "8px 12px"
                  }}
                >
                  {listeningLabel}
                </button>

                {voiceBusy ? <span style={{ color: "#555" }}>Transcribing...</span> : null}
              </div>
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
