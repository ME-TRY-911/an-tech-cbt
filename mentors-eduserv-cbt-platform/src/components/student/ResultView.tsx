import React, { useState } from "react";
import {
  Trophy,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Target,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
} from "lucide-react";
import { TestResult } from "../../types";
import { Logo } from "../Logo";

interface ResultViewProps {
  result: TestResult;
  onBackToDashboard: () => void;
  onViewLeaderboard: (testId: string) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onBackToDashboard,
  onViewLeaderboard,
}) => {
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "unattempted">("all");
  const [expandedSolutions, setExpandedSolutions] = useState<Record<number, boolean>>({});

  const toggleSolution = (qNum: number) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [qNum]: !prev[qNum],
    }));
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  };

  const filteredQuestions = result.questionAnalysis.filter((q) => {
    if (filter === "correct") return q.isCorrect;
    if (filter === "wrong") return q.isAttempted && !q.isCorrect;
    if (filter === "unattempted") return !q.isAttempted;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          id="btn-result-back"
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-100 bg-white border border-slate-300 px-3.5 py-2 rounded shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        {result.enableLeaderboard && (
          <button
            onClick={() => onViewLeaderboard(result.testId)}
            id="btn-result-leaderboard"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-4 py-2 rounded transition shadow-xs cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>Batch Leaderboard</span>
          </button>
        )}
      </div>

      {/* Header Test Summary Card */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <Logo size="sm" showText subtitle="Official CBT Scorecard" />
          <span className="text-xs text-slate-500 font-mono">
            {new Date(result.submittedAt).toLocaleDateString()} at{" "}
            {new Date(result.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">
          {result.testTitle}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-bold border border-slate-300">
            Student: {result.studentName} ({result.studentCustomId})
          </span>
          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded font-bold border border-blue-200">
            Batch: {result.batchName}
          </span>
        </div>
      </div>

      {/* Primary Score & Rank Cards (Vertical mobile friendly) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Score Card */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Score
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">
            {result.score}
            <span className="text-xs sm:text-sm font-normal text-slate-500"> / {result.maxMarks}</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-1 font-semibold">
            {result.percentage}% Percentage
          </div>
        </div>

        {/* Accuracy Card */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Accuracy
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600">
            {result.accuracy}%
          </div>
          <div className="text-[11px] text-slate-600 mt-1 font-semibold">
            {result.correct} of {result.attempted} Attempted
          </div>
        </div>

        {/* Batch Rank Card */}
        <div className="bg-amber-50/50 border border-amber-300 rounded-lg p-4 text-center shadow-xs">
          <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Batch Rank</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700">
            #{result.rankInBatch}
            <span className="text-xs sm:text-sm font-normal text-slate-500"> / {result.totalStudentsInBatch}</span>
          </div>
          <div className="text-[11px] text-amber-800 mt-1 font-semibold">
            In {result.batchName}
          </div>
        </div>

        {/* Time Taken Card */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Time Taken</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {formatTime(result.timeTakenSec)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 font-semibold">
            Total {result.totalQuestions} Questions
          </div>
        </div>
      </div>

      {/* Breakdown Badges Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs font-bold">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between text-emerald-800">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Correct ({result.correct})</span>
          </div>
          <span className="text-emerald-700 font-mono">+{result.correct * result.positiveMarksPerQ} M</span>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between text-red-800">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>Wrong ({result.wrong})</span>
          </div>
          <span className="text-red-700 font-mono">-{result.wrong * result.negativeMarksPerQ} M</span>
        </div>

        <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 flex items-center justify-between text-slate-700">
          <div className="flex items-center gap-1.5">
            <MinusCircle className="w-4 h-4 text-slate-500" />
            <span>Unattempted ({result.unattempted})</span>
          </div>
          <span className="text-slate-500 font-mono">0 M</span>
        </div>
      </div>

      {/* Detailed Question Analysis Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300 pb-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Question-by-Question Analysis</span>
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                filter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              All ({result.totalQuestions})
            </button>
            <button
              onClick={() => setFilter("correct")}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                filter === "correct"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Correct ({result.correct})
            </button>
            <button
              onClick={() => setFilter("wrong")}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                filter === "wrong"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Wrong ({result.wrong})
            </button>
            <button
              onClick={() => setFilter("unattempted")}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                filter === "unattempted"
                  ? "bg-slate-600 text-white border-slate-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Unattempted ({result.unattempted})
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const isCorr = q.isCorrect;
            const isAtt = q.isAttempted;
            const hasSolution = Boolean(q.solution && q.solution.trim());
            const isSolExpanded = expandedSolutions[q.questionNumber];

            return (
              <div
                key={q.questionNumber}
                className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-xs space-y-3.5"
              >
                {/* Header status bar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs bg-slate-900 px-2.5 py-0.5 rounded text-white">
                      Q {q.questionNumber}
                    </span>
                    {isAtt ? (
                      isCorr ? (
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Correct
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-800 flex items-center gap-1 bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                          <XCircle className="w-3.5 h-3.5 text-red-600" /> Wrong
                        </span>
                      )
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                        <MinusCircle className="w-3.5 h-3.5 text-slate-500" /> Not Attempted
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono font-bold">
                    {q.marksAwarded > 0 ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">+{q.marksAwarded} Marks</span>
                    ) : q.marksAwarded < 0 ? (
                      <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">{q.marksAwarded} Marks</span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">0 Marks</span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-sm font-medium text-slate-900 whitespace-pre-line leading-relaxed">
                  {q.questionText}
                </div>

                {/* Question Diagram / Image */}
                {q.imageUrl && (
                  <div className="my-2 rounded border border-slate-300 bg-slate-50 p-2 max-w-md">
                    <img
                      src={q.imageUrl}
                      alt={`Q${q.questionNumber} Diagram`}
                      className="max-h-60 object-contain mx-auto"
                    />
                  </div>
                )}

                {/* Options with Answer indicators OR Numerical Answer display */}
                {q.questionType !== "integer" ? (
                  <div className="grid gap-2 pt-1">
                    {(["A", "B", "C", "D"] as const).map((optKey) => {
                      const optText = q.options?.[optKey];
                      const optImg = q.optionImages?.[optKey];
                      const isCorrectOpt = q.correctAnswer.toUpperCase() === optKey;
                      const isStudentOpt = q.studentAnswer?.toUpperCase() === optKey;

                      let rowStyle = "bg-white border-slate-200 text-slate-700";
                      if (isCorrectOpt) {
                        rowStyle = "bg-emerald-50/70 border-emerald-300 text-slate-900 font-medium";
                      }
                      if (isStudentOpt && !isCorrectOpt) {
                        rowStyle = "bg-red-50/70 border-red-300 text-slate-900";
                      }

                      return (
                        <div
                          key={optKey}
                          className={`p-3 rounded-lg border-2 text-xs sm:text-sm flex flex-col gap-2 ${rowStyle}`}
                        >
                          <div className="flex items-start justify-between gap-3 w-full">
                            <div className="flex items-start gap-2.5 flex-1">
                              <span
                                className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border ${
                                  isCorrectOpt
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : isStudentOpt
                                    ? "bg-red-600 border-red-600 text-white"
                                    : "bg-white border-slate-300 text-slate-700"
                                }`}
                              >
                                {optKey}
                              </span>
                              <span className="leading-snug">{optText || <span className="text-slate-400 italic">Option {optKey}</span>}</span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold">
                              {isCorrectOpt && (
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                                  Correct Answer
                                </span>
                              )}
                              {isStudentOpt && !isCorrectOpt && (
                                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-300">
                                  Your Answer
                                </span>
                              )}
                              {isStudentOpt && isCorrectOpt && (
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                                  Your Answer ✓
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Option Diagram (if any) */}
                          {optImg && (
                            <div className="ml-8 max-w-xs border border-slate-200 rounded p-1 bg-white">
                              <img
                                src={optImg}
                                alt={`Option ${optKey} Diagram`}
                                className="max-h-28 object-contain"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Numerical / Integer Answer Display */
                  <div className="p-3.5 bg-purple-50/70 border-2 border-purple-200 rounded-lg space-y-2 text-xs sm:text-sm">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5">
                      <span>Type: Numerical / Integer Answer</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-2.5 bg-white rounded border border-purple-200">
                        <span className="text-xs text-slate-500 font-medium block mb-0.5">Correct Answer:</span>
                        <span className="font-mono font-black text-emerald-700 text-base">{q.correctAnswer}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded border border-purple-200">
                        <span className="text-xs text-slate-500 font-medium block mb-0.5">Your Submitted Answer:</span>
                        {q.studentAnswer ? (
                          <span
                            className={`font-mono font-black text-base ${
                              q.isCorrect ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {q.studentAnswer} {q.isCorrect ? "✓" : "✗"}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Answered</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Solution Dropdown if available */}
                {hasSolution && (
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      onClick={() => toggleSolution(q.questionNumber)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition py-1 cursor-pointer"
                    >
                      <span>{isSolExpanded ? "Hide Explanation / Solution" : "View Explanation / Solution"}</span>
                      {isSolExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isSolExpanded && (
                      <div className="mt-2 p-3.5 bg-blue-50/50 border border-blue-200 rounded text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                          Solution Explanation:
                        </div>
                        {q.solution}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
