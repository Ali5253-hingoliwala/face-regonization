import { useState } from "react";
import { CalendarDays, FileText, Send } from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";

const leaveTypes = ["Sick Leave", "Casual Leave", "Emergency Leave", "Other"];

export default function StudentLeavePage() {
  const [type, setType] = useState(leaveTypes[0]);
  const [duration, setDuration] = useState("Full Day");
  const [half, setHalf] = useState("Morning");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !reason.trim()) { setMessage("Please select a leave date and provide a reason."); return; }
    setMessage("Leave request form is ready. Leave API approval workflow will be connected in the next backend phase.");
  }

  return <div className="min-h-screen bg-bg text-ink"><StudentSidebar/><main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{marginLeft:"var(--portal-sidebar-offset,0px)",width:"calc(100% - var(--portal-sidebar-offset,0px))"}}>
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Leave</h1><p className="mt-2 text-sm text-ink-muted">Apply for available leave and provide a reason for your request.</p>
    <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText size={19}/></div><div><h2 className="font-semibold">Apply for leave</h2><p className="text-xs text-ink-muted">Reason is required for every request.</p></div></div>
        <form onSubmit={submit} className="mt-6 space-y-4"><Field label="Leave type"><select value={type} onChange={e=>setType(e.target.value)} className="input"><option>{leaveTypes[0]}</option><option>{leaveTypes[1]}</option><option>{leaveTypes[2]}</option><option>{leaveTypes[3]}</option></select></Field><Field label="Duration"><select value={duration} onChange={e=>setDuration(e.target.value)} className="input"><option>Full Day</option><option>Half Day</option></select></Field>{duration==="Half Day"&&<Field label="Half day"><select value={half} onChange={e=>setHalf(e.target.value)} className="input"><option>Morning</option><option>Afternoon</option></select></Field>}<Field label="Leave date"><input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="input"/></Field><Field label="Reason"><textarea required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the reason for your leave..." rows={5} className="input resize-none"/></Field>{message&&<div className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink-muted">{message}</div>}<button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dim"><Send size={16}/> Submit request</button></form>
      </section>
      <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><CalendarDays size={19}/></div><div><h2 className="font-semibold">My leave requests</h2><p className="text-xs text-ink-muted">Track requests and admin decisions here.</p></div></div><div className="mt-6 rounded-xl border border-dashed border-line bg-bg p-8 text-center"><p className="text-sm font-medium">No leave requests yet</p><p className="mt-1 text-xs text-ink-muted">Submitted requests will appear here with Pending, Approved or Rejected status.</p></div></section>
    </div>
  </main></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <div><label className="mb-1.5 block text-xs font-mono text-ink-muted">{label}</label>{children}</div>; }
