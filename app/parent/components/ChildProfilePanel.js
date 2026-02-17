"use client";
import { TextAreaField, TextField } from "../../components/forms/FormFields.js";

export function ChildProfilePanel({ childForm, loading, onSubmit, setChildForm }) {
  return (
    <section className="card">
      <h2 className="section-title">Add Child Profile</h2>
      <p className="section-muted">Add key details so tutoring matches your child&apos;s level and needs.</p>
      <form onSubmit={onSubmit} className="form-grid">
        <TextField
          id="child-name"
          label="Child's first name"
          placeholder="Ava"
          value={childForm.child_name}
          onChange={(event) => setChildForm((prev) => ({ ...prev, child_name: event.target.value }))}
        />
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
          label="Grade level"
          placeholder="5"
          value={childForm.grade}
          onChange={(event) => setChildForm((prev) => ({ ...prev, grade: event.target.value }))}
        />
        <TextField
          id="child-subjects"
          label="Main subjects"
          placeholder="Math, Science"
          value={childForm.subjects}
          onChange={(event) => setChildForm((prev) => ({ ...prev, subjects: event.target.value }))}
        />
        <TextAreaField
          id="child-personality"
          label="Learning style notes"
          placeholder="Curious, likes examples, gets frustrated with long instructions."
          value={childForm.personality_description}
          onChange={(event) =>
            setChildForm((prev) => ({ ...prev, personality_description: event.target.value }))
          }
        />
        <TextAreaField
          id="child-needs"
          label="Support needs or accommodations"
          placeholder="Needs short directions and extra time to answer."
          value={childForm.special_needs}
          onChange={(event) => setChildForm((prev) => ({ ...prev, special_needs: event.target.value }))}
        />
        <div className="btn-row">
          <button type="submit" disabled={loading} className="btn btn--primary">
            Save Profile
          </button>
        </div>
      </form>
    </section>
  );
}
