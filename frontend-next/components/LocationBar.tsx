"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  loadUserLocation,
  saveUserLocation,
  getBrowserGpsFresh,
  UserLocation,
} from "@/lib/location";
import { MapPin, Loader2, Search, Navigation } from "lucide-react";

export default function LocationBar() {
  const [loc, setLoc] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { lat: number; lon: number; city: string; region: string; country: string; label: string }[]
  >([]);
  const [showSearch, setShowSearch] = useState(false);

  const refresh = useCallback(() => setLoc(loadUserLocation()), []);

  useEffect(() => {
    refresh();
    window.addEventListener("sa-location-updated", refresh);
    return () => window.removeEventListener("sa-location-updated", refresh);
  }, [refresh]);

  async function detectGps() {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const { lat, lon } = await getBrowserGpsFresh();
      const geo = await api.reverseGeocode(lat, lon);
      const next: UserLocation = {
        lat,
        lon,
        city: geo.city || "Your location",
        region: geo.region,
        country: geo.country,
        source: "gps",
      };
      saveUserLocation(next);
      setLoc(next);
      setShowSearch(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location failed");
    } finally {
      setLoading(false);
    }
  }

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const hits = await api.searchCity(query.trim());
      setResults(hits);
      if (!hits.length) setError("No cities found. Try e.g. Warangal, Telangana");
    } catch {
      setError("City search failed.");
    } finally {
      setLoading(false);
    }
  }

  function pickCity(hit: (typeof results)[0]) {
    const next: UserLocation = {
      lat: hit.lat,
      lon: hit.lon,
      city: hit.city,
      region: hit.region,
      country: hit.country,
      source: "manual",
    };
    saveUserLocation(next);
    setLoc(next);
    setResults([]);
    setQuery("");
    setShowSearch(false);
    setError("");
  }

  return (
    <div className="card py-3 px-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Weather & report location</p>
            <p className="text-sm font-medium text-white truncate">
              {loc ? `${loc.city}${loc.region ? `, ${loc.region}` : ""}` : "Not set — required for accurate weather"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => void detectGps()}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            Use GPS
          </button>
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2"
          >
            <Search className="w-3.5 h-3.5" />
            Search city
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder="e.g. Warangal"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600"
            />
            <button type="button" onClick={() => void search()} disabled={loading} className="btn-primary text-xs px-4">
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button
                  key={`${r.lat}-${r.lon}`}
                  type="button"
                  onClick={() => pickCity(r)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-green-950/40 text-gray-300 hover:text-white transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-amber-400 mt-2">{error}</p>}
      {loc?.source === "manual" && (
        <p className="text-xs text-gray-500 mt-2">Using manually selected city.</p>
      )}
    </div>
  );
}
