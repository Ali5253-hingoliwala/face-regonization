import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element has scrolled into view. Used to
 * trigger fade/slide-in reveals and animated counters as the
 * visitor scrolls down the landing page, instead of everything
 * just being static and present on load.
 */
export function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}