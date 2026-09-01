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
      // Scanner tilt intentionally removed. The biometric frame stays stable and calm.
    }

    const canvas = root.querySelector<HTMLCanvasElement>("#face-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        let width = 0;
        let height = 0;
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        let points: Array<{ x: number; y: number; feature?: boolean }> = [];
        let connections: Array<[number, number]> = [];
        let raf = 0;
        let resizeTimer = 0;

        // Clean, deterministic facial landmark structure adapted from the 3D experiment.
        // The original 3D experiment uses these landmarks and connections to create
        // a recognizable face instead of a random particle cloud.
        const LANDMARKS: Array<[number, number, boolean?]> = [
          [-0.55, 0.55], [-0.28, 0.68], [0, 0.72], [0.28, 0.68], [0.55, 0.55],
          [-0.38, 0.32], [-0.15, 0.35], [0.15, 0.35], [0.38, 0.32],
          [0, 0.05, true],
          [-0.35, -0.18], [-0.12, -0.22], [0.12, -0.22], [0.35, -0.18],
          [-0.45, -0.52], [-0.20, -0.62], [0, -0.66, true], [0.20, -0.62], [0.45, -0.52],
        ];
        const CONNECTIONS: Array<[number, number]> = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [1, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8],
          [5, 6], [6, 7], [7, 8], [6, 9], [7, 9],
          [5, 10], [6, 10], [6, 11], [7, 11], [7, 12], [8, 12], [8, 13],
          [10, 11], [11, 12], [12, 13],
          [10, 14], [10, 15], [11, 15], [11, 16], [12, 16], [12, 17], [13, 17], [13, 18],
          [14, 15], [15, 16], [16, 17], [17, 18],
        ];

        const buildPoints = () => {
          points = LANDMARKS.map(([x, y, feature]) => ({
            x: 0.5 + x * 0.42,
            y: 0.50 - y * 0.54,
            feature,
          }));
          connections = CONNECTIONS;
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
          const drift = prefersReducedMotion ? 0 : Math.sin(time * 0.75) * 0.0025;
          const pulse = prefersReducedMotion ? 0.35 : (Math.sin(time * 2.2) + 1) / 2;
          const live = points.map((p, index) => ({
            x: (p.x + drift * (index % 2 === 0 ? 1 : -1)) * width,
            y: (p.y + drift * 0.45) * height,
            feature: Boolean(p.feature),
          }));

          // Face mesh lines: restrained opacity keeps the structure readable.
          ctx.lineWidth = 0.8;
          connections.forEach(([from, to]) => {
            const a = live[from];
            const b = live[to];
            if (!a || !b) return;
            ctx.strokeStyle = `rgba(150, 205, 198, ${0.16 + pulse * 0.10})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          });

          // Soft outer facial contour to make the landmark pattern read as a face.
          const contour = [0, 1, 2, 3, 4, 8, 13, 18, 17, 16, 15, 14, 10, 5, 0];
          ctx.strokeStyle = "rgba(190, 224, 216, 0.30)";
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          contour.forEach((index, i) => {
            const p = live[index];
            if (!p) return;
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();

          live.forEach((p) => {
            ctx.beginPath();
            ctx.fillStyle = p.feature ? "rgba(255, 255, 255, 0.98)" : "rgba(206, 231, 222, 0.86)";
            ctx.shadowBlur = p.feature ? 8 : 3;
            ctx.shadowColor = "rgba(150, 224, 213, 0.55)";
            ctx.arc(p.x, p.y, p.feature ? 2.5 : 1.7, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.shadowBlur = 0;

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
