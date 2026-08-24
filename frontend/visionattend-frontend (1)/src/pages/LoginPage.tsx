import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, User, Lock, ScanFace, Eye, EyeOff, Home } from "lucide-react";
import ViewfinderFrame from "../components/ViewfinderFrame";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err?.response?.data?.detail ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/"><Logo size={26} /></Link>
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted hover:bg-panel-hover hover:text-ink transition">
              <Home size={15} /> Back to Home
            </Link>
          </div>
          <h1 className="font-display text-3xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-ink-muted mb-8">Log in to your VisionAttend AI account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-ink-muted mb-1.5">Username / Student ID</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-white border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all" />
              </div>
            </div>
            <PasswordField label="Password" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />
            {error && <p className="text-sm text-absent bg-absent/5 border border-absent/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium py-2.5 rounded-lg shadow-sm hover:bg-accent-dim transition-all disabled:opacity-60">
              {loading ? "Logging in..." : "Log in"}{!loading && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="text-sm text-ink-muted mt-8 text-center">New student? <Link to="/signup" className="text-accent font-medium hover:underline">Sign up</Link></p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-panel-dark items-center justify-center">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(217,154,76,0.30), transparent 55%), radial-gradient(circle at 80% 80%, rgba(217,154,76,0.18), transparent 50%)" }} />
        <div className="relative z-10 flex flex-col items-center px-10 text-center">
          <div className="relative mb-8 animate-float"><ViewfinderFrame active cornerSize={22} className="relative w-40 h-40 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center"><div className="absolute inset-0 rounded-full border border-accent-glow/40 animate-pulse-ring" /><ScanFace className="text-accent-glow" size={56} strokeWidth={1.5} /></ViewfinderFrame></div>
          <h2 className="font-display text-2xl font-semibold text-white mb-3">Verified in a glance</h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">Face recognition and liveness detection confirm exactly who's present — and exactly when.</p>
        </div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void }) {
  return <div><label className="block text-xs font-mono text-ink-muted mb-1.5">{label}</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} /><input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} required className="w-full bg-white border border-line rounded-lg pl-9 pr-11 py-2.5 text-sm shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all" /><button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>;
}
