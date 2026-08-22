import React, { useEffect, useState } from "react";
import { Clock, HelpCircle, Award, CheckCircle2, ChevronRight, PlayCircle, Trophy, BarChart3 } from "lucide-react";
import { api } from "../../lib/api";
import { AuthSession } from "../../types";

interface StudentDashboardProps {
  session: AuthSession;
  onStartTest: (testId: string) => void;
  onViewResult: (resultId: string) => void;
  onViewLeaderboard: (testId: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  session,
  onStartTest,
  onViewResult,
  onViewLeaderboard,
}) => {
  const [tests, setTests] = useState<any[]>([]);
  const [myResults, setMyResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [testsData, resultsData] = await Promise.all([
        api.getStudentTests(),
        api.getMyResults(),
      ]);
      setTests(testsData);
      setMyResults(resultsData);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableTests = tests.filter((t) => !t.isCompleted);
  const completedTests = tests.filter((t) => t.isCompleted);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Student Welcome Header Banner */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Student CBT Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Welcome, {session.user.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300 font-mono font-bold">
                ID: {session.user.studentId}
              </span>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200 font-bold">
                Batch: {session.user.batchName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded self-start sm:self-auto">
            <div className="text-center pr-3 border-r border-slate-300">
              <div className="text-xl font-black text-emerald-600">
                {availableTests.length}
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Available</div>
            </div>
            <div className="text-center pl-1">
              <div className="text-xl font-black text-blue-600">
                {myResults.length}
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Available Tests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-blue-600" />
            <span>Available Tests</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            Assigned to {session.user.batchName}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white border border-slate-300 rounded-lg text-slate-500 text-sm font-semibold">
            Loading assigned tests...
          </div>
        ) : availableTests.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-300 rounded-lg shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-bold text-slate-900">No pending tests</p>
            <p className="text-xs text-slate-500 mt-1">
              You have completed all tests currently assigned to your batch.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {availableTests.map((test) => (
              <div
                key={test.id}
                className="bg-white border-2 border-slate-200 hover:border-blue-500 rounded-lg p-4 sm:p-5 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {test.subject}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Marking: <strong className="text-emerald-600 font-bold">+{test.positiveMarks}</strong> / <strong className="text-red-600 font-bold">-{test.negativeMarks}</strong>
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                    {test.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-slate-400" />
                      {test.totalQuestions} Questions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {test.durationMinutes} Minutes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-slate-400" />
                      Max {test.totalMarks} Marks
                    </span>
                  </div>
                </div>

                <div className="pt-2 sm:pt-0 shrink-0">
                  <button
                    onClick={() => onStartTest(test.id)}
                    id={`btn-start-test-${test.id}`}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded shadow-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <span>{test.hasActiveAttempt ? "Resume Test" : "Start Test"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Tests Section */}
      {myResults.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Completed Tests & Results</span>
          </h2>

          <div className="grid gap-3">
            {myResults.map((res) => (
              <div
                key={res.id}
                className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Completed
                    </span>
                    <span className="text-xs font-medium text-slate-500">{res.subject}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {res.testTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                    <span>
                      Score: <strong className="text-emerald-700 font-bold text-sm">{res.score}</strong> / {res.maxMarks}
                    </span>
                    <span>
                      Accuracy: <strong className="text-blue-700 font-bold">{res.accuracy}%</strong>
                    </span>
                    <span>
                      Percentage: <strong className="font-bold">{res.percentage}%</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onViewResult(res.id)}
                    id={`btn-view-result-${res.id}`}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded border border-slate-300 transition cursor-pointer shadow-xs"
                  >
                    View Result
                  </button>
                  <button
                    onClick={() => onViewLeaderboard(res.testId)}
                    id={`btn-view-leaderboard-${res.testId}`}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded border border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                    <span>Batch Rank</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
