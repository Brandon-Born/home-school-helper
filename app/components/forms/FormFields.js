"use client";

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  min = undefined,
  max = undefined,
  ...inputProps
}) {
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
        {...inputProps}
      />
    </div>
  );
}

export function TextAreaField({ id, label, value, onChange, placeholder = "", ...textAreaProps }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="textarea"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...textAreaProps}
      />
    </div>
  );
}

export function SelectField({ id, label, value, onChange, options, ...selectProps }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={onChange} {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
