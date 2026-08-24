import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";

export default function Navbar({ activePanel, onPanelChange }: { activePanel?: string | null; onPanelChange?: (id: string | null) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = (id: string) => { onPanelChange?.(activePanel === id ? null : id); setMobileOpen(false); };

  return <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
      <Link to="/"><Logo size={26}/></Link>
      <nav className="hidden items-center gap-2 md:flex">
        <button onClick={() => toggle("features")} className={`rounded-lg px-4 py-2 text-sm transition ${activePanel === "features" ? "bg-accent text-white" : "text-ink-muted hover:bg-panel-hover hover:text-ink"}`}>Features</button>
        <button onClick={() => toggle("how")} className={`rounded-lg px-4 py-2 text-sm transition ${activePanel === "how" ? "bg-accent text-white" : "text-ink-muted hover:bg-panel-hover hover:text-ink"}`}>How it works</button>
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <Link to="/login" className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">Log in</Link>
        <Link to="/signup" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dim">Get Started</Link>
      </div>
      <button className="md:hidden" onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? <X size={22}/> : <Menu size={22}/>}</button>
    </div>
    {mobileOpen && <div className="border-t border-line bg-bg px-6 py-4 md:hidden"><div className="flex flex-col gap-2"><button onClick={() => toggle("features")} className="rounded-lg px-4 py-3 text-left text-sm hover:bg-panel-hover">Features</button><button onClick={() => toggle("how")} className="rounded-lg px-4 py-3 text-left text-sm hover:bg-panel-hover">How it works</button><Link to="/login" className="rounded-lg border border-line px-4 py-3 text-sm">Log in</Link><Link to="/signup" className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-white">Get Started</Link></div></div>}
  </header>;
}
