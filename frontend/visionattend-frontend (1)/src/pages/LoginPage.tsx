import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, User, Lock, ScanFace } from "lucide-react";
import ViewfinderFrame from "../components/ViewfinderFrame";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const role = await login(username, password);
      navigate(role === "admin" ? "/admin" : "/student");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ?? "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Form panel (left) */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-block mb-10">
            <Logo size={26} />
          </Link>

          <h1 className="font-display text-3xl font-semibold mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            Log in to your VisionAttend AI account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-ink-muted mb-1.5">
                Username / Student ID
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  size={16}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-white border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all"
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
              {loading ? "Logging in..." : "Log in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-sm text-ink-muted mt-8 text-center">
            New student?{" "}
            <Link to="/signup" className="text-accent font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Branding panel (right) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-panel-dark items-center justify-center">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(217,154,76,0.30), transparent 55%), radial-gradient(circle at 80% 80%, rgba(217,154,76,0.18), transparent 50%)",
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
            Verified in a glance
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Face recognition and liveness detection confirm exactly who's
            present -- and exactly when.
          </p>
        </div>
      </div>
    </div>
  );
}