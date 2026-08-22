import React, { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Users,
  Layers,
  BarChart2,
  Plus,
  Trash2,
  Edit2,
  Key,
  Eye,
  Check,
  X,
  HelpCircle,
  Trophy,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  Send,
  FileCheck,
  Image as ImageIcon,
  Hash,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  PlusCircle,
  Cloud,
} from "lucide-react";
import { api } from "../../lib/api";
import { Batch, Student, Test } from "../../types";

type AdminTab = "create-test" | "tests" | "students" | "batches" | "results";

export const AdminDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>("create-test");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Test Creation Form State
  const [testTitle, setTestTitle] = useState("");
  const [testSubject, setTestSubject] = useState("Physics");
  const [testBatchId, setTestBatchId] = useState("");
  const [testDuration, setTestDuration] = useState(60);
  const [testPosMarks, setTestPosMarks] = useState(4);
  const [testNegMarks, setTestNegMarks] = useState(1);
  const [testUnattemptedMarks, setTestUnattemptedMarks] = useState(0);
  const [testEnableLeaderboard, setTestEnableLeaderboard] = useState(true);

  // Question Extraction State
  const [paperText, setPaperText] = useState("");
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractingAI, setExtractingAI] = useState(false);

  // AI Review questions state
  const [reviewedQuestions, setReviewedQuestions] = useState<any[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [manualCountInput, setManualCountInput] = useState<number>(10);
  const [manualTypeSelect, setManualTypeSelect] = useState<"mcq" | "integer">("mcq");

  // Student Creation State
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("password123");
  const [newStudentBatchId, setNewStudentBatchId] = useState("");
  const [resetPwdModal, setResetPwdModal] = useState<{ studentId: string; studentName: string } | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  // Batch Creation State
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchCode, setNewBatchCode] = useState("");
  const [newBatchDesc, setNewBatchDesc] = useState("");

  // Result filter state
  const [selectedResultTest, setSelectedResultTest] = useState<string>("");
  const [selectedResultBatch, setSelectedResultBatch] = useState<string>("");
  const [selectedResultDetail, setSelectedResultDetail] = useState<any | null>(null);

  // Safe In-App Delete Confirmation Modal State (Replaces blocked window.confirm)
  const [deleteModal, setDeleteModal] = useState<{
    type: "test" | "batch" | "student";
    id: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<any>(null);

  // Initial Data Fetch
  const refreshAllData = async () => {
    try {
      setLoading(true);
      const [batchesRes, studentsRes, testsRes, resultsRes] = await Promise.all([
        api.getBatches(),
        api.getStudents(),
        api.getAdminTests(),
        api.getAdminResults(),
      ]);
      setBatches(batchesRes);
      setStudents(studentsRes);
      setTests(testsRes);
      setResults(resultsRes);

      if (batchesRes.length > 0) {
        setTestBatchId((prev) => (prev && batchesRes.some((b) => b.id === prev) ? prev : batchesRes[0].id));
        setNewStudentBatchId((prev) => (prev && batchesRes.some((b) => b.id === prev) ? prev : batchesRes[0].id));
      } else {
        setTestBatchId("");
        setNewStudentBatchId("");
      }

      // Check Firebase Cloud status
      api.getFirebaseStatus().then(setCloudStatus).catch(() => {});
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to load admin data" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCloud = async () => {
    try {
      setCloudSyncing(true);
      const res = await api.syncFirebase();
      if (res.success) {
        showMsg(
          "success",
          `🔥 Firebase Cloud Synced (gayaji-store)! Saved: ${res.counts.batches} Batches, ${res.counts.students} Students, ${res.counts.tests} Tests, ${res.counts.results} Results.`
        );
        setCloudStatus((prev: any) => ({
          ...prev,
          status: "connected",
          lastSyncTime: res.timestamp,
        }));
      }
    } catch (err: any) {
      showMsg("error", "Firebase sync notice: " + (err.message || "Could not sync with cloud"));
    } finally {
      setCloudSyncing(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const showMsg = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Process file upload
  const processFile = (file: File) => {
    if (!file) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(2) + " MB"
        : (file.size / 1024).toFixed(1) + " KB";

    let mime = file.type;
    const lowerName = file.name.toLowerCase();
    if (!mime) {
      if (lowerName.endsWith(".docx")) {
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (lowerName.endsWith(".doc")) {
        mime = "application/msword";
      } else if (lowerName.endsWith(".pdf")) {
        mime = "application/pdf";
      } else if (lowerName.endsWith(".txt")) {
        mime = "text/plain";
      } else if (lowerName.endsWith(".png")) {
        mime = "image/png";
      } else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
        mime = "image/jpeg";
      }
    }

    setFileName(file.name);
    setFileSize(formattedSize);
    setFileMimeType(mime || "application/pdf");

    if (file.type.includes("text") || lowerName.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || "";
        setPaperText(textContent);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.includes(",") ? result.split(",")[1] : result;
        setFileBase64(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClearFile = () => {
    setFileName(null);
    setFileSize(null);
    setFileBase64(null);
    setFileMimeType(null);
    const input = document.getElementById("input-file-upload") as HTMLInputElement;
    if (input) input.value = "";
  };

  // Trigger AI Question Extraction
  const handleExtractAI = async () => {
    if (!paperText.trim() && !fileBase64) {
      showMsg("error", "Please provide question paper content (either paste text or upload a document file)");
      return;
    }

    try {
      setExtractingAI(true);
      const res = await api.extractQuestionsAI({
        documentText: paperText.trim() || undefined,
        documentBase64: fileBase64 || undefined,
        documentMimeType: fileMimeType || undefined,
        answerKeyText: answerKeyText.trim() || undefined,
        fileName: fileName || undefined,
      });

      if (res.questions && res.questions.length > 0) {
        setReviewedQuestions(res.questions);
        const methodInfo = res.methodUsed ? ` via ${res.methodUsed}` : "";
        showMsg("success", `Successfully extracted ${res.questions.length} questions${methodInfo}! Please review below.`);
      } else {
        showMsg("error", "No questions could be detected. Please check the document formatting.");
      }
    } catch (err: any) {
      showMsg("error", err.message || "AI extraction failed");
    } finally {
      setExtractingAI(false);
    }
  };

  // Sample Paper loader for fast testing
  const handleLoadSamplePaper = () => {
    setTestTitle("JEE Advanced Physics Model Test 01");
    setTestSubject("Physics");
    setTestPosMarks(4);
    setTestNegMarks(1);
    setTestUnattemptedMarks(0);
    setPaperText(`1. A body of mass 2 kg is dropped from a height of 20 m. What is its velocity just before touching the ground? (Take g = 10 m/s²)
(A) 10 m/s
(B) 20 m/s
(C) 15 m/s
(D) 25 m/s

2. [Diagram Question] For the given circuit with resistors in series and parallel, the equivalent resistance between terminals A and B is:
(A) 2 Ω
(B) 4 Ω
(C) 6 Ω
(D) 8 Ω

3. [Integer / Numerical Type] A uniform rope of mass 4 kg and length 2 m is hanging vertically from a rigid support. A tension of 30 N is applied at a point 0.5 m from the bottom. Calculate the acceleration of the system in m/s² (Take g = 10 m/s²).

4. Which of the following is a scalar quantity?
A. Force
B. Velocity
C. Electric potential
D. Acceleration`);

    setAnswerKeyText(`1-B
2-C
3-5
4-C`);
  };

  // Helper to convert an uploaded image to base64
  const handleImageFileUpload = (file: File, callback: (base64Url: string) => void) => {
    if (!file.type.startsWith("image/")) {
      showMsg("error", "Please select a valid image file (PNG, JPG, SVG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Review question helper mutations
  const handleUpdateQuestion = (qIndex: number, field: string, value: any) => {
    const updated = [...reviewedQuestions];
    if (field.startsWith("optionImage_")) {
      const optKey = field.split("_")[1];
      const prevOptImgs = updated[qIndex].optionImages || {};
      updated[qIndex].optionImages = { ...prevOptImgs, [optKey]: value };
    } else if (field.startsWith("option_")) {
      const optKey = field.split("_")[1];
      updated[qIndex].options = { ...updated[qIndex].options, [optKey]: value };
    } else {
      updated[qIndex][field] = value;
    }
    setReviewedQuestions(updated);
  };

  const handleDeleteQuestion = (qIndex: number) => {
    const updated = reviewedQuestions.filter((_, idx) => idx !== qIndex);
    // Renumber questions sequentially
    const renumbered = updated.map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
    setReviewedQuestions(renumbered);
  };

  const handleMoveQuestion = (qIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? qIndex - 1 : qIndex + 1;
    if (targetIndex < 0 || targetIndex >= reviewedQuestions.length) return;
    const updated = [...reviewedQuestions];
    const temp = updated[qIndex];
    updated[qIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    setReviewedQuestions(updated);
  };

  const handleAutoRenumber = () => {
    const renumbered = reviewedQuestions.map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
    setReviewedQuestions(renumbered);
    showMsg("success", `All ${renumbered.length} questions renumbered sequentially (1 to ${renumbered.length})`);
  };

  const handleAddNewQuestion = (type: "mcq" | "integer" = "mcq") => {
    const nextNum = reviewedQuestions.length + 1;
    setReviewedQuestions([
      ...reviewedQuestions,
      {
        id: "q_manual_" + Date.now(),
        questionNumber: nextNum,
        questionText: type === "integer" ? "Numerical Type Question Statement" : "New MCQ Question Statement",
        questionType: type,
        options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" },
        optionImages: { A: "", B: "", C: "", D: "" },
        correctAnswer: "",
        solution: "",
        imageUrl: "",
      },
    ]);
  };

  const handleGenerateBulkQuestions = (count: number, type: "mcq" | "integer" = "mcq") => {
    if (!count || count <= 0) {
      showMsg("error", "Please enter a valid question count (e.g. 5, 10, 25, 30)");
      return;
    }
    const safeCount = Math.min(Math.max(1, count), 150);
    const startNum = reviewedQuestions.length + 1;
    const newItems: any[] = [];
    for (let i = 0; i < safeCount; i++) {
      const qNum = startNum + i;
      newItems.push({
        id: "q_bulk_" + Date.now() + "_" + i,
        questionNumber: qNum,
        questionText: `Question ${qNum} Statement`,
        questionType: type,
        options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" },
        optionImages: { A: "", B: "", C: "", D: "" },
        correctAnswer: "",
        solution: "",
        imageUrl: "",
      });
    }
    setReviewedQuestions((prev) => [...prev, ...newItems]);
    showMsg("success", `Generated ${safeCount} ${type === "integer" ? "Numerical" : "MCQ"} questions!`);
  };

  const handleApproveAllWithAnswers = () => {
    const unverified = reviewedQuestions.filter((q) => !q.correctAnswer || String(q.correctAnswer).trim() === "");
    if (unverified.length > 0) {
      showMsg("error", `Please provide/verify correct answers for Question(s): ${unverified.map((q) => q.questionNumber).join(", ")}`);
      return;
    }
    showMsg("success", "All questions and answer keys verified!");
  };

  // Publish Test
  const handleSaveAndPublishTest = async (status: "published" | "draft") => {
    if (!testTitle.trim()) {
      showMsg("error", "Please provide a Test Title");
      return;
    }
    if (!testBatchId) {
      showMsg("error", "Please select a Batch for this test");
      return;
    }
    if (reviewedQuestions.length === 0) {
      showMsg("error", "Please add or extract at least one question before saving");
      return;
    }

    if (status === "published") {
      const unverified = reviewedQuestions.filter((q) => !q.correctAnswer || String(q.correctAnswer).trim() === "");
      if (unverified.length > 0) {
        showMsg("error", `Cannot publish test: Question(s) ${unverified.map((q) => q.questionNumber).join(", ")} have unverified answers. Please specify the correct answer for all questions.`);
        return;
      }
    }

    if (!testBatchId) {
      if (batches.length === 0) {
        showMsg("error", "Please create an institute batch first in the Batches tab before creating a test.");
        return;
      }
      setTestBatchId(batches[0].id);
    }

    try {
      const targetBatchId = testBatchId || (batches[0] ? batches[0].id : "");
      if (!targetBatchId) {
        showMsg("error", "Please create and select a batch for this test.");
        return;
      }

      const payload = {
        title: testTitle.trim(),
        subject: testSubject.trim(),
        batchId: targetBatchId,
        durationMinutes: Number(testDuration),
        positiveMarks: Number(testPosMarks),
        negativeMarks: Number(testNegMarks),
        unattemptedMarks: Number(testUnattemptedMarks) || 0,
        questions: reviewedQuestions,
        enableLeaderboard: testEnableLeaderboard,
        status,
      };

      const newTest = await api.createTest(payload);
      showMsg("success", `Test "${newTest.title}" ${status === "published" ? "published successfully!" : "saved as draft!"}`);
      
      // Reset wizard
      setTestTitle("");
      setPaperText("");
      setAnswerKeyText("");
      setFileBase64(null);
      setFileName(null);
      setReviewedQuestions([]);
      refreshAllData();
      setCurrentTab("tests");
    } catch (err: any) {
      showMsg("error", err.message || "Failed to save test");
    }
  };

  // Student Actions
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batches.length === 0) {
      showMsg("error", "Please create at least one batch first in the Manage Batches tab before registering students.");
      return;
    }

    const assignedBatch = newStudentBatchId || batches[0].id;

    if (!newStudentId || !newStudentName || !newStudentPassword || !assignedBatch) {
      showMsg("error", "Please fill in all student fields");
      return;
    }

    try {
      await api.createStudent({
        studentId: newStudentId.trim().toUpperCase(),
        name: newStudentName.trim(),
        password: newStudentPassword.trim(),
        batchId: assignedBatch,
      });
      showMsg("success", `Student ${newStudentName} (${newStudentId.toUpperCase()}) created successfully`);
      setNewStudentId("");
      setNewStudentName("");
      refreshAllData();
    } catch (err: any) {
      showMsg("error", err.message || "Failed to create student");
    }
  };

  const handleToggleStudent = async (studentId: string) => {
    try {
      const res = await api.toggleStudentStatus(studentId);
      showMsg("success", res.message);
      refreshAllData();
    } catch (err: any) {
      showMsg("error", err.message || "Failed to update student status");
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdModal || !newPasswordVal.trim()) return;
    try {
      const res = await api.resetPassword(resetPwdModal.studentId, newPasswordVal.trim());
      showMsg("success", res.message);
      setResetPwdModal(null);
      setNewPasswordVal("");
    } catch (err: any) {
      showMsg("error", err.message || "Failed to reset password");
    }
  };

  // Batch Actions
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) {
      showMsg("error", "Batch name cannot be empty");
      return;
    }
    try {
      await api.createBatch({
        name: newBatchName.trim(),
        code: newBatchCode.trim() || undefined,
        description: newBatchDesc.trim() || undefined,
      });
      showMsg("success", `Batch ${newBatchName} created successfully`);
      setNewBatchName("");
      setNewBatchCode("");
      setNewBatchDesc("");
      refreshAllData();
    } catch (err: any) {
      showMsg("error", err.message || "Failed to create batch");
    }
  };

  const handleDeleteBatch = (batch: Batch) => {
    setDeleteModal({
      type: "batch",
      id: batch.id,
      title: batch.name,
      subtitle: `Code: ${batch.code || "—"} • ${batch.studentCount || 0} Students • ${batch.testCount || 0} Tests`,
    });
  };

  const handleDeleteStudent = (student: Student) => {
    setDeleteModal({
      type: "student",
      id: student.id,
      title: student.name,
      subtitle: `Student ID: ${student.studentId} • Batch: ${student.batchName}`,
    });
  };

  // Test Actions
  const handleTogglePublishTest = async (test: Test) => {
    try {
      if (test.status === "published") {
        await api.unpublishTest(test.id);
        showMsg("success", `Test moved to draft`);
      } else {
        await api.publishTest(test.id);
        showMsg("success", `Test published successfully! Students in this batch can now take it.`);
      }
      refreshAllData();
    } catch (err: any) {
      showMsg("error", err.message || "Failed to update test status");
    }
  };

  const handleDeleteTest = (test: Test) => {
    setDeleteModal({
      type: "test",
      id: test.id,
      title: test.title,
      subtitle: `${test.questions.length} Questions • ${test.durationMinutes} Mins • Total Marks: ${test.totalMarks}`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      setDeleting(true);
      if (deleteModal.type === "test") {
        await api.deleteTest(deleteModal.id);
        setTests((prev) => prev.filter((t) => t.id !== deleteModal.id));
        showMsg("success", `Test "${deleteModal.title}" deleted successfully`);
      } else if (deleteModal.type === "batch") {
        await api.deleteBatch(deleteModal.id);
        setBatches((prev) => prev.filter((b) => b.id !== deleteModal.id));
        showMsg("success", `Batch "${deleteModal.title}" deleted successfully`);
      } else if (deleteModal.type === "student") {
        await api.deleteStudent(deleteModal.id);
        setStudents((prev) => prev.filter((s) => s.id !== deleteModal.id));
        showMsg("success", `Student "${deleteModal.title}" deleted successfully`);
      }
      setDeleteModal(null);
      refreshAllData();
    } catch (err: any) {
      showMsg("error", err.message || "Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered results
  const filteredResults = results.filter((r) => {
    if (selectedResultTest && r.testId !== selectedResultTest) return false;
    if (selectedResultBatch && r.batchId !== selectedResultBatch) return false;
    return true;
  });

  // Calculate stats for AI Review
  const verifiedCount = reviewedQuestions.filter((q) => Boolean(q.correctAnswer)).length;
  const unverifiedCount = reviewedQuestions.length - verifiedCount;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Admin Banner */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Owner Control Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 font-sans">
            AN <span className="text-sky-600">TECH</span> Administration
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Private test creation, AI question extraction, student credentials & batch rankings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncCloud}
            disabled={cloudSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold transition cursor-pointer shadow-xs"
            title="Sync all data to Firebase Firestore (Project: gayaji-store)"
          >
            <Cloud className={`w-3.5 h-3.5 text-amber-600 ${cloudSyncing ? "animate-spin" : ""}`} />
            <span>{cloudSyncing ? "Syncing..." : "🔥 Cloud Sync (gayaji-store)"}</span>
          </button>

          <button
            onClick={refreshAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-300 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Admin Tabs Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 border-b border-slate-300">
        <button
          onClick={() => setCurrentTab("create-test")}
          className={`px-3.5 py-2 rounded text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
            currentTab === "create-test"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Create Test & AI Upload</span>
        </button>

        <button
          onClick={() => setCurrentTab("tests")}
          className={`px-3.5 py-2 rounded text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
            currentTab === "tests"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <FileText className="w-4 h-4 text-blue-500" />
          <span>Manage Tests ({tests.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab("students")}
          className={`px-3.5 py-2 rounded text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
            currentTab === "students"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Users className="w-4 h-4 text-indigo-500" />
          <span>Students ({students.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab("batches")}
          className={`px-3.5 py-2 rounded text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
            currentTab === "batches"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>Batches ({batches.length})</span>
        </button>

        <button
          onClick={() => setCurrentTab("results")}
          className={`px-3.5 py-2 rounded text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${
            currentTab === "results"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
          }`}
        >
          <BarChart2 className="w-4 h-4 text-amber-500" />
          <span>Results & Rankings ({results.length})</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: CREATE TEST & AI EXTRACTION / REVIEW */}
      {/* ==================================================== */}
      {currentTab === "create-test" && (
        <div className="space-y-6">
          {/* Step 1: Test Metadata & Marking Scheme */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-slate-900 text-white text-xs flex items-center justify-center font-black">
                1
              </span>
              <span>Test Configuration & Marking Scheme</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Test Title *
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="e.g. Physics Chapter Test 01 - Mechanics"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  placeholder="Physics / Chemistry / Maths / Biology"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign to Batch *
                </label>
                <select
                  value={testBatchId}
                  onChange={(e) => setTestBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-sm text-slate-900 outline-none cursor-pointer"
                >
                  {batches.length === 0 ? (
                    <option value="">No batches created - Please create a batch first</option>
                  ) : (
                    batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration (Minutes) *
                </label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={testDuration}
                  onChange={(e) => setTestDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-sm text-slate-900 font-mono outline-none"
                />
              </div>

              {/* Custom Positive, Negative & Blank Marking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    Positive (+ Marks)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={testPosMarks}
                    onChange={(e) => setTestPosMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50 border-2 border-emerald-300 rounded text-sm text-emerald-900 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-700 mb-1">
                    Negative (- Penalty)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={testNegMarks}
                    onChange={(e) => setTestNegMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-red-50 border-2 border-red-300 rounded text-sm text-red-900 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Blank / Unattempted
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={testUnattemptedMarks}
                    onChange={(e) => setTestUnattemptedMarks(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded text-sm text-slate-900 font-mono font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testEnableLeaderboard}
                  onChange={(e) => setTestEnableLeaderboard(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                />
                <span>Enable Batch Leaderboard & Rankings for students</span>
              </label>
            </div>
          </div>

            {/* Step 2: Upload Question Paper & Answer Key */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-slate-900 text-white text-xs flex items-center justify-center font-black">
                  2
                </span>
                <span>Question Creation: AI Extraction or Manual Setup</span>
              </h2>

              <button
                type="button"
                onClick={handleLoadSamplePaper}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold underline self-start sm:self-auto cursor-pointer"
              >
                Load Sample Mock Paper for Testing
              </button>
            </div>

            {/* Quick Manual Generator Box */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-blue-950">Option A: Set Total Questions & Add Manually</h3>
                    <p className="text-[11px] text-blue-800 font-medium">Generate blank numbered questions instantly without uploading files</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded border border-blue-300 shadow-2xs">
                    <span className="text-xs font-bold text-slate-700">Total Qs:</span>
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={manualCountInput}
                      onChange={(e) => setManualCountInput(Math.max(1, Number(e.target.value)))}
                      className="w-14 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 text-center outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={manualTypeSelect}
                    onChange={(e) => setManualTypeSelect(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs font-bold text-slate-800 outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="mcq">MCQ (4 Options)</option>
                    <option value="integer">Numerical / Integer</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleGenerateBulkQuestions(manualCountInput, manualTypeSelect)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Generate {manualCountInput} Questions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddNewQuestion(manualTypeSelect)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 text-xs font-bold rounded shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+1 Single</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AI Extraction Section */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Option B: Upload Paper / Text for AI Auto-Extraction</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Question Paper Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Question Paper File (PDF / Word / Text / Image)
                  </label>

                  {/* File Upload box */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition ${
                      isDragging
                        ? "border-blue-600 bg-blue-50/80 scale-[1.01]"
                        : fileName
                        ? "border-emerald-400 bg-emerald-50/40"
                        : "border-slate-300 hover:border-blue-500 bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileUpload}
                      id="input-file-upload"
                      className="hidden"
                    />

                    {fileName ? (
                      <div className="flex items-center justify-between gap-3 p-2 bg-white rounded border border-emerald-300 shadow-2xs">
                        <div className="flex items-center gap-2.5 text-left min-w-0">
                          <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{fileName}</div>
                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                              <span>{fileSize}</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">Ready for extraction</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label
                            htmlFor="input-file-upload"
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer transition"
                          >
                            Change
                          </label>
                          <button
                            type="button"
                            onClick={handleClearFile}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="input-file-upload"
                        className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-2"
                      >
                        <Upload className="w-7 h-7 text-blue-600 animate-pulse" />
                        <span className="text-xs font-bold text-slate-800">
                          Click to upload or Drag & Drop Question Paper
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Supports Word (.docx), PDF (.pdf), Text (.txt), and Images (.png, .jpg)
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-600 font-bold pt-1">Or paste question paper text:</div>
                  <textarea
                    rows={5}
                    value={paperText}
                    onChange={(e) => setPaperText(e.target.value)}
                    placeholder={`Q1. What is the SI unit of force?
(A) Joule
(B) Newton
(C) Pascal
(D) Watt`}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Answer Key Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Answer Key (Optional or Separate)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Support shorthand formats like <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold">1-A 2-C 3-D</code> or <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold">1. A, 2. C</code>. If inside the question paper, AI will automatically detect it.
                  </p>
                  <textarea
                    rows={8}
                    value={answerKeyText}
                    onChange={(e) => setAnswerKeyText(e.target.value)}
                    placeholder={`1-C
2-A
3-D
4-B
...`}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* AI Extraction Button */}
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleExtractAI}
                  disabled={extractingAI}
                  id="btn-extract-ai"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded shadow-xs flex items-center gap-2 transition active:scale-[0.99] cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${extractingAI ? "animate-spin text-amber-300" : ""}`} />
                  <span>{extractingAI ? "AI Extracting Questions & Answers..." : "Extract Questions with AI"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: AI Question Review Screen */}
          {reviewedQuestions.length > 0 && (
            <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-5">
              {/* Header Stats Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <span>AI Question Review & Verification</span>
                  </h2>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Verify correct answer keys before publishing test to students
                  </p>
                </div>

                {/* Counter Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="bg-slate-100 px-3 py-1 rounded border border-slate-300 text-slate-800">
                    Detected: {reviewedQuestions.length}
                  </span>
                  <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded border border-emerald-300">
                    Verified: {verifiedCount}
                  </span>
                  {unverifiedCount > 0 && (
                    <span className="bg-red-50 text-red-800 px-3 py-1 rounded border border-red-300 animate-pulse">
                      Unverified: {unverifiedCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded border border-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddNewQuestion("mcq")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Add MCQ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddNewQuestion("integer")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Hash className="w-3.5 h-3.5 text-purple-600" />
                    <span>Add Integer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoRenumber}
                    title="Renumber all questions sequentially from 1 to total"
                    className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold rounded border border-blue-300 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                    <span>Auto Renumber (1..{reviewedQuestions.length})</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApproveAllWithAnswers}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verify All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndPublishTest("draft")}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-300 shadow-xs cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndPublishTest("published")}
                    id="btn-publish-test"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Test to Batch</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {reviewedQuestions.map((q, idx) => {
                  const isInteger = q.questionType === "integer";
                  const isUnverified = !q.correctAnswer || String(q.correctAnswer).trim() === "";

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 sm:p-5 rounded-lg border-2 transition ${
                        isUnverified
                          ? "bg-red-50/50 border-red-400"
                          : "bg-slate-50/70 border-slate-200"
                      } space-y-4`}
                    >
                      {/* Card Header with Question Numbering, Move Up/Down & Type selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Editable Question Number */}
                          <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2 py-1 rounded shadow-2xs">
                            <span className="text-[11px] font-black uppercase text-slate-300">Q. No.</span>
                            <input
                              type="number"
                              min="1"
                              value={q.questionNumber}
                              onChange={(e) => handleUpdateQuestion(idx, "questionNumber", Number(e.target.value))}
                              className="w-12 px-1 py-0.5 bg-slate-800 text-white font-mono font-black text-xs rounded border border-slate-700 outline-none text-center focus:border-blue-400"
                              title="Click to change question number"
                            />
                          </div>

                          {/* Re-order Up / Down */}
                          <div className="inline-flex rounded shadow-2xs border border-slate-300 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, "up")}
                              disabled={idx === 0}
                              title="Move Question Up"
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-30 rounded cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, "down")}
                              disabled={idx === reviewedQuestions.length - 1}
                              title="Move Question Down"
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-30 rounded cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Question Type Toggle Pills */}
                          <div className="inline-flex rounded shadow-2xs bg-slate-200 p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateQuestion(idx, "questionType", "mcq");
                                if (isInteger && !["A", "B", "C", "D"].includes(q.correctAnswer)) {
                                  handleUpdateQuestion(idx, "correctAnswer", "");
                                }
                              }}
                              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer transition ${
                                !isInteger
                                  ? "bg-white text-blue-700 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              MCQ (4 Options)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateQuestion(idx, "questionType", "integer");
                              }}
                              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer transition ${
                                isInteger
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Numerical / Integer
                            </button>
                          </div>

                          {isUnverified ? (
                            <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" /> Answer key needed
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Key: {q.correctAnswer}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer transition"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question Textarea */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Question Statement:
                        </label>
                        <textarea
                          rows={2}
                          value={q.questionText}
                          onChange={(e) => handleUpdateQuestion(idx, "questionText", e.target.value)}
                          placeholder="Enter question text here..."
                          className="w-full p-2.5 bg-white border border-slate-300 rounded text-xs text-slate-900 outline-none focus:border-blue-500 font-sans leading-relaxed"
                        />
                      </div>

                      {/* Question Diagram / Image Attachment Section */}
                      <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-blue-600" />
                            <span>Question Diagram / Image (Optional)</span>
                          </label>
                          {q.imageUrl && (
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(idx, "imageUrl", "")}
                              className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                            >
                              Remove Diagram
                            </button>
                          )}
                        </div>

                        {q.imageUrl ? (
                          <div className="relative inline-block border border-slate-300 rounded overflow-hidden max-h-48 bg-slate-50 p-1">
                            <img
                              src={q.imageUrl}
                              alt={`Q${q.questionNumber} Diagram`}
                              className="max-h-44 object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5 text-slate-600" />
                              <span>Upload Diagram File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleImageFileUpload(e.target.files[0], (dataUrl) => {
                                      handleUpdateQuestion(idx, "imageUrl", dataUrl);
                                    });
                                  }
                                }}
                              />
                            </label>
                            <span className="text-[11px] text-slate-400 font-medium">or paste image URL:</span>
                            <input
                              type="text"
                              placeholder="https://... (or data:image/...)"
                              onChange={(e) => {
                                if (e.target.value) handleUpdateQuestion(idx, "imageUrl", e.target.value.trim());
                              }}
                              className="flex-1 min-w-[200px] px-2.5 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Question Body: Options for MCQ OR Numerical Input for Integer */}
                      {!isInteger ? (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Multiple Choice Options (A, B, C, D) & Option Diagrams:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {(["A", "B", "C", "D"] as const).map((opt) => {
                              const optImg = q.optionImages?.[opt];
                              return (
                                <div key={opt} className="bg-white border border-slate-300 rounded p-2 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300">
                                      {opt}
                                    </span>
                                    <input
                                      type="text"
                                      value={q.options?.[opt] || ""}
                                      onChange={(e) => handleUpdateQuestion(idx, `option_${opt}`, e.target.value)}
                                      placeholder={`Text for Option ${opt}`}
                                      className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 outline-none focus:border-blue-500"
                                    />
                                    <label
                                      className={`p-1.5 rounded border text-xs cursor-pointer ${
                                        optImg
                                          ? "bg-blue-100 border-blue-300 text-blue-700"
                                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                      }`}
                                      title={`Attach image for Option ${opt}`}
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleImageFileUpload(e.target.files[0], (dataUrl) => {
                                              handleUpdateQuestion(idx, `optionImage_${opt}`, dataUrl);
                                            });
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>

                                  {optImg && (
                                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-1 rounded border border-slate-200">
                                      <img
                                        src={optImg}
                                        alt={`Option ${opt} diagram`}
                                        className="h-10 object-contain rounded"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestion(idx, `optionImage_${opt}`, "")}
                                        className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                                      >
                                        Remove Image
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-purple-700" />
                            <label className="text-xs font-bold text-purple-950">
                              Numerical / Integer Type Answer Key:
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={q.correctAnswer || ""}
                              onChange={(e) => handleUpdateQuestion(idx, "correctAnswer", e.target.value)}
                              placeholder="e.g. 5, 2.5, -10"
                              className="w-40 px-3 py-1.5 bg-white border-2 border-purple-300 focus:border-purple-600 rounded text-sm text-purple-950 font-mono font-black outline-none"
                            />
                            <span className="text-[11px] text-purple-700">
                              (Students will enter their numeric answer directly on virtual CBT keypad)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Correct Answer Selection Bar & Solution */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                        {!isInteger ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">
                              Correct Option:
                            </span>
                            {(["A", "B", "C", "D"] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleUpdateQuestion(idx, "correctAnswer", opt)}
                                className={`w-8 h-8 rounded text-xs font-black transition flex items-center justify-center border cursor-pointer ${
                                  q.correctAnswer === opt
                                    ? "bg-emerald-600 border-emerald-700 text-white shadow-xs"
                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                            <span>Numerical Value: {q.correctAnswer || "Not set"}</span>
                          </div>
                        )}

                        {/* Solution Field */}
                        <div className="flex-1 min-w-[220px]">
                          <input
                            type="text"
                            value={q.solution || ""}
                            onChange={(e) => handleUpdateQuestion(idx, "solution", e.target.value)}
                            placeholder="Optional explanation / step-by-step solution"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: MANAGE TESTS */}
      {/* ==================================================== */}
      {currentTab === "tests" && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>All Institute Tests</span>
            </h2>
            <button
              onClick={() => setCurrentTab("create-test")}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Test</span>
            </button>
          </div>

          <div className="grid gap-3">
            {tests.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">No Tests Created Yet</p>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    Create and publish test papers for your students with automated AI extraction, questions, and solutions.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab("create-test")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Test</span>
                </button>
              </div>
            ) : (
              tests.map((test) => (
                <div
                  key={test.id}
                  className="bg-white border-2 border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          test.status === "published"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {test.status === "published" ? "Published" : "Draft"}
                      </span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {test.subject}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        Batch: <strong className="text-slate-900">{test.batchName}</strong>
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">{test.title}</h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                      <span>{test.questions.length} Questions</span>
                      <span>•</span>
                      <span>{test.durationMinutes} Mins</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">+{test.positiveMarks}</span> / <span className="text-red-700 font-bold">-{test.negativeMarks}</span>
                      {test.unattemptedMarks !== undefined && test.unattemptedMarks !== 0 && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 font-bold">Blank: {test.unattemptedMarks}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{test.totalMarks} Total Marks</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTogglePublishTest(test)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded border transition cursor-pointer ${
                        test.status === "published"
                          ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                      }`}
                    >
                      {test.status === "published" ? "Move to Draft" : "Publish to Batch"}
                    </button>
                    <button
                      onClick={() => handleDeleteTest(test)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer transition"
                      title="Delete Test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: MANAGE STUDENTS */}
      {/* ==================================================== */}
      {currentTab === "students" && (
        <div className="space-y-6">
          {/* Create Student Form */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Create New Student</span>
            </h2>

            <form onSubmit={handleCreateStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student ID *
                </label>
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                  placeholder="e.g. ME005"
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 font-mono uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password *
                </label>
                <input
                  type="text"
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Batch *
                </label>
                <select
                  value={newStudentBatchId}
                  onChange={(e) => setNewStudentBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 outline-none cursor-pointer"
                >
                  {batches.length === 0 ? (
                    <option value="">No batches available</option>
                  ) : (
                    batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="sm:col-span-4 flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Student Record</span>
                </button>
              </div>
            </form>
          </div>

          {/* Students List */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900">Registered Students ({students.length})</h3>

            <div className="divide-y divide-slate-200">
              {students.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <p className="text-sm font-bold text-slate-800">No Students Registered Yet</p>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    Register students using the form above. Students can log in using their Student ID and password to take tests.
                  </p>
                </div>
              ) : (
                students.map((stu) => (
                <div key={stu.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-blue-700 border border-slate-300">
                        {stu.studentId}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{stu.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          stu.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                            : "bg-red-50 text-red-800 border border-red-300"
                        }`}
                      >
                        {stu.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">
                      Batch: <strong className="text-slate-800">{stu.batchName}</strong> • Password:{" "}
                      <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{stu.password}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResetPwdModal({ studentId: stu.id, studentName: stu.name })}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Key className="w-3 h-3 text-amber-600" />
                      <span className="hidden sm:inline">Reset Password</span>
                    </button>
                    <button
                      onClick={() => handleToggleStudent(stu.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded border cursor-pointer transition ${
                        stu.status === "active"
                          ? "bg-white hover:bg-slate-100 text-slate-600 border-slate-300"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {stu.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(stu)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer transition border border-transparent hover:border-red-200"
                      title="Delete Student"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: MANAGE BATCHES */}
      {/* ==================================================== */}
      {currentTab === "batches" && (
        <div className="space-y-6">
          {/* Create Batch Form */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Create Institute Batch</span>
            </h2>

            <form onSubmit={handleCreateBatch} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. JEE 2027"
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch Code
                </label>
                <input
                  type="text"
                  value={newBatchCode}
                  onChange={(e) => setNewBatchCode(e.target.value.toUpperCase())}
                  placeholder="e.g. JEE-27"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 uppercase font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newBatchDesc}
                  onChange={(e) => setNewBatchDesc(e.target.value)}
                  placeholder="e.g. 2-Year Target Course"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Batch</span>
                </button>
              </div>
            </form>
          </div>

          {/* Batches List */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900">Active Institute Batches ({batches.length})</h3>

            <div className="grid gap-3">
              {batches.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <p className="text-sm font-bold text-slate-800">No Batches Created Yet</p>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    Use the form above to create your first batch (e.g., JEE 2027, NEET 2026, Foundation, etc.).
                  </p>
                </div>
              ) : (
                batches.map((batch: any) => (
                <div
                  key={batch.id}
                  className="bg-white border-2 border-slate-200 rounded-lg p-4 flex items-center justify-between gap-3 hover:border-slate-300 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-slate-900">{batch.name}</span>
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-blue-700 border border-slate-300">
                        {batch.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">
                      {batch.description || "No description"} • Students:{" "}
                      <strong className="text-emerald-700">{batch.studentCount || 0}</strong> • Tests:{" "}
                      <strong className="text-blue-700">{batch.testCount || 0}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteBatch(batch)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer transition"
                    title="Delete Batch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: RESULTS & RANKINGS */}
      {/* ==================================================== */}
      {currentTab === "results" && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-600" />
              <span>Student Results & Batch Rankings</span>
            </h2>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <select
                value={selectedResultTest}
                onChange={(e) => setSelectedResultTest(e.target.value)}
                className="px-2.5 py-1.5 bg-white border-2 border-slate-200 rounded text-slate-800 outline-none cursor-pointer"
              >
                <option value="">All Tests</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>

              <select
                value={selectedResultBatch}
                onChange={(e) => setSelectedResultBatch(e.target.value)}
                className="px-2.5 py-1.5 bg-white border-2 border-slate-200 rounded text-slate-800 outline-none cursor-pointer"
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {filteredResults.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
                No test results match the selected filters.
              </p>
            ) : (
              filteredResults.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border-2 border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-slate-900 text-white font-black text-xs px-2 py-0.5 rounded">
                        Rank #{r.rankInBatch || 1}
                      </span>
                      <span className="font-black text-sm text-slate-900">{r.studentName}</span>
                      <span className="font-mono text-xs text-slate-600">({r.studentCustomId})</span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {r.batchName}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800">{r.testTitle}</div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                      <span>
                        Score: <strong className="text-emerald-700 font-mono font-bold text-sm">{r.score}</strong> / {r.maxMarks}
                      </span>
                      <span>•</span>
                      <span>
                        Accuracy: <strong className="text-blue-700 font-bold">{r.accuracy}%</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Correct: <strong className="text-emerald-700 font-bold">{r.correct}</strong>, Wrong:{" "}
                        <strong className="text-red-700 font-bold">{r.wrong}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedResultDetail(r)}
                    className="self-start sm:self-auto px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Analysis</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetPwdModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-300 rounded-lg p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Reset Student Password</span>
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Set a new password for <strong>{resetPwdModal.studentName}</strong>
            </p>
            <input
              type="text"
              value={newPasswordVal}
              onChange={(e) => setNewPasswordVal(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-white border-2 border-slate-200 focus:border-blue-500 rounded text-sm text-slate-900 outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetPwdModal(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      {selectedResultDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-300 rounded-lg p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">{selectedResultDetail.studentName}</h3>
                <p className="text-xs text-slate-600 font-medium">
                  {selectedResultDetail.testTitle} • Score: {selectedResultDetail.score} / {selectedResultDetail.maxMarks}
                </p>
              </div>
              <button
                onClick={() => setSelectedResultDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {(selectedResultDetail.questionAnalysis || []).map((q: any) => (
                <div key={q.questionNumber} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 bg-slate-200 px-2 py-0.5 rounded">Q{q.questionNumber}</span>
                    <span className={`font-bold ${q.isCorrect ? "text-emerald-700" : q.isAttempted ? "text-red-700" : "text-slate-600"}`}>
                      {q.isCorrect ? "✓ Correct (+4)" : q.isAttempted ? "✗ Wrong (-1)" : "Not Attempted (0)"}
                    </span>
                  </div>
                  <div className="text-slate-800 font-medium">{q.questionText}</div>
                  <div className="flex gap-4 text-slate-600 font-mono font-medium">
                    <span>Student Answer: <strong className="text-slate-900">{q.studentAnswer || "—"}</strong></span>
                    <span>Correct Answer: <strong className="text-emerald-700">{q.correctAnswer}</strong></span>
                  </div>
                  {q.solution && (
                    <div className="p-2 bg-white rounded text-slate-700 border border-slate-200 font-medium">
                      Solution: {q.solution}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Safe In-App Delete Confirmation Modal (Iframe & Mobile Compatible) */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-300 rounded-xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-950">
                  Delete {deleteModal.type === "test" ? "Test" : deleteModal.type === "batch" ? "Batch" : "Student"}?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  This record will be permanently deleted from the database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setDeleteModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer transition"
                disabled={deleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-900 text-sm">{deleteModal.title}</div>
              {deleteModal.subtitle && (
                <div className="text-slate-500 font-medium text-[11px]">{deleteModal.subtitle}</div>
              )}
              {deleteModal.type === "test" && (
                <div className="p-2 bg-red-50/80 border border-red-200/80 rounded text-[11px] text-red-700 font-semibold leading-relaxed">
                  ⚠️ Note: All student attempts, leaderboard scores, and question logs for this test will also be deleted.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-lg cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition flex items-center gap-1.5 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
