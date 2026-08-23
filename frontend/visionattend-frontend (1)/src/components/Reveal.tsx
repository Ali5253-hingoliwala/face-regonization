import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Fades and slides content up as it scrolls into view. Wrapping
 * a section in this is what makes the page feel alive while
 * scrolling instead of everything just sitting there static.
 */
export default function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}