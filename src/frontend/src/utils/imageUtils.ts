/**
 * Canvas-based client-side image resize utility.
 * No external libraries — uses HTMLCanvasElement.toDataURL.
 *
 * @param file       The File object from an <input type="file">
 * @param maxWidth   Maximum output width in pixels
 * @param maxHeight  Maximum output height in pixels
 * @param quality    JPEG quality (0–1), default 0.8
 * @returns          Promise resolving to a base64 data URL (image/jpeg)
 */
export function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new window.Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        // Compute scaled dimensions maintaining aspect ratio
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        if (h > maxHeight) {
          w = Math.round((w * maxHeight) / h);
          h = maxHeight;
        }
        // Draw onto canvas
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
