import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="container page-space not-found">
      <span className="eyebrow">404 · Wrong shelf</span>
      <h1>This page isn't in this edition.</h1>
      <p className="muted">The page may have moved or the link may be incorrect.</p>
      <Link className="btn btn-primary" to="/">Back to BookLoop</Link>
    </main>
  );
}
