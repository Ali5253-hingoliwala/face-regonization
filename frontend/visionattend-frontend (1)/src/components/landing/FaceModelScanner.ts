/**
 * Empty landing-page scanner surface.
 * The surrounding scanner frame/background and landing-page UI remain intact.
 */
export function mountFaceModelScanner(canvas: HTMLCanvasElement) {
  canvas.style.display = "block";

  return () => {
    canvas.style.display = "";
  };
}
