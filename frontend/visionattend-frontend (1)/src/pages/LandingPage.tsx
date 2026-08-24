import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, ScanFace, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";

const panels = [
  { id: "features", title: "Features", text: "AI face recognition, liveness detection, session-based attendance and automatic Present, Late or Absent tracking.", icon: ScanFace },
  { id: "how", title: "How it works", text: "Schedule a lecture, start the AI session, verify each real face, and let VisionAttend record attendance automatically.", icon: ShieldCheck },
];

const faceRecognitionImage = "https://blog.truora.com/hubfs/biometria%20facial.jpg";

const networkBackground = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'%3E%3Crect width='800' height='800' fill='%230b2236'/%3E%3Cg fill='none' stroke='%23c89432' stroke-width='2' opacity='.72'%3E%3Cpath d='M0 80L130 170 250 35 390 150 520 70 700 170 800 90M20 330L160 220 290 360 430 250 570 390 720 280 800 360M0 610L120 500 270 650 420 530 560 680 700 560 800 650M100 800L180 650 330 780 470 640 610 790 760 650 800 690M130 170L160 220 250 35 290 360 390 150 430 250 520 70 570 390 700 170 720 280M120 500L160 220 290 360 270 650 430 250 420 530 570 390 560 680 720 280 700 560'/%3E%3C/g%3E%3Cg fill='%23d6a13d'%3E%3Ccircle cx='130' cy='170' r='6'/%3E%3Ccircle cx='250' cy='35' r='6'/%3E%3Ccircle cx='390' cy='150' r='6'/%3E%3Ccircle cx='520' cy='70' r='6'/%3E%3Ccircle cx='290' cy='360' r='6'/%3E%3Ccircle cx='430' cy='250' r='6'/%3E%3Ccircle cx='570' cy='390' r='6'/%3E%3Ccircle cx='270' cy='650' r='6'/%3E%3Ccircle cx='420' cy='530' r='6'/%3E%3Ccircle cx='560' cy='680' r='6'/%3E%3C/g%3E%3C/svg%3E`;

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
                  {active.id === "features" && <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini title="Face Recognition"/><Mini title="Liveness"/><Mini title="Session Tracking"/></div>}
                  {active.id === "how" && <div className="mt-5 grid gap-3 sm:grid-cols-4"><Mini title="01 Schedule"/><Mini title="02 Verify"/><Mini title="03 Detect"/><Mini title="04 Record"/></div>}
                </div>
              )}
            </section>
            <section className="relative flex items-center justify-center border-t border-line bg-panel-hover p-8 md:border-l md:border-t-0">
              <div className="relative h-72 w-72 overflow-hidden rounded-3xl border border-accent/20 bg-[#0b2236] shadow-lg sm:h-80 sm:w-80">
                <div className="absolute inset-0 bg-cover bg-center opacity-95" style={{ backgroundImage: `url("${faceRecognitionImage}")` }} />
                <div className="absolute inset-0 bg-cover bg-center mix-blend-screen opacity-70" style={{ backgroundImage: `url("${networkBackground}")` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#061522]/80 via-transparent to-transparent" />
                <div className="absolute left-7 right-7 top-7 bottom-7 border border-white/70 rounded-sm pointer-events-none" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between font-mono text-[10px] text-white drop-shadow">
                  <span>VISIONATTEND AI</span><span className="text-emerald-300">LIVE READY</span>
                </div>
              </div>
              <div className="absolute bottom-8 right-8 rounded-xl border border-line bg-panel p-3 shadow-sm"><BarChart3 size={18} className="text-accent"/></div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Mini({ title }: { title: string }) { return <div className="rounded-xl border border-line bg-panel p-3 text-xs font-medium">{title}</div>; }
