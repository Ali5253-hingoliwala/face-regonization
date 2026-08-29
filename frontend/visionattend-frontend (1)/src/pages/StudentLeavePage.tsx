import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ChevronDown, Clock3, Eye, HeartPulse, Plus, ShieldCheck, Sunrise, Sunset, X } from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";
import { api } from "../api/client";

type Balance = { entitlement: number; used: number; remaining: number };
type LeaveType = "Casual Leave" | "Earned Leave" | "Sick Leave" | "Emergency Leave";
type LeaveRequest = {
  leave_id: string;
  leave_type: string;
  duration: string;
  half_day?: string | null;
  leave_date?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_note?: string | null;
  created_at?: string;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return day && month && year ? `${day}-${month}-${year}` : value;
};

const daysBetween = (start: string, end: string) => {
  if (!start || !end || end < start) return 0;
  return Math.floor((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1;
};

const leaveMeta: Record<LeaveType, { icon: React.ReactNode; tone: "green" | "blue" | "orange" | "purple" }> = {
  "Casual Leave": { icon: <BriefcaseBusiness size={22} />, tone: "green" },
  "Earned Leave": { icon: <CalendarDays size={22} />, tone: "blue" },
  "Sick Leave": { icon: <HeartPulse size={22} />, tone: "orange" },
  "Emergency Leave": { icon: <ShieldCheck size={22} />, tone: "purple" },
};

const defaults: Record<string, Balance> = {
  "Casual Leave": { entitlement: 12, used: 0, remaining: 12 },
  "Earned Leave": { entitlement: 20, used: 0, remaining: 20 },
  "Sick Leave": { entitlement: 7, used: 0, remaining: 7 },
  "Emergency Leave": { entitlement: 5, used: 0, remaining: 5 },
};

export default function StudentLeavePage() {
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("Casual Leave");
  const [duration, setDuration] = useState<"Full Day" | "Half Day">("Full Day");
  const [halfDay, setHalfDay] = useState<"Morning" | "Afternoon">("Morning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const response = await api.get("/leave/mine");
      setRequests(response.data.requests ?? []);
      setBalances(response.data.balances ?? {});
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "Could not load leave information.");
    }
  };

  useEffect(() => { void loadData(); }, []);

  const selectedBalance = balances[leaveType] ?? defaults[leaveType];
  const fullDayAmount = duration === "Full Day" ? daysBetween(startDate, endDate) : 0.5;

  const cards = useMemo(() => (Object.keys(leaveMeta) as LeaveType[]).map((type) => ({
    type,
    ...leaveMeta[type],
    balance: balances[type] ?? defaults[type],
  })), [balances]);

  const openApply = () => {
    setLeaveType("Casual Leave");
    setDuration("Full Day");
    setHalfDay("Morning");
    setStartDate("");
    setEndDate("");
    setReason("");
    setMessage("");
    setError("");
    setShowApply(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const currentDay = today();

    if (duration === "Full Day") {
      if (!startDate || !endDate) {
        setError("Please select both a start date and an end date.");
        return;
      }
      if (startDate < currentDay) {
        setError("Leave cannot be requested for a past date.");
        return;
      }
      if (endDate < startDate) {
        setError("End date cannot be before the start date.");
        return;
      }
    }
    if (reason.trim().length < 8) {
      setError("Please provide a clear reason of at least 8 characters.");
      return;
    }
    const amount = duration === "Half Day" ? 0.5 : fullDayAmount;
    if (!amount) {
      setError("Please select a valid leave date range.");
      return;
    }
    if (selectedBalance.remaining < amount) {
      setError(`Insufficient ${leaveType} balance. You need ${amount:g} day(s), but only ${selectedBalance.remaining} remain.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/leave", {
        leave_type: leaveType,
        duration,
        half_day: duration === "Half Day" ? halfDay : null,
        leave_date: duration === "Half Day" ? currentDay : startDate,
        end_date: duration === "Half Day" ? currentDay : endDate,
        reason: reason.trim(),
      });
      await loadData();
      setShowApply(false);
      setMessage("Leave request submitted successfully. Your available balance has been updated.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Could not submit the leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <StudentSidebar />
      <main className="w-full px-5 py-8 sm:px-8 lg:px-10" style={{ marginLeft: "var(--portal-sidebar-offset,0px)", width: "calc(100% - var(--portal-sidebar-offset,0px))" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Student Portal</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">Leave Management</h1>
            <p className="mt-2 text-sm text-ink-muted">Manage your leave balance, apply for time off, and track every request.</p>
          </div>
          <button onClick={openApply} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-dim"><Plus size={18} /> Apply New Leave</button>
        </div>

        {message && <div className="mt-5 flex items-center justify-between rounded-xl border border-present/30 bg-mint-soft px-4 py-3 text-sm text-present"><span>{message}</span><button onClick={() => setMessage("")}><X size={16} /></button></div>}

        <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ type, icon, tone, balance }) => {
            const toneClass = { green: "border-present/35 bg-present/5", blue: "border-sky/35 bg-sky/5", orange: "border-orange-400/35 bg-orange-400/5", purple: "border-lavender/40 bg-lavender-soft/40" }[tone];
            const iconClass = { green: "bg-present/10 text-present", blue: "bg-sky/10 text-sky", orange: "bg-orange-400/10 text-orange-500", purple: "bg-lavender-soft text-lavender" }[tone];
            return <article key={type} className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${toneClass}`}><p className="text-xs font-semibold tracking-wide text-ink-muted">{type.toUpperCase()}</p><p className="mt-2 text-4xl font-semibold text-ink">{balance.remaining}<span className="ml-1 text-lg font-medium text-ink-muted">Days</span></p><p className="mt-2 text-xs text-ink-muted">Used: {balance.used} days this year</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-bg"><div className={`h-full rounded-full ${iconClass.split(" ")[1] ?? "bg-accent"}`} style={{ width: `${Math.min(100, (balance.used / Math.max(1, balance.entitlement)) * 100)}%` }} /></div><p className="mt-2 text-[11px] text-ink-faint">{balance.remaining} of {balance.entitlement} days available</p><div className={`absolute right-5 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full ${iconClass}`}>{icon}</div></article>;
          })}
        </section>

        <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="flex flex-col gap-2 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Leave History</p><h2 className="mt-1 text-xl font-semibold">My Leave Requests</h2><p className="mt-1 text-xs text-ink-muted">Every request, date range, reason, and administrator decision is shown here.</p></div><span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{requests.length} request{requests.length === 1 ? "" : "s"}</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-line bg-panel-hover text-[10px] font-mono uppercase tracking-wide text-ink-faint"><tr><th className="px-5 py-4">Leave Type</th><th className="px-5 py-4">Start Date</th><th className="px-5 py-4">End Date</th><th className="px-5 py-4">Duration</th><th className="px-5 py-4">Reason</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Admin Note</th><th className="px-5 py-4">Applied On</th></tr></thead><tbody>
            {requests.length ? requests.map(item => { const amount = Number(item.amount ?? (item.duration === "Half Day" ? 0.5 : daysBetween(item.start_date ?? item.leave_date ?? "", item.end_date ?? item.leave_date ?? ""))); return <tr key={item.leave_id} className="border-b border-line last:border-0 hover:bg-panel-hover/60"><td className="px-5 py-4"><div className="flex items-center gap-2"><TypeIcon type={item.leave_type}/><div><p className="font-semibold">{item.leave_type}</p>{item.half_day && <span className="mt-1 inline-flex rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{item.half_day}</span>}</div></div></td><td className="px-5 py-4 whitespace-nowrap text-ink-muted">{formatDate(item.start_date ?? item.leave_date)}</td><td className="px-5 py-4 whitespace-nowrap text-ink-muted">{formatDate(item.end_date ?? item.leave_date)}</td><td className="px-5 py-4 whitespace-nowrap font-medium">{amount} {amount === 1 ? "Day" : "Days"}</td><td className="max-w-[260px] px-5 py-4 text-ink-muted"><span className="block truncate" title={item.reason}>{item.reason}</span></td><td className="px-5 py-4"><Status status={item.status}/></td><td className="max-w-[220px] px-5 py-4 text-ink-muted"><span className="block truncate" title={item.admin_note ?? ""}>{item.admin_note || "—"}</span></td><td className="px-5 py-4 whitespace-nowrap text-ink-muted">{formatDate(item.created_at)}</td></tr>; }) : <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><CalendarDays size={25}/></div><p className="mt-4 font-semibold">No leave history yet</p><p className="mt-1 text-sm text-ink-muted">Your submitted requests will appear here with their approval status.</p></td></tr>}
          </tbody></table></div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2"><InfoCard icon={<Clock3 size={21}/>} title="Leave Policy" text="Full-day leave can cover today or future dates. Half-day leave is restricted to today and uses 0.5 day from your balance."/><InfoCard icon={<ShieldCheck size={21}/>} title="Administrator Review" text="Requests are pending until an administrator approves or rejects them. Rejected requests return their reserved balance."/></section>
      </main>

      {showApply && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => !submitting && setShowApply(false)}><div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl items-center justify-center py-4"><div className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl" onMouseDown={e => e.stopPropagation()}><div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-5"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Leave Request</p><h2 className="mt-1 text-2xl font-semibold">Apply for Leave</h2><p className="mt-1 text-sm text-ink-muted">Choose your leave type and date range.</p></div><button onClick={() => setShowApply(false)} className="rounded-xl p-2 text-ink-muted hover:bg-panel-hover"><X size={20}/></button></div><form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="grid gap-5 md:grid-cols-2"><Field label="Leave Type"><div className="relative"><select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="w-full appearance-none rounded-xl border border-line bg-bg px-4 py-3.5 pr-10 text-sm font-medium outline-none focus:border-accent">{(Object.keys(leaveMeta) as LeaveType[]).map(type => <option key={type}>{type}</option>)}</select><ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"/></div></Field><Field label="Available Balance"><div className="rounded-xl border border-line bg-bg px-4 py-3.5"><p className="text-xs text-ink-muted">Remaining for {leaveType}</p><p className="mt-1 text-2xl font-semibold text-accent">{selectedBalance.remaining} days</p></div></Field></div>
        <div className="mt-6"><label className="mb-2 block text-sm font-medium">Request Type</label><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setDuration("Full Day")} className={`rounded-2xl border p-4 text-left transition ${duration === "Full Day" ? "border-accent bg-accent-soft" : "border-line bg-bg hover:bg-panel-hover"}`}><div className="flex items-center gap-3"><CalendarDays size={22} className={duration === "Full Day" ? "text-accent" : "text-ink-muted"}/><div><p className="font-semibold">Full Day</p><p className="mt-1 text-xs text-ink-muted">Choose a start and end date</p></div></div></button><button type="button" onClick={() => setDuration("Half Day")} className={`rounded-2xl border p-4 text-left transition ${duration === "Half Day" ? "border-accent bg-accent-soft" : "border-line bg-bg hover:bg-panel-hover"}`}><div className="flex items-center gap-3"><Clock3 size={22} className={duration === "Half Day" ? "text-accent" : "text-ink-muted"}/><div><p className="font-semibold">Half Day</p><p className="mt-1 text-xs text-ink-muted">Today only · 0.5 day</p></div></div></button></div></div>
        {duration === "Full Day" ? <div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Start Date"><input required type="date" min={today()} value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} className="w-full rounded-xl border border-line bg-bg px-4 py-3.5 text-sm outline-none focus:border-accent"/></Field><Field label="End Date"><input required type="date" min={startDate || today()} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3.5 text-sm outline-none focus:border-accent"/></Field></div> : <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft p-5"><div className="flex items-center justify-between"><div><p className="font-semibold text-accent">Half-day leave · Today</p><p className="mt-1 text-sm text-ink-muted">{formatDate(today())} · select one half.</p></div><span className="rounded-lg bg-panel px-3 py-1.5 text-xs font-semibold text-accent">0.5 Day</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setHalfDay("Morning")} className={`flex items-center gap-3 rounded-xl border p-4 transition ${halfDay === "Morning" ? "border-accent bg-panel" : "border-line bg-bg"}`}><Sunrise size={22} className={halfDay === "Morning" ? "text-accent" : "text-ink-muted"}/><div className="text-left"><p className="font-medium">Morning</p><p className="text-xs text-ink-muted">First half</p></div></button><button type="button" onClick={() => setHalfDay("Afternoon")} className={`flex items-center gap-3 rounded-xl border p-4 transition ${halfDay === "Afternoon" ? "border-accent bg-panel" : "border-line bg-bg"}`}><Sunset size={22} className={halfDay === "Afternoon" ? "text-accent" : "text-ink-muted"}/><div className="text-left"><p className="font-medium">Afternoon</p><p className="text-xs text-ink-muted">Second half</p></div></button></div></div>}
        {duration === "Full Day" && startDate && endDate && endDate >= startDate && <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm"><span className="font-semibold text-accent">{fullDayAmount} {fullDayAmount === 1 ? "day" : "days"}</span><span className="ml-2 text-ink-muted">will be reserved from your {leaveType} balance.</span></div>}
        <div className="mt-6 rounded-2xl border border-line bg-bg p-5"><div className="flex items-center justify-between"><div><label className="text-sm font-semibold">Reason for Leave</label><p className="mt-1 text-xs text-ink-muted">Required for administrator review.</p></div><span className="text-xs text-ink-faint">{reason.length}/500</span></div><textarea required minLength={8} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} rows={5} placeholder="Explain the reason for your leave..." className="mt-4 w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"/></div>
        {error && <div className="mt-5 rounded-xl border border-absent/30 bg-rose-soft px-4 py-3 text-sm text-absent">{error}</div>}
        <div className="mt-6 flex justify-end gap-3 border-t border-line pt-5"><button type="button" onClick={() => setShowApply(false)} className="rounded-xl border border-line px-5 py-3 text-sm font-medium text-ink-muted hover:bg-panel-hover">Cancel</button><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dim disabled:opacity-50">{submitting ? "Submitting..." : "Submit Request"}</button></div>
      </form></div></div></div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-2 block text-sm font-medium">{label}</label>{children}</div>; }
function TypeIcon({ type }: { type: string }) { const Icon = type === "Sick Leave" ? HeartPulse : type === "Emergency Leave" ? ShieldCheck : type === "Earned Leave" ? CalendarDays : BriefcaseBusiness; return <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={17}/></span>; }
function Status({ status }: { status: LeaveRequest["status"] }) { const cls = status === "Approved" ? "bg-mint-soft text-present" : status === "Rejected" ? "bg-rose-soft text-absent" : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}>{status}</span>; }
function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{text}</p></div></div></section>; }
