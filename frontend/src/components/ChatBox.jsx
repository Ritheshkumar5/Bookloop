import { useCallback, useEffect, useRef, useState } from "react";
import { getChats, sendChat } from "../services/api";
import { getErrorMessage } from "../utils/helpers";
import { useAuth } from "../context/AuthContext";
import ErrorMessage from "./ErrorMessage";
import Loader from "./Loader";
import MessageBubble from "./MessageBubble";

export default function ChatBox({ bookId, otherUserId, onBack, onMessageSent }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const load = useCallback(async (initial = false) => {
    try {
      const { data } = await getChats({ book_id: bookId, user: otherUserId });
      // data array illa na, empty array vachiko - crash aagathu
      setMessages(Array.isArray(data) ? data : data?.results || []);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "You are not allowed to view this conversation."));
    } finally {
      if (initial) setLoading(false);
    }
  }, [bookId, otherUserId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const refresh = async (initial) => {
      if (active) await load(initial);
    };
    refresh(true);
    const timer = window.setInterval(() => refresh(false), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load]);

  // ✅ FIXED: Itha block ah maathiten. Ippo return ethuvum illa, React ku destroy nu thedaathu
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      await sendChat({ book_id: Number(bookId), receiver_id: Number(otherUserId), message });
      setText("");
      await load(false);
      onMessageSent?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Message could not be sent."));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loader text="Loading conversation…" />;
  return (
    <section className="chat-pane">
      <div className="chat-pane-header">
        {onBack && <button className="icon-button mobile-only" onClick={onBack} aria-label="Back to conversations">←</button>}
        <div><h2>Book conversation</h2><p className="muted">Do not share passwords, OTPs, or sensitive details.</p></div>
      </div>
      <div className="message-list" aria-live="polite">
        {messages.length === 0 ? <p className="empty-chat">Start the conversation with a message.</p> : messages.map((message) => <MessageBubble key={message.chat_id || message.id} message={message} isMine={message.sender_id === user.user_id} />)}
        <div ref={bottomRef} />
      </div>
      {error && <ErrorMessage message={error} />}
      <form className="chat-compose" onSubmit={submit}>
        <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 1000))} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} rows="2" maxLength="1000" placeholder="Write a message…" aria-label="Message" />
        <button className="btn btn-primary" disabled={!text.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
      </form>
    </section>
  );
}