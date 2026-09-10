import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Message = { role: "user" | "assistant"; content: string };

const STUDENT_STARTERS = [
  "What's my attendance percentage?",
  "Show my today's attendance",
  "What's my leave balance?",
  "How does face attendance work?",
];

const ADMIN_STARTERS = [
  "How many students are present today?",
  "Which students are absent today?",
  "What sessions are scheduled today?",
  "Are there any pending leave requests?",
];

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function AssistantMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: JSX.Element[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`bullets-${blocks.length}`} className="my-1 space-y-1.5 pl-4">
        {bullets.map((bullet, index) => (
          <li key={index} className="list-disc pl-0.5">{renderInline(bullet)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return;
    }

    const bulletMatch = line.match(/^[-•]\s+(.*)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }

    flushBullets();

    if (/^#{1,3}\s+/.test(line)) {
      blocks.push(
        <p key={`heading-${index}`} className="mb-1 mt-2 font-semibold text-ink">
          {renderInline(line.replace(/^#{1,3}\s+/, ""))}
        </p>
      );
      return;
    }

    blocks.push(
      <p key={`line-${index}`} className="mb-1 last:mb-0">
        {renderInline(line)}
      </p>
    );
  });

  flushBullets();
  return <div className="space-y-0.5">{blocks}</div>;
}

export default function AssistantWidget() {
  const { isAuthenticated, role, name, studentId, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const identityRef = useRef("");

  const identityKey = isAuthenticated
    ? `${token ?? ""}|${role ?? ""}|${studentId ?? ""}`
    : "logged-out";

  const starters = role === "admin" ? ADMIN_STARTERS : STUDENT_STARTERS;

  useEffect(() => {
    if (identityRef.current === identityKey) return;
    identityRef.current = identityKey;
    setMessages([]);
    setInput("");
    setLoading(false);
    setOpen(false);
  }, [identityKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isAuthenticated) return null;

  const greeting = role === "admin"
    ? `Hi${name ? ` ${name}` : ""}! I'm VisionAttend AI. I can help you monitor attendance, manage sessions and leave requests, review student records, and understand the AI attendance system.`
    : `Hi${name ? ` ${name}` : ""}! I'm VisionAttend AI. I can help with your attendance, leave, face recognition, liveness detection, and how the student portal works.`;

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || loading) return;
    const requestIdentity = identityKey;
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const response = await api.post("/assistant/chat", {
        message,
        history: next.slice(-12),
      });
      if (identityRef.current !== requestIdentity) return;
      setMessages((current) => [...current, { role: "assistant", content: response.data?.answer || "I couldn't generate a response right now." }]);
    } catch (error: any) {
      if (identityRef.current !== requestIdentity) return;
      const status = error?.response?.status;
      const fallback = status === 429
        ? "The free AI quota is temporarily busy. Please try again in a moment."
        : status === 503
          ? "The AI Assistant isn't configured yet. Add the Gemini API key to the backend environment."
          : "I couldn't reach the AI Assistant right now. Please try again.";
      setMessages((current) => [...current, { role: "assistant", content: fallback }]);
    } finally {
      if (identityRef.current === requestIdentity) setLoading(false);
    }
  }

  return <>
    {open && <div className="fixed bottom-24 right-5 z-[80] flex h-[min(620px,calc(100vh-120px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-sm"><Bot size={20} /></div>
          <div><p className="font-semibold">VisionAttend AI</p><p className="flex items-center gap-1 text-[10px] text-ink-muted"><span className="h-1.5 w-1.5 rounded-full bg-present" /> AI Assistant · {role === "admin" ? "Admin" : "Student"}</p></div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-muted transition hover:bg-panel-hover hover:text-ink" aria-label="Close assistant"><X size={18} /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-line bg-panel-hover px-4 py-3 text-sm leading-6 text-ink"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent"><Sparkles size={12} /> Assistant</div>{greeting}</div>
        {!messages.length && <div className="grid gap-2 pt-1">{starters.map((starter) => <button key={starter} onClick={() => sendMessage(starter)} className="rounded-xl border border-line bg-panel px-3 py-2.5 text-left text-xs text-ink-muted transition hover:border-accent/40 hover:bg-accent-soft hover:text-ink">{starter}</button>)}</div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-accent px-4 py-3 text-sm leading-6 text-white" : "max-w-[88%] rounded-2xl rounded-tl-md border border-line bg-panel-hover px-4 py-3 text-sm leading-6 text-ink"}>{message.role === "assistant" ? <AssistantMessage content={message.content} /> : message.content}</div>)}
        {loading && <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-line bg-panel-hover px-4 py-3 text-sm text-ink-muted"><span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:240ms]" /></span></div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-3">
        <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex items-end gap-2 rounded-2xl border border-line bg-panel-hover p-2 focus-within:border-accent/50">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={1200} placeholder="Ask VisionAttend AI..." className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-faint" />
          <button type="submit" disabled={!input.trim() || loading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={17} /></button>
        </form>
        <p className="mt-2 text-center text-[9px] text-ink-faint">Powered by Gemini · Free tier · AI can make mistakes</p>
      </div>
    </div>}

    <button onClick={() => setOpen((value) => !value)} className="fixed bottom-5 right-5 z-[79] flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-xl shadow-accent/25 transition hover:-translate-y-0.5 hover:shadow-2xl" aria-label="Open VisionAttend AI assistant"><MessageCircle size={23} /></button>
  </>;
}
