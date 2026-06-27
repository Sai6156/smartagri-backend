/** Browser-side geocoding when backend /api/location/* is unavailable (e.g. stale deploy). */

export type CityHit = {
  lat: number;
  lon: number;
  city: string;
  region: string;
  country: string;
  label: string;
};

function label(city: string, region: string, country: string) {
  return [city, region, country].filter(Boolean).join(", ");
}

export async function searchCityFallback(q: string): Promise<CityHit[]> {
  const resp = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&country=IN`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!resp.ok) throw new Error("City search unavailable");
  const data = await resp.json();
  const hits = (data.results || []) as {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }[];
  if (!hits.length) return [];
  return hits.map((p) => ({
    lat: p.latitude,
    lon: p.longitude,
    city: p.name,
    region: p.admin1 || "",
    country: p.country || "India",
    label: label(p.name, p.admin1 || "", p.country || "India"),
  }));
}

export async function reverseGeocodeFallback(
  lat: number,
  lon: number
): Promise<{ lat: number; lon: number; city: string; region: string; country: string }> {
  const resp = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!resp.ok) throw new Error("Reverse geocode unavailable");
  const data = await resp.json();
  const city =
    data.city || data.locality || data.principalSubdivision || data.localityInfo?.locality?.[0]?.name || "Your location";
  return {
    lat,
    lon,
    city,
    region: data.principalSubdivision || "",
    country: data.countryName || "",
  };
}
