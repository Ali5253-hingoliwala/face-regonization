import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Github,
  HeartPulse,
  LockKeyhole,
  Menu,
  ScanFace,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const features = [
  { title: "AI Face Recognition", text: "Matches enrolled students in real time and keeps attendance tied to the right person.", icon: ScanFace },
  { title: "Liveness Detection", text: "Checks that a real person is present before attendance can be recorded, helping block simple photo and video spoofing.", icon: ShieldCheck },
  { title: "Continuous Presence", text: "Keeps monitoring the active session instead of treating one check-in as the whole story.", icon: Activity },
  { title: "Real-time Analytics", text: "Turns attendance records into clear dashboards so admins can spot patterns and missed sessions quickly.", icon: BarChart3 },
  { title: "Secure by Design", text: "Authentication, email verification, password recovery and account security are built into the platform.", icon: LockKeyhole },
  { title: "Leave Management", text: "Students can submit leave requests while admins review and manage them from the same portal.", icon: HeartPulse },
];

const steps = [
  { number: "01", title: "Register", text: "Create an account and enroll the student's face with the VisionAttend system." },
  { number: "02", title: "Schedule", text: "An admin creates a session and chooses when it should run and for how long." },
  { number: "03", title: "Verify", text: "The AI pipeline detects a face, checks liveness and matches the enrolled profile." },
  { number: "04", title: "Record", text: "Attendance is reflected in the dashboards and calendar for the session." },
];

const faqs = [
  { q: "What makes VisionAttend different from manual attendance?", a: "VisionAttend is designed around an actual camera-based attendance workflow: recognize the student, verify liveness, connect the result to a session and reflect it in the dashboard." },
  { q: "Can students fake attendance with a photo?", a: "The system includes liveness detection before recognition. It is designed to make basic photo or video spoofing harder, while deployments should still be tested and hardened for their own environment." },
  { q: "Who can use the platform?", a: "Admins manage students, sessions, attendance, schedules and leave. Students get their own dashboard for attendance, calendar, leave and account settings." },
  { q: "Is my account protected?", a: "VisionAttend includes bot protection, email verification, password recovery, two-factor authentication and security settings. Keep your deployment secrets private and follow the project's security guidance." },
];

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  function resetCookiePreferences() {
    localStorage.removeItem("va_cookie_preferences");
    window.location.reload();
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-nav">
          <Link to="/" className="landing-brand" onClick={closeMobile}>
            <span className="landing-brand-mark"><ScanFace size={21} /></span>
            VisionAttend
          </Link>

          <nav className={`landing-links ${mobileOpen ? "!flex fixed left-0 right-0 top-[74px] z-50 flex-col items-stretch bg-[#18343d] px-5 py-4 shadow-2xl" : ""}`}>
            <a href="#features" onClick={closeMobile}>Features</a>
            <a href="#how" onClick={closeMobile}>How it Works</a>
            <a href="#solution" onClick={closeMobile}>Problem &amp; Solution</a>
            <a href="#about" onClick={closeMobile}>About</a>
            <a href="#faqs" onClick={closeMobile}>FAQs</a>
            <a href="#contact" onClick={closeMobile}>Contact</a>
          </nav>

          <div className="landing-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">Log in</Link>
            <Link to="/signup" className="landing-btn landing-btn-primary">Sign up <ArrowRight size={15} /></Link>
            <button type="button" className="landing-mobile-menu landing-btn landing-btn-ghost" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-grid">
            <div>
              <span className="landing-eyebrow">AI attendance · built for real classrooms</span>
              <h1>Attendance, <em>reimagined.</em></h1>
              <p className="landing-lead">
                VisionAttend combines face recognition, liveness detection and session-based monitoring to answer one simple question: who is actually present?
              </p>
              <div className="landing-hero-actions">
                <Link to="/signup" className="landing-btn landing-btn-primary">Get started <ArrowRight size={17} /></Link>
                <Link to="/login" className="landing-btn landing-btn-ghost">Sign in to portal</Link>
              </div>
              <div className="landing-status"><span className="landing-pulse" /> AI pipeline ready · Admin &amp; Student portals connected</div>
            </div>

            <div className="landing-scan" aria-label="VisionAttend face recognition preview">
              <div className="landing-scan-grid" />
              <div className="landing-face-card">
                <div className="landing-face-outline"><span className="landing-face-nose" /><span className="landing-face-mouth" /></div>
                <span className="landing-scan-line" />
                <div className="landing-chip"><span>VISIONATTEND AI</span><span>LIVE · VERIFIED</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="solution" className="landing-section">
          <div className="landing-section-head">
            <span className="landing-eyebrow">The problem → the fix</span>
            <h2>Roll call doesn't scale. Faces do.</h2>
            <p>Manual attendance costs time, misses proxy check-ins and leaves admins cleaning up spreadsheets later. VisionAttend moves the process into one connected workflow.</p>
          </div>
          <div className="landing-problem-grid">
            <article className="landing-panel">
              <h3>Attendance, the old way</h3>
              <p>Too much depends on a person remembering, watching and recording everything correctly.</p>
              <ul className="landing-list">
                <li><X size={17} /> Manual roll calls consume class and meeting time.</li>
                <li><X size={17} /> Proxy sign-ins can go unnoticed.</li>
                <li><X size={17} /> Spreadsheets drift away from the actual session.</li>
                <li><X size={17} /> There is no clean live picture of the room.</li>
              </ul>
            </article>
            <article className="landing-panel solution">
              <h3>Attendance, with VisionAttend</h3>
              <p>One platform connects the camera, AI verification, sessions and dashboards.</p>
              <ul className="landing-list">
                <li><Check size={17} /> Face recognition connects attendance to enrolled students.</li>
                <li><Check size={17} /> Liveness verification adds protection against basic spoofing.</li>
                <li><Check size={17} /> Session records and attendance stay connected.</li>
                <li><Check size={17} /> Admin and student portals show the same source of truth.</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="features" className="landing-section theme-soft-surface">
          <div className="landing-section-head center">
            <span className="landing-eyebrow">Everything you need</span>
            <h2>Smart attendance without the clutter.</h2>
            <p>The existing VisionAttend feature set stays focused: recognition, security, sessions, analytics and account management working together.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ title, text, icon: Icon }) => (
              <article className="landing-feature" key={title}>
                <div className="landing-icon"><Icon size={22} strokeWidth={2.2} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="landing-section">
          <div className="landing-section-head center">
            <span className="landing-eyebrow">How it works</span>
            <h2>From face to dashboard in four steps.</h2>
            <p>A straightforward pipeline connects enrollment, scheduled sessions and the final attendance record.</p>
          </div>
          <div className="landing-step-grid">
            {steps.map(step => (
              <article className="landing-step" key={step.number}>
                <div className="landing-step-num">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="landing-section">
          <div className="landing-about">
            <div className="landing-about-copy">
              <span className="landing-eyebrow">About the project</span>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.15rem)] leading-tight">Built to make attendance honest again.</h2>
              <p>VisionAttend AI is a full-stack attendance project that brings the ML recognition pipeline, FastAPI backend and React portals together. Admins manage the academic workflow while students get a clear place to track their own attendance and requests.</p>
              <p>The platform is being built in the open so the architecture, security work and AI workflow can keep improving one milestone at a time.</p>
              <div className="landing-chips"><span>React</span><span>FastAPI</span><span>MongoDB</span><span>Python</span><span>Face Recognition</span><span>Liveness</span></div>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="https://github.com/Ali5253-hingoliwala/face-regonization" target="_blank" rel="noreferrer" className="landing-btn landing-btn-primary"><Github size={16} /> Explore the repo</a>
                <Link to="/signup" className="landing-btn" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>Create account <ArrowRight size={16} /></Link>
              </div>
            </div>
            <aside className="landing-about-panel">
              <h3>Project status</h3>
              <p>Core authentication, account security, admin/student portals, sessions, attendance and legal consent flows are connected. The visual identity is now being refined without changing the working feature architecture.</p>
              <div className="landing-progress">
                <div className="landing-progress-row"><span>Core platform</span><strong>Ready for UI refinement</strong></div>
                <div className="landing-progress-track"><div className="landing-progress-fill" /></div>
              </div>
              <div className="mt-6 flex items-center gap-3 text-sm text-white/70"><UserCheck size={18} className="text-[#9fe2d0]" /> Built for admins and students.</div>
              <div className="mt-3 flex items-center gap-3 text-sm text-white/70"><Users size={18} className="text-[#f5c8c3]" /> One connected attendance record.</div>
            </aside>
          </div>
        </section>

        <section id="faqs" className="landing-section">
          <div className="landing-section-head center">
            <span className="landing-eyebrow">FAQ</span>
            <h2>Questions, answered.</h2>
            <p>A few things worth knowing before you put a camera in the attendance workflow.</p>
          </div>
          <div className="landing-faq">
            {faqs.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}<ChevronDown size={18} /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="landing-section theme-soft-surface">
          <div className="landing-section-head center">
            <span className="landing-eyebrow">Let's talk attendance</span>
            <h2>Ready to try the system?</h2>
            <p>Use the working portal buttons to create an account or sign in. For project feedback and development, visit the repository.</p>
          </div>
          <div className="landing-contact">
            <div className="landing-contact-card">
              <div className="landing-icon"><ScanFace size={22} /></div>
              <h3 className="text-xl font-semibold">Start with VisionAttend</h3>
              <p className="mt-2">Students can create their account, while authorized admins can sign in to manage the attendance workflow.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/signup" className="landing-btn landing-btn-primary">Sign up <ArrowRight size={16} /></Link>
                <Link to="/login" className="landing-btn" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>Log in</Link>
              </div>
            </div>
            <div className="landing-contact-card">
              <div className="landing-icon"><Github size={22} /></div>
              <h3 className="text-xl font-semibold">Build it with us</h3>
              <p className="mt-2">The project is open for ideas, improvements and issue reports as the AI attendance workflow evolves.</p>
              <a href="https://github.com/Ali5253-hingoliwala/face-regonization" target="_blank" rel="noreferrer" className="mt-6 landing-btn landing-btn-primary">Open GitHub <ArrowRight size={16} /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-grid">
            <div>
              <div className="landing-brand"><span className="landing-brand-mark"><ScanFace size={20} /></span>VisionAttend</div>
              <p className="mt-4 max-w-sm">AI-powered attendance for classrooms and teams that want a clearer, more reliable picture of who is actually present.</p>
            </div>
            <div>
              <h3>Product</h3>
              <div className="landing-footer-links"><a href="#features">Features</a><a href="#how">How it Works</a><a href="#solution">Problem &amp; Solution</a><a href="#faqs">FAQs</a></div>
            </div>
            <div>
              <h3>Legal &amp; Account</h3>
              <div className="landing-footer-links"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/cookies">Cookie Policy</Link><button type="button" onClick={resetCookiePreferences} className="text-left">Cookie Preferences</button><Link to="/login">Login</Link><Link to="/signup">Sign up</Link></div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} VisionAttend AI. Built for smarter attendance.</span>
            <span>Face recognition · Liveness · Sessions · Analytics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
