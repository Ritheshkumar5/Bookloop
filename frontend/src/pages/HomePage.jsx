import { useCallback, useEffect, useState } from "react";
import { getBooks } from "../services/api";
import useDebounce from "../hooks/useDebounce";
import { cleanParams, getErrorMessage } from "../utils/helpers";
import { PAGE_SIZE } from "../utils/constants";
import { useAuth } from "../context/AuthContext";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import SortDropdown from "../components/SortDropdown";
import BookGrid from "../components/BookGrid";
import Pagination from "../components/Pagination";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";

const INITIAL_FILTERS = {
  search: "", city: "", department: "", college_name: "",
  category: "", condition: "", min_price: "", max_price: "",
  urgent_only: false, same_city: false, ordering: "-created_at", page: 1,
};

export default function HomePage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebounce(filters.search, 400);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getBooks(cleanParams({
        ...filters,
        search: debouncedSearch,
        status: "available",
        ...(filters.same_city && user?.city ? { city: user.city } : {}),
        urgent_only: filters.urgent_only ? "true" : "",
      }));
      const rows = Array.isArray(data) ? data : data.results;
      setBooks(rows.filter((book) => book.status !== "sold"));
      setTotal(Array.isArray(data) ? rows.length : data.count);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load books. Please try again."));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch, filters.city, filters.department, filters.college_name,
    filters.category, filters.condition, filters.min_price, filters.max_price,
    filters.urgent_only, filters.same_city, filters.ordering, filters.page, user?.city,
  ]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  function updateFilters(changes) {
    setFilters((previous) => ({ ...previous, ...changes, page: changes.page ?? 1 }));
  }

  return (
    <main>
      <section className="hero">
        <div className="container hero-inner">
          <span className="eyebrow">A better way to pass it on</span>
          <h1>One Book,<br /><em>Many Readers!</em></h1>
          <p>Find affordable textbooks, notes and study materials from students across India.</p>
          <SearchBar value={filters.search} onChange={(search) => updateFilters({ search })} />
          <div className="hero-proof"><span>↗</span> Discover materials from every campus, everywhere.</div>
        </div>
        <span className="hero-decoration hero-decoration-one" />
        <span className="hero-decoration hero-decoration-two" />
      </section>
      <div className="container home-layout">
        <FilterPanel filters={filters} onChange={updateFilters} currentUser={user} onReset={() => setFilters(INITIAL_FILTERS)} />
        <section className="home-results">
          <div className="section-heading">
            <div><span className="eyebrow">The book shelf</span><h2>Explore study materials</h2></div>
            <div className="results-toolbar">
              <p>{loading ? "Searching…" : `${total} ${total === 1 ? "item" : "items"}`}</p>
              <SortDropdown value={filters.ordering} onChange={(ordering) => updateFilters({ ordering })} />
            </div>
            <section className="container safety-section">
              <span className="eyebrow">Buy and sell with confidence</span>
              <h2>How BookLoop Keeps You Safe</h2>
              <p>Never Pay in Advance · Check Rating · Meet in Public · Report Fraud</p>
            </section>
          </div>
          {loading && <Loader text="Finding your next great read…" />}
          {!loading && error && <ErrorMessage message={error} onRetry={fetchBooks} />}
          {!loading && !error && !books.length && <EmptyState title="No books found" message="Try another search or clear some filters." actionLabel="Clear filters" onAction={() => setFilters(INITIAL_FILTERS)} />}
          {!loading && !error && books.length > 0 && <>
            <BookGrid books={books} />
            <Pagination page={filters.page} total={total} pageSize={PAGE_SIZE} onChange={(page) => setFilters((previous) => ({ ...previous, page }))} />
          </>}
        </section>
      </div>
    </main>
  );
}
