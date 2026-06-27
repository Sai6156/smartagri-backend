/**
 * User location — browser GPS first, not the server IP (Render = Singapore).
 */

export interface UserLocation {
  lat: number;
  lon: number;
  city: string;
  region?: string;
  country?: string;
  source: "gps" | "manual" | "saved";
}

const STORAGE_KEY = "sa_user_location";

export function saveUserLocation(loc: UserLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function loadUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserLocation;
  } catch {
    return null;
  }
}

export function getBrowserGps(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      (err) => {
        const msgs: Record<number, string> = {
          1: "Location permission denied. Allow location access or search your city below.",
          2: "Could not determine your position. Try searching your city.",
          3: "Location request timed out. Try again.",
        };
        reject(new Error(msgs[err.code] || "Could not get your location."));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 }
    );
  });
}
