import React, { useState } from "react";
import { Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import { api, saveSession } from "../../lib/api";
import { AuthSession } from "../../types";
import { Logo } from "../Logo";

interface StudentLoginProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess }) => {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      setError("Please enter both Student ID and Password");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const session = await api.studentLogin(studentId.trim(), password.trim());
      saveSession(session);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center px-4 py-8 bg-[#f1f5f9]">
      <div className="w-full max-w-md bg-white border border-slate-300 rounded-lg shadow-sm p-6 sm:p-8">
        {/* Institute Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight uppercase font-sans">
            AN <span className="text-sky-600">TECH</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
            Online CBT Examination & Assessment Portal
          </p>
          <div className="mt-1 inline-block text-[10px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 tracking-wider uppercase">
            Build • Automate • Innovate
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Student ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                placeholder="e.g. STU101"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-200 focus:border-sky-500 text-slate-900 rounded text-sm placeholder-slate-400 transition font-mono uppercase outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-student-password"
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
            id="btn-student-login"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-bold rounded text-sm transition flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Login to Test Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Authorized student access only. Log in with credentials issued by AN TECH administration.
          </p>
        </div>
      </div>
    </div>
  );
};

