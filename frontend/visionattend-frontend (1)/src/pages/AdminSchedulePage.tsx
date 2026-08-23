import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Play, Trash2 } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

type Session = { session_id: string; name: string; start_time: string; duration_minutes: number; late_after_minutes: number; overdue?: boolean };

export default function AdminSchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("Attendance Session");
  const [start, setStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await api.get("/session/scheduled");
      setSessions(response.data.sessions ?? []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function schedule() {
    setError("");
    setMessage("");

    if (!start) {
      setError("Choose a date and time first.");
      return;
    }

    setSaving(true);

    try {
      // Keep the browser's local date/time. Do not convert to UTC with toISOString().
      await api.post("/session/schedule", {
        name: name.trim() || "Attendance Session",
        planned_start_time: start,
        duration_minutes: 45,
        late_after_minutes: 10,
      });

      setStart("");
      setMessage("Session scheduled successfully.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not schedule the session.");
    } finally {
      setSaving(false);
    }
  }

  async function startNow(id: string) {
    setError("");
    setMessage("");

    try {
      await api.post(`/session/start/${id}`);
      setMessage("Session started. The 45-minute timer begins now.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not start this session.");
    }
  }

  async function cancel(id: string) {
    setError("");
    setMessage("");

    try {
      await api.delete(`/session/scheduled/${id}`);
      setMessage("Scheduled session cancelled.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not cancel this session.");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AdminSidebar />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Schedule</h1>
          <p className="mt-2 text-sm text-ink-muted">Create and manage 45-minute AI attendance sessions.</p>

          <section className="mt-6 rounded-2xl border border-line bg-panel p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent-soft p-3 text-accent"><CalendarClock size={20}/></div>
              <div>
                <h2 className="font-semibold">Schedule Session</h2>
                <p className="text-xs text-ink-muted">The planned time is a reminder. The 45-minute timer starts when you press Start.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent" placeholder="Session name" />
              <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent" />
              <button onClick={schedule} disabled={!start || saving} className="rounded-xl bg-accent px-6 py-3 font-medium text-white disabled:opacity-50">{saving ? "Scheduling..." : "Schedule"}</button>
            </div>

            {message && <p className="mt-4 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16}/>{message}</p>}
            {error && <p className="mt-4 flex items-center gap-2 text-sm text-red-600"><AlertCircle size={16}/>{error}</p>}
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm">
            <div className="border-b border-line px-6 py-5">
              <h2 className="font-semibold">Scheduled Sessions</h2>
              <p className="mt-1 text-xs text-ink-muted">A session remains here until it is started or cancelled, even if its planned time has passed.</p>
            </div>

            <div className="divide-y divide-line">
              {sessions.map(s => (
                <div key={s.session_id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.name}</p>
                      {s.overdue && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-600">OVERDUE — READY TO START</span>}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted"><CalendarClock size={15}/>{new Date(s.start_time).toLocaleString()} · {s.duration_minutes} min</p>
                    <p className="mt-1 text-xs text-ink-faint">First {s.late_after_minutes} minutes = Present window</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => startNow(s.session_id)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"><Play size={15}/> Start Session</button>
                    <button onClick={() => cancel(s.session_id)} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:bg-red-50 hover:text-red-600"><Trash2 size={15}/> Cancel</button>
                  </div>
                </div>
              ))}

              {!sessions.length && <div className="px-6 py-12 text-center"><CalendarClock className="mx-auto text-ink-faint" size={30}/><p className="mt-3 text-sm text-ink-muted">No scheduled sessions.</p></div>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
