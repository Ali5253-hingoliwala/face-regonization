import { useEffect, useState } from "react";
import { CalendarDays, FileText, Send } from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";
import { api } from "../api/client";

const leaveTypes = ["Sick Leave", "Casual Leave", "Emergency Leave", "Other"];
type LeaveRequest = { leave_id: string; leave_type: string; duration: string; half_day?: string | null; leave_date: string; reason: string; status: "Pending" | "Approved" | "Rejected"; admin_note?: string | null };

export default function StudentLeavePage() {
  const [type, setType] = useState(leaveTypes[0]);
  const [duration, setDuration] = useState("Full Day");
  const [half, setHalf] = useState("Morning");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRequests() {
    try {
      const response = await api.get("/leave/mine");
      setRequests(response.data.requests ?? []);
    } catch (error: any) {
      setMessage(error?.response?.data?.detail ?? "Could not load leave requests.");
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || reason.trim().length < 5) { setMessage("Please select a leave date and provide a reason of at least 5 characters."); return; }
    setLoading(true); setMessage("");
    try {
      await api.post("/leave", { leave_type: type, duration, half_day: duration === "Half Day" ? half : null, leave_date: date, reason: reason.trim() });
      setMessage("Leave request submitted. It is now pending admin review.");
      setDate(""); setReason("");
      await loadRequests();
    } catch (error: any) {
      setMessage(error?.response?.data?.detail ?? "Could not submit leave request.");
    } finally { setLoading(false); }
  }

  return <div className="min-h-screen bg-bg text-ink"><StudentSidebar/><main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{marginLeft:"var(--portal-sidebar-offset,0px)",width:"calc(100% - var(--portal-sidebar-offset,0px))"}}>
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Leave</h1><p className="mt-2 text-sm text-ink-muted">Apply for available leave and track every admin decision.</p>
    <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText size={19}/></div><div><h2 className="font-semibold">Apply for leave</h2><p className="text-xs text-ink-muted">A reason is required for every request.</p></div></div>
        <form onSubmit={submit} className="mt-6 space-y-4"><Field label="Leave type"><select value={type} onChange={e=>setType(e.target.value)} className="input"><option>Sick Leave</option><option>Casual Leave</option><option>Emergency Leave</option><option>Other</option></select></Field><Field label="Duration"><select value={duration} onChange={e=>setDuration(e.target.value)} className="input"><option>Full Day</option><option>Half Day</option></select></Field>{duration==="Half Day"&&<Field label="Half day"><select value={half} onChange={e=>setHalf(e.target.value)} className="input"><option>Morning</option><option>Afternoon</option></select></Field>}<Field label="Leave date"><input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="input"/></Field><Field label="Reason"><textarea required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the reason for your leave..." rows={5} className="input resize-none"/></Field>{message&&<div className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink-muted">{message}</div>}<button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dim disabled:opacity-50"><Send size={16}/> {loading ? "Submitting..." : "Submit request"}</button></form>
      </section>
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><CalendarDays size={19}/></div><div><h2 className="font-semibold">My leave requests</h2><p className="text-xs text-ink-muted">Pending, approved and rejected requests stay visible here.</p></div></div><div className="mt-6 space-y-3">{requests.length ? requests.map(item => <div key={item.leave_id} className="rounded-xl border border-line bg-bg p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{item.leave_type}</p><p className="mt-1 text-xs text-ink-muted">{item.leave_date} · {item.duration}{item.half_day ? ` · ${item.half_day}` : ""}</p></div><Status status={item.status}/></div><p className="mt-3 text-sm leading-5 text-ink-muted">{item.reason}</p>{item.admin_note&&<p className="mt-3 rounded-lg bg-panel px-3 py-2 text-xs text-ink-muted">Admin note: {item.admin_note}</p>}</div>) : <div className="rounded-xl border border-dashed border-line bg-bg p-8 text-center"><p className="text-sm font-medium">No leave requests yet</p><p className="mt-1 text-xs text-ink-muted">Your submitted requests will appear here.</p></div>}</div></section>
    </div>
  </main></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <div><label className="mb-1.5 block text-xs font-mono text-ink-muted">{label}</label>{children}</div>; }
function Status({status}:{status:LeaveRequest["status"]}) { const cls=status==="Approved"?"bg-mint-soft text-present":status==="Rejected"?"bg-rose-soft text-absent":"bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>; }
