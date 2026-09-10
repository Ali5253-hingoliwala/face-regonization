import type { ReactNode } from "react";

interface ViewfinderFrameProps {
  children: ReactNode;
  className?: string;
  cornerSize?: number;
  active?: boolean;
}

/**
 * The recurring signature element of VisionAttend AI's visual
 * identity: corner brackets mimicking a real face-detection
 * bounding box (the same kind drawn live by the ML pipeline's own
 * OpenCV window). Reused around the hero visual, feature cards,
 * and the login/signup forms so the "detection frame" idea runs
 * through the whole product, not just the hero.
 */
export default function ViewfinderFrame({
  children,
  className = "",
  cornerSize = 20,
  active = false,
}: ViewfinderFrameProps) {
  const cornerColor = active ? "border-accent" : "border-line";

  return (
    <div className={`relative ${className}`}>
      {/* Top-left */}
      <div
        className={`absolute top-0 left-0 border-t-2 border-l-2 ${cornerColor} rounded-tl-md pointer-events-none transition-colors`}
        style={{ width: cornerSize, height: cornerSize }}
      />
      {/* Top-right */}
      <div
        className={`absolute top-0 right-0 border-t-2 border-r-2 ${cornerColor} rounded-tr-md pointer-events-none transition-colors`}
        style={{ width: cornerSize, height: cornerSize }}
      />
      {/* Bottom-left */}
      <div
        className={`absolute bottom-0 left-0 border-b-2 border-l-2 ${cornerColor} rounded-bl-md pointer-events-none transition-colors`}
        style={{ width: cornerSize, height: cornerSize }}
      />
      {/* Bottom-right */}
      <div
        className={`absolute bottom-0 right-0 border-b-2 border-r-2 ${cornerColor} rounded-br-md pointer-events-none transition-colors`}
        style={{ width: cornerSize, height: cornerSize }}
      />
      {children}
    </div>
  );
}
