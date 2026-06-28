/** Convert an uploaded image to a data URL that survives page reloads (for localStorage). */
const MAX_EDGE = 400;
const JPEG_QUALITY = 0.78;

export async function fileToPersistedImageUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return readFileAsDataUrl(file);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isPersistedImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("data:image/");
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w >= h) return { width: max, height: Math.round((h / w) * max) };
  return { width: Math.round((w / h) * max), height: max };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
