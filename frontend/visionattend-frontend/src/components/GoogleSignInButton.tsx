import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = { credential: string };
type GoogleButtonProps = {
  onCredential: (credential: string) => void | Promise<void>;
  text?: "signin_with" | "signup_with";
  disabled?: boolean;
};

export default function GoogleSignInButton({ onCredential, text = "signin_with", disabled = false }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { callbackRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google Sign-In is not configured yet.");
      return;
    }

    const render = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => callbackRef.current(response.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        width: Math.min(360, containerRef.current.clientWidth || 360),
      });
      setReady(true);
    };

    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    if (existing) {
      if ((window as any).google?.accounts?.id) render();
      else existing.addEventListener("load", render, { once: true });
      return () => existing.removeEventListener("load", render);
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setError("Google Sign-In could not be loaded.");
    document.head.appendChild(script);
    return () => script.remove();
  }, [text]);

  if (error) {
    return <p className="text-xs text-ink-faint text-center">{error}</p>;
  }

  return <div className={`w-full flex justify-center ${disabled || !ready ? "opacity-60 pointer-events-none" : ""}`} ref={containerRef} aria-label="Continue with Google" />;
}
