import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, Radio, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { NOTIFICATION_EVENT, NOTIFICATION_STORAGE_KEY, NotificationPayload } from "../utils/notifications";

type Notice = NotificationPayload & { id: string; createdAt: number };

function readStored(): Notice[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>(readStored);
  const rootRef = useRef<HTMLDivElement>(null);

  const save = useCallback((items: Notice[]) => {
    const next = items.slice(0, 50);
    setNotices(next);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback((notice: NotificationPayload) => {
    setNotices(current => {
      const id = notice.id || `${notice.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (current.some(item => item.id === id)) return current;
      const next: Notice[] = [{ ...notice, id, createdAt: Date.now() }, ...current].slice(0, 50);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [currentRes, scheduledRes] = await Promise.all([
        api.get("/session/current"),
        api.get("/session/scheduled"),
      ]);

      const current = currentRes.data;
      const scheduled = scheduledRes.data?.sessions ?? [];

      if (current?.active && current.session_id) {
        add({
          id: `live-${current.session_id}`,
          title: "AI session started",
          text: `${current.name ?? "Untitled Session"} is being monitored live.`,
          kind: "live",
        });
      }

      scheduled.forEach((session: any) => {
        if (!session.session_id) return;
        add({
          id: `scheduled-${session.session_id}`,
          title: "Session scheduled",
          text: `${session.name ?? "Untitled Session"} is scheduled for ${new Date(session.planned_start_time || session.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`,
          kind: "scheduled",
        });
      });
    } catch (error) {
      console.debug("Notification refresh skipped", error);
    }
  }, [add]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    function handleNotification(event: Event) {
      const detail = (event as CustomEvent<NotificationPayload>).detail;
      if (detail?.title && detail?.text && detail?.kind) add(detail);
    }
    window.addEventListener(NOTIFICATION_EVENT, handleNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
  }, [add]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const icon = (kind: Notice["kind"]) =>
    kind === "live" ? <Radio size={16} /> :
    kind === "scheduled" ? <CalendarClock size={16} /> :
    <CheckCircle2 size={16} />;

  return <div ref={rootRef} className="relative z-[70]">
    <button
      onClick={() => setOpen(value => !value)}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-panel text-ink-muted transition hover:bg-panel-hover hover:text-ink"
      aria-label="Notifications"
      aria-expanded={open}
    >
      <Bell size={19} />
      {notices.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-panel)]" />}
    </button>

    {open && <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-semibold">Notifications</p>
          <p className="text-xs text-ink-muted">Session and attendance updates</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => save([])} className="rounded-lg p-2 text-ink-muted hover:bg-panel-hover hover:text-ink" title="Clear all notifications" aria-label="Clear all notifications"><Trash2 size={15} /></button>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-muted hover:bg-panel-hover hover:text-ink" aria-label="Close notifications"><X size={15} /></button>
        </div>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {notices.length ? notices.map(notice => <div key={notice.id} className="flex gap-3 rounded-xl border border-line bg-panel-hover p-3">
          <div className="mt-0.5 shrink-0 text-accent">{icon(notice.kind)}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{notice.title}</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{notice.text}</p>
            <p className="mt-1 text-[10px] text-ink-faint">{new Date(notice.createdAt).toLocaleString()}</p>
          </div>
        </div>) : <div className="py-12 text-center text-sm text-ink-muted">No notifications yet</div>}
      </div>

      {notices.length > 0 && <button onClick={() => save([])} className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-line py-2 text-xs font-medium text-ink-muted hover:bg-panel-hover hover:text-ink"><Trash2 size={14} />Clear all notifications</button>}
    </div>}
  </div>;
}
