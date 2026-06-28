import { api } from "@/lib/api";
import { normalizeImageUrl } from "@/lib/persistImage";

const blobCache = new Map<number, string>();

/** Resolve a displayable image URL from local data or authenticated server thumbnail. */
export async function resolvePredictionImageUrl(
  backendId?: number,
  imageUrl?: string
): Promise<string> {
  const local = normalizeImageUrl(imageUrl);
  if (local) return local;
  if (!backendId) return "";
  if (blobCache.has(backendId)) return blobCache.get(backendId)!;

  try {
    const blob = await api.predictionThumbnail(backendId);
    const url = URL.createObjectURL(blob);
    blobCache.set(backendId, url);
    return url;
  } catch {
    return "";
  }
}

export function revokePredictionImageUrl(backendId?: number): void {
  if (!backendId) return;
  const url = blobCache.get(backendId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(backendId);
  }
}
