"use client";

import { useEffect, useRef } from "react";

export function StatusAlert({ tone = "success", message, style, className = "", autoFocus = true, testId }) {
  const alertRef = useRef(null);

  useEffect(() => {
    if (!message || !autoFocus) {
      return;
    }

    alertRef.current?.focus();
  }, [message, tone, autoFocus]);

  if (!message) {
    return null;
  }

  const role = tone === "error" ? "alert" : "status";
  const live = tone === "error" ? "assertive" : "polite";

  return (
    <div
      ref={alertRef}
      tabIndex={-1}
      role={role}
      aria-live={live}
      aria-atomic="true"
      className={`alert alert--${tone}${className ? ` ${className}` : ""}`}
      style={style}
      data-testid={testId}
    >
      {message}
    </div>
  );
}
