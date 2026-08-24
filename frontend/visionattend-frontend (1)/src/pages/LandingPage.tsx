import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ScanFace, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";

const panels = [
  { id: "features", title: "Features", text: "AI face recognition, liveness detection, session-based attendance and automatic Present, Late or Absent tracking.", icon: ScanFace },
  { id: "how", title: "How it works", text: "Schedule a lecture, start the AI session, verify each real face, and let VisionAttend record attendance automatically.", icon: ShieldCheck },
];

const faceRecognitionImage = "https://blog.truora.com/hubfs/biometria%20facial.jpg";
const networkBackground = "/images/image-1686134756-7294.jpg";

export default function LandingPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = panels.find(p => p.id === expanded);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar activePanel={expanded} onPanelChange={setExpanded} />
      <main className={`mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center px-6 py-8 transition-all duration-500 ${expanded ? "items-start pt-8" : ""}`}>
        <div className={`w-full overflow-hidden rounded-3xl border border-line bg-panel shadow-sm transition-all duration-500 ${expanded ? "min-h-[calc(100vh-112px)]" : "max-w-3xl mx-auto"}`}>
          <div className="grid min-h-[520px] md:grid-cols-[1.05fr_.95fr]">
            <section className="flex flex-col justify-center p-8 sm:p-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">AI attendance • verified</p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">Smart attendance.<br/>Powered by AI.</h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-ink-muted sm:text-base">VisionAttend recognizes students, confirms liveness and records attendance against every lecture session.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent-dim transition">Get Started <ArrowRight size={16}/></Link>
                <Link to="/login" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium hover:bg-panel-hover transition">Log in</Link>
              </div>
              {expanded && active && (
                <div className="mt-10 rounded-2xl border border-line bg-bg p-5 animate-in fade-in">
                  <div className="flex items-center gap-3"><active.icon size={20} className="text-accent"/><h2 className="font-display text-xl font-semibold">{active.title}</h2></div>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">{active.text}</p>
                </div>
              )}
            </section>
            <section className="relative flex items-center justify-center overflow-hidden border-t border-line bg-[#f4efe7] p-8 md:border-l md:border-t-0">
              <div className="absolute inset-0" style={{ backgroundImage: `url("${networkBackground}")`, backgroundRepeat: "repeat", backgroundSize: "300px 300px", backgroundPosition: "center center" }} />
              <div className="absolute inset-0 bg-[#f4efe7]/0" />
              <div className="relative z-10 h-72 w-72 overflow-hidden rounded-3xl border border-accent/20 bg-panel shadow-lg sm:h-80 sm:w-80">
                <img src={faceRecognitionImage} alt="AI face recognition scan" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute left-6 right-6 top-6 bottom-6 border border-white/80 rounded-sm pointer-events-none" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between font-mono text-[10px] text-white drop-shadow"><span>VISIONATTEND AI</span><span className="text-green-300">LIVE READY</span></div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
