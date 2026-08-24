import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Play, Trash2 } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";
import { emitNotification } from "../utils/notifications";

type Session={session_id:string;name:string;start_time:string;planned_start_time?:string;duration_minutes:number;late_after_minutes:number;overdue?:boolean};

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const formatDate=(v:string)=>new Date(v).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
const formatTime=(v:string)=>new Date(v).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});

export default function AdminSchedulePage(){
 const minDateTime=useMemo(()=>toLocalInputValue(new Date(Date.now()+60_000)),[]);
 const [sessions,setSessions]=useState<Session[]>([]),[name,setName]=useState(""),[start,setStart]=useState(""),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function load(){try{const r=await api.get("/session/scheduled");setSessions(r.data.sessions??[])}catch(e){console.error(e)}}
 useEffect(()=>{void load();const t=window.setInterval(()=>void load(),3000);return()=>window.clearInterval(t)},[]);
 const upcoming=sessions.filter(s=>!s.overdue).length,ready=sessions.filter(s=>s.overdue).length;
 const selectedTime=start?new Date(start).getTime():NaN;
 const isValidFutureTime=Number.isFinite(selectedTime)&&selectedTime>Date.now();

 async function schedule(){
   setError("");setMessage("");
   if(!start){setError("Choose a date and time first.");return}
   if(!isValidFutureTime){setError("You cannot schedule a session in the past. Please choose a future date and time.");return}
   setSaving(true);
   try{
     const response=await api.post("/session/schedule",{name:name.trim()||"Untitled Session",planned_start_time:start,duration_minutes:45,late_after_minutes:10});
     const planned=response.data?.planned_start_time||start;
     setName("");setStart("");setMessage("Session scheduled successfully.");
     emitNotification({id:`scheduled-${response.data?.session_id||Date.now()}`,title:"Session scheduled",text:`${name.trim()||"Untitled Session"} is scheduled for ${new Date(planned).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}.`,kind:"scheduled"});
     await load();
   }catch(e:any){setError(e?.response?.data?.detail??"Could not schedule the session.")}finally{setSaving(false)}
 }
 async function startNow(id:string){try{const session=sessions.find(item=>item.session_id===id);await api.post(`/session/start/${id}`);setMessage("Session started. The 45-minute timer begins now.");emitNotification({id:`live-${id}`,title:"AI session started",text:`${session?.name??"Attendance Session"} is now live and being monitored.`,kind:"live"});await load()}catch(e:any){setError(e?.response?.data?.detail??"Could not start this session.")}}
 async function cancel(id:string){try{const session=sessions.find(item=>item.session_id===id);await api.delete(`/session/scheduled/${id}`);setMessage("Scheduled session cancelled.");if(session)emitNotification({title:"Session cancelled",text:`${session.name} was cancelled.`,kind:"system"});await load()}catch(e:any){setError(e?.response?.data?.detail??"Could not cancel this session.")}}
 return <div className="min-h-screen bg-bg text-ink"><AdminSidebar/><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Schedule</h1><p className="mt-2 text-sm text-ink-muted">Plan your AI attendance sessions and start them whenever you are ready.</p>
 <section className="mt-6 overflow-visible rounded-2xl border border-line bg-panel shadow-sm"><div className="border-b border-line px-6 py-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-blue-soft p-3 text-blue"><CalendarClock size={20}/></div><div><h2 className="font-semibold">Schedule a session</h2><p className="mt-1 text-xs text-ink-muted">Set a planned date and time. The attendance timer starts only when you press Start.</p></div></div></div>
 <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_180px] lg:items-start">
  <label className="block"><span className="mb-2 block text-xs font-medium text-ink-muted">Session name <span className="font-normal text-ink-faint">(optional)</span></span><input value={name} onChange={e=>setName(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft" placeholder="e.g. Data Structures — Lecture 4"/><span className="mt-1.5 block text-[11px] text-ink-faint">Give it a name you will recognize later.</span></label>
  <label className="block"><span className="mb-2 block text-xs font-medium text-ink-muted">Date & time</span><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-faint" size={17}/><input type="datetime-local" min={minDateTime} value={start} onChange={e=>{setStart(e.target.value);setError("")}} className={`dark-datetime h-12 w-full rounded-xl border bg-bg py-3 pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-accent-soft ${start&&!isValidFutureTime?"border-absent focus:border-absent":"border-line focus:border-accent"}`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-faint">Future only</span></div><span className={`mt-1.5 block text-[11px] ${start&&!isValidFutureTime?"text-absent":"text-ink-faint"}`}>{start&&!isValidFutureTime?"This time has already passed. Choose a future time.":"Past dates and times are not allowed."}</span></label>
  <button onClick={schedule} disabled={!isValidFutureTime||saving} className="h-12 w-full self-start whitespace-nowrap rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 lg:mt-6">{saving?"Scheduling...":"Schedule Session"}</button>
 </div>{message&&<div className="mx-6 mb-6 flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-sm font-medium text-present"><CheckCircle2 size={16}/>{message}</div>}{error&&<div className="mx-6 mb-6 flex items-center gap-2 rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-absent"><AlertCircle size={16}/>{error}</div>}</section>
 <div className="mt-6 grid gap-4 sm:grid-cols-3"><Card label="Scheduled" value={upcoming} cls="bg-lavender-soft text-lavender"/><Card label="Ready to start" value={ready} cls="bg-peach-soft text-accent"/><Card label="Session length" value="45 min" cls="bg-sky-soft text-sky"/></div>
 <section className="mt-6 rounded-2xl border border-line bg-panel shadow-sm"><div className="flex items-center justify-between border-b border-line px-6 py-5"><div><h2 className="font-semibold">Scheduled Sessions</h2><p className="mt-1 text-xs text-ink-muted">Sessions remain here until you start or cancel them.</p></div><span className="rounded-full bg-blue-soft px-3 py-1 text-xs font-semibold text-blue">{sessions.length} total</span></div><div className="divide-y divide-line">{sessions.map(s=>{const planned=s.planned_start_time||s.start_time;return <div key={s.session_id} className="flex flex-col gap-5 px-6 py-5 transition hover:bg-panel-hover md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{s.name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.overdue?"bg-peach-soft text-accent":"bg-mint-soft text-present"}`}>{s.overdue?"READY TO START":"SCHEDULED"}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted"><span className="inline-flex items-center gap-1.5"><CalendarClock size={14}/>{formatDate(planned)}</span><span className="font-medium text-ink">{formatTime(planned)}</span><span>45 min</span></div><p className="mt-1.5 text-[11px] text-ink-faint">Present window: first {s.late_after_minutes} minutes · ID {s.session_id.slice(-6)}</p></div><div className="flex shrink-0 gap-2"><button onClick={()=>startNow(s.session_id)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"><Play size={15}/>Start</button><button onClick={()=>cancel(s.session_id)} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm hover:bg-rose-soft hover:text-absent"><Trash2 size={15}/>Cancel</button></div></div>})}{!sessions.length&&<div className="px-6 py-14 text-center"><CalendarClock className="mx-auto text-ink-faint" size={32}/><p className="mt-3 text-sm font-medium">No scheduled sessions</p><p className="mt-1 text-xs text-ink-muted">Create one above to see it here.</p></div>}</div></section></main></div>;
}
function Card({label,value,cls}:{label:string;value:number|string;cls:string}){return <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`inline-flex rounded-xl px-3 py-2 text-xs font-semibold ${cls}`}>{label}</div><p className="mt-3 text-2xl font-semibold">{value}</p></div>}
