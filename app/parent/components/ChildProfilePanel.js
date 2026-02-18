"use client";
import { TextAreaField, TextField } from "../../components/forms/FormFields.js";

export function ChildProfilePanel({ childForm, loading, onSubmit, onCancel, setChildForm }) {
  return (
    <div className="child-form-inline">
      <form onSubmit={onSubmit} className="form-grid">
        <TextField
          id="child-name"
          label="First name"
          placeholder="Ava"
          value={childForm.child_name}
          onChange={(event) => setChildForm((prev) => ({ ...prev, child_name: event.target.value }))}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField
            id="child-age"
            label="Age"
            type="number"
            min="4"
            max="21"
            placeholder="10"
            value={childForm.age}
            onChange={(event) => setChildForm((prev) => ({ ...prev, age: event.target.value }))}
          />
          <TextField
            id="child-grade"
            label="Grade"
            placeholder="5th"
            value={childForm.grade}
            onChange={(event) => setChildForm((prev) => ({ ...prev, grade: event.target.value }))}
          />
        </div>
        <TextField
          id="child-subjects"
          label="Subjects"
          placeholder="Math, Reading"
          value={childForm.subjects}
          onChange={(event) => setChildForm((prev) => ({ ...prev, subjects: event.target.value }))}
        />
        <TextAreaField
          id="child-personality"
          label="How they learn best"
          placeholder="Likes examples, works better with short instructions"
          value={childForm.personality_description}
          onChange={(event) =>
            setChildForm((prev) => ({ ...prev, personality_description: event.target.value }))
          }
        />
        <TextAreaField
          id="child-needs"
          label="Anything else? (optional)"
          placeholder="Needs extra time, prefers large text"
          value={childForm.special_needs}
          onChange={(event) => setChildForm((prev) => ({ ...prev, special_needs: event.target.value }))}
        />
        <div className="btn-row">
          <button type="submit" disabled={loading || !childForm.child_name.trim()} className="btn btn--primary">
            Save
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="btn btn--ghost">
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
