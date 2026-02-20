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
  const showThinking = isTranscribing || pendingTutorReply || isPlayingSpeech;
  const voiceDisabled = loading || voiceBusy || pendingTutorReply || (!speechSupport.cloudStt && !speechSupport.browserStt);
  const voiceButtonClass = `btn btn--secondary voice-button${isVoiceActive ? " is-active" : ""}`;

  const toggleVoiceCapture = () => {
    if (isVoiceActive) {
      onVoiceStop();
      return;
    }
    onVoiceStart();
  };

  return (
    <section className="card" aria-busy={loading || pendingTutorReply}>
      <h2 className="section-title">What do you want to learn? 🤔</h2>
      <p className="section-muted">Type your question or tap the mic button to start and stop talking.</p>
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
            onClick={(event) => {
              event.preventDefault();
              toggleVoiceCapture();
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
          {showThinking ? <span className="pill pulse">Thinking...</span> : null}
        </div>
      </form>
    </section>
  );
}
