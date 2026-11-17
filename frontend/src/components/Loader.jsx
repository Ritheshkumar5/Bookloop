export default function Loader({ text = "Loading..." }) {
  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <span className="spinner" />
      <p>{text}</p>
    </div>
  );
}
