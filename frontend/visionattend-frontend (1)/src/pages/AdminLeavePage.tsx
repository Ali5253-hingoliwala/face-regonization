import { useEffect, useState } from "react";
import { Check, FileText, X } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

type LeaveRequest = {
  leave_id: string;
  student_id: string;
  student_name: string;
  leave_type: string;
  duration: string;
  half_day?: string | null;
  leave_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_note?: string | null;
};

export default function AdminLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState("All");
  const [note, setNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await api.get("/admin/leaves");
      setRequests(response.data.requests ?? []);
    } catch (error: any) {
      setMessage(error?.response?.data?.detail ?? "Could not load leave requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function decide(item: LeaveRequest, status: "Approved" | "Rejected") {
    setBusy(item.leave_id);
    setMessage("");
    try {
      await api.put(`/admin/leaves/${item.leave_id}`, { status, admin_note: note[item.leave_id] || null });
      setMessage(`Leave request ${status.toLowerCase()} successfully.`);
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.detail ?? "Could not update leave request.");
    } finally {
      setBusy("");
    }
  }

  const visible = filter === "All" ? requests : requests.filter(item => item.status === filter);

  return <div className="min-h-screen bg-bg text-ink">
    <AdminSidebar />
    <main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{ marginLeft: "var(--portal-sidebar-offset,0px)", width: "calc(100% - var(--portal-sidebar-offset,0px))" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Leave Management</h1>
      <p className="mt-2 text-sm text-ink-muted">Review student leave requests and record your decision.</p>

      {message && <div className="mt-5 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink-muted">{message}</div>}

      <div className="mt-6 flex flex-wrap gap-2">
        {["All", "Pending", "Approved", "Rejected"].map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${filter === item ? "border-accent bg-accent text-white" : "border-line bg-panel text-ink-muted hover:bg-panel-hover hover:text-ink"}`}>{item}</button>)}
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-panel p-5 shadow-sm">
        {loading ? <div className="py-14 text-center text-sm text-ink-muted">Loading leave requests...</div> : visible.length === 0 ? <div className="py-14 text-center"><FileText className="mx-auto text-ink-faint" size={32}/><p className="mt-3 text-sm font-medium">No leave requests</p><p className="mt-1 text-xs text-ink-muted">Requests submitted by students will appear here.</p></div> : <div className="space-y-4">
          {visible.map(item => <article key={item.leave_id} className="rounded-2xl border border-line bg-bg p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.student_name}</h2><span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-ink-muted">{item.student_id}</span><Status status={item.status}/></div>
                <p className="mt-3 text-sm"><span className="font-medium">{item.leave_type}</span> · {item.duration}{item.half_day ? ` · ${item.half_day}` : ""} · {item.leave_date}</p>
                <div className="mt-3 rounded-xl border border-line bg-panel px-4 py-3"><p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Reason</p><p className="mt-1 text-sm leading-6 text-ink-muted">{item.reason}</p></div>
              </div>
            </div>
            {item.status === "Pending" && <div className="mt-4 border-t border-line pt-4"><textarea value={note[item.leave_id] ?? ""} onChange={e => setNote(current => ({ ...current, [item.leave_id]: e.target.value }))} maxLength={500} rows={2} placeholder="Optional note for the student..." className="w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"/><div className="mt-3 flex justify-end gap-2"><button disabled={busy === item.leave_id} onClick={() => decide(item, "Rejected")} className="inline-flex items-center gap-2 rounded-xl border border-absent/30 px-4 py-2.5 text-sm font-medium text-absent hover:bg-absent/5 disabled:opacity-50"><X size={16}/> Reject</button><button disabled={busy === item.leave_id} onClick={() => decide(item, "Approved")} className="inline-flex items-center gap-2 rounded-xl bg-present px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Check size={16}/> Accept</button></div></div>}
            {item.status !== "Pending" && item.admin_note && <p className="mt-3 text-xs text-ink-muted">Admin note: {item.admin_note}</p>}
          </article>)}
        </div>}
      </section>
    </main>
  </div>;
}

function Status({ status }: { status: LeaveRequest["status"] }) {
  const cls = status === "Approved" ? "bg-mint-soft text-present" : status === "Rejected" ? "bg-rose-soft text-absent" : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>;
}
