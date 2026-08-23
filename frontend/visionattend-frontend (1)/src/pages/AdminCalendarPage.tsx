import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

export default function AdminCalendarPage() {
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => { api.get("/attendance/today").then(r => setRecords(r.data.records ?? [])).catch(console.error); }, []);
  const today = new Date();
  return <div className="min-h-screen bg-bg text-ink"><AdminSidebar/><div className="lg:pl-64"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Attendance Calendar</h1><p className="mt-2 text-sm text-ink-muted">Today's attendance records.</p><div className="mt-6 rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><CalendarDays className="text-accent"/><div><p className="font-semibold">{today.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p><p className="text-sm text-ink-muted">{records.length} recorded students</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{records.map(r=><div key={r.student_id} className="rounded-xl border border-line p-4"><p className="font-medium">{r.name}</p><p className="mt-1 text-xs text-ink-muted">{r.student_id}</p><span className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{r.status}</span></div>)}{!records.length&&<p className="py-8 text-sm text-ink-muted">No attendance records for today.</p>}</div></div></main></div></div>;
}
