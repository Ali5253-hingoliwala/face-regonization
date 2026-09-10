interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * The VisionAttend AI mark: four corner brackets framing a center
 * point, the same "detection frame" language used throughout the
 * app (see ViewfinderFrame). This is deliberately the same shape
 * as a face-detection bounding box closing in on a verified point --
 * not a generic abstract icon.
 */
export default function Logo({
  size = 28,
  showWordmark = true,
  className = "",
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corner brackets */}
        <path
          d="M4 13V7a3 3 0 0 1 3-3h6"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M36 13V7a3 3 0 0 0-3-3h-6"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M4 27v6a3 3 0 0 0 3 3h6"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M36 27v6a3 3 0 0 1-3 3h-6"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Verified center point */}
        <circle cx="20" cy="20" r="5" fill="var(--color-accent)" />
        <circle
          cx="20"
          cy="20"
          r="9"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeOpacity="0.35"
        />
      </svg>

      {showWordmark && (
        <span className="font-display font-semibold tracking-tight text-ink">
          VisionAttend<span className="text-accent">AI</span>
        </span>
      )}
    </div>
  );
}
