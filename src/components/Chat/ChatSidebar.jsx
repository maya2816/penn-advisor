/**
 * ChatSidebar.jsx — dashboard right-rail advisor (streaming Claude).
 */

import { useChat } from "../../state/ChatContext.jsx";
import { InputBar } from "./InputBar.jsx";
import { MessageList } from "./MessageList.jsx";
import { SuggestedPrompts } from "./SuggestedPrompts.jsx";

export function ChatSidebar() {
  const { messages, isStreaming, error, sendMessage, clearChat } = useChat();
  const showStarters = messages.length === 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-b from-white to-penn-50/30 p-6 shadow-lift">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-penn text-base font-bold text-white shadow-md">
            P
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Advisor chat</h2>
            <p className="text-xs text-muted">Grounded in your audit and catalog snapshot</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            disabled={isStreaming}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div
          className="mb-3 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {showStarters && <SuggestedPrompts onPick={sendMessage} disabled={isStreaming} />}

      {!showStarters && (
        <div className="mb-3">
          <MessageList messages={messages} isStreaming={isStreaming} />
        </div>
      )}

      {isStreaming && (
        <p className="mb-2 text-xs text-muted" aria-live="polite">
          Advisor is typing…
        </p>
      )}

      <div className={showStarters ? "mt-4" : "mt-2"}>
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        AI can make mistakes. Always verify with your academic advisor before making decisions.
      </p>
    </div>
  );
}
