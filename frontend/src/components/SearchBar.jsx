export default function SearchBar({ value, onChange }) {
  return (
    <label className="search-bar">
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search title, author or subject"
        aria-label="Search books"
      />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}>×</button>}
    </label>
  );
}
