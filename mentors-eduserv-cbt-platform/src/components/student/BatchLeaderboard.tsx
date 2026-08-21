import React, { useEffect, useState } from "react";
import { Trophy, Medal, ArrowLeft, Clock, Target, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { LeaderboardEntry } from "../../types";

interface BatchLeaderboardProps {
  testId: string;
  onBack: () => void;
}

export const BatchLeaderboard: React.FC<BatchLeaderboardProps> = ({ testId, onBack }) => {
  const [data, setData] = useState<{
    testTitle: string;
    batchName: string;
    totalStudents: number;
    leaderboard: LeaderboardEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getLeaderboard(testId);
        setData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load batch leaderboard");
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, [testId]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center shadow-xs border border-amber-500">
          <Medal className="w-4 h-4 text-slate-900" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-300">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center border border-amber-300">
          3
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center border border-slate-300">
        #{rank}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Back Button */}
      <div>
        <button
          onClick={onBack}
          id="btn-leaderboard-back"
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-100 bg-white border border-slate-300 px-3.5 py-2 rounded shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white border border-slate-300 rounded-lg text-slate-500 text-sm font-semibold">
          Loading Batch Leaderboard...
        </div>
      ) : error ? (
        <div className="p-6 bg-white border border-slate-300 rounded-lg text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-900">Leaderboard Unavailable</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase tracking-wider mb-1">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span>Batch Leaderboard</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {data.testTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded font-bold border border-blue-200">
                Batch: {data.batchName}
              </span>
              <span className="text-slate-600 font-semibold">
                Total Submissions: <strong className="text-slate-900 font-bold">{data.totalStudents}</strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              Note: Rankings are strictly computed among students enrolled in this batch.
            </p>
          </div>

          {/* Ranking List (Mobile First Vertical Cards) */}
          <div className="space-y-2.5">
            {data.leaderboard.map((item) => {
              const isMe = item.isCurrentStudent;

              return (
                <div
                  key={item.studentId}
                  className={`p-3.5 sm:p-4 rounded-lg border-2 transition shadow-xs flex items-center justify-between gap-3 ${
                    isMe
                      ? "bg-blue-50/70 border-blue-500 text-slate-900"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  {/* Left: Rank Badge & Student Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{getRankBadge(item.rank)}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-slate-900 truncate">
                          {item.studentName}
                        </span>
                        {isMe && (
                          <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {item.studentCustomId}
                      </div>
                    </div>
                  </div>

                  {/* Right: Score, Accuracy, Time */}
                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                      {item.score} <span className="text-xs text-slate-500 font-normal">/ {item.maxMarks}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-blue-600" />
                        {item.accuracy}%
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTime(item.timeTakenSec)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
