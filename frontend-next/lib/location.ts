/**
 * User location — browser GPS first, not the server IP (Render = Singapore).
 */

export interface UserLocation {
  lat: number;
  lon: number;
  city: string;
  region?: string;
  country?: string;
  source: "gps" | "manual";
}

const STORAGE_KEY = "sa_user_location";

/** Stale fallback coords that were incorrectly saved when GPS failed. */
const STALE_DEFAULT = { lat: 17.385, lon: 78.4867, city: "hyderabad" };

export function saveUserLocation(loc: UserLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  window.dispatchEvent(new Event("sa-location-updated"));
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

export function purgeStaleDefaultLocation(): void {
  const saved = loadUserLocation();
  if (!saved || saved.source === "manual") return;
  const nearDefault =
    Math.abs(saved.lat - STALE_DEFAULT.lat) < 0.05 &&
    Math.abs(saved.lon - STALE_DEFAULT.lon) < 0.05;
  if (nearDefault && saved.city.toLowerCase().includes(STALE_DEFAULT.city)) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getBrowserGps(): Promise<{ lat: number; lon: number }> {
  return getBrowserGpsFresh();
}

export function getBrowserGpsFresh(): Promise<{ lat: number; lon: number }> {
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
          1: "Location permission denied. Search your city below (e.g. Warangal).",
          2: "Could not determine your position. Search your city below.",
          3: "Location request timed out. Try again or search your city.",
        };
        reject(new Error(msgs[err.code] || "Could not get your location."));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  });
}

type GeoResult = { city: string; region?: string; country?: string };

/**
 * Use location already set in LocationBar; only fetch GPS if nothing saved.
 */
export async function resolveScanLocation(
  reverseGeocode: (lat: number, lon: number) => Promise<GeoResult>
): Promise<{ lat: number; lon: number; city: string }> {
  purgeStaleDefaultLocation();

  const saved = loadUserLocation();
  if (saved) {
    return { lat: saved.lat, lon: saved.lon, city: saved.city };
  }

  const gps = await getBrowserGpsFresh();
  const geo = await reverseGeocode(gps.lat, gps.lon);
  const city = geo.city || "Your location";
  saveUserLocation({
    lat: gps.lat,
    lon: gps.lon,
    city,
    region: geo.region,
    country: geo.country,
    source: "gps",
  });
  return { lat: gps.lat, lon: gps.lon, city };
}
