"use client";

import { useState } from "react";

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(isoString) {
    const diff = new Date(isoString).getTime() - Date.now();
    if (diff <= 0) return "expired";
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `in ${hrs}h`;
}

export function ActiveSessionsPanel({
    activeSessions,
    onRejoin,
    onEnd,
    onRegenerateCode,
    loading
}) {
    const [codeMap, setCodeMap] = useState({});
    const [confirmEndId, setConfirmEndId] = useState(null);

    if (!activeSessions || activeSessions.length === 0) {
        return null;
    }

    const handleRegenerate = async (sessionId) => {
        const result = await onRegenerateCode(sessionId);
        if (result?.join_code) {
            setCodeMap((prev) => ({
                ...prev,
                [sessionId]: { code: result.join_code, expires_at: result.expires_at }
            }));
        }
    };

    const handleConfirmEnd = async (sessionId) => {
        await onEnd(sessionId);
        setConfirmEndId(null);
        setCodeMap((prev) => {
            const next = { ...prev };
            delete next[sessionId];
            return next;
        });
    };

    return (
        <section className="card">
            <h2 className="section-title">Active sessions</h2>

            <div className="active-sessions-list">
                {activeSessions.map((s) => {
                    const newCode = codeMap[s.session_id];
                    const subjects = s.daily_context?.daily_subjects;

                    return (
                        <div key={s.session_id} className="active-session-card">
                            <div className="active-session-card__header">
                                <span className="active-session-card__name">{s.child_name}</span>
                                <span className="active-session-card__time">
                                    Started {timeAgo(s.started_at)}
                                </span>
                            </div>

                            {subjects?.length > 0 ? (
                                <span className="active-session-card__subjects">
                                    {subjects.join(", ")}
                                </span>
                            ) : null}

                            {newCode ? (
                                <div className="active-session-card__code">
                                    <span className="join-code">{newCode.code}</span>
                                    <span className="section-muted" style={{ fontSize: "0.8rem" }}>
                                        expires {timeUntil(newCode.expires_at)}
                                    </span>
                                </div>
                            ) : null}

                            <div className="active-session-card__actions">
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    disabled={loading}
                                    onClick={() => onRejoin({
                                        session_id: s.session_id,
                                        child_id: s.child_id,
                                        status: s.status,
                                        daily_context: s.daily_context
                                    })}
                                >
                                    📺 Rejoin
                                </button>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    disabled={loading}
                                    onClick={() => handleRegenerate(s.session_id)}
                                >
                                    🔄 New code
                                </button>
                                {confirmEndId === s.session_id ? (
                                    <span className="active-session-card__confirm">
                                        <span className="section-muted" style={{ fontSize: "0.82rem" }}>End?</span>
                                        <button
                                            type="button"
                                            className="btn--icon btn--icon-danger"
                                            disabled={loading}
                                            onClick={() => handleConfirmEnd(s.session_id)}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            className="btn--icon"
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
                                        disabled={loading}
                                        onClick={() => setConfirmEndId(s.session_id)}
                                    >
                                        ⏹ End
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
