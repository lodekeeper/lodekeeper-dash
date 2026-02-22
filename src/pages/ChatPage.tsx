import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ApiError } from "../api/client";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldDisable = isStreaming;

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

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setIsStreaming(true);

    const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };
    const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: "" };

    const requestMessages = [
      ...sendHistory,
      { role: userMessage.role, content: userMessage.content },
    ];

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");

    const abort = new AbortController();
    abortRef.current = abort;

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
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      setMessages((prev) =>
        prev.map((m) => (
          m.id === assistantMessage.id && m.content.trim().length === 0
            ? { ...m, content: `Error: ${message}` }
            : m
        ))
      );
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [input, isStreaming, parseSseStream, sendHistory]);

  return (
    <div className="h-full bg-surface-0 p-6 flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-100">Chat</h1>
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

        <div className="border-t border-surface-3 p-4">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={3}
              className="flex-1 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent disabled:opacity-60 resize-none"
              placeholder="Send a message or /command..."
              disabled={shouldDisable}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={shouldDisable || input.trim().length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">Try <span className="text-accent">/status</span>, <span className="text-accent">/compact</span>, <span className="text-accent">/model</span>, <span className="text-accent">/help</span></p>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
