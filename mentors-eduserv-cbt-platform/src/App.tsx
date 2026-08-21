import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { StudentLogin } from "./components/student/StudentLogin";
import { StudentDashboard } from "./components/student/StudentDashboard";
import { TestInterface } from "./components/student/TestInterface";
import { ResultView } from "./components/student/ResultView";
import { BatchLeaderboard } from "./components/student/BatchLeaderboard";
import { AdminLogin } from "./components/admin/AdminLogin";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { getSession, clearSession, api } from "./lib/api";
import { AuthSession, TestResult } from "./types";
import { Shield } from "lucide-react";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [currentView, setCurrentView] = useState<
    "student-dashboard" | "student-test" | "student-result" | "student-leaderboard" | "admin-login" | "admin-dashboard"
  >("student-dashboard");
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<TestResult | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Initialize session and hash route
  useEffect(() => {
    const saved = getSession();
    if (saved) {
      setSession(saved);
      if (saved.role === "admin") {
        setCurrentView("admin-dashboard");
      } else {
        setCurrentView("student-dashboard");
      }
    } else {
      if (window.location.hash === "#admin" || window.location.pathname.includes("/admin")) {
        setCurrentView("admin-login");
      } else {
        setCurrentView("student-dashboard");
      }
    }
    setLoadingInitial(false);

    const handleHashChange = () => {
      if (window.location.hash === "#admin") {
        const curr = getSession();
        if (curr?.role === "admin") {
          setCurrentView("admin-dashboard");
        } else {
          setCurrentView("admin-login");
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setActiveTestId(null);
    setActiveResult(null);
    setCurrentView("student-dashboard");
    window.location.hash = "";
  };

  const handleStartTest = (testId: string) => {
    setActiveTestId(testId);
    setCurrentView("student-test");
  };

  const handleFinishTest = (result: TestResult) => {
    setActiveResult(result);
    setCurrentView("student-result");
  };

  const handleViewResultById = async (resultId: string) => {
    try {
      const res = await api.getResultById(resultId);
      setActiveResult(res);
      setCurrentView("student-result");
    } catch (err: any) {
      console.error("Failed to load result:", err);
    }
  };

  const handleViewLeaderboard = (testId: string) => {
    setActiveTestId(testId);
    setCurrentView("student-leaderboard");
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center text-slate-600 font-semibold">
        Loading portal...
      </div>
    );
  }

  // Not logged in states
  if (!session) {
    if (currentView === "admin-login") {
      return (
        <div className="min-h-screen bg-[#f1f5f9] flex flex-col text-slate-800">
          <Header session={null} onLogout={handleLogout} />
          <div className="flex-1">
            <AdminLogin
              onLoginSuccess={(newSession) => {
                setSession(newSession);
                setCurrentView("admin-dashboard");
              }}
              onCancel={() => {
                setCurrentView("student-dashboard");
                window.location.hash = "";
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f1f5f9] flex flex-col text-slate-800">
        <Header session={null} onLogout={handleLogout} />
        <div className="flex-1">
          <StudentLogin
            onLoginSuccess={(newSession) => {
              setSession(newSession);
              setCurrentView("student-dashboard");
            }}
          />
        </div>
        {/* Subtle Admin Portal Link for the Institute Owner */}
        <footer className="py-4 border-t border-slate-300 bg-white text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} AN TECH. All rights reserved. • Build • Automate • Innovate</span>
            <button
              onClick={() => {
                window.location.hash = "#admin";
                setCurrentView("admin-login");
              }}
              className="text-slate-600 hover:text-sky-600 flex items-center gap-1 text-[11px] font-semibold transition"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administrator Portal</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Admin Logged In
  if (session.role === "admin") {
    return (
      <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col">
        <Header
          session={session}
          onLogout={handleLogout}
          onNavigateHome={() => setCurrentView("admin-dashboard")}
        />
        <main className="flex-1">
          <AdminDashboard />
        </main>
        <footer className="py-4 border-t border-slate-300 bg-white text-center text-xs text-slate-500 font-medium">
          AN TECH CBT System • Master Administration Console
        </footer>
      </div>
    );
  }

  // Student Logged In
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col">
      {/* Hide standard header during active test taking to prevent distraction */}
      {currentView !== "student-test" && (
        <Header
          session={session}
          onLogout={handleLogout}
          onNavigateHome={() => setCurrentView("student-dashboard")}
        />
      )}

      <main className="flex-1">
        {currentView === "student-dashboard" && (
          <StudentDashboard
            session={session}
            onStartTest={handleStartTest}
            onViewResult={handleViewResultById}
            onViewLeaderboard={handleViewLeaderboard}
          />
        )}

        {currentView === "student-test" && activeTestId && (
          <TestInterface
            testId={activeTestId}
            onFinishTest={handleFinishTest}
            onExit={() => setCurrentView("student-dashboard")}
          />
        )}

        {currentView === "student-result" && activeResult && (
          <ResultView
            result={activeResult}
            onBackToDashboard={() => setCurrentView("student-dashboard")}
            onViewLeaderboard={handleViewLeaderboard}
          />
        )}

        {currentView === "student-leaderboard" && activeTestId && (
          <BatchLeaderboard
            testId={activeTestId}
            onBack={() => {
              if (activeResult) {
                setCurrentView("student-result");
              } else {
                setCurrentView("student-dashboard");
              }
            }}
          />
        )}
      </main>

      {currentView !== "student-test" && (
        <footer className="py-4 border-t border-slate-300 bg-white text-center text-xs text-slate-500 font-medium">
          AN TECH Computer Based Testing Platform • Build • Automate • Innovate
        </footer>
      )}
    </div>
  );
}
