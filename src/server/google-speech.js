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

async function getGoogleAccessToken(config) {
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
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new ApiError(
      502,
      "speech_provider_auth_failed",
      parseGoogleError(payload, "Unable to authenticate Google Speech provider.")
    );
  }

  const expiresInSeconds = Number(payload.expires_in) || 3600;
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + expiresInSeconds * 1000
  };

  return payload.access_token;
}

export async function transcribeWithGoogleSpeech({ audioBytes, languageCode }) {
  const config = getGoogleSpeechConfig();
  const accessToken = await getGoogleAccessToken(config);

  const recognizerPath = `projects/${config.projectId}/locations/${config.location}/recognizers/${config.sttRecognizer}`;
  const endpoint = `https://speech.googleapis.com/v2/${recognizerPath}:recognize`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
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
    throw new ApiError(
      502,
      "speech_transcription_failed",
      parseGoogleError(payload, "Unable to transcribe audio.")
    );
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

export async function synthesizeWithGoogleTts({ text, speakingRate }) {
  const config = getGoogleSpeechConfig();
  const accessToken = await getGoogleAccessToken(config);

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
        speakingRate: Number.isFinite(speakingRate) ? speakingRate : config.ttsSpeakingRate
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.audioContent) {
    throw new ApiError(
      502,
      "speech_synthesis_failed",
      parseGoogleError(payload, "Unable to synthesize speech audio.")
    );
  }

  return Buffer.from(payload.audioContent, "base64");
}

export function resetGoogleSpeechTokenCache() {
  tokenCache = undefined;
}
