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
    return "Listening... tap again when you're done.";
  }

  if (isListening) {
    return "Listening... tap again when you're done.";
  }

  if (isTranscribing) {
    return "Getting your words...";
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
    return "Tap to stop";
  }

  if (isListening) {
    return "Tap to stop";
  }

  if (isTranscribing) {
    return "Working...";
  }

  if (isPlayingSpeech) {
    return "Sidekick speaking...";
  }

  return "Tap to talk";
}
