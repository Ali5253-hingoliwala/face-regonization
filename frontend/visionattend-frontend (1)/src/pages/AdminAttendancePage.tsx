import { useEffect, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

export default function AdminAttendancePage(){
 const [records,setRecords]=useState<any[]>([]);
 useEffect(()=>{api.get("/attendance/today").then(r=>setRecords(r.data.records??[])).catch(console.error)},[]);
 return <div className="min-h-screen bg-bg text-ink"><AdminSidebar/><div className="lg:pl-64"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Attendance</h1><p className="mt-2 text-sm text-ink-muted">Today's attendance records.</p><div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">ID</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Time</th></tr></thead><tbody>{records.map((r,i)=><tr key={`${r.student_id}-${i}`} className="border-b border-line last:border-0"><td className="px-5 py-4 font-medium">{r.name}</td><td className="px-5 py-4 text-ink-muted">{r.student_id}</td><td className="px-5 py-4"><span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{r.status}</span></td><td className="px-5 py-4 text-ink-muted">{r.time??"—"}</td></tr>)}{!records.length&&<tr><td colSpan={4} className="px-5 py-12 text-center text-ink-muted">No attendance records today.</td></tr>}</tbody></table></div></main></div></div>
}
