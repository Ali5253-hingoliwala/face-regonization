import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

/**
 * Counts up from 0 to the target number once it scrolls into
 * view -- a small but effective "popping" detail for a stats row.
 */
export default function AnimatedCounter({
  target,
  suffix = "",
  decimals = 0,
  duration = 1400,
}: AnimatedCounterProps) {
  const { ref, inView } = useInView(0.5);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}