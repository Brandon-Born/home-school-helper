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

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${failureBody.slice(0, 400)}`);
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
