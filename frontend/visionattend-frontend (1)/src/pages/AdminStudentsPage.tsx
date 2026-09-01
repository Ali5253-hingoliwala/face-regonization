import { useEffect, useState } from "react";
import { CheckCircle2, Search, Trash2, Users, Mail, UserRound } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

type Student = { student_id: string; username?: string; name: string; email?: string | null; gender?: string | null; email_verified?: boolean; auth_provider?: string };

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await api.get("/admin/students");
      setStudents(response.data.students ?? []);
      setError("");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not load students.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function removeStudent(student: Student) {
    const confirmed = window.confirm(`Delete ${student.name} (${student.student_id})? Their attendance history will be preserved.`);
    if (!confirmed) return;
    setDeleting(student.student_id); setError(""); setMessage("");
    try {
      await api.delete(`/students/${student.student_id}`);
      setMessage(`${student.name} was removed from the active student registry.`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not delete student.");
    } finally { setDeleting(""); }
  }

  const filtered = students.filter((student) => `${student.name} ${student.student_id} ${student.email ?? ""} ${student.gender ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const genderLabel = (gender?: string | null) => !gender ? "Not set" : gender === "prefer not to say" ? "Prefer not to say" : gender.charAt(0).toUpperCase() + gender.slice(1);

  return <div className="min-h-screen bg-bg text-ink">
    <AdminSidebar />
    <main className="w-full px-5 py-8 transition-[margin-left,width] duration-300 sm:px-8 lg:px-10" style={{marginLeft:"var(--portal-sidebar-offset,0px)",width:"calc(100% - var(--portal-sidebar-offset,0px))"}}>
      <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p><h1 className="mt-1 font-display text-3xl font-semibold">Students</h1><p className="mt-2 text-sm text-ink-muted">View and manage students registered through the student signup portal.</p></div>
      {message && <p className="mt-5 flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-sm font-medium text-present"><CheckCircle2 size={17}/>{message}</p>}
      {error && <p className="mt-5 rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-absent">{error}</p>}
      <div className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-sm">
        <div className="relative"><Search className="absolute left-3 top-3 text-ink-faint" size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, ID, email or gender..." className="w-full rounded-xl border border-line bg-bg py-2.5 pl-10 pr-4 outline-none focus:border-accent"/></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Face</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted">Loading students...</td></tr> : filtered.length ? filtered.map(student => <tr key={student.student_id} className="border-b border-line last:border-0 hover:bg-panel-hover">
            <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><UserRound size={16}/></span><div><p className="font-medium">{student.name}</p><p className="text-[11px] text-ink-faint">Username: {student.username || student.student_id}</p></div></div></td>
            <td className="px-4 py-4 font-mono text-xs text-ink-muted">{student.student_id}</td>
            <td className="px-4 py-4"><div className="flex items-center gap-2 text-ink-muted"><Mail size={14}/><span>{student.email || "Not provided"}</span>{student.email_verified && <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[9px] font-semibold text-present">Verified</span>}</div></td>
            <td className="px-4 py-4 text-ink-muted">{genderLabel(student.gender)}</td>
            <td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1 text-xs font-semibold text-present"><Users size={13}/> Registered</span></td>
            <td className="px-4 py-4 text-right"><button onClick={()=>removeStudent(student)} disabled={deleting===student.student_id} title="Delete student" className="rounded-lg p-2 text-ink-muted hover:bg-rose-soft hover:text-absent disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={17}/></button></td>
          </tr>) : <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted">No students found.</td></tr>}</tbody>
        </table></div>
      </div>
    </main>
  </div>;
}
