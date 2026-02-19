"use client";

import { useId, useState } from "react";
import { StatusAlert } from "../../components/feedback/StatusAlert.js";
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
    const childListHeadingId = useId();
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
        <section className="card" aria-busy={loading}>
            <h2 id={childListHeadingId} className="section-title">Your children</h2>
            <StatusAlert
                tone={actionAlert?.tone}
                message={actionAlert?.message}
                style={{ marginBottom: 10 }}
            />

            {children.length === 0 && !showAddForm ? (
                <p className="section-muted">No children added yet — add one to get started.</p>
            ) : null}

            {children.length > 0 ? (
                <div className="child-list" role="listbox" aria-labelledby={childListHeadingId}>
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
                                        autoFocusFirstField
                                    />
                                </div>
                            ) : (
                                <div
                                    className={`child-card${selectedChildId === child.id ? " is-selected" : ""}`}
                                    data-testid={`child-card-${child.id}`}
                                    onClick={() => setSelectedChildId(child.id)}
                                    role="option"
                                    aria-selected={selectedChildId === child.id}
                                    aria-label={`${child.first_name} profile`}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.target !== e.currentTarget) {
                                            return;
                                        }
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setSelectedChildId(child.id);
                                        }
                                    }}
                                >
                                    <div className="child-card__header">
                                        <span className="child-card__name">{child.first_name}</span>
                                        <span className="child-card__actions">
                                            <button
                                                type="button"
                                                className="btn--icon"
                                                aria-label={`Edit ${child.first_name}`}
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
                                                        aria-label={`Confirm delete ${child.first_name}`}
                                                        title="Confirm delete"
                                                        onClick={(e) => { e.stopPropagation(); handleConfirmDelete(child.id); }}
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn--icon"
                                                        aria-label={`Cancel delete ${child.first_name}`}
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
                                                    aria-label={`Delete ${child.first_name}`}
                                                    aria-expanded={confirmDeleteId === child.id}
                                                    aria-controls={`child-delete-confirm-${child.id}`}
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
                                    {confirmDeleteId === child.id ? (
                                        <span id={`child-delete-confirm-${child.id}`} className="sr-only">
                                            Delete confirmation controls shown.
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {showAddForm ? (
                <div id="child-create-form" className="child-form-inline">
                    <ChildProfilePanel
                        childForm={childForm}
                        setChildForm={setChildForm}
                        onSubmit={handleSaveNew}
                        onCancel={() => setShowAddForm(false)}
                        loading={loading}
                        autoFocusFirstField
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="btn btn--secondary"
                    data-testid="child-add-button"
                    aria-expanded={showAddForm}
                    aria-controls="child-create-form"
                    onClick={() => setShowAddForm(true)}
                    style={{ marginTop: children.length > 0 ? 12 : 0 }}
                >
                    ＋ Add a child
                </button>
            )}
        </section>
    );
}
