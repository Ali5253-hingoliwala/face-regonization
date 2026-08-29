import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "../api/client";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("error"); setMessage("This verification link is missing its token."); return; }
    api.get("/account/email/verify", { params: { token } })
      .then(() => { setState("success"); setMessage("Your email has been verified successfully."); })
      .catch((error: any) => { setState("error"); setMessage(error?.response?.data?.detail || "This verification link is invalid or expired."); });
  }, [params]);

  return <main className="min-h-screen bg-bg px-5 py-16 text-ink"><div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center"><div className="w-full rounded-3xl border border-line bg-panel p-8 text-center shadow-xl">
    {state === "loading" ? <Loader2 className="mx-auto animate-spin text-accent" size={48}/> : state === "success" ? <CheckCircle2 className="mx-auto text-present" size={52}/> : <XCircle className="mx-auto text-absent" size={52}/>} 
    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">VisionAttend · Email Security</p>
    <h1 className="mt-2 font-display text-3xl font-semibold">{state === "success" ? "Email verified" : state === "error" ? "Verification failed" : "Verifying email"}</h1>
    <p className="mt-3 text-sm leading-6 text-ink-muted">{message}</p>
    <Link to="/login" className="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white">Back to login</Link>
  </div></div></main>;
}
