import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Save, UserRound } from "lucide-react";
import { api } from "../api/client";
import AdminSidebar from "../components/AdminSidebar";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { role, name, studentId } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState(name ?? "");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false); const [showNext, setShowNext] = useState(false); const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { api.get("/profile").then(r => setProfileName(r.data.name ?? "")).catch(() => {}); }, []);

  async function saveProfile() {
    setMessage("");
    try { await api.put("/profile", { name: profileName }); localStorage.setItem("va_name", profileName); setEditing(false); setMessage("Profile updated successfully."); }
    catch (e: any) { setMessage(e?.response?.data?.detail ?? "Could not update profile."); }
  }

  async function changePassword() {
    setMessage("");
    try { await api.put("/profile/password", { current_password: current, new_password: next, confirm_password: confirm }); setCurrent(""); setNext(""); setConfirm(""); setMessage("Password changed successfully."); }
    catch (e: any) { setMessage(e?.response?.data?.detail ?? "Could not change password."); }
  }

  const field = (value: string, setValue: (v:string)=>void, show:boolean, toggle:()=>void, placeholder:string) => <div className="relative"><input type={show ? "text" : "password"} value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-line bg-bg px-4 py-3 pr-11 text-sm outline-none focus:border-accent"/><button type="button" onClick={toggle} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-faint hover:text-ink">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>;

  return <div className="min-h-screen bg-bg text-ink"><AdminSidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)}/><div className="lg:pl-64"><main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><div className="mb-7"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Account</p><h1 className="mt-1 font-display text-3xl font-semibold">Profile</h1><p className="mt-2 text-sm text-ink-muted">Manage your personal details and account password.</p></div>
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-4 border-b border-line pb-5"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><UserRound size={25}/></div><div><h2 className="font-semibold">{profileName || "User"}</h2><p className="text-sm text-ink-muted">{role === "admin" ? "Administrator" : `Student${studentId ? ` · ${studentId}` : ""}`}</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-mono text-ink-muted">Name</label><input disabled={!editing} value={profileName} onChange={e=>setProfileName(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm disabled:opacity-70"/></div><div><label className="mb-1.5 block text-xs font-mono text-ink-muted">Username / Student ID</label><input disabled value={studentId ?? "Administrator"} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm opacity-70"/></div></div><div className="mt-5 flex gap-2">{editing ? <button onClick={saveProfile} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"><Save size={16}/> Save</button> : <button onClick={()=>setEditing(true)} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium"><Pencil size={16}/> Edit</button>}</div></section>
    <section className="mt-5 rounded-2xl border border-line bg-panel p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><KeyRound size={19}/></div><div><h2 className="font-semibold">Change password</h2><p className="text-xs text-ink-muted">Enter your current password before choosing a new one.</p></div></div><div className="mt-5 space-y-3">{field(current,setCurrent,showCurrent,()=>setShowCurrent(v=>!v,"Current password")} {field(next,setNext,showNext,()=>setShowNext(v=>!v,"New password")} {field(confirm,setConfirm,showConfirm,()=>setShowConfirm(v=>!v,"Confirm new password")}<button onClick={changePassword} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white"><KeyRound size={16}/> Change password</button></div></section>
    {message&&<div className="mt-4 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink-muted">{message}</div>}</main></div></div>;
}
