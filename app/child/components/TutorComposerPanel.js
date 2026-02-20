"use client";

import { useRef } from "react";

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
  onVoiceHoldStart,
  onVoiceHoldEnd,
  holdToTalkPressed,
  isCloudRecording,
  isListening,
  speechSupport,
  listeningLabel
}) {
  const isVoiceActive = isCloudRecording || isListening;
  const showThinking = isTranscribing || pendingTutorReply || isPlayingSpeech;
  const voiceDisabled = loading || voiceBusy || pendingTutorReply || (!speechSupport.cloudStt && !speechSupport.browserStt);
  const frozenVoiceUiRef = useRef(null);
  const wasHoldingRef = useRef(false);

  if (holdToTalkPressed && !wasHoldingRef.current) {
    frozenVoiceUiRef.current = {
      isVoiceActive,
      listeningLabel,
      turnStatus,
      showThinking
    };
  } else if (!holdToTalkPressed && wasHoldingRef.current) {
    frozenVoiceUiRef.current = null;
  }
  wasHoldingRef.current = holdToTalkPressed;

  const frozenVoiceUi = holdToTalkPressed ? frozenVoiceUiRef.current : null;
  const displayIsVoiceActive = frozenVoiceUi?.isVoiceActive ?? isVoiceActive;
  const displayListeningLabel = frozenVoiceUi?.listeningLabel ?? listeningLabel;
  const displayTurnStatus = frozenVoiceUi?.turnStatus ?? turnStatus;
  const displayShowThinking = frozenVoiceUi?.showThinking ?? showThinking;
  const voiceButtonClass = `btn btn--secondary voice-button${displayIsVoiceActive ? " is-active" : ""}`;

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
              onVoiceHoldStart();
              onVoiceStart();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              onVoiceStop();
              onVoiceHoldEnd();
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
                onVoiceHoldStart();
                onVoiceStart();
              }
            }}
            onKeyUp={(event) => {
              if ((event.key === "Enter" || event.key === " ") && isVoiceActive) {
                event.preventDefault();
                onVoiceStop();
                onVoiceHoldEnd();
              }
            }}
            onPointerCancel={(event) => {
              event.preventDefault();
              onVoiceStop();
              onVoiceHoldEnd();
            }}
            onPointerLeave={(event) => {
              if (holdToTalkPressed) {
                event.preventDefault();
                if (isCloudRecording || isListening) {
                  onVoiceStop();
                }
                onVoiceHoldEnd();
              }
            }}
            onBlur={() => {
              if (holdToTalkPressed) {
                if (isVoiceActive) {
                  onVoiceStop();
                }
                onVoiceHoldEnd();
              }
            }}
            disabled={voiceDisabled}
            className={voiceButtonClass}
            aria-pressed={displayIsVoiceActive}
            aria-describedby="turn-status"
          >
            {displayListeningLabel}
          </button>

          <span id="turn-status" className="pill" role="status" aria-live="polite">
            {displayTurnStatus || "Waiting for your question"}
          </span>
          {displayShowThinking ? <span className="pill pulse">Thinking...</span> : null}
        </div>
      </form>
    </section>
  );
}
