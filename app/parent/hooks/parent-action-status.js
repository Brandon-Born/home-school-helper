"use client";

function resolveErrorMessage(error, fallbackErrorMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackErrorMessage;
}

export async function runAsyncActionStatus({
  actionKey,
  run,
  setLoadingState,
  setError,
  clearActionAlert,
  setActionAlert,
  clearError = true,
  successMessage = null,
  fallbackErrorMessage = "We couldn't complete that request. Please try again.",
  onSuccess,
  onError
}) {
  setLoadingState(actionKey, true);
  if (clearError) {
    setError("");
  }
  clearActionAlert(actionKey);

  try {
    const result = await run();
    let resolvedSuccessMessage = successMessage;

    if (typeof onSuccess === "function") {
      const nextMessage = await onSuccess(result);
      if (typeof nextMessage === "string") {
        resolvedSuccessMessage = nextMessage;
      }
    }

    if (resolvedSuccessMessage) {
      setActionAlert(actionKey, "success", resolvedSuccessMessage);
    }

    return {
      ok: true,
      result,
      error: null
    };
  } catch (error) {
    if (typeof onError === "function") {
      await onError(error);
    }

    setActionAlert(actionKey, "error", resolveErrorMessage(error, fallbackErrorMessage));
    return {
      ok: false,
      result: null,
      error
    };
  } finally {
    setLoadingState(actionKey, false);
  }
}
