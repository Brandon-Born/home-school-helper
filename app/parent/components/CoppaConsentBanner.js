"use client";

import { StatusAlert } from "../../components/feedback/StatusAlert.js";

export function CoppaConsentBanner({ onGrantConsent, loading, actionAlert, billingEnabled = false }) {
    return (
        <div className="consent-banner" data-testid="coppa-consent-banner" role="alert">
            <div className="consent-banner__icon" aria-hidden="true">🛡️</div>
            <div className="consent-banner__body">
                <h3 className="consent-banner__heading">Parental consent required</h3>
                <p className="consent-banner__text">
                    Before you can add children or start tutoring sessions, we need your consent
                    under the Children&rsquo;s Online Privacy Protection Act (COPPA). This helps
                    us keep your child&rsquo;s data safe.
                    {billingEnabled
                        ? " Verify a parent payment method first (you may see a $1.00 temporary authorization or refundable verification charge), then start your 7-day family trial."
                        : ""}
                </p>
                <div className="btn-row" style={{ marginTop: 12 }}>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={onGrantConsent}
                        disabled={loading}
                        data-testid="coppa-consent-banner-grant"
                    >
                        {billingEnabled ? "Verify parent payment method" : "I am the parent or legal guardian"}
                    </button>
                    <a href="/privacy" className="btn btn--secondary">
                        Review privacy policy
                    </a>
                </div>
                <StatusAlert tone={actionAlert?.tone} message={actionAlert?.message} style={{ marginTop: 10 }} />
            </div>
        </div>
    );
}
