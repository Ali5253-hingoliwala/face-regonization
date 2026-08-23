import { useEffect, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, Radio } from "lucide-react";
import { api } from "../api/client";

type Notice = { id: string; title: string; text: string; kind: "live" | "scheduled" | "attendance" };

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  async function refresh() {
    try {
      const [currentRes, scheduledRes] = await Promise.all([
        api.get("/session/current"),
        api.get("/session/scheduled"),
      ]);
      const current = currentRes.data;
      const scheduled = scheduledRes.data?.sessions ?? [];
      const next = scheduled[0];
      const nextNotices: Notice[] = [];

      if (current?.active) {
        nextNotices.push({
          id: `live-${current.session_id}`,
          title: "AI session is live",
          text: `${current.name ?? "Attendance Session"} is currently being monitored.`,
          kind: "live",
        });
      }

      if (next) {
        const when = new Date(next.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        nextNotices.push({
          id: `scheduled-${next.session_id}`,
          title: "Upcoming session",
          text: `${next.name} is scheduled for ${when}.`,
          kind: "scheduled",
        });
      }

      if (!nextNotices.length) {
        nextNotices.push({
          id: "ready",
          title: "VisionAttend is ready",
          text: "No active or upcoming sessions right now.",
          kind: "attendance",
        });
      }
      setNotices(nextNotices);
    } catch {
      // Keep the last notification state during temporary backend restarts.
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const icon = (kind: Notice["kind"]) =>
    kind === "live" ? <Radio size={16} /> : kind === "scheduled" ? <CalendarClock size={16} /> : <CheckCircle2 size={16} />;

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="relative rounded-xl border border-line bg-panel p-2.5 text-ink-muted hover:text-ink" aria-label="Notifications">
        <Bell size={19} />
        {notices.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-line bg-panel p-3 shadow-xl">
          <div className="flex items-center justify-between px-2 py-2">
            <div><p className="font-semibold">Notifications</p><p className="text-xs text-ink-muted">Live system updates</p></div>
            <span className="rounded-full bg-accent-soft px-2 py-1 text-[10px] font-medium text-accent">LIVE</span>
          </div>
          <div className="mt-2 space-y-2">
            {notices.map(n => (
              <div key={n.id} className="flex gap-3 rounded-xl bg-panel-hover p-3">
                <div className="mt-0.5 text-accent">{icon(n.kind)}</div>
                <div><p className="text-sm font-medium">{n.title}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{n.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
