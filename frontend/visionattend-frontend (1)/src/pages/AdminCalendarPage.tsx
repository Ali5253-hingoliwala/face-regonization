import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, CalendarDays } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

type Record = { student_id?: string; name?: string; status?: string; date?: string; time?: string; session_id?: string };

export default function AdminCalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [records, setRecords] = useState<Record[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), [month]);
  const first = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1).getDay(), [month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const requests = Array.from({ length: days }, (_, i) => {
        const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
        const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        return api.get(`/attendance/${date}`).then(r => r.data.records ?? []).catch(() => []);
      });
      const data = (await Promise.all(requests)).flat();
      if (!cancelled) setRecords(data);
    }
    void load();
    return () => { cancelled = true; };
  }, [month, days]);

  const byDate = useMemo(() => {
    const map: Record<string, Record[]> = {};
    for (const r of records) { if (!r.date) continue; (map[r.date] ??= []).push(r); }
    return map;
  }, [records]);

  const selectedRecords = selected ? byDate[selected] ?? [] : [];
  const monthName = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const cells = Array.from({ length: first + days }, (_, i) => i < first ? null : i - first + 1);

  return <div className="min-h-screen bg-bg text-ink"><AdminSidebar/><div className="lg:pl-64"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Attendance Calendar</h1><p className="mt-2 text-sm text-ink-muted">Browse attendance by date and inspect every recorded session.</p>
    <section className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex items-center justify-between"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className="rounded-xl border border-line p-2 hover:bg-panel-hover"><ChevronLeft size={18}/></button><div className="flex items-center gap-2"><CalendarDays className="text-accent" size={20}/><h2 className="font-semibold">{monthName}</h2></div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className="rounded-xl border border-line p-2 hover:bg-panel-hover"><ChevronRight size={18}/></button></div>
      <div className="mt-6 grid grid-cols-7 gap-2 text-center text-[11px] font-medium uppercase tracking-wider text-ink-faint">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="py-2">{d}</div>)}
        {cells.map((day,i)=>{if(!day)return <div key={`blank-${i}`}/>; const d=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const rs=byDate[d]??[]; const p=rs.filter(r=>r.status?.toLowerCase()==="present"||r.status?.toLowerCase()==="late").length; const a=rs.filter(r=>r.status?.toLowerCase()==="absent").length; return <button key={d} onClick={()=>setSelected(d)} className={`min-h-24 rounded-xl border p-2 text-left transition ${selected===d?"border-accent bg-accent-soft":"border-line bg-bg hover:bg-panel-hover"}`}><div className="flex justify-between"><span className="text-sm font-semibold">{day}</span>{rs.length>0&&<span className="text-[10px] text-accent">{rs.length}</span>}</div>{rs.length>0&&<div className="mt-4 space-y-1 text-[10px]"><div className="flex items-center gap-1 text-green-700"><CircleCheck size={11}/> {p} present</div><div className="flex items-center gap-1 text-red-600"><CircleX size={11}/> {a} absent</div></div>}</button>})}
      </div>
    </section>
    {selected&&<section className="mt-5 rounded-2xl border border-line bg-panel shadow-sm"><div className="border-b border-line px-6 py-5"><h2 className="font-semibold">{new Date(`${selected}T00:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</h2><p className="mt-1 text-xs text-ink-muted">{selectedRecords.length} attendance records</p></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{selectedRecords.map((r,i)=><div key={`${r.student_id}-${i}`} className="rounded-xl border border-line p-4"><p className="font-medium">{r.name}</p><p className="text-xs text-ink-muted">{r.student_id} · Session {r.session_id?.slice(-6) ?? "—"}</p><span className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{r.status}</span></div>)}{!selectedRecords.length&&<p className="text-sm text-ink-muted">No records for this date.</p>}</div></section>}
  </main></div></div>;
}
