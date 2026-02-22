import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Slash, Square } from "lucide-react";
import { ApiError } from "../api/client";

const SLASH_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: "/status", desc: "Show session status (model, tokens, uptime)" },
  { cmd: "/compact", desc: "Compact conversation context" },
  { cmd: "/model", desc: "Show or change the current model" },
  { cmd: "/help", desc: "List available commands" },
  { cmd: "/reasoning", desc: "Toggle extended thinking" },
  { cmd: "/verbose", desc: "Toggle verbose tool output" },
  { cmd: "/reset", desc: "Reset the session" },
  { cmd: "/sessions", desc: "List active sessions" },
  { cmd: "/agent", desc: "Switch agent context" },
];

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const STORAGE_KEY = "lodekeeper-chat-history";
const MAX_STORED_MESSAGES = 100;
const FETCH_TIMEOUT_MS = 60_000;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function parseInline(text: string): Array<{ type: "text" | "strong" | "code"; value: string }> {
  const out: Array<{ type: "text" | "strong" | "code"; value: string }> = [];
  let i = 0;

  while (i < text.length) {
    if (text.slice(i, i + 2) === "**") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        out.push({ type: "strong", value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        out.push({ type: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    const nextStrong = text.indexOf("**", i);
    const nextCode = text.indexOf("`", i);
    const nextStop = [nextStrong, nextCode].filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? text.length;
    out.push({ type: "text", value: text.slice(i, nextStop) });
    i = nextStop;
  }

  return out;
}

function renderSimpleMarkdown(text: string): JSX.Element[] {
  const nodes: JSX.Element[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      nodes.push(
        <pre
          key={`md-${key++}`}
          className="my-2 overflow-x-auto rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-gray-200"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      if (i < lines.length && lines[i].startsWith("```")) i += 1;
      continue;
    }

    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith("```") && lines[i].trim() !== "") {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    const paragraphText = paragraphLines.join("\n");
    const inline = parseInline(paragraphText);

    nodes.push(
      <p key={`md-${key++}`} className="whitespace-pre-wrap leading-relaxed">
        {inline.map((part, idx) => {
          if (part.type === "strong") return <strong key={idx} className="font-semibold text-gray-100">{part.value}</strong>;
          if (part.type === "code") {
            return (
              <code key={idx} className="rounded bg-surface-0 px-1 py-0.5 text-xs text-gray-100">
                {part.value}
              </code>
            );
          }
          return <span key={idx}>{part.value}</span>;
        })}
      </p>
    );
  }

  return nodes;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldDisable = isStreaming;

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const slashMatches = useMemo(() => {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith("/")) return [];
    // Only match if it's a single token (no spaces yet, or cursor is still on the command)
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace > 0) return [];
    const query = trimmed.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(query));
  }, [input]);

  // Reset selection when matches change
  useEffect(() => {
    setSlashIndex((prev) => (slashMatches.length === 0 ? -1 : Math.min(prev, slashMatches.length - 1)));
  }, [slashMatches]);

  const selectSlashCommand = useCallback((cmd: string) => {
    setInput(cmd + " ");
    setSlashIndex(-1);
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendHistory = useMemo(() => {
    return messages
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
      .filter((m) => m.content.trim().length > 0);
  }, [messages]);

  const appendAssistantChunk = useCallback((assistantId: string, chunk: string) => {
    if (!chunk) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m))
    );
  }, []);

  const parseSseStream = useCallback(async (
    response: Response,
    assistantId: string,
  ): Promise<void> => {
    if (!response.body) {
      throw new Error("No response body for stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const eventChunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const lines = eventChunk.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") return;

          let parsed: any;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }

          if (typeof parsed.error === "string") {
            throw new Error(parsed.error);
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string") {
            appendAssistantChunk(assistantId, delta);
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }
  }, [appendAssistantChunk]);

  const handleSlashCommand = useCallback((command: string): string | null => {
    const cmd = command.split(/\s/)[0]?.toLowerCase();
    // /help can be resolved client-side for quick reference
    if (cmd === "/help") {
      return SLASH_COMMANDS.map((c) => `**${c.cmd}** — ${c.desc}`).join("\n");
    }
    // All other slash commands are sent to the gateway (it handles them natively)
    return null;
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);

    const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };

    // Handle slash commands that can be resolved client-side
    if (trimmed.startsWith("/")) {
      const localResponse = handleSlashCommand(trimmed);
      if (localResponse !== null) {
        const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: localResponse };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInput("");
        return;
      }
    }

    setIsStreaming(true);
    const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: "" };

    const requestMessages = [
      ...sendHistory,
      { role: userMessage.role, content: userMessage.content },
    ];

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");

    const abort = new AbortController();
    abortRef.current = abort;
    const timeout = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({
          messages: requestMessages,
          stream: true,
          user: "dashboard-chat",
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        let details = `${res.status} ${res.statusText}`;
        try {
          const json = await res.json();
          if (typeof json?.error === "string") details = json.error;
          if (typeof json?.details === "string") details = `${details}: ${json.details}`;
        } catch {
          // noop
        }
        throw new ApiError(res.status, details);
      }

      await parseSseStream(res, assistantMessage.id);

      setMessages((prev) =>
        prev.map((m) => (
          m.id === assistantMessage.id && m.content.trim().length === 0
            ? { ...m, content: "No response content returned." }
            : m
        ))
      );
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const message = isAbort
        ? "Request timed out — the gateway may be busy. Try again."
        : err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      setMessages((prev) =>
        prev.map((m) => (
          m.id === assistantMessage.id && m.content.trim().length === 0
            ? { ...m, content: `Error: ${message}` }
            : m
        ))
      );
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [input, isStreaming, handleSlashCommand, parseSseStream, sendHistory]);

  return (
    <div className="h-full bg-surface-0 p-3 sm:p-6 flex flex-col">
      <div className="mb-4">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-100">Chat</h1>
        <p className="text-sm text-gray-400 mt-1">Talk to the OpenClaw gateway session from the dashboard.</p>
      </div>

      <div className="flex-1 min-h-0 bg-surface-1 border border-surface-3 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-gray-400">
              Start a conversation. Slash commands are supported directly.
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-accent/20 border-accent/40 text-gray-100"
                    : "bg-surface-2 border-surface-3 text-gray-200"
                }`}
              >
                {renderSimpleMarkdown(message.content)}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Assistant is typing...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="border-t border-surface-3 p-4 relative">
          {slashMatches.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 max-h-52 overflow-y-auto rounded-lg border border-surface-3 bg-surface-2 shadow-lg z-10">
              {slashMatches.map((item, idx) => (
                <button
                  key={item.cmd}
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    idx === slashIndex
                      ? "bg-accent/20 text-gray-100"
                      : "text-gray-300 hover:bg-surface-3"
                  }`}
                  onMouseEnter={() => setSlashIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus on textarea
                    selectSlashCommand(item.cmd);
                  }}
                >
                  <Slash className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="font-medium text-accent">{item.cmd}</span>
                  <span className="text-xs text-gray-500">{item.desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (slashMatches.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSlashIndex((prev) => Math.min(prev + 1, slashMatches.length - 1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSlashIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && slashIndex >= 0)) {
                    e.preventDefault();
                    const selected = slashMatches[Math.max(slashIndex, 0)];
                    if (selected) selectSlashCommand(selected.cmd);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSlashIndex(-1);
                    setInput("");
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={2}
              className="flex-1 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-base sm:text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent disabled:opacity-60 resize-none"
              placeholder="Send a message or /command..."
              disabled={shouldDisable}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={cancelRequest}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:opacity-90"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={shouldDisable || input.trim().length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">Try <span className="text-accent">/status</span>, <span className="text-accent">/compact</span>, <span className="text-accent">/model</span>, <span className="text-accent">/help</span></p>
              {messages.length > 0 && !isStreaming && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-gray-300 underline"
                >
                  Clear history
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
