export function getVoiceStatusText(speechSupport) {
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
}

export function getTurnStatusText({ isCloudRecording, isListening, isTranscribing, pendingTutorReply, isPlayingSpeech, notice }) {
  if (isCloudRecording) {
    return "Listening. Release to transcribe.";
  }

  if (isListening) {
    return "Listening. Release to stop.";
  }

  if (isTranscribing) {
    return "Transcribing your voice...";
  }

  if (pendingTutorReply) {
    return "Tutor is thinking...";
  }

  if (isPlayingSpeech) {
    return "Tutor is speaking...";
  }

  return notice;
}

export function getListeningLabelText({ isCloudRecording, isListening, isTranscribing, isPlayingSpeech }) {
  if (isCloudRecording) {
    return "Recording... release to transcribe";
  }

  if (isListening) {
    return "Listening... release to stop";
  }

  if (isTranscribing) {
    return "Transcribing...";
  }

  if (isPlayingSpeech) {
    return "Tutor speaking...";
  }

  return "Hold to talk";
}
