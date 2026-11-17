import { SORT_OPTIONS } from "../utils/constants";

export default function SortDropdown({ value, onChange }) {
  return (
    <label className="sort-control">
      <span>Sort by</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
