/**
 * Main API Module
 * Aggregates all API services and exports them for easy importing
 */

// ─────────────────────────────────────────────────────────────
// Imports for legacy named exports (must be at top of module)
// NOTE: Do NOT use require() here — it returns undefined in
// ES module contexts and causes errors like
// "cannot read property 'fetchTrackingSnapshot' of undefined".
// ─────────────────────────────────────────────────────────────
import { workoutApi } from "./workout"
import { bodyTrackingApi } from "./bodyStats"

// Configuration
export {
  getServerUrl,
  setServerUrl,
  getDefaultServerUrl,
  resetServerUrl,
  onServerUrlChange,
} from "./config"

// Authentication
export { authService, authenticatedFetch } from "./auth"

// Macros Tracking
export { macrosTrackingApi } from "./macros"

// Creatine
export { creatineApi } from "./creatine"

// Photo Calendar
export { photoApi } from "./photo"

// Body Tracking
export { bodyTrackingApi, bodyFatApi, getCurrentBodyWeight } from "./bodyStats"

// Workout
export { workoutApi } from "./workout"

// Friends
export { friendsApi } from "./friends"

// Sharing
export { sharingApi } from "./sharing"

// Program
export { programApi } from "./program"

// ─────────────────────────────────────────────────────────────
// Legacy named exports for backward compatibility
// ─────────────────────────────────────────────────────────────

// Workout legacy exports
export const {
  uploadWorkoutFile,
  pickWorkoutFile,
  getPersonWeeklyPlan,
  getDayWorkout,
  healthCheck,
  startSession,
  recordSet,
  endSession,
  getAnalytics,
  getSessionHistory,
  getSession,
  clearDemoSessions,
  deleteAllSessions,
  deleteAllSessionsForPerson,
} = workoutApi

// Body stats legacy exports
export const {
  fetchTrackingSnapshot,
  logWeight,
  getWeightHistory,
  deleteWeightEntry,
  getCurrentWeight,
  saveHeightAndUnits,
  getHeightAndUnits,
  saveCreatineSettings,
  getCreatineStatus,
  markCreatineTaken,
  getCreatineHistory,
  deleteCreatineEntry,
  uploadProgressPhoto,
  getPhotoList,
  getPhotoUrl,
  fetchPhotoAsUri,
  deleteProgressPhoto,
} = bodyTrackingApi
