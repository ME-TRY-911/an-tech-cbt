import React, { useState } from "react";
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { api, saveSession } from "../../lib/api";
import { AuthSession } from "../../types";
import { Logo } from "../Logo";

interface AdminLoginProps {
  onLoginSuccess: (session: AuthSession) => void;
  onCancel?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const session = await api.adminLogin(username.trim(), password.trim());
      saveSession(session);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || "Invalid administrator credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center px-4 py-8 bg-[#f1f5f9]">
      <div className="w-full max-w-md bg-white border border-slate-300 rounded-lg shadow-sm p-6 sm:p-8 relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 relative">
            <Logo size="xl" />
            <div className="absolute -bottom-1 -right-1 bg-sky-600 text-white rounded-full p-1.5 border-2 border-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight font-sans">
            AN <span className="text-sky-600">TECH</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-bold mt-1 flex items-center justify-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-sky-600" />
            <span>Master Administration Console</span>
          </p>
          <div className="mt-1 inline-block text-[10px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 tracking-wider uppercase">
            Build • Automate • Innovate
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Admin ID / Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ADMIN"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-200 focus:border-sky-500 text-slate-900 rounded text-sm placeholder-slate-400 transition outline-none uppercase font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-200 focus:border-sky-500 text-slate-900 rounded text-sm placeholder-slate-400 transition outline-none"
              />
            </div>
          </div>

          <button
            id="btn-admin-login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-700 text-white font-bold rounded text-sm transition flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Access Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {onCancel && (
          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
            >
              ← Return to Student Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
