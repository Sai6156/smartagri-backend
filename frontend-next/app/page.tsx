"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveUser, getUser } from "@/lib/auth";
import { Leaf, LogIn, UserPlus, Eye, EyeOff, Sparkles, Shield, Zap } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getUser()) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const res = mode === "signup"
        ? await api.auth.signup(trimmedEmail, password, name.trim())
        : await api.auth.login(trimmedEmail, password);
      saveUser({ ...res, name: res.name || name.trim() });
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-green-950/30" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-green-400/5 rounded-full blur-2xl" />
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white">SmartAgri</h1>
              <p className="text-[#7a8f82] text-sm">AI Powered Agriculture</p>
            </div>
          </div>
          <h2 className="font-serif text-4xl font-bold text-white leading-tight mb-4">
            Detect crop diseases with AI precision
          </h2>
          <p className="text-[#7a8f82] mb-8 leading-relaxed">
            Upload a leaf photo, get instant disease detection, visual AI second opinions,
            weather insights, and voice-guided farming advice — in your language.
          </p>
          <div className="space-y-4">
            {[
              { icon: Zap, text: "Instant Detection with 97%+ accuracy" },
              { icon: Sparkles, text: "Gemma AI visual second opinion" },
              { icon: Shield, text: "Secure, persistent scan history" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-[#c8d4cc] text-sm">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-green-400" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 mb-4 shadow-lg shadow-green-500/20">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-white">SmartAgri</h1>
            <p className="text-[#7a8f82] text-sm mt-1">AI Powered Agriculture</p>
          </div>

          <div className="card card-glow">
            <h2 className="font-serif text-2xl font-bold text-white mb-1">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-[#7a8f82] text-sm mb-6">
              {mode === "login" ? "Sign in to access your farm dashboard" : "Join SmartAgri for free"}
            </p>

            <div className="flex rounded-xl overflow-hidden border border-white/8 mb-6 p-1 bg-black/20">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === m
                      ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md shadow-green-500/20"
                      : "text-[#7a8f82] hover:text-[#c8d4cc]"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs text-[#7a8f82] mb-1.5 font-medium uppercase tracking-wide">Full Name</label>
                  <input className="input" placeholder="Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div>
                <label className="block text-xs text-[#7a8f82] mb-1.5 font-medium uppercase tracking-wide">Email</label>
                <input className="input" type="email" placeholder="farmer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-[#7a8f82] mb-1.5 font-medium uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6b60] hover:text-[#c8d4cc]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : mode === "login" ? (
                  <><LogIn className="w-4 h-4" /> Sign In</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create Account</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
