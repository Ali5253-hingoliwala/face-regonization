import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; theme?: "light" | "dark"; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type Props = {
  onToken: (token: string) => void;
  disabled?: boolean;
  resetKey?: number;
};

export default function TurnstileWidget({ onToken, disabled = false, resetKey = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>();
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!siteKey || !containerRef.current || disabled) return;

    const render = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);

    return () => {
      widgetIdRef.current = undefined;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [siteKey, disabled, onToken, resetKey]);

  if (!siteKey) {
    return <p className="text-xs text-absent">CAPTCHA is not configured. Set VITE_TURNSTILE_SITE_KEY.</p>;
  }

  return <div ref={containerRef} className={disabled ? "pointer-events-none opacity-60" : ""} />;
}
