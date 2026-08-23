import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Menu, Radio, Users, XCircle } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AdminSidebar from "../components/AdminSidebar";

type Record = {
  student_id?: string;
  name?: string;
  status?: string;
  time?: string;
};

type Session = {
  session_id: string;
  name?: string;
};

export default function AdminDashboardPage() {
  const { name } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  async function load() {
    try {
      const [studentsRes, sessionRes, pipelineRes] = await Promise.all([
        api.get("/students"),
        api.get("/session/current"),
        api.get("/pipeline/status"),
      ]);

      const sessionData = sessionRes.data;
      const currentSession =
        sessionData?.session ??
        (sessionData?.session_id ? sessionData : null);

      setStudents(studentsRes.data?.students ?? []);
      setSession(currentSession);
      setPipelineRunning(Boolean(pipelineRes.data?.running));

      // IMPORTANT: Do not use /attendance/today here.
      // Without an active session there is no live attendance state,
      // so old absent records must not appear as today's current absence.
      if (currentSession?.session_id) {
        const attendanceRes = await api.get(
          `/attendance/session/${currentSession.session_id}`
        );
        setRecords(attendanceRes.data?.records ?? []);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error("Dashboard refresh failed:", error);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const present = useMemo(
    () => records.filter((r) => r.status?.toLowerCase() === "present").length,
    [records]
  );

  const late = useMemo(
    () => records.filter((r) => r.status?.toLowerCase() === "late").length,
    [records]
  );

  // Absence is session-specific. Before a session is closed, students who
  // have not appeared yet are simply "not recorded", not absent.
  const absent = session
    ? records.filter((r) => r.status?.toLowerCase() === "absent").length
    : 0;

  const attendanceRate = session && students.length
    ? Math.round(((present + late) / students.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-4 px-5 sm:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-line bg-panel p-2 lg:hidden"
            >
              <Menu size={19} />
            </button>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p>
              <h1 className="font-display text-xl font-semibold">Dashboard</h1>
            </div>
            <div className="ml-auto hidden items-center gap-2 text-xs text-ink-muted sm:flex">
              <span className={`h-2 w-2 rounded-full ${pipelineRunning ? "bg-green-500" : "bg-ink-faint"}`} />
              {pipelineRunning ? "AI Pipeline Active" : "AI Pipeline Idle"}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <section className="mb-7">
            <p className="text-sm text-accent">Welcome back{name ? `, ${name}` : ""}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Attendance Overview</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {session ? "Live data for the active attendance session." : "No active attendance session right now."}
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Users size={20} />} label="Total Students" value={students.length} />
            <Stat icon={<CheckCircle2 size={20} />} label="Present" value={present} />
            <Stat icon={<XCircle size={20} />} label="Absent" value={absent} />
            <Stat icon={<Activity size={20} />} label="Attendance Rate" value={`${attendanceRate}%`} />
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-panel p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">AI Attendance</p>
                <h3 className="mt-2 text-xl font-semibold">
                  {session ? "Session Active" : "No Active Session"}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {session ? session.name ?? "Attendance Session" : "Start a session from Live Session to begin monitoring."}
                </p>
              </div>
              <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ${session ? "bg-green-50 text-green-700" : "bg-panel-hover text-ink-muted"}`}>
                <span className={`h-2 w-2 rounded-full ${session ? "bg-green-500 animate-pulse" : "bg-ink-faint"}`} />
                {session ? "LIVE" : "IDLE"}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <h3 className="font-semibold">Current Session Attendance</h3>
                <p className="mt-1 text-xs text-ink-muted">Only the active session is shown here.</p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">{records.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Student ID</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr key={`${record.student_id}-${index}`} className="border-b border-line last:border-0">
                      <td className="px-6 py-4 font-medium">{record.name ?? "Unknown"}</td>
                      <td className="px-6 py-4 font-mono text-xs text-ink-muted">{record.student_id ?? "—"}</td>
                      <td className="px-6 py-4"><span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{record.status ?? "Recorded"}</span></td>
                      <td className="px-6 py-4 text-ink-muted">{record.time ?? "—"}</td>
                    </tr>
                  ))}
                  {!records.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-ink-muted">
                        {session ? "No attendance detected yet." : "No active session. No students are marked absent."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</div>
      <p className="mt-5 text-xs uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
