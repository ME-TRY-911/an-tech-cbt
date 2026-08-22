import { AuthSession, Batch, Student, Test, TestResult, LeaderboardEntry } from "../types";

const TOKEN_KEY = "mentors_cbt_token";
const SESSION_KEY = "mentors_cbt_session";

export function getSavedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSavedSession(): AuthSession | null {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export const getSession = getSavedSession;

export function saveSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getSavedToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  studentLogin: (studentId: string, password: string): Promise<AuthSession> =>
    fetchWithAuth("/api/auth/student-login", {
      method: "POST",
      body: JSON.stringify({ studentId, password }),
    }),

  adminLogin: (username: string, password: string): Promise<AuthSession> =>
    fetchWithAuth("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getMe: (): Promise<{ role: "student" | "admin"; user: any }> =>
    fetchWithAuth("/api/auth/me"),

  // Student APIs
  getStudentTests: (): Promise<any[]> =>
    fetchWithAuth("/api/student/tests"),

  startTest: (testId: string): Promise<{
    attemptId: string;
    test: any;
    answers: Record<number, string>;
    markedForReview: number[];
    remainingSeconds: number;
    startTime: string;
  }> =>
    fetchWithAuth(`/api/student/tests/${testId}/start`, { method: "POST" }),

  saveAnswers: (attemptId: string, answers: Record<number, string>, markedForReview: number[]) =>
    fetchWithAuth(`/api/student/attempts/${attemptId}/save-answers`, {
      method: "POST",
      body: JSON.stringify({ answers, markedForReview }),
    }),

  submitTest: (attemptId: string, finalAnswers: Record<number, string>): Promise<TestResult> =>
    fetchWithAuth(`/api/student/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ finalAnswers }),
    }),

  getResult: (resultId: string): Promise<TestResult> =>
    fetchWithAuth(`/api/student/results/${resultId}`),

  getResultById: (resultId: string): Promise<TestResult> =>
    fetchWithAuth(`/api/student/results/${resultId}`),

  getLeaderboard: (testId: string): Promise<{
    testTitle: string;
    batchName: string;
    totalStudents: number;
    leaderboard: LeaderboardEntry[];
  }> =>
    fetchWithAuth(`/api/student/tests/${testId}/leaderboard`),

  getMyResults: (): Promise<any[]> =>
    fetchWithAuth("/api/student/my-results"),

  // Admin APIs
  getBatches: (): Promise<Batch[]> =>
    fetchWithAuth("/api/admin/batches"),

  createBatch: (batchData: { name: string; code?: string; description?: string }): Promise<Batch> =>
    fetchWithAuth("/api/admin/batches", {
      method: "POST",
      body: JSON.stringify(batchData),
    }),

  deleteBatch: (id: string): Promise<{ success: boolean; message: string }> =>
    fetchWithAuth(`/api/admin/batches/${id}`, { method: "DELETE" }),

  getStudents: (): Promise<Student[]> =>
    fetchWithAuth("/api/admin/students"),

  createStudent: (studentData: { studentId: string; name: string; password: string; batchId: string }): Promise<Student> =>
    fetchWithAuth("/api/admin/students", {
      method: "POST",
      body: JSON.stringify(studentData),
    }),

  updateStudent: (id: string, updates: Partial<Student>): Promise<Student> =>
    fetchWithAuth(`/api/admin/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  resetPassword: (id: string, newPassword: string): Promise<{ success: boolean; message: string }> =>
    fetchWithAuth(`/api/admin/students/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),

  toggleStudentStatus: (id: string): Promise<{ success: boolean; message: string; status: "active" | "inactive" }> =>
    fetchWithAuth(`/api/admin/students/${id}/toggle-status`, { method: "POST" }),

  deleteStudent: (id: string): Promise<{ success: boolean; message: string }> =>
    fetchWithAuth(`/api/admin/students/${id}`, { method: "DELETE" }),

  getAdminTests: (): Promise<Test[]> =>
    fetchWithAuth("/api/admin/tests"),

  createTest: (testData: any): Promise<Test> =>
    fetchWithAuth("/api/admin/tests", {
      method: "POST",
      body: JSON.stringify(testData),
    }),

  updateTest: (id: string, testData: any): Promise<Test> =>
    fetchWithAuth(`/api/admin/tests/${id}`, {
      method: "PUT",
      body: JSON.stringify(testData),
    }),

  publishTest: (id: string): Promise<{ success: boolean; message: string; test: Test }> =>
    fetchWithAuth(`/api/admin/tests/${id}/publish`, { method: "POST" }),

  unpublishTest: (id: string): Promise<{ success: boolean; message: string; test: Test }> =>
    fetchWithAuth(`/api/admin/tests/${id}/unpublish`, { method: "POST" }),

  deleteTest: (id: string): Promise<{ success: boolean; message: string }> =>
    fetchWithAuth(`/api/admin/tests/${id}`, { method: "DELETE" }),

  extractQuestionsAI: (payload: {
    documentText?: string;
    documentBase64?: string;
    documentMimeType?: string;
    answerKeyText?: string;
    fileName?: string;
  }): Promise<{ success: boolean; questionsCount: number; questions: any[]; methodUsed?: string }> =>
    fetchWithAuth("/api/admin/extract-questions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminResults: (params?: { testId?: string; batchId?: string; studentId?: string }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.testId) query.set("testId", params.testId);
    if (params?.batchId) query.set("batchId", params.batchId);
    if (params?.studentId) query.set("studentId", params.studentId);
    return fetchWithAuth(`/api/admin/results?${query.toString()}`);
  },

  getFirebaseStatus: (): Promise<{
    projectId: string;
    status: "idle" | "syncing" | "connected" | "error";
    lastSyncTime: string | null;
    lastError: string | null;
    isConnected: boolean;
    localCounts?: {
      batches: number;
      students: number;
      tests: number;
      results: number;
    };
  }> => fetchWithAuth("/api/admin/firebase-status"),

  syncFirebase: (): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
    counts: { batches: number; students: number; tests: number; results: number };
  }> =>
    fetchWithAuth("/api/admin/firebase-sync", {
      method: "POST",
    }),
};
