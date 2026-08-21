export interface Batch {
  id: string;
  name: string;
  code: string;
  description?: string;
  studentCount?: number;
  testCount?: number;
  createdAt: string;
}

export interface Student {
  id: string;
  studentId: string; // e.g. ME001
  name: string;
  password?: string;
  batchId: string;
  batchName?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType?: 'mcq' | 'integer'; // 'mcq' (options A-D) or 'integer' (numerical value)
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionImages?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctAnswer: string; // 'A' | 'B' | 'C' | 'D' | '' for MCQ, or integer/numerical string like "5", "12", "-4", "3.14"
  solution?: string;
  imageUrl?: string; // Question diagram image URL or data URI
}

export interface Test {
  id: string;
  title: string;
  subject: string;
  batchId: string;
  batchName?: string;
  durationMinutes: number;
  positiveMarks: number; // e.g. 4
  negativeMarks: number; // e.g. 1
  unattemptedMarks?: number; // e.g. 0 or -0.5 (blank/unattempted marking)
  questions: Question[];
  status: 'draft' | 'published' | 'archived';
  enableLeaderboard: boolean;
  totalMarks: number;
  createdAt: string;
  publishedAt?: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  batchId: string;
  startTime: string; // ISO string
  durationMinutes: number;
  endTime?: string;
  status: 'in_progress' | 'completed';
  answers: Record<number, string>; // questionNumber -> 'A' | 'B' | 'C' | 'D' or numeric value string
  markedForReview: number[]; // questionNumbers
  lastSavedAt: string;
}

export interface QuestionResultAnalysis {
  questionNumber: number;
  questionText: string;
  questionType?: 'mcq' | 'integer';
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionImages?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  imageUrl?: string;
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  isAttempted: boolean;
  marksAwarded: number;
  solution?: string;
}

export interface TestResult {
  id: string;
  attemptId: string;
  testId: string;
  testTitle: string;
  subject: string;
  studentId: string;
  studentCustomId: string; // ME001
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
  unattemptedMarksPerQ?: number; // Blank/unattempted marking per Q
  maxMarks: number;
  score: number;
  percentage: number;
  accuracy: number;
  timeTakenSec: number;
  submittedAt: string;
  rankInBatch: number;
  totalStudentsInBatch: number;
  enableLeaderboard: boolean;
  questionAnalysis: QuestionResultAnalysis[];
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentCustomId: string;
  studentName: string;
  score: number;
  maxMarks: number;
  accuracy: number;
  percentage: number;
  timeTakenSec: number;
  submittedAt: string;
  isCurrentStudent?: boolean;
}

export interface AuthSession {
  token: string;
  role: 'student' | 'admin';
  user: {
    id: string;
    studentId?: string;
    name: string;
    batchId?: string;
    batchName?: string;
    username?: string;
  };
}
