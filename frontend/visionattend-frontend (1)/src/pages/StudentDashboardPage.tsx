import { useEffect, useState } from "react";
import { Activity, BarChart3, CalendarDays, CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";
import { api } from "../api/client";
import StudentSidebar from "../components/StudentSidebar";
import { useAuth } from "../context/AuthContext";

type Summary = { total_sessions: number; present: number; late: number; absent: number; attendance_percentage: number };
type RecordItem = { date: string; session_id?: string; session_name?: string; status: string; time?: string; start_time?: string };

type CardTone = "blue" | "green" | "sky" | "red";

const cardStyles: Record<CardTone, string> = {
  blue: "bg-blue-soft border-blue/20 text-blue",
  green: "bg-mint-soft border-present/20 text-present",
  sky: "bg-sky-soft border-sky/20 text-sky",
  red: "bg-rose-soft border-absent/20 text-absent",
};

export default function StudentDashboardPage() {
  const { name } = useAuth();
  const [summary, setSummary] = useState<Summary>({ total_sessions: 0, present: 0, late: 0, absent: 0, attendance_percentage: 0 });
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/me/summary"), api.get("/me/attendance")]).then(([s, a]) => {
      setSummary(s.data); setRecords(a.data.records ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const recent = records.slice(0, 5);
  const cards = [
    ["Attendance", `${summary.attendance_percentage}%`, BarChart3, "Overall attendance", "blue"],
    ["Present", summary.present, CheckCircle2, "Sessions attended", "green"],
    ["Late", summary.late, Clock3, "Late arrivals", "sky"],
    ["Absent", summary.absent, XCircle, "Missed sessions", "red"],
  ] as const;

  return <div className="min-h-screen bg-bg text-ink"><StudentSidebar /><main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{ marginLeft: "var(--portal-sidebar-offset,0px)", width: "calc(100% - var(--portal-sidebar-offset,0px))" }}>
    <section className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p><h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Welcome{name ? `, ${name}` : ""}</h1><p className="mt-2 text-sm text-ink-muted">Your attendance overview and latest academic attendance activity.</p></div><div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-xs text-ink-muted shadow-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent"/>AI Attendance System</div></section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, Icon, sub, tone]) => <div key={label} className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardStyles[tone]}`}><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider opacity-75">{label}</p><p className="mt-2 text-3xl font-semibold">{loading ? "—" : value}</p><p className="mt-1 text-xs opacity-70">{sub}</p></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-black/15"><Icon size={20}/></div></div></div>)}
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Attendance Trend</p><h2 className="mt-1 text-lg font-semibold">Your attendance</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Activity size={19}/></div></div><div className="mt-6 flex h-40 items-end gap-2">{records.slice(0, 10).reverse().map((r, i) => { const good = r.status === "Present" ? 100 : r.status === "Late" ? 70 : 25; return <div key={`${r.date}-${i}`} className="flex h-full flex-1 flex-col justify-end"><div title={r.status} className={`rounded-t-lg transition-all ${r.status === "Present" ? "bg-present" : r.status === "Late" ? "bg-late" : "bg-absent"}`} style={{ height: `${good}%` }}/><span className="mt-2 truncate text-center text-[9px] text-ink-faint">{r.date?.slice(5) ?? ""}</span></div>; })}</div>{!records.length && <div className="mt-8 text-sm text-ink-muted">No attendance records yet.</div>}</section>
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender-soft text-lavender"><CalendarDays size={19}/></div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Recent Activity</p><h2 className="mt-1 text-lg font-semibold">Latest sessions</h2></div></div><div className="mt-5 space-y-3">{recent.length ? recent.map((r, i) => <div key={`${r.date}-${i}`} className="flex items-center justify-between rounded-xl border border-line bg-panel-hover px-4 py-3"><div><p className="text-sm font-medium">{r.session_name || "Attendance Session"}</p><p className="mt-0.5 text-xs text-ink-muted">{r.date}</p></div><Status status={r.status}/></div>) : <p className="text-sm text-ink-muted">No sessions recorded yet.</p>}</div></section>
    </div>

    <div className="mt-5 rounded-2xl border border-line bg-panel p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-peach-soft text-accent"><FileText size={18}/></div><div><h2 className="font-semibold">Leave requests</h2><p className="text-xs text-ink-muted">Apply for leave and track approval from the Leave section.</p></div></div></div>
  </main></div>;
}
function Status({status}:{status:string}) { const cls = status === "Present" ? "bg-mint-soft text-present" : status === "Late" ? "bg-sky-soft text-sky" : "bg-rose-soft text-absent"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>; }
