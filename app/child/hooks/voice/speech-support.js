function readSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function getSpeechRecognitionCtor() {
  return readSpeechRecognitionCtor();
}

export function detectSpeechSupport() {
  const cloudStt =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);

  return {
    cloudStt,
    browserStt: Boolean(readSpeechRecognitionCtor()),
    cloudTts: typeof window !== "undefined" && typeof Audio !== "undefined",
    browserTts: typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
  };
}
