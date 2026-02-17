import crypto from "node:crypto";
import { ApiError } from "./api-error.js";
import { getGoogleSpeechConfig } from "./google-speech-config.js";

const OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

let tokenCache;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseGoogleError(payload, fallbackMessage) {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (payload?.error_description) {
    return payload.error_description;
  }

  if (payload?.message) {
    return payload.message;
  }

  return fallbackMessage;
}

function mapGoogleError(payload, fallbackCode, fallbackMessage) {
  const status = String(payload?.error?.status || "").trim().toUpperCase();
  const message = parseGoogleError(payload, fallbackMessage);

  if (status === "RESOURCE_EXHAUSTED") {
    return new ApiError(429, "speech_provider_rate_limited", message);
  }

  if (status === "DEADLINE_EXCEEDED") {
    return new ApiError(504, "speech_provider_timeout", message);
  }

  if (status === "UNAVAILABLE" || status === "INTERNAL") {
    return new ApiError(503, "speech_provider_unavailable", message);
  }

  if (status === "UNAUTHENTICATED" || status === "PERMISSION_DENIED") {
    return new ApiError(502, "speech_provider_auth_failed", message);
  }

  if (status === "INVALID_ARGUMENT") {
    return new ApiError(400, "validation_error", message);
  }

  return new ApiError(502, fallbackCode, message);
}

function clampSpeakingRate(rawValue, fallbackValue) {
  if (!Number.isFinite(rawValue)) {
    return fallbackValue;
  }

  return Math.min(1.2, Math.max(0.8, rawValue));
}

function createSignedJwt(config) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claimSet = {
    iss: config.clientEmail,
    scope: OAUTH_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signingInput = `${encodedHeader}.${encodedClaimSet}`;

  const signature = crypto.createSign("RSA-SHA256").update(signingInput).end().sign(config.privateKey, "base64");

  return `${signingInput}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

async function getGoogleAccessToken(config, { signal } = {}) {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const assertion = createSignedJwt(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body,
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw mapGoogleError(payload, "speech_provider_auth_failed", "Unable to authenticate Google Speech provider.");
  }

  const expiresInSeconds = Number(payload.expires_in) || 3600;
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + expiresInSeconds * 1000
  };

  return payload.access_token;
}

export async function transcribeWithGoogleSpeech({ audioBytes, languageCode, signal }) {
  const config = getGoogleSpeechConfig();
  const accessToken = await getGoogleAccessToken(config, { signal });

  const recognizerPath = `projects/${config.projectId}/locations/${config.location}/recognizers/${config.sttRecognizer}`;
  const endpoint = `https://speech.googleapis.com/v2/${recognizerPath}:recognize`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    signal,
    body: JSON.stringify({
      config: {
        autoDecodingConfig: {},
        languageCodes: [languageCode || config.sttLanguageCode],
        model: config.sttModel
      },
      content: Buffer.from(audioBytes).toString("base64")
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw mapGoogleError(payload, "speech_transcription_failed", "Unable to transcribe audio.");
  }

  const segments = [];
  for (const result of payload.results ?? []) {
    const transcript = result?.alternatives?.[0]?.transcript;
    if (transcript) {
      segments.push(String(transcript).trim());
    }
  }

  return {
    transcript: segments.join(" ").trim()
  };
}

export async function synthesizeWithGoogleTts({ text, speakingRate, signal }) {
  const config = getGoogleSpeechConfig();
  const accessToken = await getGoogleAccessToken(config, { signal });

  const trimmedText = String(text || "").trim();
  if (!trimmedText) {
    throw new ApiError(400, "validation_error", "text is required for speech synthesis.");
  }

  const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    signal,
    body: JSON.stringify({
      input: {
        text: trimmedText
      },
      voice: {
        languageCode: config.ttsLanguageCode,
        name: config.ttsVoiceName
      },
      audioConfig: {
        audioEncoding: config.ttsAudioEncoding,
        speakingRate: clampSpeakingRate(speakingRate, config.ttsSpeakingRate)
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.audioContent) {
    throw mapGoogleError(payload, "speech_synthesis_failed", "Unable to synthesize speech audio.");
  }

  return Buffer.from(payload.audioContent, "base64");
}

export function resetGoogleSpeechTokenCache() {
  tokenCache = undefined;
}
