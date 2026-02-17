import test from "node:test";
import assert from "node:assert/strict";

import {
  getGoogleSpeechConfig,
  resetGoogleSpeechConfigCache
} from "../src/server/google-speech-config.js";

test("google speech config uses kid-friendly defaults", () => {
  resetGoogleSpeechConfigCache();
  const config = getGoogleSpeechConfig({
    GOOGLE_CLOUD_PROJECT_ID: "proj",
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: "svc@example.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"
    })
  });

  assert.equal(config.sttModel, "latest_short");
  assert.equal(config.ttsSpeakingRate, 0.92);
});

test("google speech config parses wrapped service account json", () => {
  resetGoogleSpeechConfigCache();
  const rawJson = JSON.stringify({
    client_email: "svc@example.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"
  });
  const wrapped = `'${rawJson}'`;

  const config = getGoogleSpeechConfig({
    GOOGLE_CLOUD_PROJECT_ID: "proj",
    GOOGLE_SERVICE_ACCOUNT_JSON: wrapped
  });

  assert.equal(config.clientEmail, "svc@example.com");
  assert.match(config.privateKey, /BEGIN PRIVATE KEY/);
  assert.match(config.privateKey, /\nabc\n/);
});
