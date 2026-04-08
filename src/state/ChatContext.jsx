import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildAdvisorContext } from "../llm/buildAdvisorContext.js";
import { streamChatResponse } from "../components/Chat/useChatStream.js";
import { getChatHistory, setChatHistory } from "../utils/storage.js";
import { useStudent } from "./StudentContext.jsx";

const ChatContext = createContext(null);

const MAX_API_MESSAGES = 20;
const MAX_STORED_MESSAGES = 40;

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
}

export function ChatProvider({ children }) {
  const { completion, completedCourses, profile, planByTerm } = useStudent();
  const [messages, setMessages] = useState(() => sanitizeMessages(getChatHistory()));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const snapshotRef = useRef({ completion, completedCourses, profile, planByTerm });
  snapshotRef.current = { completion, completedCourses, profile, planByTerm };

  useEffect(() => {
    if (isStreaming) return;
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    if (trimmed.length < messages.length) {
      setMessages(trimmed);
      return;
    }
    setChatHistory(trimmed);
  }, [messages, isStreaming]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setChatHistory([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const { completion: c, completedCourses: cc, profile: p, planByTerm: pb } = snapshotRef.current;
    const advisorContext = buildAdvisorContext({
      completion: c,
      completedCourses: cc,
      profile: p,
      planByTerm: pb,
    });

    const historyForApi = [...messagesRef.current, { role: "user", content: trimmed }].slice(
      -MAX_API_MESSAGES
    );

    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      await streamChatResponse({
        messages: historyForApi,
        advisorContext,
        signal: ac.signal,
        onTextDelta: (delta) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role !== "assistant") return prev;
            copy[copy.length - 1] = { ...last, content: last.content + delta };
            return copy;
          });
        },
      });
    } catch (e) {
      if (e?.name === "AbortError") {
        setMessages((prev) => {
          if (prev.length < 2) return prev;
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy.pop();
            copy.pop();
            return copy;
          }
          return prev;
        });
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Could not reach advisor. Check connection or API configuration."
        );
        setMessages((prev) => {
          if (prev.length < 2) return prev;
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content: last.content || "Something went wrong. Please try again.",
            };
            return copy;
          }
          return prev;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming]);

  const value = useMemo(
    () => ({
      messages,
      isStreaming,
      error,
      sendMessage,
      clearChat,
    }),
    [messages, isStreaming, error, sendMessage, clearChat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
