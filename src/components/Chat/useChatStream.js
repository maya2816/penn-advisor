/**
 * useChatStream.js — POST /api/chat and parse SSE text deltas (no React state).
 */

const SSE_DATA_PREFIX = "data: ";

/**
 * @param {object} opts
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {object} opts.advisorContext
 * @param {(chunk: string) => void} opts.onTextDelta
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<void>}
 */
export async function streamChatResponse({ messages, advisorContext, onTextDelta, signal }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, advisorContext }),
    signal,
  });

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).trim();
    let msg = errText || `Request failed (${res.status})`;
    if (errText.startsWith("{")) {
      try {
        const j = JSON.parse(errText);
        if (typeof j.error === "string") msg = j.error;
      } catch {
        /* keep msg */
      }
    }
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith(SSE_DATA_PREFIX)) continue;
      let payload;
      try {
        payload = JSON.parse(line.slice(SSE_DATA_PREFIX.length));
      } catch {
        continue;
      }
      if (payload.type === "text" && payload.text) {
        onTextDelta(payload.text);
      }
      if (payload.type === "error" && payload.message) {
        throw new Error(payload.message);
      }
    }
  }
}
