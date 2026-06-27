"use client";
import { useState, useEffect, useCallback } from "react";
import { api, WeatherData } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import {
  getBrowserGps,
  loadUserLocation,
  saveUserLocation,
  UserLocation,
} from "@/lib/location";
import {
  Cloud, MapPin, Loader2, Volume2, Thermometer, Droplets, Wind, Search,
} from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function WeatherMonitor({ lang: _lang, speechLang }: Props) {
  const [weather, setWeather]     = useState<WeatherData | null>(null);
  const [userLoc, setUserLoc]     = useState<UserLocation | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { lat: number; lon: number; city: string; region: string; country: string; label: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const tts = new TTSPlayer();

  const fetchWeatherFor = useCallback(async (loc: UserLocation) => {
    setLoading(true);
    setError("");
    try {
      const w = await api.weather(loc.lat, loc.lon);
      setWeather(w);
      setUserLoc(loc);
      saveUserLocation(loc);
    } catch {
      setError("Could not load weather. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function useGps() {
    setLoading(true);
    setError("");
    setSearchResults([]);
    try {
      const { lat, lon } = await getBrowserGps();
      const geo = await api.reverseGeocode(lat, lon);
      const loc: UserLocation = {
        lat,
        lon,
        city: geo.city || "Your location",
        region: geo.region,
        country: geo.country,
        source: "gps",
      };
      await fetchWeatherFor(loc);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Location failed");
      setLoading(false);
    }
  }

  async function searchCities() {
    if (cityQuery.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const results = await api.searchCity(cityQuery.trim());
      setSearchResults(results);
      if (!results.length) setError("No cities found. Try a different name.");
    } catch {
      setError("City search failed.");
    } finally {
      setSearching(false);
    }
  }

  function pickCity(r: { lat: number; lon: number; city: string; region: string; country: string }) {
    setSearchResults([]);
    setCityQuery("");
    fetchWeatherFor({
      lat: r.lat,
      lon: r.lon,
      city: r.city,
      region: r.region,
      country: r.country,
      source: "manual",
    });
  }

  useEffect(() => {
    const saved = loadUserLocation();
    if (saved) {
      fetchWeatherFor({ ...saved, source: "saved" });
    } else {
      useGps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speakWeather() {
    if (!weather) return;
    const text = `Current weather in ${weather.location}. 
      Temperature ${weather.temperature_c} degrees Celsius, feels like ${weather.feels_like_c} degrees. 
      Humidity ${weather.humidity_pct} percent. ${weather.description}. 
      ${weather.irrigation_advice}`;
    tts.speak(text, speechLang);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" /> Weather Monitor
          </h2>
          <button onClick={useGps} disabled={loading} className="btn-secondary text-xs flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Use my location
          </button>
        </div>

        {/* City search */}
        <div className="mb-4 flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Search city (e.g. Hyderabad, Mumbai)…"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchCities()}
          />
          <button
            onClick={searchCities}
            disabled={searching || cityQuery.trim().length < 2}
            className="btn-primary px-3 flex items-center gap-1 text-sm"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-4 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => pickCity(r)}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 last:border-0"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {userLoc && !loading && (
          <p className="text-xs text-gray-500 mb-3">
            Showing weather for{" "}
            <span className="text-gray-400">
              {userLoc.city}
              {userLoc.region ? `, ${userLoc.region}` : ""}
            </span>
            {userLoc.source === "gps" && " (your GPS)"}
          </p>
        )}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        )}

        {weather && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-xl">{weather.location}</p>
                <p className="text-gray-400 text-sm capitalize">{weather.description}</p>
              </div>
              <button onClick={speakWeather} className="btn-secondary flex items-center gap-1 text-xs">
                <Volume2 className="w-3.5 h-3.5" /> Listen
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Temperature", value: `${weather.temperature_c}°C`, icon: Thermometer, color: "text-orange-400" },
                { label: "Feels Like",  value: `${weather.feels_like_c}°C`,  icon: Thermometer, color: "text-yellow-400" },
                { label: "Humidity",    value: `${weather.humidity_pct}%`,    icon: Droplets,    color: "text-blue-400" },
                { label: "Wind",        value: `${weather.wind_speed_ms} m/s`, icon: Wind,       color: "text-gray-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                  <p className="font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-green-950/40 border border-green-800 rounded-xl p-4">
              <p className="text-sm font-medium text-green-300 mb-1">Farming Advice</p>
              <p className="text-green-200 text-sm">{weather.irrigation_advice}</p>
            </div>

            {weather.farming_alerts?.map((alert, i) => (
              <div key={i} className="bg-yellow-950/40 border border-yellow-800 rounded-xl p-3 text-yellow-300 text-sm">
                ⚠ {alert}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
