import { useEffect, useState } from "react";
import { CalendarClock, Play, Trash2 } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

export default function AdminSchedulePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [name, setName] = useState("Attendance Session");
  const [start, setStart] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() { try { const r = await api.get("/session/scheduled"); setSessions(r.data.sessions ?? []); } catch(e){ console.error(e); } }
  useEffect(() => { void load(); }, []);

  async function schedule() {
    if (!start) return;
    setSaving(true);
    try { await api.post("/session/schedule", { name, planned_start_time: new Date(start).toISOString(), duration_minutes:45, late_after_minutes:10 }); setStart(""); await load(); } finally { setSaving(false); }
  }

  async function startNow(id:string){ await api.post(`/session/start/${id}`); await load(); }
  async function cancel(id:string){ await api.delete(`/session/scheduled/${id}`); await load(); }

  return <div className="min-h-screen bg-bg text-ink"><AdminSidebar/><div className="lg:pl-64"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Schedule</h1><p className="mt-2 text-sm text-ink-muted">Create and manage 45-minute attendance sessions.</p>
  <section className="mt-6 rounded-2xl border border-line bg-panel p-6 shadow-sm"><h2 className="font-semibold">Schedule Session</h2><div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={e=>setName(e.target.value)} className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent" placeholder="Session name"/><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"/><button onClick={schedule} disabled={!start||saving} className="rounded-xl bg-accent px-5 py-3 font-medium text-white disabled:opacity-50">{saving?"Saving...":"Schedule"}</button></div></section>
  <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm"><div className="border-b border-line px-6 py-5"><h2 className="font-semibold">Scheduled Sessions</h2></div><div className="divide-y divide-line">{sessions.map(s=><div key={s.session_id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{s.name}</p><p className="mt-1 text-sm text-ink-muted"><CalendarClock className="mr-1 inline" size={15}/>{new Date(s.start_time).toLocaleString()} · {s.duration_minutes} min</p></div><div className="flex gap-2"><button onClick={()=>startNow(s.session_id)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white"><Play size={15}/> Start</button><button onClick={()=>cancel(s.session_id)} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:bg-red-50 hover:text-red-600"><Trash2 size={15}/> Cancel</button></div></div>)}{!sessions.length&&<p className="px-6 py-10 text-sm text-ink-muted">No scheduled sessions.</p>}</div></section>
  </main></div></div>;
}
