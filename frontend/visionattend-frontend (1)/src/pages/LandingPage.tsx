import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./landing-page.css";
import "./landing-page-overrides.css";
import template from "./landing-page-template.html?raw";

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    document.title = "VisionAttend — AI Face Recognition Attendance System";
    root.innerHTML = template;

    const contactCard = root.querySelector<HTMLElement>("#contact .contact-card");
    if (contactCard && !contactCard.querySelector(".contact-email")) {
      const email = document.createElement("a");
      email.className = "contact-email";
      email.href = "mailto:aliasgarhingoliwala786@gmail.com";
      email.textContent = "aliasgarhingoliwala786@gmail.com";
      email.setAttribute("aria-label", "Email VisionAttend support");
      contactCard.appendChild(email);
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: Array<() => void> = [];

    const on = (
      element: HTMLElement | Document | Window,
      event: string,
      handler: EventListener | EventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      element.addEventListener(event, handler, options);
      cleanups.push(() => element.removeEventListener(event, handler, options));
    };

    const header = root.querySelector<HTMLElement>("#site-header");
    const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 12);
    on(window, "scroll", onScroll, { passive: true });
    onScroll();

    const navToggle = root.querySelector<HTMLButtonElement>("#nav-toggle");
    const navLinks = root.querySelector<HTMLElement>("#nav-links");
    if (navToggle) {
      on(navToggle, "click", () => {
        const isOpen = root.classList.toggle("nav-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }
    navLinks?.querySelectorAll("a").forEach((link) => {
      on(link, "click", () => {
        root.classList.remove("nav-open");
        navToggle?.setAttribute("aria-expanded", "false");
      });
    });

    const go = (path: string) => navigate(path);
    const authClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.cookieReset === "true") return;
      const text = button.textContent?.trim().toLowerCase();
      if (text === "log in" || text === "sign up" || text === "get started" || text === "create account") {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(text === "sign up" || text === "get started" || text === "create account" ? "/signup" : "/login");
      }
    };
    on(root, "click", authClick, true);

    const authSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      if (form.id === "login-form" || form.id === "signup-form") {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(form.id === "signup-form" ? "/signup" : "/login");
      }
    };
    on(root, "submit", authSubmit, true);

    const cookieReset = root.querySelector<HTMLButtonElement>("[data-cookie-reset='true']");
    if (cookieReset) {
      on(cookieReset, "click", () => {
        localStorage.removeItem("va_cookie_preferences");
        window.location.reload();
      });
    }

    const contactForm = root.querySelector<HTMLFormElement>("#contact-form");
    const contactSuccess = root.querySelector<HTMLElement>("#contact-success");
    let successTimer: number | undefined;
    if (contactForm) {
      on(contactForm, "submit", (event) => {
        event.preventDefault();
        contactSuccess?.classList.add("show");
        contactForm.reset();
        if (successTimer) window.clearTimeout(successTimer);
        successTimer = window.setTimeout(() => contactSuccess?.classList.remove("show"), 6000);
      });
    }

    const revealEls = root.querySelectorAll<HTMLElement>(".reveal");
    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }),
        { threshold: 0.15 },
      );
      revealEls.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    if (canHover && !prefersReducedMotion) {
      root.querySelectorAll<HTMLElement>(".tilt-card").forEach((card) => {
        const move = (event: Event) => {
          const pointer = event as PointerEvent;
          const rect = card.getBoundingClientRect();
          const x = (pointer.clientX - rect.left) / rect.width - 0.5;
          const y = (pointer.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
          card.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
          card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
          card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
        };
        const leave = () => {
          card.style.setProperty("--rx", "0deg");
          card.style.setProperty("--ry", "0deg");
        };
        on(card, "pointermove", move);
        on(card, "pointerleave", leave);
      });

      const scanFrame = root.querySelector<HTMLElement>("#scan-frame");
      const heroSection = root.querySelector<HTMLElement>(".hero");
      if (scanFrame && heroSection) {
        const move = (event: Event) => {
          const pointer = event as PointerEvent;
          const rect = heroSection.getBoundingClientRect();
          const x = (pointer.clientX - rect.left) / rect.width - 0.5;
          const y = (pointer.clientY - rect.top) / rect.height - 0.5;
          scanFrame.style.transform = `rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 14).toFixed(2)}deg)`;
        };
        const leave = () => { scanFrame.style.transform = "rotateY(0deg) rotateX(0deg)"; };
        on(heroSection, "pointermove", move);
        on(heroSection, "pointerleave", leave);
      }
    }

    const canvas = root.querySelector<HTMLCanvasElement>("#face-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        let width = 0;
        let height = 0;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        let points: Array<{ bx: number; by: number; feature: boolean; phase: number; amp: number }> = [];
        let raf = 0;
        let resizeTimer = 0;
        const NODE_COLOR = "rgba(183, 212, 199, 0.85)";
        const LINE_COLOR = "rgba(120, 175, 174, 0.35)";
        const FEATURE_COLOR = "rgba(255, 255, 255, 0.9)";

        const buildPoints = () => {
          points = [];
          const cx = 0.5;
          const cy = 0.52;
          for (let i = 0; i < 34; i++) {
            const t = (i / 34) * Math.PI * 2;
            const rx = 0.30 + Math.sin(t * 3) * 0.012;
            const ry = 0.40 + Math.cos(t * 2) * 0.012;
            points.push({ bx: cx + Math.cos(t) * rx, by: cy + Math.sin(t) * ry * 1.02, feature: false, phase: Math.random() * Math.PI * 2, amp: 0.006 + Math.random() * 0.006 });
          }
          for (let i = 0; i < 26; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 0.24;
            points.push({ bx: cx + Math.cos(angle) * dist * 1.05, by: cy + Math.sin(angle) * dist * 1.25 - 0.02, feature: false, phase: Math.random() * Math.PI * 2, amp: 0.005 + Math.random() * 0.008 });
          }
          [[cx - 0.11, cy - 0.06], [cx + 0.11, cy - 0.06], [cx, cy + 0.02], [cx, cy + 0.07], [cx - 0.09, cy + 0.17], [cx + 0.09, cy + 0.17], [cx, cy + 0.20], [cx - 0.18, cy - 0.10], [cx + 0.18, cy - 0.10]].forEach(([bx, by]) => {
            points.push({ bx, by, feature: true, phase: Math.random() * Math.PI * 2, amp: 0.004 });
          });
        };

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          width = rect.width;
          height = rect.height;
          dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.floor(width * dpr));
          canvas.height = Math.max(1, Math.floor(height * dpr));
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const frame = (t: number) => {
          ctx.clearRect(0, 0, width, height);
          const time = t / 1000;
          const live = points.map((p) => {
            const wob = prefersReducedMotion ? 0 : Math.sin(time * 0.9 + p.phase) * p.amp;
            return { x: (p.bx + wob) * width, y: (p.by + wob * 0.6) * height, feature: p.feature };
          });
          const maxDist = Math.min(width, height) * 0.16;
          ctx.lineWidth = 1;
          for (let i = 0; i < live.length; i++) {
            for (let j = i + 1; j < live.length; j++) {
              const dx = live[i].x - live[j].x;
              const dy = live[i].y - live[j].y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < maxDist) {
                ctx.strokeStyle = LINE_COLOR;
                ctx.globalAlpha = 1 - d / maxDist;
                ctx.beginPath();
                ctx.moveTo(live[i].x, live[i].y);
                ctx.lineTo(live[j].x, live[j].y);
                ctx.stroke();
              }
            }
          }
          ctx.globalAlpha = 1;
          live.forEach((p) => {
            ctx.beginPath();
            ctx.fillStyle = p.feature ? FEATURE_COLOR : NODE_COLOR;
            ctx.arc(p.x, p.y, p.feature ? 2.6 : 1.8, 0, Math.PI * 2);
            ctx.fill();
          });
          if (!prefersReducedMotion) raf = window.requestAnimationFrame(frame);
        };

        const start = () => {
          buildPoints();
          resize();
          if (raf) cancelAnimationFrame(raf);
          if (prefersReducedMotion) frame(0);
          else raf = requestAnimationFrame(frame);
        };
        const resizeHandler = () => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(start, 150);
        };
        on(window, "resize", resizeHandler);
        start();
        cleanups.push(() => {
          cancelAnimationFrame(raf);
          window.clearTimeout(resizeTimer);
        });
      }
    }

    const yearEl = root.querySelector<HTMLElement>("#year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    return () => {
      if (successTimer) window.clearTimeout(successTimer);
      cleanups.reverse().forEach((cleanup) => cleanup());
      root.classList.remove("nav-open");
      root.innerHTML = "";
    };
  }, [navigate]);

  return <div ref={rootRef} className="landing-page" />;
}
