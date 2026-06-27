"use client";
import { useState, useEffect } from "react";
import { api, WeatherData, LocationData } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import { Cloud, MapPin, Loader2, Volume2, Thermometer, Droplets, Wind } from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function WeatherMonitor({ lang, speechLang }: Props) {
  const [weather, setWeather]     = useState<WeatherData | null>(null);
  const [location, setLocation]   = useState<LocationData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [city, setCity]           = useState("");
  const tts = new TTSPlayer();

  useEffect(() => { detectAndFetch(); }, []);

  async function detectAndFetch() {
    setLoading(true);
    try {
      const loc = await api.locationDetect();
      setLocation(loc);
      const w = await api.weather(loc.lat, loc.lon);
      setWeather(w);
      setCity(loc.city);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  function speakWeather() {
    if (!weather) return;
    const text = `Current weather in ${weather.location}. 
      Temperature ${weather.temperature_c}°C, feels like ${weather.feels_like_c}°C. 
      Humidity ${weather.humidity_pct}%. ${weather.description}. 
      ${weather.irrigation_advice}`;
    tts.speak(text, speechLang);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Weather Monitor</h2>
          <button onClick={detectAndFetch} className="btn-secondary text-xs flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Auto-detect
          </button>
        </div>

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
