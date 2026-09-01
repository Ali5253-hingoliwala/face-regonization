/**
 * Landing-page scanner portrait layer.
 * Keeps the existing scanner frame, beam, labels and verified badge intact.
 */
export function mountFaceModelScanner(canvas: HTMLCanvasElement) {
  const frame = canvas.parentElement;

  if (!frame) {
    canvas.style.display = "block";
    return () => {
      canvas.style.display = "";
    };
  }

  // Disable the old canvas/model while keeping the existing scanner surface.
  canvas.style.display = "none";

  const image = document.createElement("img");
  image.src = "/face/image.png";
  image.alt = "AI face recognition preview";
  image.className = "scanner-face-image";

  Object.assign(image.style, {
    position: "absolute",
    zIndex: "2",
    left: "50%",
    bottom: "0",
    width: "62%",
    height: "84%",
    transform: "translateX(-50%)",
    objectFit: "contain",
    objectPosition: "center bottom",
    pointerEvents: "none",
    userSelect: "none",
    display: "block",
  });

  frame.appendChild(image);

  // Scanner UI stays in front of the portrait.
  frame.querySelectorAll<HTMLElement>(".scan-line").forEach((el) => {
    el.style.zIndex = "7";
  });

  frame.querySelectorAll<HTMLElement>(".scan-label").forEach((el) => {
    el.style.zIndex = "8";
  });

  frame.querySelectorAll<HTMLElement>(".corner").forEach((el) => {
    el.style.zIndex = "9";
  });

  frame.querySelectorAll<HTMLElement>(".status-chip").forEach((el) => {
    el.style.zIndex = "10";
  });

  return () => {
    image.remove();
    canvas.style.display = "";

    frame
      .querySelectorAll<HTMLElement>(
        ".corner, .scan-line, .scan-label, .status-chip",
      )
      .forEach((el) => {
        el.style.removeProperty("z-index");
      });
  };
}
