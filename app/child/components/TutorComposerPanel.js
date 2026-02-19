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
  const isVoiceActive = isCloudRecording || isListening;
  const voiceDisabled = loading || voiceBusy || pendingTutorReply || (!speechSupport.cloudStt && !speechSupport.browserStt);
  const voiceButtonClass = `btn btn--secondary voice-button${isCloudRecording || isListening ? " is-active" : ""}`;

  return (
    <section className="card" aria-busy={loading || pendingTutorReply}>
      <h2 className="section-title">What do you want to learn? 🤔</h2>
      <p className="section-muted">Type your question or hold the mic button to talk.</p>
      <form onSubmit={onSend} className="form-grid" aria-busy={loading || pendingTutorReply}>
        <div className="voice-row">
          <label className="sr-only" htmlFor="student-input">
            Ask a question
          </label>
          <input
            id="student-input"
            className="input"
            placeholder="Ask me anything..."
            value={studentInput}
            onChange={(event) => setStudentInput(event.target.value)}
            autoFocus
            aria-label="Ask a question"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || voiceBusy || pendingTutorReply || !studentInput.trim()}
          >
            Ask! ✨
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
            onClick={(event) => {
              if (event.detail !== 0) {
                return;
              }

              if (isVoiceActive) {
                onVoiceStop();
              } else {
                onVoiceStart();
              }
            }}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !isVoiceActive) {
                event.preventDefault();
                onVoiceStart();
              }
            }}
            onKeyUp={(event) => {
              if ((event.key === "Enter" || event.key === " ") && isVoiceActive) {
                event.preventDefault();
                onVoiceStop();
              }
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
            onBlur={() => {
              if (isVoiceActive) {
                onVoiceStop();
              }
            }}
            disabled={voiceDisabled}
            className={voiceButtonClass}
            aria-pressed={isVoiceActive}
            aria-describedby="turn-status"
          >
            {listeningLabel}
          </button>

          <span id="turn-status" className="pill" role="status" aria-live="polite">
            {turnStatus || "Waiting for your question"}
          </span>
          {isTranscribing || pendingTutorReply || isPlayingSpeech ? <span className="pill pulse">Thinking...</span> : null}
        </div>
      </form>
    </section>
  );
}
