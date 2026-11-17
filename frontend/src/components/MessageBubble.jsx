import { formatDate } from "../utils/helpers";

export default function MessageBubble({ message, isMine }) {
  return (
    <article className={`message-bubble ${isMine ? "message-mine" : ""}`}>
      <p>{message.message}</p>
      <time dateTime={message.sent_at}>{formatDate(message.sent_at)}</time>
    </article>
  );
}
