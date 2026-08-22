import React from "react";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { AuthSession } from "../types";
import { Logo } from "./Logo";

interface HeaderProps {
  session: AuthSession | null;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ session, onLogout, onNavigateHome }) => {
  return (
    <header className="bg-white text-slate-900 border-b-2 border-slate-900 sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={onNavigateHome}
          className={`flex items-center gap-3 ${onNavigateHome ? 'cursor-pointer' : ''}`}
        >
          <Logo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-slate-950 uppercase font-sans">
                AN <span className="text-sky-600">TECH</span>
              </span>
              {session?.role === "admin" && (
                <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[11px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                  Administrator
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide flex items-center gap-1.5">
              <span>Online CBT Testing Portal</span>
              <span className="hidden md:inline text-slate-300">•</span>
              <span className="hidden md:inline text-sky-700 font-bold text-[10px] uppercase">Build • Automate • Innovate</span>
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {session ? (
            <>
              {session.role === "student" && (
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>{session.user.name}</span>
                    <span className="text-slate-500 font-mono">({session.user.studentId})</span>
                  </div>
                  {session.user.batchName && (
                    <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
                      Batch: {session.user.batchName}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={onLogout}
                id="btn-logout"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-100 rounded border border-slate-300 transition shadow-xs"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Examination System
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

