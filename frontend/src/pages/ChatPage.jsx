import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getChats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatDate, getErrorMessage } from "../utils/helpers";
import ChatBox from "../components/ChatBox";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";

export default function ChatPage() {
  const { bookId, otherUserId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedKey = bookId && otherUserId ? `${bookId}-${otherUserId}` : "";

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await getChats();
      const grouped = new Map();
      data.forEach((message) => {
        const other = message.sender_id === user.user_id ? message.receiver_id : message.sender_id;
        const key = `${message.book_id}-${other}`;
        const current = grouped.get(key);
        const unread = message.receiver_id === user.user_id && !message.is_read;
        if (!current) {
          grouped.set(key, {
            key, book_id: message.book_id, other_user_id: other,
            book_title: message.book_title,
            other_name: message.sender_id === user.user_id ? message.receiver_name : message.sender_name,
            latest: message, unread,
          });
        } else {
          current.latest = message;
          current.unread = current.unread || unread;
          current.book_title = message.book_title;
        }
      });
      setConversations([...grouped.values()].sort((a, b) => new Date(b.latest.sent_at) - new Date(a.latest.sent_at)));
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load your messages."));
    } finally { setLoading(false); }
  }, [user.user_id]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedKey) return undefined;
    const timer = window.setInterval(loadConversations, 5000);
    return () => window.clearInterval(timer);
  }, [selectedKey, loadConversations]);

  return (
    <main className="container page-space">
      <div className="page-heading"><span className="eyebrow">Student to student</span><h1>Messages</h1></div>
      {error && <ErrorMessage message={error} onRetry={loadConversations} />}
      <div className="chat-layout">
        <aside className={`conversation-list ${selectedKey ? "conversation-list-hidden-mobile" : ""}`}>
          <h2>Your conversations</h2>
          {loading ? <Loader text="Loading…" /> : conversations.length === 0 ? <EmptyState title="No conversations yet" message="Visit a listing and start a chat with its seller." /> : conversations.map((item) => (
            <button className={`conversation-item ${selectedKey === item.key ? "conversation-active" : ""}`} key={item.key} onClick={() => navigate(`/chat/${item.book_id}/${item.other_user_id}`)}>
              <span className="conversation-avatar">{item.other_name?.charAt(0)?.toUpperCase() || "B"}</span>
              <span className="conversation-text"><strong>{item.other_name}</strong><span className="muted small">{item.book_title}</span><span className="muted small conversation-preview">{item.latest.message}</span></span>
              <span className="conversation-meta">{item.unread && <i className="unread-dot" />}<time>{formatDate(item.latest.sent_at)}</time></span>
            </button>
          ))}
        </aside>
        {selectedKey ? <ChatBox bookId={bookId} otherUserId={otherUserId} onBack={() => navigate("/chat")} onMessageSent={loadConversations} /> : <section className="chat-placeholder"><span>✉</span><h2>Choose a conversation</h2><p className="muted">Your messages about each book will appear here.</p><Link className="btn btn-outline" to="/">Explore books</Link></section>}
      </div>
    </main>
  );
}
