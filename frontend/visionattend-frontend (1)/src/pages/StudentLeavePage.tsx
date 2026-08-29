import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ChevronDown, Clock3, HeartPulse, Plus, ShieldCheck, Sunrise, Sunset, X } from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";
import { api } from "../api/client";

type Balance = { entitlement: number; used: number; remaining: number };
type BalanceResponse = { balances: Record<string, Balance> };
type LeaveType = "Casual Leave" | "Earned Leave" | "Sick Leave" | "Emergency Leave";

// Use the browser's local calendar date instead of UTC so half-day requests
// stay aligned with the student's actual day.
const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [showApply, setShowApply] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("Casual Leave");
  const [duration, setDuration] = useState<"Full Day" | "Half Day">("Full Day");
  const [halfDay, setHalfDay] = useState<"Morning" | "Afternoon">("Morning");
  const [leaveDate, setLeaveDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBalance = async () => {
    try {
      const response = await api.get<BalanceResponse>("/leave/balance");
      setBalances(response.data.balances ?? {});
    } catch {
      setBalances({});
    }
  };

  useEffect(() => { void loadBalance(); }, []);

  const selectedBalance = balances[leaveType] ?? defaults[leaveType];

  const cards = useMemo(() => (Object.keys(leaveMeta) as LeaveType[]).map((type) => ({
    type,
    ...leaveMeta[type],
    balance: balances[type] ?? defaults[type],
  })), [balances]);

  const openApply = () => {
    setLeaveType("Casual Leave");
    setDuration("Full Day");
    setHalfDay("Morning");
    setLeaveDate("");
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

    if (duration === "Full Day" && !leaveDate) {
      setError("Please select a leave date.");
      return;
    }
    if (duration === "Full Day" && leaveDate < currentDay) {
      setError("Full-day leave cannot be requested for a past date.");
      return;
    }
    if (reason.trim().length < 8) {
      setError("Please provide a clear reason of at least 8 characters.");
      return;
    }

    const amount = duration === "Half Day" ? 0.5 : 1;
    if (selectedBalance.remaining < amount) {
      setError(`Insufficient ${leaveType} balance. You have ${selectedBalance.remaining} day(s) remaining.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/leave", {
        leave_type: leaveType,
        duration,
        half_day: duration === "Half Day" ? halfDay : null,
        // Half-day requests deliberately have no editable date: they are for today.
        leave_date: duration === "Half Day" ? currentDay : leaveDate,
        reason: reason.trim(),
      });
      if (response.data?.balances) setBalances(response.data.balances);
      else await loadBalance();
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
            <p className="mt-2 text-sm text-ink-muted">Check your available leave balance and apply when you need time off.</p>
          </div>
          <button onClick={openApply} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-dim">
            <Plus size={18} /> Apply New Leave
          </button>
        </div>

        {message && <div className="mt-5 flex items-center justify-between rounded-xl border border-present/30 bg-mint-soft px-4 py-3 text-sm text-present"><span>{message}</span><button onClick={() => setMessage("")}><X size={16} /></button></div>}

        <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ type, icon, tone, balance }) => {
            const toneClass = {
              green: "border-present/35 bg-present/5",
              blue: "border-sky/35 bg-sky/5",
              orange: "border-orange-400/35 bg-orange-400/5",
              purple: "border-lavender/40 bg-lavender-soft/40",
            }[tone];
            const iconClass = {
              green: "bg-present/10 text-present",
              blue: "bg-sky/10 text-sky",
              orange: "bg-orange-400/10 text-orange-500",
              purple: "bg-lavender-soft text-lavender",
            }[tone];
            return (
              <article key={type} className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${toneClass}`}>
                <p className="text-xs font-semibold tracking-wide text-ink-muted">{type.toUpperCase()}</p>
                <p className="mt-2 text-4xl font-semibold text-ink">{balance.remaining}<span className="ml-1 text-lg font-medium text-ink-muted">Days</span></p>
                <p className="mt-2 text-xs text-ink-muted">Used: {balance.used} days this year</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg"><div className={`h-full rounded-full ${iconClass.split(" ")[1] ?? "bg-accent"}`} style={{ width: `${Math.min(100, (balance.used / Math.max(1, balance.entitlement)) * 100)}%` }} /></div>
                <p className="mt-2 text-[11px] text-ink-faint">{balance.remaining} of {balance.entitlement} days available</p>
                <div className={`absolute right-5 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
              </article>
            );
          })}
        </section>

        <section className="mt-7 rounded-2xl border border-line bg-panel p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><CalendarDays size={22} /></div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">How leave works</p>
              <h2 className="mt-1 text-xl font-semibold">Simple balance-first leave management</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">Your available balance is shown above. A full-day request uses one day, while a half-day request uses half a day and is restricted to today. Every request requires a reason and is sent to the administrator for review.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Guide icon={<CalendarDays size={19}/>} title="Full Day" text="Choose today or a future date for a complete day leave." />
            <Guide icon={<Sunrise size={19}/>} title="Half Day" text="For today only. Select Morning or Afternoon." />
            <Guide icon={<ShieldCheck size={19}/>} title="Admin Review" text="Your request is reviewed by the administrator." />
          </div>
        </section>
      </main>

      {showApply && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => !submitting && setShowApply(false)}>
          <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl items-center justify-center py-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-5">
                <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Leave Request</p><h2 className="mt-1 text-2xl font-semibold">Apply for Leave</h2><p className="mt-1 text-sm text-ink-muted">Choose your leave type and request format.</p></div>
                <button onClick={() => setShowApply(false)} className="rounded-xl p-2 text-ink-muted hover:bg-panel-hover"><X size={20}/></button>
              </div>
              <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Leave Type">
                    <div className="relative"><select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} className="w-full appearance-none rounded-xl border border-line bg-bg px-4 py-3.5 pr-10 text-sm font-medium outline-none focus:border-accent">{(Object.keys(leaveMeta) as LeaveType[]).map((type) => <option key={type}>{type}</option>)}</select><ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"/></div>
                  </Field>
                  <Field label="Available Balance">
                    <div className="rounded-xl border border-line bg-bg px-4 py-3.5"><p className="text-xs text-ink-muted">Remaining for {leaveType}</p><p className="mt-1 text-2xl font-semibold text-accent">{selectedBalance.remaining} days</p></div>
                  </Field>
                </div>

                <div className="mt-6"><label className="mb-2 block text-sm font-medium">Request Type</label><div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setDuration("Full Day")} className={`rounded-2xl border p-4 text-left transition ${duration === "Full Day" ? "border-accent bg-accent-soft" : "border-line bg-bg hover:bg-panel-hover"}`}><div className="flex items-center gap-3"><CalendarDays size={22} className={duration === "Full Day" ? "text-accent" : "text-ink-muted"}/><div><p className="font-semibold">Full Day</p><p className="mt-1 text-xs text-ink-muted">Complete day · today or future date</p></div></div></button>
                  <button type="button" onClick={() => setDuration("Half Day")} className={`rounded-2xl border p-4 text-left transition ${duration === "Half Day" ? "border-accent bg-accent-soft" : "border-line bg-bg hover:bg-panel-hover"}`}><div className="flex items-center gap-3"><Clock3 size={22} className={duration === "Half Day" ? "text-accent" : "text-ink-muted"}/><div><p className="font-semibold">Half Day</p><p className="mt-1 text-xs text-ink-muted">Today only · 0.5 day</p></div></div></button>
                </div></div>

                {duration === "Full Day" ? (
                  <div className="mt-6"><Field label="Leave Date"><input type="date" min={today()} value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3.5 text-sm outline-none focus:border-accent"/></Field></div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft p-5">
                    <div className="flex items-center justify-between"><div><p className="font-semibold text-accent">Half-day leave · Today</p><p className="mt-1 text-sm text-ink-muted">{today().split("-").reverse().join("-")} · select one half.</p></div><span className="rounded-lg bg-panel px-3 py-1.5 text-xs font-semibold text-accent">0.5 Day</span></div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={() => setHalfDay("Morning")} className={`flex items-center gap-3 rounded-xl border p-4 transition ${halfDay === "Morning" ? "border-accent bg-panel" : "border-line bg-bg"}`}><Sunrise size={22} className={halfDay === "Morning" ? "text-accent" : "text-ink-muted"}/><div className="text-left"><p className="font-medium">Morning</p><p className="text-xs text-ink-muted">First half</p></div></button>
                      <button type="button" onClick={() => setHalfDay("Afternoon")} className={`flex items-center gap-3 rounded-xl border p-4 transition ${halfDay === "Afternoon" ? "border-accent bg-panel" : "border-line bg-bg"}`}><Sunset size={22} className={halfDay === "Afternoon" ? "text-accent" : "text-ink-muted"}/><div className="text-left"><p className="font-medium">Afternoon</p><p className="text-xs text-ink-muted">Second half</p></div></button>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-line bg-bg p-5"><div className="flex items-center justify-between"><div><label className="text-sm font-semibold">Reason for Leave</label><p className="mt-1 text-xs text-ink-muted">This is required for administrator review.</p></div><span className="text-xs text-ink-faint">{reason.length}/500</span></div><textarea required minLength={8} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} rows={5} placeholder="Explain the reason for your leave..." className="mt-4 w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"/></div>

                {error && <div className="mt-5 rounded-xl border border-absent/30 bg-rose-soft px-4 py-3 text-sm text-absent">{error}</div>}
                <div className="mt-6 flex justify-end gap-3 border-t border-line pt-5"><button type="button" onClick={() => setShowApply(false)} className="rounded-xl border border-line px-5 py-3 text-sm font-medium text-ink-muted hover:bg-panel-hover">Cancel</button><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dim disabled:opacity-50">{submitting ? "Submitting..." : "Submit Request"}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-2 block text-sm font-medium">{label}</label>{children}</div>; }
function Guide({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-xl border border-line bg-bg p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</div><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{text}</p></div>; }
