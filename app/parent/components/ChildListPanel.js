"use client";

import { useState } from "react";
import { ChildProfilePanel } from "./ChildProfilePanel.js";

function childToForm(child) {
    return {
        child_name: child.first_name ?? "",
        age: String(child.age ?? ""),
        grade: child.grade ?? "",
        subjects: Array.isArray(child.subjects) ? child.subjects.join(", ") : "",
        personality_description: child.profile_notes ?? "",
        special_needs: child.special_needs ?? ""
    };
}

export function ChildListPanel({
    children,
    selectedChildId,
    setSelectedChildId,
    childForm,
    setChildForm,
    onCreateChild,
    onUpdateChild,
    onDeleteChild,
    loading,
    actionAlert
}) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingChildId, setEditingChildId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleSaveNew = async (event) => {
        const saved = await onCreateChild(event);
        if (saved) {
            setShowAddForm(false);
        }
    };

    const handleStartEdit = (child) => {
        setEditingChildId(child.id);
        setEditForm(childToForm(child));
        setSelectedChildId(child.id);
    };

    const handleSaveEdit = async (event) => {
        event.preventDefault();
        const updated = await onUpdateChild(editingChildId, editForm);
        if (updated) {
            setEditingChildId(null);
            setEditForm(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingChildId(null);
        setEditForm(null);
    };

    const handleConfirmDelete = async (childId) => {
        const deleted = await onDeleteChild(childId);
        if (deleted) {
            setConfirmDeleteId(null);
        }
    };

    return (
        <section className="card">
            <h2 className="section-title">Your children</h2>
            {actionAlert ? (
                <div className={`alert alert--${actionAlert.tone}`} style={{ marginBottom: 10 }}>
                    {actionAlert.message}
                </div>
            ) : null}

            {children.length === 0 && !showAddForm ? (
                <p className="section-muted">No children added yet — add one to get started.</p>
            ) : null}

            {children.length > 0 ? (
                <div className="child-list">
                    {children.map((child) => (
                        <div key={child.id}>
                            {editingChildId === child.id ? (
                                <div className="child-form-inline">
                                    <ChildProfilePanel
                                        childForm={editForm}
                                        setChildForm={setEditForm}
                                        onSubmit={handleSaveEdit}
                                        onCancel={handleCancelEdit}
                                        loading={loading}
                                    />
                                </div>
                            ) : (
                                <div
                                    className={`child-card${selectedChildId === child.id ? " is-selected" : ""}`}
                                    data-testid={`child-card-${child.id}`}
                                    onClick={() => setSelectedChildId(child.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === "Enter" && setSelectedChildId(child.id)}
                                >
                                    <div className="child-card__header">
                                        <span className="child-card__name">{child.first_name}</span>
                                        <span className="child-card__actions">
                                            <button
                                                type="button"
                                                className="btn--icon"
                                                title="Edit"
                                                onClick={(e) => { e.stopPropagation(); handleStartEdit(child); }}
                                            >
                                                ✏️
                                            </button>
                                            {confirmDeleteId === child.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn--icon btn--icon-danger"
                                                        title="Confirm delete"
                                                        onClick={(e) => { e.stopPropagation(); handleConfirmDelete(child.id); }}
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn--icon"
                                                        title="Cancel"
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                                    >
                                                        No
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn--icon"
                                                    title="Delete"
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(child.id); }}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                    <span className="child-card__meta">
                                        {child.grade ? `Grade ${child.grade}` : ""}
                                        {child.grade && child.subjects?.length ? " · " : ""}
                                        {child.subjects?.length ? child.subjects.join(", ") : ""}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {showAddForm ? (
                <div className="child-form-inline">
                    <ChildProfilePanel
                        childForm={childForm}
                        setChildForm={setChildForm}
                        onSubmit={handleSaveNew}
                        onCancel={() => setShowAddForm(false)}
                        loading={loading}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="btn btn--secondary"
                    data-testid="child-add-button"
                    onClick={() => setShowAddForm(true)}
                    style={{ marginTop: children.length > 0 ? 12 : 0 }}
                >
                    ＋ Add a child
                </button>
            )}
        </section>
    );
}
