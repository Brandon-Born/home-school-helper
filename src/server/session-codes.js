import { createHash, randomBytes } from "node:crypto";

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeJoinCode(code) {
  return String(code || "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function generateJoinCode(length = 8) {
  if (!Number.isInteger(length) || length < 6) {
    throw new Error("Join code length must be an integer >= 6");
  }

  let output = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = randomBytes(1)[0] % JOIN_CODE_CHARS.length;
    output += JOIN_CODE_CHARS[randomIndex];
  }

  return output;
}

export function hashOpaqueToken(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function createChildSessionToken() {
  return randomBytes(32).toString("base64url");
}
