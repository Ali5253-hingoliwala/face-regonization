import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

const KEY = "va_signup_consent";
export type SignupConsent = { terms: boolean; privacy: boolean; biometric: boolean; attendance: boolean; acceptedAt: string };

export function getSignupConsent(): SignupConsent | null {
  try { const value = JSON.parse(localStorage.getItem(KEY) || "null"); return value?.terms && value?.privacy && value?.biometric && value?.attendance ? value : null; } catch { return null; }
}

export default function SignupConsentGate() {
  const [ready, setReady] = useState(!!getSignupConsent());
  const [terms, setTerms] = useState(false); const [privacy, setPrivacy] = useState(false); const [biometric, setBiometric] = useState(false); const [attendance, setAttendance] = useState(false);
  useEffect(()=>{ if (ready) return; },[ready]);
  function accept() { if (!terms||!privacy||!biometric||!attendance) return; localStorage.setItem(KEY,JSON.stringify({terms,privacy,biometric,attendance,acceptedAt:new Date().toISOString()})); setReady(true); }
  if (ready) return null;
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-line bg-panel p-6 shadow-2xl"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><ShieldCheck size={20}/></div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Before you register</p><h2 className="text-xl font-semibold">Legal & consent</h2></div></div><p className="mt-4 text-sm leading-6 text-ink-muted">Please review the information below before creating an account. Consent choices are recorded with a version and timestamp.</p><div className="mt-5 space-y-3"><Check checked={terms} setChecked={setTerms}>I agree to the <Link to="/terms" target="_blank" className="text-accent hover:underline">Terms & Conditions</Link>.</Check><Check checked={privacy} setChecked={setPrivacy}>I acknowledge the <Link to="/privacy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>.</Check><Check checked={biometric} setChecked={setBiometric}>I expressly consent to VisionAttend processing my face/biometric representation for the face-recognition attendance feature described in the Privacy Policy.</Check><Check checked={attendance} setChecked={setAttendance}>I consent to my attendance/session data being recorded and used for academic attendance administration.</Check></div><p className="mt-4 text-xs leading-5 text-ink-faint">You can request correction or deletion and ask the institution administering VisionAttend about withdrawal or alternative attendance procedures. Biometric processing should be reviewed by the deploying institution for its applicable legal basis and safeguards.</p><button disabled={!terms||!privacy||!biometric||!attendance} onClick={accept} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={17}/> Continue to signup</button></div></div>;
}
function Check({checked,setChecked,children}:{checked:boolean;setChecked:(v:boolean)=>void;children:React.ReactNode}) { return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg p-3"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-1 h-4 w-4"/><span className="text-sm leading-5 text-ink-muted">{children}</span></label>; }
