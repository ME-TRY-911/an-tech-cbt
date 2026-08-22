import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import mammoth from "mammoth";
import {
  initFirebase,
  syncToFirestore,
  deleteFromFirestore,
  pullFromFirestore,
  getFirebaseStatus,
} from "./server/firebaseStore";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Persistent Data Storage setup
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  admin: {
    id: string;
    username: string;
    passwordHash: string;
    name: string;
  };
  batches: Array<{
    id: string;
    name: string;
    code: string;
    description?: string;
    createdAt: string;
  }>;
  students: Array<{
    id: string;
    studentId: string;
    name: string;
    password: string;
    batchId: string;
    status: "active" | "inactive";
    createdAt: string;
  }>;
  tests: Array<{
    id: string;
    title: string;
    subject: string;
    batchId: string;
    durationMinutes: number;
    positiveMarks: number;
    negativeMarks: number;
    unattemptedMarks?: number;
    questions: Array<{
      id: string;
      questionNumber: number;
      questionText: string;
      questionType?: "mcq" | "integer";
      options: { A: string; B: string; C: string; D: string };
      optionImages?: { A?: string; B?: string; C?: string; D?: string };
      correctAnswer: string;
      solution?: string;
      imageUrl?: string;
    }>;
    status: "draft" | "published" | "archived";
    enableLeaderboard: boolean;
    totalMarks: number;
    createdAt: string;
    publishedAt?: string;
  }>;
  attempts: Array<{
    id: string;
    testId: string;
    studentId: string;
    studentName: string;
    batchId: string;
    startTime: string;
    durationMinutes: number;
    endTime?: string;
    status: "in_progress" | "completed";
    answers: Record<number, string>;
    markedForReview: number[];
    lastSavedAt: string;
  }>;
  results: Array<{
    id: string;
    attemptId: string;
    testId: string;
    testTitle: string;
    subject: string;
    studentId: string;
    studentCustomId: string;
    studentName: string;
    batchId: string;
    batchName: string;
    totalQuestions: number;
    attempted: number;
    correct: number;
    wrong: number;
    unattempted: number;
    positiveMarksPerQ: number;
    negativeMarksPerQ: number;
    unattemptedMarksPerQ?: number;
    maxMarks: number;
    score: number;
    percentage: number;
    accuracy: number;
    timeTakenSec: number;
    submittedAt: string;
    enableLeaderboard: boolean;
    questionAnalysis: Array<{
      questionNumber: number;
      questionText: string;
      questionType?: "mcq" | "integer";
      options: { A: string; B: string; C: string; D: string };
      optionImages?: { A?: string; B?: string; C?: string; D?: string };
      imageUrl?: string;
      studentAnswer: string | null;
      correctAnswer: string;
      isCorrect: boolean;
      isAttempted: boolean;
      marksAwarded: number;
      solution?: string;
    }>;
  }>;
}

function getInitialDatabase(): DatabaseSchema {
  return {
    admin: {
      id: "admin_owner",
      username: "ADMIN",
      passwordHash: "786786",
      name: "Master Administrator",
    },
    batches: [],
    students: [],
    tests: [],
    attempts: [],
    results: [],
  };
}

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, resetting to initial:", err);
    const initial = getInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function writeDb(db: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
    // Asynchronously push to Firebase Firestore in the background
    syncToFirestore({
      batches: db.batches,
      students: db.students,
      tests: db.tests,
      results: db.results,
      attempts: db.attempts,
    }).catch((err) => {
      console.warn("[Firebase Cloud] Background sync notice:", err?.message || err);
    });
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Token secret & HMAC signing to ensure sessions persist across server restarts
const TOKEN_SECRET = process.env.SESSION_SECRET || "an_tech_cbt_master_session_secret_786786";

function generateSignedToken(payload: { role: "admin" | "student"; id: string; studentId?: string; name: string; batchId?: string }) {
  const data = JSON.stringify({ ...payload, ts: Date.now() });
  const b64 = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
  return `${b64}.${signature}`;
}

function verifySignedToken(token: string): { role: "admin" | "student"; id: string; studentId?: string; name: string; batchId?: string } | null {
  try {
    if (!token || !token.includes(".")) return null;
    const [b64, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
    if (sig !== expectedSig) return null;
    const jsonStr = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// In-memory token store for active sessions
const sessions: Map<string, { role: "admin" | "student"; id: string; studentId?: string; name: string; batchId?: string }> = new Map();

// Helper Auth Middlewares
function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Admin authentication token required. Please log in." });
  }
  const token = authHeader.split(" ")[1];
  let session = sessions.get(token);

  if (!session) {
    const verified = verifySignedToken(token);
    if (verified && verified.role === "admin") {
      session = { role: "admin", id: verified.id, name: verified.name };
      sessions.set(token, session);
    }
  }

  if (!session || session.role !== "admin") {
    return res.status(401).json({ error: "Admin session expired or invalid. Please log in again with ID: ADMIN and Password: 786786" });
  }
  (req as any).adminSession = session;
  next();
}

function authenticateStudent(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Student authentication token required. Please log in." });
  }
  const token = authHeader.split(" ")[1];
  let session = sessions.get(token);

  if (!session) {
    const verified = verifySignedToken(token);
    if (verified && verified.role === "student") {
      session = {
        role: "student",
        id: verified.id,
        studentId: verified.studentId,
        name: verified.name,
        batchId: verified.batchId,
      };
      sessions.set(token, session);
    }
  }

  if (!session || session.role !== "student") {
    return res.status(401).json({ error: "Student session expired or invalid. Please log in again." });
  }
  (req as any).studentSession = session;
  next();
}

// ==========================================
// AUTHENTICATION & HEALTH ROUTES
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Student Login: ONLY Student ID & Password
app.post("/api/auth/student-login", (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) {
    return res.status(400).json({ error: "Please provide both Student ID and Password" });
  }

  const db = readDb();
  const cleanId = String(studentId).trim().toUpperCase();
  const student = db.students.find(
    (s) => s.studentId.toUpperCase() === cleanId && s.password === String(password).trim()
  );

  if (!student) {
    return res.status(401).json({ error: "Invalid Student ID or Password. Please contact AN TECH administration." });
  }

  if (student.status !== "active") {
    return res.status(403).json({ error: "This student account is currently inactive. Please contact administration." });
  }

  const batch = db.batches.find((b) => b.id === student.batchId);
  const tokenPayload = {
    role: "student" as const,
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    batchId: student.batchId,
  };
  const token = generateSignedToken(tokenPayload);

  sessions.set(token, tokenPayload);

  return res.json({
    token,
    role: "student",
    user: {
      id: student.id,
      studentId: student.studentId,
      name: student.name,
      batchId: student.batchId,
      batchName: batch ? batch.name : "Unassigned",
    },
  });
});

// Admin / Owner Login (Private URL: /admin)
app.post("/api/auth/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please enter administrator credentials" });
  }

  const db = readDb();
  const cleanUser = String(username).trim().toUpperCase();
  const cleanPass = String(password).trim();

  const configuredUser = (db.admin?.username || "ADMIN").toUpperCase();
  const configuredPass = db.admin?.passwordHash || "786786";

  if ((cleanUser === configuredUser || cleanUser === "ADMIN") && (cleanPass === configuredPass || cleanPass === "786786")) {
    const tokenPayload = {
      role: "admin" as const,
      id: db.admin?.id || "admin_owner",
      name: db.admin?.name || "Master Administrator",
    };
    const token = generateSignedToken(tokenPayload);
    sessions.set(token, tokenPayload);

    return res.json({
      token,
      role: "admin",
      user: {
        id: db.admin?.id || "admin_owner",
        name: db.admin?.name || "Master Administrator",
        username: db.admin?.username || "ADMIN",
      },
    });
  }

  return res.status(401).json({ error: "Invalid Administrator credentials. Please enter ID: ADMIN and Password: 786786" });
});

// Get current logged-in user profile
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const token = authHeader.split(" ")[1];
  let session = sessions.get(token);
  if (!session) {
    const verified = verifySignedToken(token);
    if (verified) {
      session = verified;
      sessions.set(token, session);
    }
  }

  if (!session) {
    return res.status(401).json({ error: "Session expired or invalid" });
  }

  const db = readDb();
  if (session.role === "student") {
    const student = db.students.find((s) => s.id === session.id);
    if (!student || student.status !== "active") {
      sessions.delete(token);
      return res.status(403).json({ error: "Student account inactive or removed" });
    }
    const batch = db.batches.find((b) => b.id === student.batchId);
    return res.json({
      role: "student",
      user: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        batchId: student.batchId,
        batchName: batch ? batch.name : "Unassigned",
      },
    });
  } else {
    return res.json({
      role: "admin",
      user: {
        id: db.admin.id,
        name: db.admin.name,
        username: db.admin.username,
      },
    });
  }
});

// ==========================================
// ADMIN: BATCHES MANAGEMENT
// ==========================================

app.get("/api/admin/batches", authenticateAdmin, (req, res) => {
  const db = readDb();
  const batchesWithStats = db.batches.map((b) => {
    const studentCount = db.students.filter((s) => s.batchId === b.id).length;
    const testCount = db.tests.filter((t) => t.batchId === b.id).length;
    return { ...b, studentCount, testCount };
  });
  res.json(batchesWithStats);
});

app.post("/api/admin/batches", authenticateAdmin, (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Batch Name is required" });
  }

  const db = readDb();
  const newBatch = {
    id: "batch_" + Date.now(),
    name: String(name).trim(),
    code: code ? String(code).trim().toUpperCase() : String(name).trim().substring(0, 8).toUpperCase(),
    description: description ? String(description).trim() : "",
    createdAt: new Date().toISOString(),
  };

  db.batches.push(newBatch);
  writeDb(db);
  res.status(201).json(newBatch);
});

app.delete("/api/admin/batches/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const studentCount = db.students.filter((s) => s.batchId === id).length;
  if (studentCount > 0) {
    return res.status(400).json({ error: `Cannot delete batch with ${studentCount} assigned student(s). Reassign or remove students first.` });
  }
  db.batches = db.batches.filter((b) => b.id !== id);
  writeDb(db);
  deleteFromFirestore("cbt_batches", id).catch(() => {});
  res.json({ success: true, message: "Batch deleted" });
});

// ==========================================
// ADMIN: STUDENTS MANAGEMENT
// ==========================================

app.get("/api/admin/students", authenticateAdmin, (req, res) => {
  const db = readDb();
  const batchMap = new Map(db.batches.map((b) => [b.id, b.name]));
  const studentsWithBatch = db.students.map((s) => ({
    ...s,
    batchName: batchMap.get(s.batchId) || "Unknown Batch",
  }));
  res.json(studentsWithBatch);
});

app.post("/api/admin/students", authenticateAdmin, (req, res) => {
  const { studentId, name, password, batchId } = req.body;
  if (!studentId || !name || !password || !batchId) {
    return res.status(400).json({ error: "Please provide Student ID, Name, Password, and Batch" });
  }

  const cleanStudentId = String(studentId).trim().toUpperCase();
  const db = readDb();

  if (db.students.some((s) => s.studentId.toUpperCase() === cleanStudentId)) {
    return res.status(400).json({ error: `Student ID '${cleanStudentId}' already exists. Please use a unique ID.` });
  }

  const batch = db.batches.find((b) => b.id === batchId);
  if (!batch) {
    return res.status(400).json({ error: "Selected Batch does not exist" });
  }

  const newStudent = {
    id: "stu_" + Date.now(),
    studentId: cleanStudentId,
    name: String(name).trim(),
    password: String(password).trim(),
    batchId: String(batchId),
    status: "active" as const,
    createdAt: new Date().toISOString(),
  };

  db.students.push(newStudent);
  writeDb(db);

  res.status(201).json({ ...newStudent, batchName: batch.name });
});

app.put("/api/admin/students/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { name, password, batchId, status } = req.body;

  const db = readDb();
  const index = db.students.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Student not found" });
  }

  if (name) db.students[index].name = String(name).trim();
  if (password) db.students[index].password = String(password).trim();
  if (batchId) db.students[index].batchId = String(batchId);
  if (status && (status === "active" || status === "inactive")) {
    db.students[index].status = status;
  }

  writeDb(db);
  const batch = db.batches.find((b) => b.id === db.students[index].batchId);
  res.json({ ...db.students[index], batchName: batch ? batch.name : "Unknown Batch" });
});

app.post("/api/admin/students/:id/reset-password", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || !String(newPassword).trim()) {
    return res.status(400).json({ error: "New password cannot be empty" });
  }

  const db = readDb();
  const student = db.students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  student.password = String(newPassword).trim();
  writeDb(db);
  res.json({ success: true, message: `Password reset successfully for ${student.name} (${student.studentId})` });
});

app.post("/api/admin/students/:id/toggle-status", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const student = db.students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  student.status = student.status === "active" ? "inactive" : "active";
  writeDb(db);
  res.json({ success: true, status: student.status, message: `Student status updated to ${student.status}` });
});

app.delete("/api/admin/students/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const student = db.students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }
  db.students = db.students.filter((s) => s.id !== id);
  db.attempts = db.attempts.filter((a) => a.studentId !== id);
  db.results = db.results.filter((r) => r.studentId !== id);
  writeDb(db);
  deleteFromFirestore("cbt_students", id).catch(() => {});
  res.json({ success: true, message: `Student ${student.name} deleted successfully` });
});

// Helper functions for AI Question Extraction & Parser Fallbacks
function parseAnswersFromText(keyText: string): Record<number, "A" | "B" | "C" | "D"> {
  const answers: Record<number, "A" | "B" | "C" | "D"> = {};
  if (!keyText) return answers;

  // Patterns like 1-A, 1. A, 1:A, Q1: A, 1(A), 1 A, 1. (B)
  const regex = /(?:Q(?:uestion)?\s*)?(\d{1,3})\s*(?:[\-\.\:\)\=\s]+)\s*\(?([A-Da-d])\)?/g;
  let match;
  while ((match = regex.exec(keyText)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase() as "A" | "B" | "C" | "D";
    if (["A", "B", "C", "D"].includes(ans)) {
      answers[qNum] = ans;
    }
  }
  return answers;
}

function parseQuestionsFromRawText(docText: string, answerKeyText?: string) {
  if (!docText || !docText.trim()) return [];

  const answersFromKey = answerKeyText ? parseAnswersFromText(answerKeyText) : {};
  const embeddedAnswers = parseAnswersFromText(docText);
  const combinedAnswers = { ...embeddedAnswers, ...answersFromKey };

  const lines = docText.split(/\r?\n/);
  const questions: Array<{
    id: string;
    questionNumber: number;
    questionText: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: "A" | "B" | "C" | "D" | "";
    solution: string;
  }> = [];

  let currentQNum: number | null = null;
  let currentQTextLines: string[] = [];
  let currentOptions: { A: string; B: string; C: string; D: string } = { A: "", B: "", C: "", D: "" };
  let currentSolution = "";
  let currentCorrectAnswer: "A" | "B" | "C" | "D" | "" = "";

  function saveCurrent() {
    if (currentQNum !== null && (currentQTextLines.length > 0 || currentOptions.A)) {
      const qNum = currentQNum || questions.length + 1;
      const ans = combinedAnswers[qNum] || currentCorrectAnswer || "";
      questions.push({
        id: "q_" + qNum + "_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        questionNumber: qNum,
        questionText: currentQTextLines.join("\n").trim() || `Question ${qNum}`,
        options: {
          A: currentOptions.A || "Option A",
          B: currentOptions.B || "Option B",
          C: currentOptions.C || "Option C",
          D: currentOptions.D || "Option D",
        },
        correctAnswer: ans,
        solution: currentSolution,
      });
    }
    currentQNum = null;
    currentQTextLines = [];
    currentOptions = { A: "", B: "", C: "", D: "" };
    currentSolution = "";
    currentCorrectAnswer = "";
  }

  const qStartRegex = /^\s*(?:(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[\.\)\:\-]\s+|(\d{1,3})\.\s+)(.*)$/i;
  const optRegex = /^\s*(?:\(?([A-Da-d])\)|\b([A-Da-d])[\.\:\)]|\[([A-Da-d])\])\s*(.*)$/;
  const ansLineRegex = /^\s*(?:Ans(?:wer)?|Correct\s*Option)\s*[\:\-]?\s*\(?([A-Da-d])\)?/i;
  const solLineRegex = /^\s*(?:Solution|Explanation|Hint)\s*[\:\-]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^\s*(?:answer\s*key|key\s*sheet|answers\s*:)/i.test(trimmed)) {
      continue;
    }

    const qMatch = trimmed.match(qStartRegex);
    if (qMatch) {
      saveCurrent();
      currentQNum = parseInt(qMatch[1] || qMatch[2], 10);
      if (qMatch[3]) {
        currentQTextLines.push(qMatch[3].trim());
      }
      continue;
    }

    const ansMatch = trimmed.match(ansLineRegex);
    if (ansMatch && currentQNum !== null) {
      currentCorrectAnswer = ansMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      continue;
    }

    const solMatch = trimmed.match(solLineRegex);
    if (solMatch && currentQNum !== null) {
      currentSolution = solMatch[1] || "";
      continue;
    }

    // Check for inline multiple options: (A) xxx (B) yyy (C) zzz (D) www
    if (
      currentQNum !== null &&
      /\(?A\)|\bA[\.\)]/i.test(trimmed) &&
      /\(?B\)|\bB[\.\)]/i.test(trimmed)
    ) {
      const inlineOptRegex = /(?:\(?([A-Da-d])\)|\b([A-Da-d])[\.\:\)])\s*([^(\n]+?)(?=(?:\(?[A-Da-d]\)|\b[A-Da-d][\.\:\)])|$)/g;
      let optFound = false;
      let match;
      while ((match = inlineOptRegex.exec(trimmed)) !== null) {
        const letter = (match[1] || match[2]).toUpperCase() as "A" | "B" | "C" | "D";
        const val = match[3].trim();
        if (["A", "B", "C", "D"].includes(letter) && val) {
          currentOptions[letter] = val;
          optFound = true;
        }
      }
      if (optFound) continue;
    }

    const optMatch = trimmed.match(optRegex);
    if (optMatch && currentQNum !== null) {
      const optLetter = (optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase() as "A" | "B" | "C" | "D";
      const optVal = (optMatch[4] || "").trim();
      currentOptions[optLetter] = optVal;
      continue;
    }

    if (currentQNum !== null) {
      if (!currentOptions.A) {
        currentQTextLines.push(trimmed);
      } else if (currentSolution) {
        currentSolution += " " + trimmed;
      }
    }
  }

  saveCurrent();
  return questions;
}

async function extractQuestionsWithFallbackAI(
  ai: GoogleGenAI,
  contentsPayload: any[],
  systemPrompt: string
): Promise<{ modelUsed: string; questions: any[] }> {
  // Valid list of Gemini models to try in sequence - flash-lite has high availability
  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-flash-latest"];
  const maxRetriesPerModel = 1;
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`[Gemini API] Question extraction request with model: ${model} (attempt ${attempt + 1})`);
        const response = await ai.models.generateContent({
          model,
          contents: contentsPayload,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedQuestionsCount: { type: Type.INTEGER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      questionNumber: { type: Type.INTEGER },
                      questionText: { type: Type.STRING },
                      options: {
                        type: Type.OBJECT,
                        properties: {
                          A: { type: Type.STRING },
                          B: { type: Type.STRING },
                          C: { type: Type.STRING },
                          D: { type: Type.STRING },
                        },
                        required: ["A", "B", "C", "D"],
                      },
                      correctAnswer: {
                        type: Type.STRING,
                        description: "'A', 'B', 'C', 'D' or empty string if unverified",
                      },
                      solution: { type: Type.STRING },
                    },
                    required: ["questionNumber", "questionText", "options", "correctAnswer"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return {
              modelUsed: model,
              questions: parsed.questions,
            };
          }
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTemporarySpike =
          errMsg.includes("503") ||
          errMsg.includes("429") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("spikes in demand") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        console.warn(`[Gemini API] Model ${model} attempt ${attempt + 1} failed:`, errMsg);

        if (isTemporarySpike && attempt < maxRetriesPerModel) {
          const delayMs = 600 + Math.floor(Math.random() * 300);
          console.log(`[Gemini API] Temporary spike. Retrying model ${model} in ${delayMs}ms...`);
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          break; // Try next fallback model in list
        }
      }
    }
  }

  throw lastError || new Error("All AI question extraction models are temporarily experiencing high demand");
}

// ==========================================
// ADMIN: AI QUESTION EXTRACTION (GEMINI API)
// ==========================================

app.post("/api/admin/extract-questions", authenticateAdmin, async (req, res) => {
  try {
    const { documentText, documentBase64, documentMimeType, answerKeyText, fileName } = req.body;

    if (!documentText && !documentBase64) {
      return res.status(400).json({ error: "Please provide question paper content (text or uploaded document file)" });
    }

    let finalDocText = (documentText || "").trim();
    let isDocx = false;
    let cleanBase64 = "";

    if (documentBase64) {
      cleanBase64 = documentBase64.includes(",")
        ? documentBase64.split(",")[1]
        : documentBase64;
      const buffer = Buffer.from(cleanBase64, "base64");

      const mime = (documentMimeType || "").toLowerCase();
      const fName = (fileName || "").toLowerCase();

      // Handle Word Document (.docx / .doc)
      if (
        mime.includes("word") ||
        mime.includes("officedocument") ||
        mime.includes("docx") ||
        fName.endsWith(".docx") ||
        fName.endsWith(".doc")
      ) {
        isDocx = true;
        try {
          const mammothResult = await mammoth.extractRawText({ buffer });
          if (mammothResult && mammothResult.value && mammothResult.value.trim()) {
            console.log(`[Word Document] Extracted ${mammothResult.value.length} characters from ${fileName || "document.docx"}`);
            const docxText = mammothResult.value.trim();
            finalDocText = finalDocText ? `${docxText}\n\n${finalDocText}` : docxText;
          }
        } catch (docxErr: any) {
          console.warn("[Word Document] Failed to extract text with mammoth:", docxErr?.message);
        }
      } else if (mime.includes("pdf") || fName.endsWith(".pdf")) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const pdfParser = new PDFParse({ data: buffer });
          const pdfResult = await pdfParser.getText();
          if (pdfResult && pdfResult.text && pdfResult.text.trim()) {
            console.log(`[PDF Document] Extracted ${pdfResult.text.length} characters from ${fileName || "document.pdf"}`);
            const pdfText = pdfResult.text.trim();
            finalDocText = finalDocText ? `${pdfText}\n\n${finalDocText}` : pdfText;
          }
          if (typeof pdfParser.destroy === "function") {
            await pdfParser.destroy();
          }
        } catch (pdfErr: any) {
          console.warn("[PDF Document] PDF text extraction note:", pdfErr?.message);
        }
      } else if (mime.includes("text") || mime.includes("plain") || fName.endsWith(".txt")) {
        try {
          const textContent = buffer.toString("utf-8").trim();
          if (textContent) {
            finalDocText = finalDocText ? `${textContent}\n\n${finalDocText}` : textContent;
          }
        } catch (txtErr) {
          console.warn("Text decoding error:", txtErr);
        }
      }
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemPrompt = `You are an expert exam parser for "AN TECH".
Extract multiple-choice questions (MCQs) from the provided question paper.
For every question, extract:
1. questionNumber: integer index starting at 1
2. questionText: clear text of the question
3. options: an object with keys "A", "B", "C", "D" and their corresponding text values
4. correctAnswer: "A", "B", "C", "D", or "" (empty string if cannot be verified)
5. solution: explanation if present in the document or answer key, otherwise empty string

RULES FOR ANSWER KEY MATCHING:
- If an answer key is provided in the input (either inside the text or provided separately in the answerKeyText), use that official answer key as the absolute source of truth!
- Do NOT guess or invent answers if no official answer key is provided. If no answer key is found for a question, set correctAnswer to "" (empty string) so the Admin can manually verify it.
- Clean up option labels like "(A)", "A.", "[A]" to return only the option value for each key.
- Maintain formatting for equations and scientific symbols accurately.`;

    const contentsPayload: any[] = [];

    // Attach PDF or Image inlineData for Gemini if applicable (Gemini does not support docx MIME type inlineData)
    if (cleanBase64 && documentMimeType && !isDocx) {
      let normalizedMime = documentMimeType.toLowerCase();
      if (normalizedMime.includes("pdf") || (fileName && fileName.toLowerCase().endsWith(".pdf"))) {
        normalizedMime = "application/pdf";
      } else if (normalizedMime.includes("png")) {
        normalizedMime = "image/png";
      } else if (normalizedMime.includes("jpeg") || normalizedMime.includes("jpg")) {
        normalizedMime = "image/jpeg";
      } else if (normalizedMime.includes("webp")) {
        normalizedMime = "image/webp";
      }

      if (normalizedMime === "application/pdf" || normalizedMime.startsWith("image/")) {
        contentsPayload.push({
          inlineData: {
            mimeType: normalizedMime,
            data: cleanBase64,
          },
        });
      }
    }

    let promptText = "Please extract all multiple-choice questions (MCQs) from this exam document.\n\n";
    if (finalDocText) {
      promptText += `QUESTION PAPER CONTENT:\n${finalDocText}\n\n`;
    }
    if (answerKeyText) {
      promptText += `OFFICIAL ANSWER KEY / SHORTHAND PROVIDED BY ADMIN:\n${answerKeyText}\n(Match question numbers with this official answer key!)\n\n`;
    }
    promptText += "Return the extracted questions in structured JSON format with options A, B, C, D and verified correct answer.";

    contentsPayload.push({ text: promptText });

    let questionsList: any[] = [];
    let methodUsed = "AI";

    try {
      const aiResult = await extractQuestionsWithFallbackAI(ai, contentsPayload, systemPrompt);
      questionsList = (aiResult.questions || []).map((q: any, idx: number) => ({
        id: "q_" + (idx + 1) + "_" + Date.now(),
        questionNumber: q.questionNumber || idx + 1,
        questionText: q.questionText || `Question ${idx + 1}`,
        options: {
          A: q.options?.A || "",
          B: q.options?.B || "",
          C: q.options?.C || "",
          D: q.options?.D || "",
        },
        correctAnswer: ["A", "B", "C", "D"].includes(q.correctAnswer?.toUpperCase())
          ? q.correctAnswer.toUpperCase()
          : "",
        solution: q.solution || "",
      }));
      methodUsed = isDocx ? `Word Parser + AI (${aiResult.modelUsed})` : `AI (${aiResult.modelUsed})`;
    } catch (aiErr: any) {
      console.warn("AI extraction failed across models, attempting heuristic text parser fallback:", aiErr?.message);
      if (finalDocText && finalDocText.trim()) {
        questionsList = parseQuestionsFromRawText(finalDocText, answerKeyText);
        methodUsed = isDocx ? "Word Document Parser (Heuristic Fallback)" : "Smart Heuristic Parser (Fallback)";
      }

      if (questionsList.length === 0) {
        throw aiErr;
      }
    }

    return res.json({
      success: true,
      questionsCount: questionsList.length,
      questions: questionsList,
      methodUsed,
    });
  } catch (err: any) {
    console.error("AI Question Extraction error:", err);
    const rawMsg = err?.message || String(err);
    let friendlyMsg = rawMsg;
    if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
      friendlyMsg = "AI services are currently experiencing high demand. Please paste the question paper text directly into the text box below, or click 'Extract Questions' again to retry.";
    }
    return res.status(500).json({
      error: friendlyMsg,
    });
  }
});

// ==========================================
// ADMIN: TEST CREATION & MANAGEMENT
// ==========================================

app.get("/api/admin/tests", authenticateAdmin, (req, res) => {
  const db = readDb();
  const batchMap = new Map(db.batches.map((b) => [b.id, b.name]));
  const testsWithBatch = db.tests.map((t) => {
    const attemptCount = db.results.filter((r) => r.testId === t.id).length;
    return {
      ...t,
      batchName: batchMap.get(t.batchId) || "Unknown Batch",
      attemptCount,
      questionCount: t.questions.length,
    };
  });
  res.json(testsWithBatch);
});

app.get("/api/admin/tests/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const test = db.tests.find((t) => t.id === id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const batch = db.batches.find((b) => b.id === test.batchId);
  res.json({ ...test, batchName: batch ? batch.name : "Unknown Batch" });
});

app.post("/api/admin/tests", authenticateAdmin, (req, res) => {
  const {
    title,
    subject,
    batchId,
    durationMinutes,
    positiveMarks,
    negativeMarks,
    unattemptedMarks,
    questions,
    enableLeaderboard,
    status,
  } = req.body;

  if (!title || !subject || !batchId || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "Please provide Test Title, Subject, Batch, and at least one Question." });
  }

  const db = readDb();
  const batch = db.batches.find((b) => b.id === batchId);
  if (!batch) {
    return res.status(400).json({ error: "Selected Batch not found" });
  }

  const posMarks = Number(positiveMarks) >= 0 ? Number(positiveMarks) : 4;
  const negMarks = Number(negativeMarks) >= 0 ? Number(negativeMarks) : 1;
  const unattemptMarks = Number(unattemptedMarks) || 0;
  const totalM = questions.length * posMarks;

  const newTest = {
    id: "test_" + Date.now(),
    title: String(title).trim(),
    subject: String(subject).trim(),
    batchId: String(batchId),
    durationMinutes: Number(durationMinutes) > 0 ? Number(durationMinutes) : 60,
    positiveMarks: posMarks,
    negativeMarks: negMarks,
    unattemptedMarks: unattemptMarks,
    questions: questions.map((q: any, i: number) => {
      const qType = q.questionType === "integer" ? ("integer" as const) : ("mcq" as const);
      let corr = "";
      if (qType === "integer") {
        corr = q.correctAnswer !== undefined && q.correctAnswer !== null ? String(q.correctAnswer).trim() : "";
      } else {
        corr = ["A", "B", "C", "D"].includes(q.correctAnswer?.toUpperCase())
          ? (q.correctAnswer.toUpperCase() as "A" | "B" | "C" | "D")
          : "";
      }

      return {
        id: q.id || `q_${i + 1}_${Date.now()}`,
        questionNumber: q.questionNumber !== undefined && q.questionNumber !== null && !isNaN(Number(q.questionNumber)) ? Number(q.questionNumber) : i + 1,
        questionText: String(q.questionText || "").trim(),
        options: {
          A: String(q.options?.A || "").trim(),
          B: String(q.options?.B || "").trim(),
          C: String(q.options?.C || "").trim(),
          D: String(q.options?.D || "").trim(),
        },
        optionImages: {
          A: q.optionImages?.A || "",
          B: q.optionImages?.B || "",
          C: q.optionImages?.C || "",
          D: q.optionImages?.D || "",
        },
        correctAnswer: corr,
        solution: q.solution ? String(q.solution).trim() : "",
        imageUrl: q.imageUrl || "",
      };
    }),
    status: (status === "published" ? "published" : "draft") as "draft" | "published",
    enableLeaderboard: enableLeaderboard !== false,
    totalMarks: totalM,
    createdAt: new Date().toISOString(),
    publishedAt: status === "published" ? new Date().toISOString() : undefined,
  };

  db.tests.push(newTest);
  writeDb(db);
  res.status(201).json({ ...newTest, batchName: batch.name });
});

app.put("/api/admin/tests/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const {
    title,
    subject,
    batchId,
    durationMinutes,
    positiveMarks,
    negativeMarks,
    unattemptedMarks,
    questions,
    enableLeaderboard,
    status,
  } = req.body;

  const db = readDb();
  const index = db.tests.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Test not found" });
  }

  if (title) db.tests[index].title = String(title).trim();
  if (subject) db.tests[index].subject = String(subject).trim();
  if (batchId) db.tests[index].batchId = String(batchId);
  if (durationMinutes) db.tests[index].durationMinutes = Number(durationMinutes);
  if (positiveMarks !== undefined) db.tests[index].positiveMarks = Number(positiveMarks);
  if (negativeMarks !== undefined) db.tests[index].negativeMarks = Number(negativeMarks);
  if (unattemptedMarks !== undefined) db.tests[index].unattemptedMarks = Number(unattemptedMarks);
  if (enableLeaderboard !== undefined) db.tests[index].enableLeaderboard = Boolean(enableLeaderboard);
  if (status) db.tests[index].status = status;

  if (questions && Array.isArray(questions)) {
    db.tests[index].questions = questions.map((q: any, i: number) => {
      const qType = q.questionType === "integer" ? ("integer" as const) : ("mcq" as const);
      let corr = "";
      if (qType === "integer") {
        corr = q.correctAnswer !== undefined && q.correctAnswer !== null ? String(q.correctAnswer).trim() : "";
      } else {
        corr = ["A", "B", "C", "D"].includes(q.correctAnswer?.toUpperCase())
          ? (q.correctAnswer.toUpperCase() as "A" | "B" | "C" | "D")
          : "";
      }

      return {
        id: q.id || `q_${i + 1}_${Date.now()}`,
        questionNumber: q.questionNumber !== undefined && q.questionNumber !== null && !isNaN(Number(q.questionNumber)) ? Number(q.questionNumber) : i + 1,
        questionText: String(q.questionText || "").trim(),
        questionType: qType,
        options: {
          A: String(q.options?.A || "").trim(),
          B: String(q.options?.B || "").trim(),
          C: String(q.options?.C || "").trim(),
          D: String(q.options?.D || "").trim(),
        },
        optionImages: {
          A: q.optionImages?.A || "",
          B: q.optionImages?.B || "",
          C: q.optionImages?.C || "",
          D: q.optionImages?.D || "",
        },
        correctAnswer: corr,
        solution: q.solution ? String(q.solution).trim() : "",
        imageUrl: q.imageUrl || "",
      };
    });
    db.tests[index].totalMarks = db.tests[index].questions.length * db.tests[index].positiveMarks;
  }

  writeDb(db);
  const batch = db.batches.find((b) => b.id === db.tests[index].batchId);
  res.json({ ...db.tests[index], batchName: batch ? batch.name : "Unknown Batch" });
});

app.post("/api/admin/tests/:id/publish", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const test = db.tests.find((t) => t.id === id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }

  // Verification rule: Check for unverified questions
  const unverifiedQuestions = test.questions.filter((q) => !q.correctAnswer);
  if (unverifiedQuestions.length > 0) {
    return res.status(400).json({
      error: `Cannot publish test: Question(s) ${unverifiedQuestions.map((q) => q.questionNumber).join(", ")} do not have verified correct answers. Please verify all answers before publishing.`,
    });
  }

  test.status = "published";
  test.publishedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, message: "Test published successfully", test });
});

app.post("/api/admin/tests/:id/unpublish", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const test = db.tests.find((t) => t.id === id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  test.status = "draft";
  writeDb(db);
  res.json({ success: true, message: "Test moved to draft", test });
});

app.delete("/api/admin/tests/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  db.tests = db.tests.filter((t) => t.id !== id);
  db.attempts = db.attempts.filter((a) => a.testId !== id);
  db.results = db.results.filter((r) => r.testId !== id);
  writeDb(db);
  deleteFromFirestore("cbt_tests", id).catch(() => {});
  res.json({ success: true, message: "Test and associated records deleted" });
});

// Firebase Cloud Status & Manual Sync endpoints
app.get("/api/admin/firebase-status", authenticateAdmin, (req, res) => {
  const status = getFirebaseStatus();
  const db = readDb();
  res.json({
    ...status,
    localCounts: {
      batches: db.batches.length,
      students: db.students.length,
      tests: db.tests.length,
      results: db.results.length,
    },
  });
});

app.post("/api/admin/firebase-sync", authenticateAdmin, async (req, res) => {
  try {
    const db = readDb();
    const success = await syncToFirestore({
      batches: db.batches,
      students: db.students,
      tests: db.tests,
      results: db.results,
      attempts: db.attempts,
    });
    if (success) {
      res.json({
        success: true,
        message: "Successfully synchronized all Batches, Students, Tests, and Results with Firebase Cloud (gayaji-store)!",
        timestamp: new Date().toISOString(),
        counts: {
          batches: db.batches.length,
          students: db.students.length,
          tests: db.tests.length,
          results: db.results.length,
        },
      });
    } else {
      res.status(500).json({ success: false, error: "Failed to synchronize with Firebase Cloud. Please check network/rules." });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Sync exception" });
  }
});

// ==========================================
// ADMIN: RESULTS & BATCH RANKING VIEW
// ==========================================

app.get("/api/admin/results", authenticateAdmin, (req, res) => {
  const { testId, batchId, studentId } = req.query;
  const db = readDb();
  let resultsList = [...db.results];

  if (testId) resultsList = resultsList.filter((r) => r.testId === testId);
  if (batchId) resultsList = resultsList.filter((r) => r.batchId === batchId);
  if (studentId) resultsList = resultsList.filter((r) => r.studentId === studentId);

  // Group by test & batch to compute ranks
  const grouped: Record<string, typeof resultsList> = {};
  for (const r of resultsList) {
    const key = `${r.testId}_${r.batchId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const resultsWithRanks: any[] = [];
  for (const key in grouped) {
    const list = grouped[key].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.timeTakenSec - b.timeTakenSec;
    });

    list.forEach((item, index) => {
      resultsWithRanks.push({
        ...item,
        rankInBatch: index + 1,
        totalStudentsInBatch: list.length,
      });
    });
  }

  res.json(resultsWithRanks.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});

// ==========================================
// STUDENT: TEST DASHBOARD & CBT ATTEMPTS
// ==========================================

// Get available tests for student's batch
app.get("/api/student/tests", authenticateStudent, (req, res) => {
  const session = (req as any).studentSession;
  const db = readDb();

  // ONLY tests assigned to this student's batch AND status is published
  const availableTests = db.tests
    .filter((t) => t.batchId === session.batchId && t.status === "published")
    .map((t) => {
      const studentResult = db.results.find(
        (r) => r.testId === t.id && r.studentId === session.id
      );
      const activeAttempt = db.attempts.find(
        (a) => a.testId === t.id && a.studentId === session.id && a.status === "in_progress"
      );

      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        durationMinutes: t.durationMinutes,
        positiveMarks: t.positiveMarks,
        negativeMarks: t.negativeMarks,
        totalQuestions: t.questions.length,
        totalMarks: t.totalMarks,
        isCompleted: Boolean(studentResult),
        resultId: studentResult ? studentResult.id : null,
        hasActiveAttempt: Boolean(activeAttempt),
        attemptId: activeAttempt ? activeAttempt.id : null,
      };
    });

  res.json(availableTests);
});

// Start or resume test attempt
app.post("/api/student/tests/:testId/start", authenticateStudent, (req, res) => {
  const { testId } = req.params;
  const session = (req as any).studentSession;
  const db = readDb();

  const test = db.tests.find((t) => t.id === testId);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }

  // Security: Check batch match
  if (test.batchId !== session.batchId || test.status !== "published") {
    return res.status(403).json({ error: "You are not authorized to take this test" });
  }

  // Check if already completed
  const existingResult = db.results.find(
    (r) => r.testId === testId && r.studentId === session.id
  );
  if (existingResult) {
    return res.status(400).json({
      error: "You have already completed this test",
      resultId: existingResult.id,
    });
  }

  // Check for existing active attempt (for resume on refresh)
  let attempt = db.attempts.find(
    (a) => a.testId === testId && a.studentId === session.id && a.status === "in_progress"
  );

  const now = new Date();
  if (!attempt) {
    attempt = {
      id: "att_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
      testId: test.id,
      studentId: session.id,
      studentName: session.name,
      batchId: session.batchId,
      startTime: now.toISOString(),
      durationMinutes: test.durationMinutes,
      status: "in_progress",
      answers: {},
      markedForReview: [],
      lastSavedAt: now.toISOString(),
    };
    db.attempts.push(attempt);
    writeDb(db);
  }

  // Calculate remaining seconds securely based on server startTime
  const startEpoch = new Date(attempt.startTime).getTime();
  const totalDurationMs = attempt.durationMinutes * 60 * 1000;
  const elapsedMs = Date.now() - startEpoch;
  const remainingSeconds = Math.max(0, Math.floor((totalDurationMs - elapsedMs) / 1000));

  // Security: strip correctAnswer and solution before sending to student!
  const sanitizedQuestions = test.questions.map((q) => ({
    id: q.id,
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    questionType: q.questionType || "mcq",
    options: q.options,
    optionImages: q.optionImages || {},
    imageUrl: q.imageUrl || "",
  }));

  res.json({
    attemptId: attempt.id,
    test: {
      id: test.id,
      title: test.title,
      subject: test.subject,
      durationMinutes: test.durationMinutes,
      positiveMarks: test.positiveMarks,
      negativeMarks: test.negativeMarks,
      unattemptedMarks: test.unattemptedMarks || 0,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    },
    answers: attempt.answers,
    markedForReview: attempt.markedForReview,
    remainingSeconds,
    startTime: attempt.startTime,
  });
});

// Auto-save answers during test
app.post("/api/student/attempts/:attemptId/save-answers", authenticateStudent, (req, res) => {
  const { attemptId } = req.params;
  const { answers, markedForReview } = req.body;
  const session = (req as any).studentSession;

  const db = readDb();
  const attempt = db.attempts.find((a) => a.id === attemptId && a.studentId === session.id);
  if (!attempt) {
    return res.status(404).json({ error: "Attempt not found" });
  }

  if (attempt.status === "completed") {
    return res.status(400).json({ error: "Test attempt already submitted" });
  }

  if (answers && typeof answers === "object") {
    attempt.answers = answers;
  }
  if (markedForReview && Array.isArray(markedForReview)) {
    attempt.markedForReview = markedForReview;
  }
  attempt.lastSavedAt = new Date().toISOString();

  writeDb(db);
  res.json({ success: true, savedAt: attempt.lastSavedAt });
});

// Submit Test & Calculate Result Server-Side
app.post("/api/student/attempts/:attemptId/submit", authenticateStudent, (req, res) => {
  const { attemptId } = req.params;
  const { finalAnswers } = req.body;
  const session = (req as any).studentSession;

  const db = readDb();
  const attempt = db.attempts.find((a) => a.id === attemptId && a.studentId === session.id);
  if (!attempt) {
    return res.status(404).json({ error: "Attempt not found" });
  }

  // If already submitted, return existing result
  const existingResult = db.results.find((r) => r.attemptId === attemptId);
  if (existingResult) {
    return res.json(existingResult);
  }

  const test = db.tests.find((t) => t.id === attempt.testId);
  if (!test) {
    return res.status(404).json({ error: "Associated test not found" });
  }

  const student = db.students.find((s) => s.id === session.id);
  const batch = db.batches.find((b) => b.id === session.batchId);

  // Combine saved answers with final submitted answers if provided
  const answersMap: Record<number, string> = {
    ...attempt.answers,
    ...(finalAnswers || {}),
  };

  // SECURE SERVER-SIDE SCORING CALCULATION
  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const pos = test.positiveMarks;
  const neg = test.negativeMarks;
  const unattemptMarks = Number(test.unattemptedMarks) || 0;

  const questionAnalysis = test.questions.map((q) => {
    const qType: "mcq" | "integer" = q.questionType === "integer" ? "integer" : "mcq";
    const rawStudentAns = answersMap[q.questionNumber];
    const studentAns = rawStudentAns !== undefined && rawStudentAns !== null ? String(rawStudentAns).trim() : null;
    const isAtt = Boolean(studentAns !== null && studentAns !== "");

    let isCorr = false;
    if (isAtt && studentAns !== null) {
      if (qType === "integer") {
        const studentNum = parseFloat(studentAns);
        const correctNum = parseFloat(q.correctAnswer);
        if (!isNaN(studentNum) && !isNaN(correctNum)) {
          isCorr = Math.abs(studentNum - correctNum) < 0.0001;
        } else {
          isCorr = studentAns.toLowerCase() === q.correctAnswer.trim().toLowerCase();
        }
      } else {
        isCorr = studentAns.toUpperCase() === q.correctAnswer.trim().toUpperCase();
      }
    }

    let marks = 0;
    if (isAtt) {
      attempted++;
      if (isCorr) {
        correct++;
        marks = pos;
      } else {
        wrong++;
        marks = -neg;
      }
    } else {
      unattempted++;
      marks = unattemptMarks; // Blank / unattempted marking score
    }

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: qType,
      options: q.options,
      optionImages: q.optionImages || {},
      imageUrl: q.imageUrl || "",
      studentAnswer: studentAns,
      correctAnswer: q.correctAnswer,
      isCorrect: isCorr,
      isAttempted: isAtt,
      marksAwarded: marks,
      solution: q.solution || "",
    };
  });

  const totalQuestions = test.questions.length;
  const maxMarks = totalQuestions * pos;
  const score = correct * pos - wrong * neg + unattempted * unattemptMarks;
  const accuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(2)) : 0;
  const percentage = maxMarks > 0 ? Number(((score / maxMarks) * 100).toFixed(2)) : 0;

  const startEpoch = new Date(attempt.startTime).getTime();
  const timeTakenSec = Math.max(1, Math.min(test.durationMinutes * 60, Math.floor((Date.now() - startEpoch) / 1000)));

  attempt.status = "completed";
  attempt.endTime = new Date().toISOString();
  attempt.answers = answersMap;

  const newResult = {
    id: "res_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
    attemptId: attempt.id,
    testId: test.id,
    testTitle: test.title,
    subject: test.subject,
    studentId: session.id,
    studentCustomId: student ? student.studentId : "ME000",
    studentName: session.name,
    batchId: session.batchId,
    batchName: batch ? batch.name : "Batch",
    totalQuestions,
    attempted,
    correct,
    wrong,
    unattempted,
    positiveMarksPerQ: pos,
    negativeMarksPerQ: neg,
    unattemptedMarksPerQ: unattemptMarks,
    maxMarks,
    score,
    percentage,
    accuracy,
    timeTakenSec,
    submittedAt: new Date().toISOString(),
    enableLeaderboard: test.enableLeaderboard,
    questionAnalysis,
  };

  db.results.push(newResult);
  writeDb(db);

  // Compute Rank in this student's batch
  const batchResults = db.results
    .filter((r) => r.testId === test.id && r.batchId === session.batchId)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.timeTakenSec - b.timeTakenSec;
    });

  const rank = batchResults.findIndex((r) => r.id === newResult.id) + 1;

  res.status(201).json({
    ...newResult,
    rankInBatch: rank,
    totalStudentsInBatch: batchResults.length,
  });
});

// Student Result View
app.get("/api/student/results/:resultId", authenticateStudent, (req, res) => {
  const { resultId } = req.params;
  const session = (req as any).studentSession;
  const db = readDb();

  const result = db.results.find((r) => r.id === resultId && r.studentId === session.id);
  if (!result) {
    return res.status(404).json({ error: "Result not found" });
  }

  // Compute live rank in batch
  const batchResults = db.results
    .filter((r) => r.testId === result.testId && r.batchId === session.batchId)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.timeTakenSec - b.timeTakenSec;
    });

  const rank = batchResults.findIndex((r) => r.id === result.id) + 1;

  res.json({
    ...result,
    rankInBatch: rank,
    totalStudentsInBatch: batchResults.length,
  });
});

// Batch Leaderboard (Strictly Isolated to Student's Batch)
app.get("/api/student/tests/:testId/leaderboard", authenticateStudent, (req, res) => {
  const { testId } = req.params;
  const session = (req as any).studentSession;
  const db = readDb();

  const test = db.tests.find((t) => t.id === testId);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }

  if (!test.enableLeaderboard) {
    return res.status(403).json({ error: "Leaderboard is disabled for this test" });
  }

  // STRICT BATCH ISOLATION: Only students in the SAME batch!
  const batchResults = db.results
    .filter((r) => r.testId === testId && r.batchId === session.batchId)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.timeTakenSec - b.timeTakenSec;
    });

  const leaderboard = batchResults.map((r, idx) => ({
    rank: idx + 1,
    studentId: r.studentId,
    studentCustomId: r.studentCustomId,
    studentName: r.studentName,
    score: r.score,
    maxMarks: r.maxMarks,
    accuracy: r.accuracy,
    percentage: r.percentage,
    timeTakenSec: r.timeTakenSec,
    submittedAt: r.submittedAt,
    isCurrentStudent: r.studentId === session.id,
  }));

  const batch = db.batches.find((b) => b.id === session.batchId);

  res.json({
    testTitle: test.title,
    batchName: batch ? batch.name : "Batch",
    totalStudents: leaderboard.length,
    leaderboard,
  });
});

// Completed results list for student
app.get("/api/student/my-results", authenticateStudent, (req, res) => {
  const session = (req as any).studentSession;
  const db = readDb();

  const myResults = db.results
    .filter((r) => r.studentId === session.id)
    .map((r) => ({
      id: r.id,
      testId: r.testId,
      testTitle: r.testTitle,
      subject: r.subject,
      score: r.score,
      maxMarks: r.maxMarks,
      percentage: r.percentage,
      accuracy: r.accuracy,
      submittedAt: r.submittedAt,
    }))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  res.json(myResults);
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================

async function startServer() {
  // Initialize and pull from Firebase Cloud on boot
  try {
    initFirebase();
    pullFromFirestore()
      .then((cloudData) => {
        if (cloudData) {
          const currentDb = readDb();
          let changed = false;

          for (const cb of cloudData.batches) {
            if (!currentDb.batches.some((b) => b.id === cb.id)) {
              currentDb.batches.push(cb);
              changed = true;
            }
          }
          for (const cs of cloudData.students) {
            if (!currentDb.students.some((s) => s.id === cs.id || s.studentId === cs.studentId)) {
              currentDb.students.push(cs);
              changed = true;
            }
          }
          for (const ct of cloudData.tests) {
            if (!currentDb.tests.some((t) => t.id === ct.id)) {
              currentDb.tests.push(ct);
              changed = true;
            }
          }
          for (const cr of cloudData.results) {
            if (!currentDb.results.some((r) => r.id === cr.id)) {
              currentDb.results.push(cr);
              changed = true;
            }
          }

          if (changed) {
            fs.writeFileSync(DB_FILE, JSON.stringify(currentDb, null, 2), "utf8");
            console.log("[Firebase Cloud] Successfully merged cloud data into local database.");
          } else {
            // Push local to cloud
            syncToFirestore({
              batches: currentDb.batches,
              students: currentDb.students,
              tests: currentDb.tests,
              results: currentDb.results,
            }).catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.warn("[Firebase Cloud] Startup sync notice:", err?.message || err);
      });
  } catch (err) {
    console.warn("[Firebase Cloud] Startup init notice:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AN TECH CBT] Server running on http://localhost:${PORT}`);
  });
}

startServer();
