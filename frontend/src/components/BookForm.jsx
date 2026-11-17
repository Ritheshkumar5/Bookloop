import { useEffect, useState } from "react";
import { CATEGORIES, CONDITIONS, DELIVERY_METHODS } from "../utils/constants";
import { validateBook } from "../utils/validators";

const fields = [
  ["title", "Title", "text", true],
  ["author", "Author (if applicable)", "text", false],
  ["subject", "Subject", "text", true],
  ["department", "Department", "text", true],
  ["college_name", "College / university", "text", true],
  ["city", "City", "text", true],
  ["price", "Price (₹)", "number", true],
];

export default function BookForm({ initialValues, errors = {}, submitting, mode, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [clientErrors, setClientErrors] = useState({});
  const [preview, setPreview] = useState(initialValues.image_url || initialValues.existingImage || "");

  useEffect(() => {
    setValues(initialValues);
    setPreview(initialValues.image_url || initialValues.existingImage || "");
  }, [initialValues]);

  const change = (key) => (event) => {
    const value = event.target.type === "file" ? event.target.files?.[0] || null : event.target.value;
    setValues((previous) => ({ ...previous, [key]: value }));
    if (key === "image" && value) setPreview(URL.createObjectURL(value));
  };

  function submit(event) {
    event.preventDefault();
    const validation = validateBook(values, { isEdit: mode === "edit" });
    setClientErrors(validation);
    if (Object.keys(validation).length) return;
    onSubmit(values);
  }

  const errorFor = (key) => clientErrors[key] || errors[key];
  return (
    <form className="form-card book-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        {fields.map(([key, label, type, required]) => (
          <label className={`field ${errorFor(key) ? "has-error" : ""}`} key={key}>
            <span>{label}{required && <i> *</i>}</span>
            <input
              type={type}
              min={type === "number" ? "0.01" : undefined}
              step={type === "number" ? "0.01" : undefined}
              maxLength={key === "title" ? 200 : undefined}
              value={values[key] ?? ""}
              onChange={change(key)}
              required={required}
            />
            {errorFor(key) && <small className="field-error">{errorFor(key)}</small>}
          </label>
        ))}
        <label className={`field ${errorFor("category") ? "has-error" : ""}`}>
          <span>Category *</span>
          <select value={values.category || ""} onChange={change("category")} required>
            <option value="">Choose category</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          {errorFor("category") && <small className="field-error">{errorFor("category")}</small>}
        </label>
        <label className={`field ${errorFor("condition") ? "has-error" : ""}`}>
          <span>Condition *</span>
          <select value={values.condition || ""} onChange={change("condition")} required>
            <option value="">Choose condition</option>{CONDITIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
          {errorFor("condition") && <small className="field-error">{errorFor("condition")}</small>}
        </label>
        <label className={`field full-field ${errorFor("description") ? "has-error" : ""}`}>
          <span>Description *</span>
          <textarea rows="4" value={values.description || ""} onChange={change("description")} placeholder="Describe the material, edition and any markings…" required />
          {errorFor("description") && <small className="field-error">{errorFor("description")}</small>}
        </label>
        <fieldset className="field full-field delivery-field">
          <legend>Preferred handover</legend>
          {DELIVERY_METHODS.map((method) => (
            <label key={method.value} className="radio-option">
              <input type="radio" name="delivery_method" value={method.value} checked={(values.delivery_method || "meet") === method.value} onChange={change("delivery_method")} />
              {method.label}
            </label>
          ))}
        </fieldset>
        <label className="radio-option full-field"><input type="checkbox" checked={Boolean(values.is_urgent)} onChange={(event) => setValues((previous) => ({ ...previous, is_urgent: event.target.checked }))} />Available urgently</label>
        <label className="field"><span>Delivery speed</span><select value={values.delivery_time || "SAME_DAY"} onChange={change("delivery_time")}><option value="WITHIN_1_HOUR">Within 1 hour</option><option value="SAME_DAY">Same day</option><option value="IN_2_DAYS">In 2 days</option></select></label>
        <div className={`field full-field ${errorFor("image") ? "has-error" : ""}`}>
          <span>Item image {mode === "create" && "*"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={change("image")} />
          {errorFor("image") && <small className="field-error">{errorFor("image")}</small>}
          <small className="muted">JPG, PNG or WEBP, up to 2 MB. Image upload is required for a new listing.</small>
          {preview && <img className="image-preview" src={preview} alt="Listing preview" />}
        </div>
      </div>
      <p className="form-note">Your listing will appear after admin approval.</p>
      <button className="btn btn-primary btn-wide" type="submit" disabled={submitting}>{submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Submit listing"}</button>
    </form>
  );
}
