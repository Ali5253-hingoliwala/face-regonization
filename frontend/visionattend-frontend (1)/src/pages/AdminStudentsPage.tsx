import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/students").then((res) => setStudents(res.data.students ?? [])).catch(console.error);
  }, []);

  const filtered = students.filter((s) =>
    `${s.name} ${s.student_id}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg text-ink"><AdminSidebar />
      <div className="lg:pl-64"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Students</h1>
        <p className="mt-2 text-sm text-ink-muted">Registered students in VisionAttend AI.</p>
        <div className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <div className="relative"><Search className="absolute left-3 top-3 text-ink-faint" size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search students..." className="w-full rounded-xl border border-line bg-bg py-2.5 pl-10 pr-4 outline-none focus:border-accent"/></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{filtered.map((s)=><tr key={s.student_id} className="border-b border-line last:border-0"><td className="px-4 py-4 font-medium">{s.name}</td><td className="px-4 py-4 font-mono text-xs text-ink-muted">{s.student_id}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs text-accent"><Users size={13}/> Registered</span></td></tr>)}{!filtered.length&&<tr><td colSpan={3} className="px-4 py-12 text-center text-ink-muted">No students found.</td></tr>}</tbody></table></div>
        </div>
      </main></div>
    </div>
  );
}
