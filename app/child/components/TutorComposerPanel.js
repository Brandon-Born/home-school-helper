"use client";

export function TutorComposerPanel({
  studentInput,
  setStudentInput,
  loading,
  voiceBusy,
  isTranscribing,
  isPlayingSpeech,
  pendingTutorReply,
  turnStatus,
  onSend,
  onVoiceStart,
  onVoiceStop,
  isCloudRecording,
  isListening,
  speechSupport,
  listeningLabel
}) {
  const voiceButtonClass = `btn btn--secondary voice-button${isCloudRecording || isListening ? " is-active" : ""}`;

  return (
    <section className="card">
      <h2 className="section-title">Ask the Tutor</h2>
      <p className="section-muted">Type a question or hold the mic button to speak.</p>
      <form onSubmit={onSend} className="form-grid">
        <div className="voice-row">
          <input
            className="input"
            placeholder="Type your question"
            value={studentInput}
            onChange={(event) => setStudentInput(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || voiceBusy || pendingTutorReply || !studentInput.trim()}
          >
            Send
          </button>
        </div>

        <div className="voice-row">
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
            disabled={loading || voiceBusy || pendingTutorReply || (!speechSupport.cloudStt && !speechSupport.browserStt)}
            className={voiceButtonClass}
          >
            {listeningLabel}
          </button>

          {turnStatus ? <span className="pill">{turnStatus}</span> : null}
          {isTranscribing || pendingTutorReply || isPlayingSpeech ? <span className="pill">Working...</span> : null}
        </div>
      </form>
    </section>
  );
}
