/**
 * MessageList.jsx — scrollable transcript with auto-scroll while streaming.
 */

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble.jsx";

export function MessageList({ messages, isStreaming }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth", block: "end" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[min(50vh,22rem)] space-y-3 overflow-y-auto pr-1 text-left"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((m, i) => {
        const hideEmptyStreamingTail =
          isStreaming &&
          m.role === "assistant" &&
          !m.content &&
          i === messages.length - 1;
        if (hideEmptyStreamingTail) return null;
        return <MessageBubble key={i} role={m.role} content={m.content} />;
      })}
      <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
    </div>
  );
}
