import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../api/client";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Click the button below to verify your email address.");

  const verifyEmail = async () => {
    const token = params.get("token");

    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    setState("loading");
    setMessage("Verifying your email…");

    try {
      const { data } = await api.get("/account/email/verify", {
        params: { token },
      });
      setState("success");
      setMessage(data?.message || "Your email has been verified successfully.");
    } catch (error: any) {
      setState("error");
      setMessage(
        error?.response?.data?.detail ||
          "This verification link is invalid or expired."
      );
    }
  };

  return (
    <main className="min-h-screen bg-bg px-5 py-16 text-ink">
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-line bg-panel p-8 text-center shadow-xl">
          {state === "loading" ? (
            <Loader2 className="mx-auto animate-spin text-accent" size={52} />
          ) : state === "success" ? (
            <CheckCircle2 className="mx-auto text-present" size={52} />
          ) : state === "error" ? (
            <XCircle className="mx-auto text-absent" size={52} />
          ) : (
            <ShieldCheck className="mx-auto text-accent" size={52} />
          )}

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            VisionAttend · Email Security
          </p>

          <h1 className="mt-2 font-display text-3xl font-semibold">
            {state === "success"
              ? "Email verified"
              : state === "error"
                ? "Verification failed"
                : state === "loading"
                  ? "Verifying email"
                  : "Verify your email"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-ink-muted">{message}</p>

          {state === "idle" && (
            <button
              type="button"
              onClick={() => void verifyEmail()}
              className="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Verify my email
            </button>
          )}

          {state === "loading" && (
            <button
              type="button"
              disabled
              className="mt-7 inline-flex cursor-not-allowed rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white opacity-60"
            >
              Verifying…
            </button>
          )}

          {state === "success" && (
            <Link
              to="/login"
              className="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Continue to login
            </Link>
          )}

          {state === "error" && (
            <Link
              to="/login"
              className="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Back to login
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
