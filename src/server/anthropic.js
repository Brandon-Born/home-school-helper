import { ApiError } from "./api-error.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Anthropic tutor calls must run on the server only.");
  }
}

function extractTextContent(content = []) {
  return content
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function callAnthropic({ config, systemPrompt, userPrompt, metadata = {} }) {
  assertServerOnly();

  const payload = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }]
      }
    ]
  };

  let response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "tutor_model_call_failed",
        stage: "request",
        model: config.model,
        prompt_version: config.promptVersion,
        session_id: metadata.sessionId ?? null,
        route: metadata.route ?? null,
        error_name: error instanceof Error ? error.name : "unknown"
      })
    );
    throw new ApiError(503, "model_unavailable", "Tutor service is temporarily unavailable.");
  }

  if (!response.ok) {
    console.warn(
      JSON.stringify({
        event: "tutor_model_call_failed",
        stage: "response",
        model: config.model,
        prompt_version: config.promptVersion,
        session_id: metadata.sessionId ?? null,
        route: metadata.route ?? null,
        provider_status: response.status
      })
    );

    if (response.status === 429) {
      throw new ApiError(503, "model_rate_limited", "Tutor service is temporarily unavailable.");
    }

    if (response.status >= 500) {
      throw new ApiError(503, "model_unavailable", "Tutor service is temporarily unavailable.");
    }

    throw new ApiError(502, "model_request_failed", "Tutor service request failed.");
  }

  const data = await response.json();
  const text = extractTextContent(data.content);

  console.info(
    JSON.stringify({
      event: "tutor_model_call",
      model: config.model,
      prompt_version: config.promptVersion,
      session_id: metadata.sessionId ?? null,
      route: metadata.route ?? null
    })
  );

  return { text, raw: data };
}
