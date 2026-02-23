import { ApiError } from "../../../../src/server/api-error.js";
import { requireParentContext } from "../../../../src/server/auth.js";
import { isSelfAttestationConsentGrantAllowed } from "../../../../src/server/billing-config.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import {
  COPPA_CONSENT_STATUS,
  getParentCoppaConsentState,
  setParentCoppaConsentState
} from "../../../../src/server/session-foundation-service.js";

function resolveConsentStatusFromAction(action, options = {}) {
  const normalized = String(action ?? "").trim().toLowerCase();
  if (normalized === "grant") {
    const allowSelfAttestationGrant =
      options.allowSelfAttestationConsentGrant ?? isSelfAttestationConsentGrantAllowed(options.env);
    if (!allowSelfAttestationGrant) {
      throw new ApiError(
        409,
        "billing_required_for_coppa_grant",
        "Complete subscription billing verification to grant parental consent."
      );
    }
    return COPPA_CONSENT_STATUS.granted;
  }

  if (normalized === "revoke") {
    return COPPA_CONSENT_STATUS.revoked;
  }

  throw new ApiError(400, "validation_error", "Action must be 'grant' or 'revoke'.");
}

export function createPrivacyConsentGetHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const readConsent = dependencies.getParentCoppaConsentState ?? getParentCoppaConsentState;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request) {
    try {
      const { parent } = await requireParent(request);
      const consent = await readConsent(parent.id);
      return Response.json({ consent });
    } catch (error) {
      return onError(error, "privacy_consent_fetch_failed");
    }
  };
}

export function createPrivacyConsentPostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const writeConsent = dependencies.setParentCoppaConsentState ?? setParentCoppaConsentState;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      const payload = await request.json().catch(() => ({}));
      const status = resolveConsentStatusFromAction(payload.action, {
        allowSelfAttestationConsentGrant: dependencies.allowSelfAttestationConsentGrant,
        env: dependencies.env
      });
      const { parent } = await requireParent(request);
      const consent = await writeConsent(
        parent.id,
        {
          status,
          actorParentId: parent.id
        },
        { request }
      );

      return Response.json({ consent });
    } catch (error) {
      return onError(error, "privacy_consent_update_failed");
    }
  };
}

export const GET = createPrivacyConsentGetHandler();
export const POST = createPrivacyConsentPostHandler();
