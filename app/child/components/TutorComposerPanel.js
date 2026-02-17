"use client";

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

export function TutorComposerPanel({
  studentInput,
  setStudentInput,
  loading,
  voiceBusy,
  onSend,
  onVoiceStart,
  onVoiceStop,
  isCloudRecording,
  isListening,
  speechSupport,
  listeningLabel
}) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Ask the Tutor</h2>
      <form onSubmit={onSend} style={{ display: "grid", gap: 10, marginBottom: 12 }}>
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
              onVoiceStart();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              onVoiceStop();
            }}
            onPointerCancel={(event) => {
              event.preventDefault();
              onVoiceStop();
            }}
            onPointerLeave={(event) => {
              if (isCloudRecording || isListening) {
                event.preventDefault();
                onVoiceStop();
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
    </section>
  );
}
