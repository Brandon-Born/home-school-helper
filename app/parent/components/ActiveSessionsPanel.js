"use client";

import { useState } from "react";
import { StatusAlert } from "../../components/feedback/StatusAlert.js";

function timeAgo(isoString) {
    if (!isoString) return "recently";
    const timestamp = new Date(isoString).getTime();
    if (Number.isNaN(timestamp)) return "recently";

    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(isoString, now = Date.now()) {
    if (!isoString) return "soon";
    const timestamp = new Date(isoString).getTime();
    if (Number.isNaN(timestamp)) return "soon";

    const diff = timestamp - now;
    if (diff <= 0) return "expired";
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `in ${hrs}h`;
}

function isJoinCodeActive(joinCode, expiresAt, now = Date.now()) {
    if (!joinCode || !expiresAt) {
        return false;
    }

    const expiryTs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryTs)) {
        return false;
    }

    return expiryTs > now;
}

export function ActiveSessionsPanel({
    children,
    activeSessions,
    selectedChildId,
    onSelectChild,
    onRejoin,
    onEnd,
    onRegenerateCode,
    loading,
    actionAlert
}) {
    const [confirmEndId, setConfirmEndId] = useState(null);

    if (!children || children.length === 0) {
        return (
            <section className="card" data-testid="active-sessions-panel">
                <h2 className="section-title">Your children's sessions</h2>
                <p className="empty-state">No children added yet — add one in the Children section.</p>
            </section>
        );
    }

    const sessionsByChildId = new Map();
    for (const s of (activeSessions || [])) {
        sessionsByChildId.set(s.child_id, s);
    }

    const handleCardClick = (child) => {
        if (loading) {
            return;
        }

        const session = sessionsByChildId.get(child.id);
        if (session) {
            onRejoin({
                session_id: session.session_id,
                child_id: session.child_id,
                child_name: session.child_name,
                status: session.status,
                daily_context: session.daily_context,
                started_at: session.started_at,
                join_code: session.join_code ?? null,
                expires_at: session.expires_at ?? null
            });
        } else {
            onSelectChild(child.id);
        }
    };

    const handleRegenerate = async (sessionId) => {
        await onRegenerateCode(sessionId);
    };

    const handleConfirmEnd = async (sessionId) => {
        await onEnd(sessionId);
        setConfirmEndId(null);
    };

    const handleCardKeyDown = (event, child) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick(child);
        }
    };

    return (
        <section className="card" data-testid="active-sessions-panel" aria-busy={loading}>
            <h2 className="section-title">Your children's sessions</h2>
            <StatusAlert
                tone={actionAlert?.tone}
                message={actionAlert?.message}
                style={{ marginBottom: 10 }}
            />

            <div className="active-sessions-list">
                {children.map((child) => {
                    const session = sessionsByChildId.get(child.id);
                    const isSelected = child.id === selectedChildId;
                    const joinCode = session?.join_code;
                    const joinCodeExpiry = session?.expires_at;
                    const now = Date.now();
                    const shouldShowJoinCode = isJoinCodeActive(joinCode, joinCodeExpiry, now);
                    const subjects = session?.daily_context?.daily_subjects;

                    return (
                        <div
                            key={child.id}
                            className={`active-session-card${isSelected ? " is-selected" : ""}${session ? " has-session" : ""}`}
                            data-testid={session ? `active-session-card-${session.session_id}` : `child-session-card-${child.id}`}
                            role="button"
                            tabIndex={loading ? -1 : 0}
                            aria-disabled={loading ? "true" : undefined}
                            onClick={() => handleCardClick(child)}
                            onKeyDown={(event) => handleCardKeyDown(event, child)}
                        >
                            <div className="active-session-card__header">
                                <span className="active-session-card__name">{child.first_name}</span>
                                {session ? (
                                    <span className="pill">Active</span>
                                ) : (
                                    <span className="pill pill--muted">No session</span>
                                )}
                            </div>

                            {subjects?.length > 0 ? (
                                <span className="active-session-card__subjects">
                                    {subjects.join(", ")}
                                </span>
                            ) : null}

                            {session ? (
                                <>
                                    {shouldShowJoinCode ? (
                                        <div className="active-session-card__code">
                                            <span className="join-code" data-testid={`active-session-code-${session.session_id}`}>
                                                {joinCode}
                                            </span>
                                            <span className="section-muted" style={{ fontSize: "0.8rem" }}>
                                                expires {timeUntil(joinCodeExpiry, now)}
                                            </span>
                                        </div>
                                    ) : null}

                                    <span className="active-session-card__time">
                                        Started {timeAgo(session.started_at)}
                                    </span>

                                    <div className="active-session-card__actions" onClick={(e) => e.stopPropagation()} role="toolbar" aria-label={`Session actions for ${child.first_name}`}>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--sm"
                                            data-testid={`active-session-regenerate-${session.session_id}`}
                                            disabled={loading}
                                            onClick={() => handleRegenerate(session.session_id)}
                                        >
                                            🔄 New code
                                        </button>
                                        {confirmEndId === session.session_id ? (
                                            <span id={`active-session-end-confirm-${session.session_id}`} className="active-session-card__confirm">
                                                <span className="section-muted" style={{ fontSize: "0.82rem" }}>End?</span>
                                                <button
                                                    type="button"
                                                    className="btn--icon btn--icon-danger"
                                                    data-testid={`active-session-end-confirm-${session.session_id}`}
                                                    aria-label={`Confirm end session for ${child.first_name}`}
                                                    disabled={loading}
                                                    onClick={() => handleConfirmEnd(session.session_id)}
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn--icon"
                                                    aria-label={`Cancel ending session for ${child.first_name}`}
                                                    disabled={loading}
                                                    onClick={() => setConfirmEndId(null)}
                                                >
                                                    No
                                                </button>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn--ghost btn--sm btn--danger-text"
                                                data-testid={`active-session-end-${session.session_id}`}
                                                aria-label={`End session for ${child.first_name}`}
                                                aria-expanded={confirmEndId === session.session_id}
                                                aria-controls={`active-session-end-confirm-${session.session_id}`}
                                                disabled={loading}
                                                onClick={() => setConfirmEndId(session.session_id)}
                                            >
                                                ⏹ End
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
