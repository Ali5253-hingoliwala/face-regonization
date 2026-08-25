import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, HeartPulse, Info, Plus, BriefcaseBusiness, X, Clock3 } from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";
import { api } from "../api/client";

const leaveTypes = ["Sick Leave", "Casual Leave", "Emergency Leave", "Other"];
const PAGE_SIZE = 5;
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
  const [showApply, setShowApply] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);

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
      setDate(""); setReason(""); setShowApply(false); setPage(1); await loadRequests();
    } catch (error: any) { setMessage(error?.response?.data?.detail ?? "Could not submit leave request."); }
    finally { setLoading(false); }
  }

  const totals = useMemo(() => ({
    casual: requests.filter((r) => r.leave_type === "Casual Leave").length,
    sick: requests.filter((r) => r.leave_type === "Sick Leave").length,
    other: requests.filter((r) => r.leave_type === "Emergency Leave" || r.leave_type === "Other").length,
    pending: requests.filter((r) => r.status === "Pending").length,
  }), [requests]);
  const pageCount = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRequests = requests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <div className="min-h-screen bg-bg text-ink"><StudentSidebar/><main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{marginLeft:"var(--portal-sidebar-offset,0px)",width:"calc(100% - var(--portal-sidebar-offset,0px))"}}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Leave Management</h1><p className="mt-2 text-sm text-ink-muted">Apply for leave and track every request and admin decision.</p></div><button type="button" onClick={()=>{setMessage("");setShowApply(true)}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-dim"><Plus size={18}/>Apply New Leave</button></div>
    {message&&<div className="mt-5 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink-muted shadow-sm">{message}</div>}

    <section className="mt-7 grid gap-5 xl:grid-cols-3"><BalanceCard title="CASUAL LEAVE" value={`${totals.casual}`} subtitle="Requests this year" tone="green" icon={<BriefcaseBusiness size={23}/>}/><BalanceCard title="SICK LEAVE" value={`${totals.sick}`} subtitle="Requests this year" tone="blue" icon={<HeartPulse size={23}/>}/><BalanceCard title="OTHER LEAVE" value={`${totals.other}`} subtitle={`${totals.pending} request${totals.pending===1?"":"s"} pending`} tone="orange" icon={<CalendarDays size={23}/>}/></section>

    <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm"><div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><button className="border-b-2 border-accent pb-3 text-sm font-semibold text-accent">My Leave Requests</button><button type="button" onClick={()=>setShowApply(true)} className="pb-3 text-sm font-medium text-ink-muted hover:text-ink">Apply for Leave</button></div><span className="text-xs text-ink-faint">{requests.length} total request{requests.length===1?"":"s"}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-line bg-panel-hover text-xs font-mono uppercase tracking-wide text-ink-faint"><tr><th className="px-5 py-4">Type</th><th className="px-5 py-4">Start Date</th><th className="px-5 py-4">End Date</th><th className="px-5 py-4">Duration</th><th className="px-5 py-4">Reason</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Applied On</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody>
        {visibleRequests.length?visibleRequests.map(item=><tr key={item.leave_id} className="border-b border-line last:border-0 hover:bg-panel-hover/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><TypeIcon type={item.leave_type}/><div><p className="font-semibold">{item.leave_type}</p><span className="mt-1 inline-flex rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{item.duration}{item.half_day?` (${item.half_day})`:""}</span></div></div></td><td className="px-5 py-4 text-ink-muted">{formatDate(item.leave_date)}</td><td className="px-5 py-4 text-ink-muted">{formatDate(item.leave_date)}</td><td className="px-5 py-4 text-ink-muted">{item.duration==="Half Day"?"0.5 Day":"1 Day"}</td><td className="max-w-[210px] px-5 py-4 text-ink-muted"><span className="block truncate" title={item.reason}>{item.reason}</span></td><td className="px-5 py-4"><Status status={item.status}/></td><td className="px-5 py-4 text-ink-muted">{formatDate(item.leave_date)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={()=>setSelected(item)} title="View request" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-accent/50 hover:bg-accent-soft hover:text-accent"><Eye size={17}/></button></td></tr>):<tr><td colSpan={8} className="px-5 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><CalendarDays size={25}/></div><p className="mt-4 font-semibold">No leave history found</p><p className="mt-1 text-sm text-ink-muted">You haven't applied for any leaves yet.</p></td></tr>}
      </tbody></table></div>
      {requests.length>0&&<div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4"><button type="button" disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted disabled:opacity-35"><ChevronLeft size={17}/></button>{Array.from({length:pageCount},(_,i)=>i+1).map(n=><button key={n} type="button" onClick={()=>setPage(n)} className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold ${n===currentPage?"border-accent bg-accent text-white":"border-line text-ink-muted hover:bg-panel-hover"}`}>{n}</button>)}<button type="button" disabled={currentPage===pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted disabled:opacity-35"><ChevronRight size={17}/></button></div>}
    </section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2"><InfoCard icon={<Info size={22}/>} title="Leave Policy" tone="blue" text="Apply for leave in advance where possible. A reason is required for every request and approval is handled by your administrator."/><InfoCard icon={<Clock3 size={22}/>} title="Need Help?" tone="gold" text="For leave balance questions, urgent requests, or policy clarification, contact your administrator."/></section>
  </main>

  {showApply&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={()=>!loading&&setShowApply(false)}><div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-center justify-between border-b border-line px-6 py-5"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Leave Request</p><h2 className="mt-1 text-xl font-semibold">Apply for Leave</h2></div><button type="button" onClick={()=>setShowApply(false)} className="rounded-lg p-2 text-ink-muted hover:bg-panel-hover hover:text-ink"><X size={19}/></button></div><form onSubmit={submit} className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Leave Type"><select value={type} onChange={e=>setType(e.target.value)} className="input"><option>Sick Leave</option><option>Casual Leave</option><option>Emergency Leave</option><option>Other</option></select></Field><Field label="Duration"><select value={duration} onChange={e=>setDuration(e.target.value)} className="input"><option>Full Day</option><option>Half Day</option></select></Field></div>{duration==="Half Day"&&<Field label="Half Day"><select value={half} onChange={e=>setHalf(e.target.value)} className="input"><option>Morning</option><option>Afternoon</option></select></Field>}<Field label="Leave Date"><input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="input"/></Field><Field label="Reason"><textarea required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Please explain the reason for your leave..." rows={5} className="input resize-none"/></Field>{message&&<div className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink-muted">{message}</div>}<div className="flex justify-end gap-2 border-t border-line pt-5"><button type="button" onClick={()=>setShowApply(false)} className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-ink-muted hover:bg-panel-hover">Cancel</button><button type="submit" disabled={loading} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dim disabled:opacity-50">{loading?"Submitting...":"Submit Request"}</button></div></form></div></div>}
  {selected&&<RequestModal item={selected} onClose={()=>setSelected(null)}/>}</div>;
}

function BalanceCard({title,value,subtitle,tone,icon}:{title:string;value:string;subtitle:string;tone:"green"|"blue"|"orange";icon:React.ReactNode}){const styles={green:"border-present/40 text-present bg-present/5",blue:"border-sky-400/40 text-sky-500 bg-sky-400/5",orange:"border-orange-400/40 text-orange-500 bg-orange-400/5"}[tone];const iconStyles={green:"bg-present/10",blue:"bg-sky-400/10",orange:"bg-orange-400/10"}[tone];return <div className={`relative overflow-hidden rounded-2xl border p-6 ${styles}`}><div className="relative z-10"><p className="text-xs font-semibold tracking-wide">{title}</p><p className="mt-2 text-3xl font-semibold text-ink">{value}</p><p className="mt-1 text-xs text-ink-muted">{subtitle}</p></div><div className={`absolute right-6 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full ${iconStyles}`}>{icon}</div></div>}
function TypeIcon({type}:{type:string}){const icon=type==="Sick Leave"?<HeartPulse size={18}/>:type==="Casual Leave"?<BriefcaseBusiness size={18}/>:<CalendarDays size={18}/>;return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</span>}
function Status({status}:{status:LeaveRequest["status"]}){const cls=status==="Approved"?"bg-mint-soft text-present":status==="Rejected"?"bg-rose-soft text-absent":"bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300";return <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>}
function InfoCard({icon,title,text,tone}:{icon:React.ReactNode;title:string;text:string;tone:"blue"|"gold"}){return <div className={`rounded-2xl border ${tone==="blue"?"border-sky-400/40":"border-accent/40"} bg-panel p-5 shadow-sm`}><div className="flex items-start gap-4"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone==="blue"?"bg-sky-400/10 text-sky-500":"bg-accent-soft text-accent"}`}>{icon}</div><div><h3 className={`font-semibold ${tone==="blue"?"text-sky-500":"text-accent"}`}>{title}</h3><p className="mt-1 text-sm leading-6 text-ink-muted">{text}</p></div></div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="mb-1.5 block text-xs font-mono text-ink-muted">{label}</label>{children}</div>}
function RequestModal({item,onClose}:{item:LeaveRequest;onClose:()=>void}){return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Leave Request</p><h2 className="mt-1 text-xl font-semibold">{item.leave_type}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-ink-muted hover:bg-panel-hover"><X size={18}/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Date" value={formatDate(item.leave_date)}/><Detail label="Duration" value={`${item.duration}${item.half_day?` · ${item.half_day}`:""}`}/><Detail label="Status" value={item.status}/><Detail label="Request ID" value={item.leave_id}/></div><div className="mt-5 rounded-xl bg-bg p-4"><p className="text-xs font-mono text-ink-faint">REASON</p><p className="mt-2 text-sm leading-6 text-ink-muted">{item.reason}</p></div>{item.admin_note&&<div className="mt-4 rounded-xl bg-accent-soft p-4"><p className="text-xs font-mono text-accent">ADMIN NOTE</p><p className="mt-2 text-sm leading-6 text-ink-muted">{item.admin_note}</p></div>}</div></div>}
function Detail({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-line bg-bg p-3"><p className="text-[10px] font-mono text-ink-faint">{label}</p><p className="mt-1 truncate text-sm font-medium" title={value}>{value}</p></div>}
function formatDate(value:string){const date=new Date(`${value}T00:00:00`);if(Number.isNaN(date.getTime()))return value;return date.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
