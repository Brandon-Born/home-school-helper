export function getVoiceStatusText(speechSupport) {
  if (speechSupport.cloudStt && speechSupport.cloudTts) {
    return "Voice is ready.";
  }

  if (speechSupport.cloudStt) {
    return "Voice input is ready. Sidekick audio uses device playback.";
  }

  if (speechSupport.browserStt && speechSupport.browserTts) {
    return "Basic voice mode is ready on this device.";
  }

  if (speechSupport.browserStt) {
    return "Voice input is ready on this device.";
  }

  if (speechSupport.browserTts) {
    return "Audio playback is ready on this device.";
  }

  return "Voice is not available here. You can still type.";
}

export function getTurnStatusText({ isCloudRecording, isListening, isTranscribing, pendingTutorReply, isPlayingSpeech, notice }) {
  if (isCloudRecording) {
    return "Listening. Release to transcribe.";
  }

  if (isListening) {
    return "Listening. Release to stop.";
  }

  if (isTranscribing) {
    return "Turning your voice into text...";
  }

  if (pendingTutorReply) {
    return "Sidekick is working on your answer...";
  }

  if (isPlayingSpeech) {
    return "Sidekick is speaking...";
  }

  return notice;
}

export function getListeningLabelText({ isCloudRecording, isListening, isTranscribing, isPlayingSpeech }) {
  if (isCloudRecording) {
    return "Recording... release to fill the text box";
  }

  if (isListening) {
    return "Listening... release to stop";
  }

  if (isTranscribing) {
    return "Transcribing...";
  }

  if (isPlayingSpeech) {
    return "Sidekick speaking...";
  }

  return "Hold to talk";
}
