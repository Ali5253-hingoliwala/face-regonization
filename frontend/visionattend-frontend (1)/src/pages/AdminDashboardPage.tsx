import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, CheckCircle2, Menu, Radio, Users, XCircle } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AdminSidebar from "../components/AdminSidebar";
import NotificationCenter from "../components/NotificationCenter";

type Student = { student_id: string; name: string };
type Attendance = { student_id?: string; name?: string; status?: string; date?: string; time?: string; session_id?: string };
type Session = { session_id: string; name: string; start_time: string; duration_minutes: number; status: string };

export default function AdminDashboardPage() {
  const { name } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [scheduled, setScheduled] = useState<Session[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  async function load() {
    try {
      const [studentsRes, currentRes, scheduledRes, statusRes] = await Promise.all([
        api.get("/students"), api.get("/session/current"), api.get("/session/scheduled"), api.get("/pipeline/status")
      ]);
      const current = currentRes.data?.active ? currentRes.data : null;
      setStudents(studentsRes.data?.students ?? []);
      setSession(current);
      setScheduled(scheduledRes.data?.sessions ?? []);
      setPipelineRunning(Boolean(statusRes.data?.running));
      if (current?.session_id) {
        const r = await api.get(`/attendance/session/${current.session_id}`);
        setRecords(r.data?.records ?? []);
      } else setRecords([]);
    } catch (e) { console.error("Dashboard refresh failed", e); }
  }

  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 5000); return () => window.clearInterval(t); }, []);

  const present = records.filter(r => r.status?.toLowerCase() === "present").length;
  const late = records.filter(r => r.status?.toLowerCase() === "late").length;
  const absent = records.filter(r => r.status?.toLowerCase() === "absent").length;
  const rate = students.length ? Math.round(((present + late) / students.length) * 100) : 0;
  const max = Math.max(students.length, 1);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-4 px-5 sm:px-8">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg border border-line bg-panel p-2 lg:hidden"><Menu size={19}/></button>
            <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="font-display text-xl font-semibold">Dashboard</h1></div>
            <div className="ml-auto flex items-center gap-3"><div className="hidden text-xs text-ink-muted sm:block"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${pipelineRunning ? "bg-green-500 animate-pulse" : "bg-ink-faint"}`}/>{pipelineRunning ? "AI Pipeline Active" : "AI Pipeline Idle"}</div><NotificationCenter/></div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <section className="mb-7"><p className="text-sm text-accent">Welcome back{name ? `, ${name}` : ""}</p><h2 className="mt-1 font-display text-3xl font-semibold">Attendance Overview</h2><p className="mt-2 text-sm text-ink-muted">Track live sessions, scheduled lectures and attendance performance.</p></section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Users size={20}/>} label="Total Students" value={students.length}/>
            <Stat icon={<CheckCircle2 size={20}/>} label="Present" value={present}/>
            <Stat icon={<XCircle size={20}/>} label="Absent" value={absent}/>
            <Stat icon={<Activity size={20}/>} label="Current Rate" value={`${rate}%`}/>
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Live Analytics</p><h3 className="mt-1 text-lg font-semibold">Current Session Breakdown</h3></div><span className={`rounded-full px-3 py-1 text-xs ${session ? "bg-green-50 text-green-700" : "bg-panel-hover text-ink-muted"}`}>{session ? "LIVE" : "IDLE"}</span></div>
              <div className="mt-7 space-y-5">
                <Bar label="Present" value={present} total={max}/><Bar label="Late" value={late} total={max}/><Bar label="Absent" value={absent} total={max}/>
              </div>
              <div className="mt-7 grid grid-cols-3 gap-3 text-center"><Mini label="Present" value={present}/><Mini label="Late" value={late}/><Mini label="Absent" value={absent}/></div>
            </div>

            <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-accent-soft p-3 text-accent"><CalendarClock size={20}/></div><div><p className="text-xs uppercase tracking-wider text-ink-faint">Next session</p><h3 className="mt-1 font-semibold">{scheduled[0]?.name ?? "Nothing scheduled"}</h3></div></div>
              {scheduled[0] ? <><p className="mt-5 text-sm text-ink-muted">{new Date(scheduled[0].start_time).toLocaleString()}</p><p className="mt-1 text-xs text-ink-faint">45-minute AI monitoring session</p></> : <p className="mt-5 text-sm text-ink-muted">Schedule a lecture to see it here.</p>}
              <a href="/admin/schedule" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"><CalendarClock size={16}/> Manage Schedule</a>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-6 py-5"><div><h3 className="font-semibold">Current Session</h3><p className="mt-1 text-xs text-ink-muted">Session-specific attendance only.</p></div><span className="text-xs text-ink-muted">{records.length} records</span></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-6 py-3">Student</th><th className="px-6 py-3">ID</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Time</th></tr></thead><tbody>{records.map((r,i)=><tr key={`${r.student_id}-${i}`} className="border-b border-line last:border-0"><td className="px-6 py-4 font-medium">{r.name}</td><td className="px-6 py-4 text-ink-muted">{r.student_id}</td><td className="px-6 py-4"><span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{r.status}</span></td><td className="px-6 py-4 text-ink-muted">{r.time ?? "—"}</td></tr>)}{!records.length&&<tr><td colSpan={4} className="px-6 py-12 text-center text-ink-muted">{session ? "Waiting for AI attendance..." : "No active session. Previous attendance is available in Attendance History."}</td></tr>}</tbody></table></div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}){return <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</div><p className="mt-5 text-xs uppercase tracking-wider text-ink-faint">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p></div>}
function Bar({label,value,total}:{label:string;value:number;total:number}){const width=Math.min(100,(value/total)*100);return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-medium">{value}</span></div><div className="h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{width:`${width}%`}}/></div></div>}
function Mini({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-panel-hover p-3"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-ink-muted">{label}</p></div>}
