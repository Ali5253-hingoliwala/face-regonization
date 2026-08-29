import { useEffect, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { api } from "../api/client";
import { LockKeyhole, MailCheck, ShieldCheck, Smartphone, Globe2, Clock3, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SecurityPage() {
  const [security, setSecurity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });

  const load = async () => {
    try { const { data } = await api.get("/account/security"); setSecurity(data); }
    catch (e: any) { setError(e.response?.data?.detail || "Unable to load security settings."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setMessage(""); setError("");
    try { await api.put("/account/password", passwords); setPasswords({ current_password: "", new_password: "", confirm_password: "" }); setMessage("Password changed successfully."); }
    catch (e: any) { setError(e.response?.data?.detail || "Unable to change password."); }
  };

  const toggle2FA = async () => {
    setMessage(""); setError("");
    try { const enabled = !!security?.two_factor_enabled; await api.post(enabled ? "/account/2fa/disable" : "/account/2fa/enable"); await load(); setMessage(enabled ? "2FA disabled." : "2FA enabled."); }
    catch (e: any) { setError(e.response?.data?.detail || "Unable to update 2FA."); }
  };

  if (loading) return <main className="mx-auto max-w-5xl p-6"><div className="rounded-2xl border border-line bg-panel p-8 text-ink-muted">Loading security settings…</div></main>;
  const Status = ({ ok, children }: { ok: boolean; children: ReactNode }) => <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{ok ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {children}</span>;
  return <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
    <div className="mb-7"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Account protection</p><h2 className="mt-2 font-display text-3xl font-bold">Security Center</h2><p className="mt-2 max-w-2xl text-sm text-ink-muted">Manage your password and account authentication settings.</p></div>
    {message && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div>}
    {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-2xl border border-line bg-panel p-5"><MailCheck className="text-accent"/><p className="mt-4 text-sm font-semibold">Email verification</p><div className="mt-3"><Status ok={!!security?.email_verified}>{security?.email_verified ? "Verified" : "Not verified"}</Status></div></div>
      <div className="rounded-2xl border border-line bg-panel p-5"><Globe2 className="text-accent"/><p className="mt-4 text-sm font-semibold">Google account</p><div className="mt-3"><Status ok={!!security?.google_linked}>{security?.google_linked ? "Linked" : "Not linked"}</Status></div></div>
      <div className="rounded-2xl border border-line bg-panel p-5"><Smartphone className="text-accent"/><p className="mt-4 text-sm font-semibold">Two-factor authentication</p><div className="mt-3"><Status ok={!!security?.two_factor_enabled}>{security?.two_factor_enabled ? "Enabled" : "Disabled"}</Status></div><button onClick={toggle2FA} className="mt-4 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">{security?.two_factor_enabled ? "Disable 2FA" : "Enable 2FA"}</button></div>
    </section>
    <section className="mt-4 rounded-2xl border border-line bg-panel p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><LockKeyhole size={19}/></div><div><h3 className="font-semibold">Change password</h3><p className="text-xs text-ink-muted">Use a strong password you do not reuse elsewhere.</p></div></div><form onSubmit={changePassword} className="mt-6 grid gap-4 sm:grid-cols-3"><input type="password" required placeholder="Current password" value={passwords.current_password} onChange={e => setPasswords(p => ({...p,current_password:e.target.value}))} className="rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"/><input type="password" required minLength={6} placeholder="New password" value={passwords.new_password} onChange={e => setPasswords(p => ({...p,new_password:e.target.value}))} className="rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"/><input type="password" required minLength={6} placeholder="Confirm new password" value={passwords.confirm_password} onChange={e => setPasswords(p => ({...p,confirm_password:e.target.value}))} className="rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent sm:col-span-3"/><button className="w-fit rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white">Update password</button></form></section>
    <section className="mt-4 rounded-2xl border border-line bg-panel p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-accent"/><div><h3 className="font-semibold">Account status</h3><p className="text-sm text-ink-muted">Authentication provider: <span className="font-medium text-ink">{security?.auth_provider || "local"}</span></p></div></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-muted"><span className="inline-flex items-center gap-1.5"><Clock3 size={14}/>Last login: {security?.last_login ? new Date(security.last_login).toLocaleString() : "Not available"}</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14}/>Account active: {security?.active ? "Yes" : "No"}</span></div></section>
  </main>;
}
