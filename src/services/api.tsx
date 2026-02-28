/**
 * Main API Module
 * Aggregates all API services and exports them for easy importing.
 */

import { workoutApi } from './workout'
import { bodyTrackingApi } from './bodyStats'

// Configuration
export {
  getServerUrl,
  setServerUrl,
  getDefaultServerUrl,
  resetServerUrl,
  onServerUrlChange,
} from './config'

// Authentication
export { authService, authenticatedFetch } from './auth'
export type { AuthUser, AuthResponse } from './auth'

// Macros Tracking
export { macrosTrackingApi } from './macros'
export type { LogMacrosParams, MacrosGoals } from './macros'

// Creatine
export { creatineApi } from './creatine'
export type { LocationCheckResult } from './creatine'

// Photo Calendar
export { photoApi } from './photo'

// Body Tracking
export { bodyTrackingApi, bodyFatApi, getCurrentBodyWeight } from './bodyStats'
export type { WeightUnit, HeightUnit, Gender, HeightInput, BodyFatMeasurements } from './bodyStats'

// Workout
export { workoutApi } from './workout'
export type { WorkoutAnalytics, WorkoutSession, SetTiming } from './workout'

// Friends
export { friendsApi } from './friends'
export type { Friend, PendingFriendRequest, SentFriendRequest, UserSearchResult } from './friends'

// Sharing
export { sharingApi } from './sharing'
export type {
  PermissionType,
  GrantedPermission,
  ReceivedPermission,
  SharedProgram,
  JointInviteParams,
} from './sharing'

// Program
export { programApi } from './program'
export type { SavedProgram, ExercisePayload } from './program'

// Version
export {
  parseVersion,
  compareVersions,
  checkVersionCompatibility,
  fetchServerVersion,
  getClientVersion,
  validateServerVersion,
} from './versionService'
export type { ParsedVersion, VersionCompatibility, ServerVersionResult, ValidationResult } from './versionService'

// ─────────────────────────────────────────────────────────────
// Legacy named exports for backward compatibility
// ─────────────────────────────────────────────────────────────

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
