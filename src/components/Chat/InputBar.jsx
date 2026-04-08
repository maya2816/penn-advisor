/**
 * InputBar.jsx — autosizing textarea, Enter sends, Shift+Enter newline.
 */

import { useCallback, useRef } from "react";

export function InputBar({ onSend, disabled, placeholder = "Ask about your degree…" }) {
  const taRef = useRef(null);

  const submit = useCallback(() => {
    if (disabled) return;
    const el = taRef.current;
    if (!el) return;
    const v = el.value.trim();
    if (!v) return;
    el.value = "";
    onSend(v);
  }, [disabled, onSend]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <div className="flex gap-2">
      <textarea
        ref={taRef}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-penn/40 focus:outline-none focus:ring-2 focus:ring-penn/15 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Message to advisor"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="self-end rounded-xl bg-penn px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-penn-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
