const ANALYTICS_ENDPOINT = "/api/analytics/event";

function analyticsDisabled() {
  return String(process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_DISABLED || "").trim() === "1";
}

function canTrackInClient() {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof window.fetch !== "function") {
    return false;
  }
  if (!window.location?.href) {
    return false;
  }
  return true;
}

function resolveEndpoint() {
  try {
    return new URL(ANALYTICS_ENDPOINT, window.location.href).toString();
  } catch {
    return "";
  }
}

export function trackProductEvent(event, payload = {}) {
  if (analyticsDisabled() || !canTrackInClient()) {
    return;
  }

  const target = resolveEndpoint();
  if (!target) {
    return;
  }

  try {
    void window.fetch(target, {
      // Use window.fetch for browser-only behavior.
      // In test/jsdom environments this is typically absent, so tracking no-ops.
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        event,
        payload
      }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Analytics must never block product actions.
  }
}
