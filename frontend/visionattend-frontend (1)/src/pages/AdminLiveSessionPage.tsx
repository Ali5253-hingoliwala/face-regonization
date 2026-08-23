import { useEffect, useMemo, useState } from "react";
import {
  Radio,
  Square,
  Users,
  CheckCircle2,
  Clock3,
  Activity,
} from "lucide-react";

import { api } from "../api/client";

type Session = {
  session_id: string;
  name: string;
  start_time?: string;
  duration_minutes?: number;
  status?: string;
};

type AttendanceRecord = {
  student_id?: string;
  name?: string;
  status?: string;
  time?: string;
  timestamp?: string;
};

export default function AdminLiveSessionPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);

  async function load() {
    try {
      const sessionRes = await api.get("/session/current");
      const sessionData = sessionRes.data;
      const currentSessionId =
        sessionData?.session_id ?? sessionData?.session?.session_id;

      const [attendanceRes, pipelineRes] = await Promise.all([
        currentSessionId
          ? api.get(`/attendance/session/${currentSessionId}`)
          : Promise.resolve({ data: { records: [] } }),
        api.get("/pipeline/status"),
      ]);

      setSession(
        sessionData?.session ??
          (sessionData?.session_id ? sessionData : null)
      );
      setRecords(attendanceRes.data.records ?? []);
      setPipelineRunning(Boolean(pipelineRes.data.running));
    } catch {
      // Keep the current UI state if a refresh fails.
    }
  }

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session?.start_time) {
      setSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      const start = new Date(session.start_time!).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const duration = (session.duration_minutes ?? 45) * 60;
      const remaining = Math.max(0, duration - elapsed);

      setSeconds(remaining);

      if (remaining === 0) {
        void load();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session]);

  const timer = useMemo(() => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }, [seconds]);

  const present = records.filter(
    (r) => r.status?.toLowerCase() === "present"
  ).length;

  const late = records.filter(
    (r) => r.status?.toLowerCase() === "late"
  ).length;

  async function startSession() {
    setLoading(true);

    try {
      await api.post("/session/start", {
        name: "Attendance Session",
        duration_minutes: 45,
        late_after_minutes: 10,
      });

      await load();
    } finally {
      setLoading(false);
    }
  }

  async function stopSession() {
    setLoading(true);

    try {
      await api.post("/session/end");
      await load();
    } finally {
      setLoading(false);
    }
  }

  const active = Boolean(session?.session_id);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-4 px-5 sm:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              Admin Portal
            </p>
            <h1 className="font-display text-xl font-semibold">
              Live Session
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <div className="mb-7">
          <p className="text-sm text-ink-muted">
            Control and monitor the active AI attendance session.
          </p>
        </div>

        <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  active
                    ? "bg-red-50 text-red-600"
                    : "bg-accent-soft text-accent"
                }`}
              >
                <Radio size={26} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-ink-faint">
                  Session status
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {active ? "AI Session Active" : "No Active Session"}
                </h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
                  <Activity size={15} />
                  {pipelineRunning
                    ? "ML pipeline running"
                    : "ML pipeline stopped"}
                </div>
              </div>
            </div>

            {!active ? (
              <button
                onClick={startSession}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-sm transition hover:bg-accent-dim disabled:opacity-50"
              >
                <Radio size={18} />
                {loading ? "Starting..." : "Start 45-Minute Session"}
              </button>
            ) : (
              <button
                onClick={stopSession}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                <Square size={17} />
                {loading ? "Stopping..." : "Stop Session"}
              </button>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Clock3 size={20} />}
            title="Time Remaining"
            value={active ? timer : "45:00"}
          />
          <InfoCard
            icon={<Users size={20} />}
            title="Present"
            value={present.toString()}
          />
          <InfoCard
            icon={<CheckCircle2 size={20} />}
            title="Late"
            value={late.toString()}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold">Live Attendance</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Attendance detected by the AI pipeline for this session
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-present">
              <span className="h-2 w-2 rounded-full bg-present" />
              {active ? "Live" : "Closed"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record, index) => (
                  <tr
                    key={`${record.student_id}-${index}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-4 font-medium">
                      {record.name ?? "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {record.student_id ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                        {record.status ?? "Recorded"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {record.time ?? record.timestamp ?? "—"}
                    </td>
                  </tr>
                ))}

                {!records.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-ink-muted"
                    >
                      {active
                        ? "No attendance detected yet."
                        : "No active session attendance."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-faint">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}
