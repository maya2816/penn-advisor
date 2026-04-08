/**
 * MessageBubble.jsx — user vs assistant styling; light **bold** parsing for assistant text.
 */

function formatBoldSegments(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function MessageBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      data-role={role}
    >
      <div
        className={`max-w-[min(100%,18rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-penn text-white shadow-sm"
            : "border border-slate-200/80 bg-white text-slate-800 shadow-card"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="whitespace-pre-wrap break-words">{formatBoldSegments(content)}</div>
        )}
      </div>
    </div>
  );
}
