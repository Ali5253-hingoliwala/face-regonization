import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import StudentSidebar from "../components/StudentSidebar";

type RecordItem = { date: string; session_id?: string; session_name?: string; status: string; start_time?: string; duration_minutes?: number };
const PAGE_SIZE = 8;

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/me/attendance").then(r => setRecords(r.data.records ?? [])).catch(e => setError(e?.response?.data?.detail ?? "Could not load attendance.")); }, []);
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const visible = useMemo(() => records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [records, page]);
  return <div className="min-h-screen bg-bg text-ink"><StudentSidebar/><main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{marginLeft:"var(--portal-sidebar-offset,0px)",width:"calc(100% - var(--portal-sidebar-offset,0px))"}}>
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Attendance History</h1><p className="mt-2 text-sm text-ink-muted">Your complete session-by-session attendance record.</p>
    <section className="mt-7 rounded-2xl border border-line bg-panel p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><BarChart3 size={19}/></div><div><h2 className="font-semibold">All sessions</h2><p className="text-xs text-ink-muted">{records.length} recorded session{records.length === 1 ? "" : "s"}</p></div></div>
      {error && <p className="mt-5 rounded-xl bg-rose-soft px-4 py-3 text-sm text-absent">{error}</p>}
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{visible.map((r,i)=><tr key={`${r.session_id ?? r.date}-${i}`} className="border-b border-line last:border-0 hover:bg-panel-hover"><td className="px-4 py-4">{r.date}</td><td className="px-4 py-4 font-medium">{r.session_name || "Attendance Session"}</td><td className="px-4 py-4 text-ink-muted">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td><td className="px-4 py-4"><Status status={r.status}/></td></tr>)}</tbody></table>{!visible.length && <div className="px-4 py-12 text-center text-sm text-ink-muted">No attendance records found.</div>}</div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><p className="text-xs text-ink-muted">Page {page} of {totalPages}</p><div className="flex gap-2"><button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-line p-2 disabled:opacity-40"><ChevronLeft size={16}/></button><button disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-lg border border-line p-2 disabled:opacity-40"><ChevronRight size={16}/></button></div></div>
    </section>
  </main></div>;
}
function Status({status}:{status:string}) { const cls=status==="Present"?"bg-mint-soft text-present":status==="Late"?"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300":"bg-rose-soft text-absent"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>; }
