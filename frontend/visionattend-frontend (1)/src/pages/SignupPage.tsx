import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Hash, Lock, ScanFace } from "lucide-react";
import ViewfinderFrame from "../components/ViewfinderFrame";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signup(studentId, password);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Something went wrong. Check your student ID and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-panel-dark items-center justify-center">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 75%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 20%, rgba(56,189,248,0.2), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center px-10 text-center">
          <div className="relative mb-8 animate-float">
            <div className="absolute inset-0 rounded-full bg-accent-glow/30 blur-2xl scale-150" />
            <ViewfinderFrame
              active
              cornerSize={22}
              className="relative w-40 h-40 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full border border-accent-glow/40 animate-pulse-ring" />
              <ScanFace className="text-accent-glow" size={56} strokeWidth={1.5} />
            </ViewfinderFrame>
          </div>

          <h2 className="font-display text-2xl font-semibold text-white mb-3">
            One face, one record
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Link your login to the face already registered under your
            student ID -- nothing else is needed.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-block mb-10">
            <Logo size={26} />
          </Link>

          <h1 className="font-display text-2xl font-semibold mb-1">
            Create your account
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            Use the same student ID your face was registered under.
          </p>

          {success ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="text-present mb-3" size={36} />
              <p className="text-sm text-ink-muted">
                Account created. Taking you to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-ink-muted mb-1.5">
                  Student ID
                </label>
                <div className="relative">
                  <Hash
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    size={16}
                  />
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    placeholder="e.g. CW001"
                    className="w-full bg-white border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all placeholder:text-ink-faint"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-muted mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    size={16}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-muted mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    size={16}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-white border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-absent bg-absent/5 border border-absent/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium py-2.5 rounded-lg shadow-sm shadow-accent/20 hover:bg-accent-dim hover:shadow-md transition-all disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          {!success && (
            <p className="text-sm text-ink-muted mt-8 text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
