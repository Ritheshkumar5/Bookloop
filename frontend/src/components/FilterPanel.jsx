import { useState } from "react";
import { CATEGORIES, CONDITIONS } from "../utils/constants";

export default function FilterPanel({ filters, onChange, onReset, currentUser }) {
  const [expanded, setExpanded] = useState(false);
  const set = (key) => (event) => onChange({ [key]: event.target.value });
  return (
    <aside className={`filter-panel ${expanded ? "filter-panel-open" : ""}`}>
      <button className="filter-mobile-toggle" onClick={() => setExpanded(!expanded)}>Filters <span>{expanded ? "−" : "+"}</span></button>
      <div className="filter-fields">
        <div className="filter-title"><h2>Refine your search</h2><button className="link-button" onClick={onReset}>Clear all</button></div>
        <label className="field"><span>City</span><input value={filters.city} onChange={set("city")} placeholder="Any city" /></label>
        <label className="radio-option"><input type="checkbox" checked={filters.urgent_only} onChange={(event) => onChange({ urgent_only: event.target.checked })} />Urgent Only</label>
        <label className="radio-option" title={!currentUser ? "Sign in to filter by your city" : ""}><input type="checkbox" checked={filters.same_city} disabled={!currentUser} onChange={(event) => onChange({ same_city: event.target.checked })} />Same City</label>
        <label className="field"><span>Department</span><input value={filters.department} onChange={set("department")} placeholder="e.g. Computer Science" /></label>
        <label className="field"><span>College</span><input value={filters.college_name} onChange={set("college_name")} placeholder="Any college" /></label>
        <label className="field"><span>Category</span><select value={filters.category} onChange={set("category")}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Condition</span><select value={filters.condition} onChange={set("condition")}><option value="">Any condition</option>{CONDITIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="field"><span>Price range (₹)</span><div className="price-inputs"><input type="number" min="0" placeholder="Min" value={filters.min_price} onChange={set("min_price")} aria-label="Minimum price" /><input type="number" min="0" placeholder="Max" value={filters.max_price} onChange={set("max_price")} aria-label="Maximum price" /></div></div>
      </div>
    </aside>
  );
}
