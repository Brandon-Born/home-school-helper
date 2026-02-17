"use client";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1px solid #c8c8c8",
  borderRadius: 8
};

const cardStyle = {
  border: "1px solid #dadada",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff"
};

export function ChildProfilePanel({ childForm, loading, onSubmit, setChildForm }) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Create Child Profile</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          style={inputStyle}
          placeholder="Child name"
          value={childForm.child_name}
          onChange={(event) => setChildForm((prev) => ({ ...prev, child_name: event.target.value }))}
        />
        <input
          style={inputStyle}
          placeholder="Age"
          type="number"
          min="4"
          max="21"
          value={childForm.age}
          onChange={(event) => setChildForm((prev) => ({ ...prev, age: event.target.value }))}
        />
        <input
          style={inputStyle}
          placeholder="Grade"
          value={childForm.grade}
          onChange={(event) => setChildForm((prev) => ({ ...prev, grade: event.target.value }))}
        />
        <input
          style={inputStyle}
          placeholder="Subjects (comma separated)"
          value={childForm.subjects}
          onChange={(event) => setChildForm((prev) => ({ ...prev, subjects: event.target.value }))}
        />
        <textarea
          style={{ ...inputStyle, minHeight: 70 }}
          placeholder="Personality notes"
          value={childForm.personality_description}
          onChange={(event) =>
            setChildForm((prev) => ({ ...prev, personality_description: event.target.value }))
          }
        />
        <textarea
          style={{ ...inputStyle, minHeight: 70 }}
          placeholder="Special needs"
          value={childForm.special_needs}
          onChange={(event) => setChildForm((prev) => ({ ...prev, special_needs: event.target.value }))}
        />
        <button type="submit" disabled={loading}>
          Save Child
        </button>
      </form>
    </section>
  );
}
