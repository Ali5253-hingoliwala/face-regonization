import { useAuth } from "../context/AuthContext";

// Placeholder for Phase 2 -- real stats cards, session control,
// and charts get built here next. This just confirms auth +
// routing work end to end.
export default function AdminDashboardPage() {
  const { name, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg text-ink font-body px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-mono text-xs text-accent uppercase tracking-wider mb-1">
              Admin
            </p>
            <h1 className="font-display text-2xl font-semibold">
              Welcome{name ? `, ${name}` : ""}
            </h1>
          </div>
          <button
            onClick={logout}
            className="text-sm text-ink-muted hover:text-ink border border-line rounded-md px-4 py-2 transition-colors"
          >
            Log out
          </button>
        </div>

        <div className="bg-panel border border-line rounded-xl p-8 text-center text-ink-muted">
          Admin dashboard -- session control, stats, and charts land
          here in Phase 2.
        </div>
      </div>
    </div>
  );
}
