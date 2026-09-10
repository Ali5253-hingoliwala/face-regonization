import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, SearchX } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-line bg-panel shadow-lg text-accent">
          <SearchX size={36} strokeWidth={2.2} />
        </div>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.22em] text-accent">VisionAttend · Error 404</p>
        <h1 className="mt-3 font-display text-6xl font-semibold sm:text-7xl">404</h1>
        <h2 className="mt-3 text-2xl font-semibold">Page not found</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
          The page you’re looking for doesn’t exist, may have moved, or the address may be incorrect.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-panel-hover">
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
            <Home size={16} /> Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
