"use client";

export function TextField({ id, label, value, onChange, placeholder = "", type = "text", min = undefined, max = undefined }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function TextAreaField({ id, label, value, onChange, placeholder = "" }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="textarea" placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  );
}

export function SelectField({ id, label, value, onChange, options }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
