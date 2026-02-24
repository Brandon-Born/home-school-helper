export class ApiRequestError extends Error {
  constructor(message, { status = null, code = null, payload = null } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function buildAuthHeaders(bearerToken) {
  const headers = {};

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }

  return headers;
}

async function parseError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.message || `Request failed with status ${response.status}`;

    return new ApiRequestError(message, {
      status: response.status,
      code: payload?.error || null,
      payload
    });
  }

  const text = await response.text().catch(() => "");
  const message = text || `Request failed with status ${response.status}`;

  return new ApiRequestError(message, {
    status: response.status,
    code: null,
    payload: text
  });
}

export async function apiRequest(path, { method = "GET", body, bearerToken } = {}) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: {
      ...buildAuthHeaders(bearerToken),
      "content-type": "application/json",
      "cache-control": "no-cache, no-store, must-revalidate"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(payload?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: payload?.error || null,
      payload
    });
  }

  return payload;
}

export async function apiFormRequest(path, { method = "POST", formData, bearerToken } = {}) {
  const response = await fetch(path, {
    method,
    headers: buildAuthHeaders(bearerToken),
    body: formData
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json().catch(() => ({}));
}
