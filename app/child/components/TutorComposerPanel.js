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

  const toggleVoiceCapture = () => {
    if (isVoiceActive) {
      onVoiceStop();
      return;
    }
    onVoiceStart();
  };

  return (
    <div className="child-composer" aria-busy={loading || pendingTutorReply}>
      <form onSubmit={onSend} className="child-composer__input-wrapper">
        {showThinking ? <span className="child-composer-status">Thinking...</span> : null}
        <label className="sr-only" htmlFor="student-input">
          Ask a question
        </label>
        <textarea
          id="student-input"
          className="child-composer__input"
          placeholder="Ask me anything..."
          value={studentInput}
          onChange={(event) => setStudentInput(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (studentInput.trim() && !loading && !pendingTutorReply && !voiceBusy) {
                onSend(e);
              }
            }
          }}
          autoFocus
          aria-label="Ask a question"
          rows={1}
        />
        <div className="child-composer__actions">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              toggleVoiceCapture();
            }}
            disabled={voiceDisabled}
            className={`btn-record${isVoiceActive ? " is-active" : ""}`}
            aria-pressed={isVoiceActive}
            aria-label={listeningLabel}
          >
            {isVoiceActive ? "🛑 Click here to end" : "🎤 Record your voice"}
          </button>
          <button
            type="submit"
            className="btn-circle btn-circle--primary"
            disabled={loading || voiceBusy || pendingTutorReply || !studentInput.trim()}
            aria-label="Send"
          >
            ⇧
          </button>
        </div>
      </form>
      <span id="turn-status" className="sr-only" role="status" aria-live="polite">
        {turnStatus || "Waiting for your question"}
      </span>
    </div>
  );
}
