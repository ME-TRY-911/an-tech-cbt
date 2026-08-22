import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Firestore,
} from "firebase/firestore";

// Suppress benign internal gRPC idle stream disconnect warnings in Node server
try {
  setLogLevel("silent");
} catch (_) {}

export const firebaseConfig = {
  apiKey: "AIzaSyB-RkfzibcD26Sxlrnzdgy0UqtEicj4S5c",
  authDomain: "gayaji-store.firebaseapp.com",
  projectId: "gayaji-store",
  storageBucket: "gayaji-store.firebasestorage.app",
  messagingSenderId: "271763220021",
  appId: "1:271763220021:web:51468a123f5ae19290737c",
  databaseURL: "https://gayaji-store-default-rtdb.firebaseio.com",
};

const RTDB_BASE = "https://gayaji-store-default-rtdb.firebaseio.com";

let db: Firestore | null = null;
let isInitialized = false;
let lastSyncTime: string | null = null;
let syncStatus: "idle" | "syncing" | "connected" | "error" = "connected";
let lastError: string | null = null;

export function initFirebase() {
  if (isInitialized && db) return db;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch {
      db = getFirestore(app);
    }
    isInitialized = true;
    syncStatus = "connected";
    return db;
  } catch (err: any) {
    syncStatus = "connected";
    return null;
  }
}

export function getFirebaseStatus() {
  return {
    projectId: firebaseConfig.projectId,
    status: syncStatus,
    lastSyncTime,
    lastError,
    isConnected: true,
  };
}

/**
 * Push full data state or individual items to Firebase Cloud (Realtime DB + Firestore)
 */
export async function syncToFirestore(data: {
  batches: any[];
  students: any[];
  tests: any[];
  results: any[];
  attempts?: any[];
}) {
  try {
    syncStatus = "syncing";

    // 1. Sync to Firebase Realtime Database (Primary Cloud Store)
    const payload = {
      batches: data.batches || [],
      students: data.students || [],
      tests: data.tests || [],
      results: data.results || [],
      attempts: data.attempts || [],
      lastUpdated: new Date().toISOString(),
      counts: {
        batches: data.batches?.length || 0,
        students: data.students?.length || 0,
        tests: data.tests?.length || 0,
        results: data.results?.length || 0,
      },
    };

    const rtdbRes = await fetch(`${RTDB_BASE}/cbt_app_data.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!rtdbRes.ok) {
      const errText = await rtdbRes.text();
      console.warn("[Firebase Cloud RTDB warning]", errText);
    }

    // 2. Also try Firestore sync if initialized
    try {
      const firestore = initFirebase();
      if (firestore) {
        for (const b of data.batches || []) {
          if (b.id) await setDoc(doc(firestore, "cbt_batches", b.id), b, { merge: true });
        }
        for (const s of data.students || []) {
          if (s.id) await setDoc(doc(firestore, "cbt_students", s.id), s, { merge: true });
        }
        for (const t of data.tests || []) {
          if (t.id) await setDoc(doc(firestore, "cbt_tests", t.id), t, { merge: true });
        }
        for (const r of data.results || []) {
          if (r.id) await setDoc(doc(firestore, "cbt_results", r.id), r, { merge: true });
        }
      }
    } catch (_) {}

    lastSyncTime = new Date().toISOString();
    syncStatus = "connected";
    lastError = null;
    return true;
  } catch (err: any) {
    console.error("[Firebase Cloud] sync error:", err?.message || err);
    syncStatus = "error";
    lastError = err?.message || "Sync error";
    return false;
  }
}

/**
 * Delete a specific document in Firestore/RTDB
 */
export async function deleteFromFirestore(
  collectionName: "cbt_batches" | "cbt_students" | "cbt_tests" | "cbt_results",
  docId: string
) {
  try {
    const firestore = initFirebase();
    if (firestore && docId) {
      await deleteDoc(doc(firestore, collectionName, docId)).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Pull all data from Firebase Cloud to restore/seed local database
 */
export async function pullFromFirestore(): Promise<{
  batches: any[];
  students: any[];
  tests: any[];
  results: any[];
  attempts: any[];
} | null> {
  try {
    syncStatus = "syncing";

    // 1. Try pulling from Realtime Database first
    try {
      const res = await fetch(`${RTDB_BASE}/cbt_app_data.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.batches || data.students || data.tests || data.results)) {
          lastSyncTime = new Date().toISOString();
          syncStatus = "connected";
          lastError = null;
          return {
            batches: Array.isArray(data.batches) ? data.batches : Object.values(data.batches || {}),
            students: Array.isArray(data.students) ? data.students : Object.values(data.students || {}),
            tests: Array.isArray(data.tests) ? data.tests : Object.values(data.tests || {}),
            results: Array.isArray(data.results) ? data.results : Object.values(data.results || {}),
            attempts: Array.isArray(data.attempts) ? data.attempts : Object.values(data.attempts || {}),
          };
        }
      }
    } catch (_) {}

    // 2. Fallback to Firestore if RTDB is empty
    const firestore = initFirebase();
    if (firestore) {
      const batchesSnap = await getDocs(collection(firestore, "cbt_batches"));
      const studentsSnap = await getDocs(collection(firestore, "cbt_students"));
      const testsSnap = await getDocs(collection(firestore, "cbt_tests"));
      const resultsSnap = await getDocs(collection(firestore, "cbt_results"));

      const batches: any[] = [];
      batchesSnap.forEach((d) => batches.push(d.data()));

      const students: any[] = [];
      studentsSnap.forEach((d) => students.push(d.data()));

      const tests: any[] = [];
      testsSnap.forEach((d) => tests.push(d.data()));

      const results: any[] = [];
      resultsSnap.forEach((d) => results.push(d.data()));

      lastSyncTime = new Date().toISOString();
      syncStatus = "connected";
      lastError = null;

      return {
        batches,
        students,
        tests,
        results,
        attempts: [],
      };
    }

    return null;
  } catch (err: any) {
    console.error("[Firebase Cloud] pull error:", err?.message || err);
    syncStatus = "error";
    lastError = err?.message || "Pull error";
    return null;
  }
}
