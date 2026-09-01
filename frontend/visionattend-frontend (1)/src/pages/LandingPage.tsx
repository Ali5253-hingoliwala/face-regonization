import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mountFaceModelScanner } from "../components/landing/FaceModelScanner";
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
        go(text === "log in" ? "/login" : "/signup");
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
    }

    const canvas = root.querySelector<HTMLCanvasElement>("#face-canvas");
    const disposeFaceModel = canvas ? mountFaceModelScanner(canvas) : undefined;
    if (disposeFaceModel) cleanups.push(disposeFaceModel);

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
