import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  LayoutGrid,
  RotateCcw,
  Check,
  Hash,
  Delete as DeleteIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { TestResult } from "../../types";
import { Logo } from "../Logo";

interface TestInterfaceProps {
  testId: string;
  onFinishTest: (result: TestResult) => void;
  onExit: () => void;
}

export const TestInterface: React.FC<TestInterfaceProps> = ({
  testId,
  onFinishTest,
  onExit,
}) => {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [markedForReview, setMarkedForReview] = useState<number[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPaletteDrawer, setShowPaletteDrawer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-submit helper
  const handleFinalSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    try {
      setSubmitting(true);
      setShowSubmitModal(false);
      const result = await api.submitTest(attemptId, answers);
      onFinishTest(result);
    } catch (err: any) {
      setError(err.message || "Failed to submit test. Please retry.");
      setSubmitting(false);
    }
  }, [attemptId, answers, onFinishTest, submitting]);

  // Load attempt
  useEffect(() => {
    let mounted = true;
    async function loadTest() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.startTest(testId);
        if (!mounted) return;

        setAttemptId(data.attemptId);
        setTestData(data.test);
        setAnswers(data.answers || {});
        setMarkedForReview(data.markedForReview || []);
        setRemainingSeconds(data.remainingSeconds);

        if (data.remainingSeconds <= 0) {
          // If already timed out, submit
          handleFinalSubmit();
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || "Failed to initialize test");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTest();
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testId]);

  // Timer interval countdown
  useEffect(() => {
    if (remainingSeconds <= 0 || loading || submitting) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds, loading, submitting, handleFinalSubmit]);

  // Debounced auto-save function
  const triggerAutoSave = (newAnswers: Record<number, string>, newMarked: number[]) => {
    if (!attemptId) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.saveAnswers(attemptId, newAnswers, newMarked);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 400);
  };

  const handleSelectOption = (optionKey: string) => {
    if (!testData) return;
    const qNum = testData.questions[currentIdx].questionNumber;
    const newAnswers = { ...answers, [qNum]: optionKey };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, markedForReview);
  };

  const handleNumericInput = (val: string) => {
    if (!testData) return;
    const qNum = testData.questions[currentIdx].questionNumber;
    const newAnswers = { ...answers, [qNum]: val };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, markedForReview);
  };

  const handleKeypadPress = (key: string) => {
    if (!testData) return;
    const qNum = testData.questions[currentIdx].questionNumber;
    const currentVal = String(answers[qNum] || "");

    let newVal = currentVal;
    if (key === "CLEAR") {
      newVal = "";
    } else if (key === "BACK") {
      newVal = currentVal.slice(0, -1);
    } else if (key === "-") {
      if (currentVal.startsWith("-")) {
        newVal = currentVal.slice(1);
      } else {
        newVal = "-" + currentVal;
      }
    } else if (key === ".") {
      if (!currentVal.includes(".")) {
        newVal = currentVal === "" ? "0." : currentVal + ".";
      }
    } else {
      // Numbers 0-9
      newVal = currentVal + key;
    }

    const newAnswers = { ...answers, [qNum]: newVal };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, markedForReview);
  };

  const handleClearResponse = () => {
    if (!testData) return;
    const qNum = testData.questions[currentIdx].questionNumber;
    const newAnswers = { ...answers };
    delete newAnswers[qNum];
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, markedForReview);
  };

  const handleToggleMarkForReview = () => {
    if (!testData) return;
    const qNum = testData.questions[currentIdx].questionNumber;
    let newMarked = [...markedForReview];
    if (newMarked.includes(qNum)) {
      newMarked = newMarked.filter((n) => n !== qNum);
    } else {
      newMarked.push(qNum);
    }
    setMarkedForReview(newMarked);
    triggerAutoSave(answers, newMarked);
  };

  const handleNext = () => {
    if (testData && currentIdx < testData.questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white">Starting CBT Test...</h2>
        <p className="text-xs text-slate-400 mt-1">Preparing your examination environment</p>
      </div>
    );
  }

  if (error || !testData) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-xl text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Unable to Load Test</h2>
        <p className="text-xs text-slate-400 mt-2 mb-4">{error || "Test not available"}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = testData.questions[currentIdx];
  const qNumber = currentQuestion.questionNumber;
  const isInteger = currentQuestion.questionType === "integer";
  const selectedOption = answers[qNumber];
  const isMarked = markedForReview.includes(qNumber);

  // Statistics for submission modal
  const answeredCount = Object.keys(answers).filter((k) => String(answers[Number(k)] || "").trim() !== "").length;
  const unansweredCount = testData.questions.length - answeredCount;
  const markedCount = markedForReview.length;

  const isLowTime = remainingSeconds < 300; // < 5 mins
  const isCriticalTime = remainingSeconds < 60; // < 1 min

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col pb-24 sm:pb-20 select-none">
      {/* Top Fixed CBT Header */}
      <header className="bg-white border-b-2 border-slate-900 sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Institute & Test Title */}
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            <Logo size="xs" />
            <div className="min-w-0 truncate">
              <div className="text-[10px] sm:text-xs font-black text-slate-950 uppercase tracking-tight truncate font-sans">
                AN <span className="text-sky-600">TECH</span> CBT
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                {testData.title}
              </div>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 font-medium">
            {saveStatus === "saving" ? (
              <span className="text-amber-700 font-semibold animate-pulse">Saving...</span>
            ) : saveStatus === "error" ? (
              <span className="text-red-600 font-semibold">Offline / Sync error</span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> Auto-saved
              </span>
            )}
          </div>

          {/* Countdown Timer in Geometric Balance Style */}
          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded font-mono font-bold text-xs sm:text-sm border transition ${
              isCriticalTime
                ? "bg-red-100 text-red-800 border-red-300 animate-pulse"
                : isLowTime
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-700 shrink-0" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Question Palette Drawer Trigger (Mobile) */}
          <button
            onClick={() => setShowPaletteDrawer(true)}
            id="btn-open-palette"
            className="lg:hidden p-2 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 flex items-center gap-1 text-xs font-bold shadow-xs"
            title="Questions Palette"
          >
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Questions</span>
          </button>
        </div>
      </header>

      {/* Main Examination View Area */}
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Question Container (8 cols on desktop) */}
        <section className="lg:col-span-8 bg-white border border-slate-300 rounded-lg p-5 sm:p-7 shadow-xs flex flex-col min-h-[460px]">
          {/* Question Status Bar */}
          <div className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3 flex items-center justify-between">
            <span>
              {testData.subject} SECTION &bull; QUESTION {currentIdx + 1} OF {testData.questions.length}
            </span>
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${
                isInteger
                  ? "bg-purple-100 text-purple-800 border-purple-300"
                  : "bg-blue-100 text-blue-800 border-blue-300"
              }`}
            >
              {isInteger ? "NUMERICAL VALUE" : "SINGLE CHOICE (MCQ)"}
            </span>
          </div>

          {/* Question Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-slate-900 text-white font-bold text-xs px-3 py-1 rounded-xs">
                {currentIdx + 1}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Question {qNumber}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                +{testData.positiveMarks}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                -{testData.negativeMarks}
              </span>
              {testData.unattemptedMarks !== undefined && testData.unattemptedMarks !== 0 && (
                <>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300" title="Marks for Blank / Unattempted">
                    {testData.unattemptedMarks > 0 ? `+${testData.unattemptedMarks}` : testData.unattemptedMarks} Blank
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Question Text & Diagram */}
          <div className="flex-1 space-y-4">
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed whitespace-pre-line font-sans">
              {currentQuestion.questionText}
            </div>

            {/* Question Diagram / Image */}
            {currentQuestion.imageUrl && (
              <div className="my-3 rounded-lg overflow-hidden border border-slate-300 bg-slate-50 p-2 max-w-lg">
                <img
                  src={currentQuestion.imageUrl}
                  alt={`Question ${qNumber} Diagram`}
                  className="w-full max-h-72 object-contain mx-auto"
                />
              </div>
            )}

            {/* Options List with Geometric Balance option cards OR Numerical input */}
            {!isInteger ? (
              <div className="space-y-2.5 pt-2">
                {(["A", "B", "C", "D"] as const).map((optKey) => {
                  const optText = currentQuestion.options?.[optKey];
                  const optImg = currentQuestion.optionImages?.[optKey];
                  const isSelected = selectedOption === optKey;

                  return (
                    <button
                      key={optKey}
                      type="button"
                      onClick={() => handleSelectOption(optKey)}
                      id={`btn-option-${qNumber}-${optKey}`}
                      className={`w-full min-h-[48px] px-4 py-3 rounded-lg text-left text-sm font-medium transition flex flex-col gap-2 border-2 ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/70 text-slate-900 shadow-xs"
                          : "border-slate-200 hover:border-blue-500 hover:bg-slate-50 bg-white text-slate-800"
                      } active:scale-[0.99] cursor-pointer`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span
                          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border-2 transition ${
                            isSelected
                              ? "bg-blue-500 text-white border-blue-500"
                              : "border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          {optKey}
                        </span>
                        <span className="flex-1 leading-snug break-words">
                          {optText || <span className="text-slate-400 italic">Option {optKey}</span>}
                        </span>
                      </div>

                      {/* Option Diagram (if provided) */}
                      {optImg && (
                        <div className="ml-11 max-w-xs border border-slate-200 rounded p-1 bg-white">
                          <img
                            src={optImg}
                            alt={`Option ${optKey} Diagram`}
                            className="max-h-32 object-contain"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Numerical / Integer Answer Input & Virtual Keypad */
              <div className="pt-3 space-y-4">
                <div className="bg-purple-50/60 border-2 border-purple-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-purple-700" />
                      <span>Enter Numerical Answer:</span>
                    </label>
                    <span className="text-[11px] text-purple-700 font-medium">
                      Type using keyboard or virtual keypad below
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={selectedOption || ""}
                      onChange={(e) => handleNumericInput(e.target.value)}
                      placeholder="Type answer..."
                      className="w-full sm:w-64 px-4 py-2.5 bg-white border-2 border-purple-400 focus:border-purple-600 rounded-lg text-lg font-mono font-black text-purple-950 outline-none shadow-xs tracking-wider"
                    />
                    {selectedOption && (
                      <button
                        type="button"
                        onClick={handleClearResponse}
                        className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded text-xs font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Virtual CBT Numeric Keypad */}
                  <div className="pt-2 border-t border-purple-200">
                    <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-2">
                      On-Screen CBT Keypad:
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-w-xs">
                      {["7", "8", "9", "BACK", "4", "5", "6", "CLEAR", "1", "2", "3", "-", "0", ".", "", ""].map(
                        (key, kIdx) => {
                          if (!key) return <div key={kIdx} />;
                          const isSpecial = key === "BACK" || key === "CLEAR";
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleKeypadPress(key)}
                              className={`h-11 rounded font-mono font-bold text-sm transition flex items-center justify-center border cursor-pointer active:scale-95 shadow-xs ${
                                isSpecial
                                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300 text-xs"
                                  : "bg-white hover:bg-purple-100 text-purple-950 border-purple-300 hover:border-purple-400"
                              }`}
                            >
                              {key === "BACK" ? (
                                <DeleteIcon className="w-4 h-4 text-slate-700" />
                              ) : (
                                key
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions (Clear response & Mark for review) */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-6">
            <button
              type="button"
              onClick={handleClearResponse}
              disabled={!selectedOption || String(selectedOption).trim() === ""}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 flex items-center gap-1 transition py-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Response</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMarkForReview}
              className={`text-xs font-semibold px-3 py-1.5 rounded border flex items-center gap-1.5 transition cursor-pointer ${
                isMarked
                  ? "bg-purple-50 text-purple-700 border-purple-300"
                  : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isMarked ? "fill-purple-600 text-purple-600" : ""}`} />
              <span>{isMarked ? "Marked for Review" : "Mark for Review"}</span>
            </button>
          </div>
        </section>

        {/* Right Desktop Palette (4 cols on desktop) */}
        <aside className="hidden lg:block lg:col-span-4 bg-slate-50 border border-slate-300 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4 text-slate-700" />
              <span>Question Palette</span>
            </h3>
            <span className="text-xs font-semibold text-slate-600">
              {answeredCount}/{testData.questions.length}
            </span>
          </div>

          {/* Question Grid */}
          <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
            {testData.questions.map((q: any, index: number) => {
              const num = q.questionNumber;
              const hasAnswer = Boolean(answers[num] !== undefined && String(answers[num]).trim() !== "");
              const marked = markedForReview.includes(num);
              const isCurrent = index === currentIdx;

              let btnClass = "bg-white border-slate-300 text-slate-700 hover:bg-slate-100";
              if (hasAnswer) {
                btnClass = "bg-green-500 border-green-600 text-white font-bold";
              }
              if (marked) {
                btnClass = hasAnswer
                  ? "bg-purple-500 border-green-500 text-white font-bold ring-2 ring-green-500"
                  : "bg-purple-500 border-purple-600 text-white font-bold";
              }
              if (isCurrent) {
                btnClass += " border-2 border-slate-900 font-extrabold";
              }

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCurrentIdx(index)}
                  className={`aspect-square rounded text-xs font-semibold flex items-center justify-center transition border cursor-pointer ${btnClass}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="p-3 bg-white border border-slate-200 rounded grid grid-cols-2 gap-2 text-[11px] text-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-xs bg-green-500"></div>
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-xs bg-white border border-slate-300"></div>
              <span>Not Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-xs bg-purple-500"></div>
              <span>For Review ({markedCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-xs border-2 border-slate-900"></div>
              <span>Current</span>
            </div>
          </div>

          {/* Direct Submit from palette */}
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Test</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Bottom Sticky Navigation Bar */}
      <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-300 p-3 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Previous Button */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToggleMarkForReview}
              className={`min-h-[40px] px-3.5 py-2 font-semibold text-xs rounded border transition flex items-center gap-1.5 cursor-pointer ${
                isMarked
                  ? "bg-purple-50 text-purple-700 border-purple-300"
                  : "bg-white text-slate-800 hover:bg-slate-100 border-slate-300"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Review</span>
            </button>
            <button
              type="button"
              onClick={handleClearResponse}
              disabled={!selectedOption}
              className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-800 font-semibold text-xs rounded border border-slate-300 transition cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Middle summary info on mobile */}
          <div className="text-center text-[11px] text-slate-600 font-semibold">
            <span className="text-green-600 font-bold">{answeredCount}</span>/{testData.questions.length} Answered
          </div>

          {/* Navigation & Submit Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-800 font-semibold text-xs rounded border border-slate-300 flex items-center gap-1 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {currentIdx < testData.questions.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                id="btn-save-next"
                className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1 transition active:scale-[0.98] cursor-pointer"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                id="btn-final-submit"
                className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Test</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Mobile Question Palette Drawer Modal */}
      {showPaletteDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-slate-300 rounded-t-xl sm:rounded-xl p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-600" />
                <span>Questions Palette</span>
              </h3>
              <button
                onClick={() => setShowPaletteDrawer(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-green-500" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-white border border-slate-300" />
                <span>Not Visited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-purple-500" />
                <span>For Review ({markedCount})</span>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2 overflow-y-auto py-2 flex-1">
              {testData.questions.map((q: any, index: number) => {
                const num = q.questionNumber;
                const hasAnswer = Boolean(answers[num] !== undefined && String(answers[num]).trim() !== "");
                const marked = markedForReview.includes(num);
                const isCurrent = index === currentIdx;

                let btnClass = "bg-white border-slate-300 text-slate-700";
                if (hasAnswer) btnClass = "bg-green-500 border-green-600 text-white font-bold";
                if (marked) btnClass = "bg-purple-500 border-purple-600 text-white font-bold";
                if (isCurrent) btnClass += " border-2 border-slate-900";

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setCurrentIdx(index);
                      setShowPaletteDrawer(false);
                    }}
                    className={`h-10 rounded text-xs font-semibold flex items-center justify-center transition border ${btnClass}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => {
                  setShowPaletteDrawer(false);
                  setShowSubmitModal(true);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Examination</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-300 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-slate-900">Submit Test?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to finish and submit your answers?
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Total Questions:</span>
                <span className="font-bold text-slate-900">{testData.questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Answered:</span>
                <span>{answeredCount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unanswered:</span>
                <span>{unansweredCount}</span>
              </div>
              {markedCount > 0 && (
                <div className="flex justify-between text-purple-700 font-semibold">
                  <span>Marked for Review:</span>
                  <span>{markedCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                id="btn-confirm-submit"
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold rounded shadow-xs flex items-center justify-center gap-1.5"
              >
                {submitting ? <span>Calculating...</span> : <span>Confirm Submit</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
