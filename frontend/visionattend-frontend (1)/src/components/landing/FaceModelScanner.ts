/**
 * Landing-page scanner portrait layer.
 * Uses the supplied transparent portrait while preserving the original
 * scanner frame, beam, labels and verified badge.
 */
export function mountFaceModelScanner(canvas: HTMLCanvasElement) {
  const frame = canvas.parentElement;

  if (!frame) {
    canvas.style.display = "block";
    return () => {
      canvas.style.display = "";
    };
  }

  // Disable the old 3D canvas/model.
  canvas.style.display = "none";

  const image = document.createElement("img");
  image.src = "/face/image.png";
  image.alt = "AI face recognition preview";
  image.className = "scanner-face-image";

  Object.assign(image.style, {
    position: "absolute",
    zIndex: "2",
    left: "50%",
    bottom: "1%",
    width: "56%",
    height: "80%",
    transform: "translateX(-50%)",
    objectFit: "contain",
    objectPosition: "center bottom",
    pointerEvents: "none",
    userSelect: "none",
    display: "block",
    // Softly fade the bottom of the portrait so the source image does not
    // create a visible rectangular edge inside the scanner.
    WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%)",
    maskImage: "linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%)",
  });

  frame.appendChild(image);

  // Keep the original scanner UI above the portrait.
  frame.querySelectorAll<HTMLElement>(".scan-line").forEach((el) => {
    el.style.zIndex = "7";
  });

  frame.querySelectorAll<HTMLElement>(".scan-label").forEach((el) => {
    el.style.zIndex = "8";
  });

  frame.querySelectorAll<HTMLElement>(".corner").forEach((el) => {
    el.style.zIndex = "9";
  });

  return () => {
    image.remove();
    canvas.style.display = "";

    frame
      .querySelectorAll<HTMLElement>(".corner, .scan-line, .scan-label")
      .forEach((el) => {
        el.style.removeProperty("z-index");
      });
  };
}
