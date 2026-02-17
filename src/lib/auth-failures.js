import { EventStreamError } from "./event-stream.js";
import { ApiRequestError } from "./http.js";

function errorMessageIncludes(error, fragments) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return fragments.every((fragment) => message.includes(fragment));
}

function hasStructuredErrorFields(error) {
  return error instanceof EventStreamError || error instanceof ApiRequestError;
}

export function isChildAuthFailure(error) {
  if (hasStructuredErrorFields(error)) {
    if ([401, 403, 404, 410].includes(error.status)) {
      return true;
    }

    if (["invalid_child_session_token", "missing_authorization"].includes(error.code)) {
      return true;
    }
  }

  return errorMessageIncludes(error, ["token"]) && (errorMessageIncludes(error, ["invalid"]) || errorMessageIncludes(error, ["expired"]));
}

export function isParentAuthFailure(error) {
  if (hasStructuredErrorFields(error)) {
    if ([401, 403].includes(error.status)) {
      return true;
    }

    if (["invalid_parent_token", "missing_authorization"].includes(error.code)) {
      return true;
    }
  }

  return errorMessageIncludes(error, ["token", "invalid"]);
}
