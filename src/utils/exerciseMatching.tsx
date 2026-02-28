// Utility functions for exercise name matching and suggestions

import type { WorkoutData } from "../types/index"

export interface SimilarityMatch {
  name: string
  similarity: number
}

export interface TypoCheckResult {
  isLikelyTypo: boolean
  suggestions: SimilarityMatch[]
  exactMatch?: string | null
}

/**
 * Calculate Levenshtein distance between two strings
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  const matrix: number[][] = []

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[s2.length][s1.length]
}

/**
 * Calculate similarity score between two strings (0-1 range)
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  return 1 - distance / maxLength
}

/**
 * Find all unique exercise names from workout data
 */
export const getAllExerciseNames = (
  workoutData: WorkoutData | null | undefined,
  selectedPerson: string | null,
): string[] => {
  const exerciseNames = new Set<string>()

  if (!workoutData?.days || !selectedPerson) return []

  workoutData.days.forEach((day) => {
    const personWorkout = day.people[selectedPerson]
    if (personWorkout?.exercises) {
      personWorkout.exercises.forEach((exercise) => {
        if (exercise.name) {
          exerciseNames.add(exercise.name.trim())
        }
      })
    }
  })

  return Array.from(exerciseNames)
}

/**
 * Find all unique muscle groups from workout data for a person.
 */
export const getAllMuscleGroups = (
  workoutData: WorkoutData | null | undefined,
  selectedPerson: string | null,
): string[] => {
  const groups = new Set<string>(CANONICAL_MUSCLE_GROUPS)

  if (workoutData?.days && selectedPerson) {
    workoutData.days.forEach((day) => {
      const personWorkout = day.people?.[selectedPerson]
      if (personWorkout?.exercises) {
        personWorkout.exercises.forEach((exercise) => {
          if (exercise.muscleGroup?.trim()) {
            groups.add(exercise.muscleGroup.trim())
          }
        })
      }
    })
  }

  return Array.from(groups)
}

/**
 * Canonical list of common muscle group names.
 */
export const CANONICAL_MUSCLE_GROUPS: readonly string[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Core",
  "Abs",
  "Obliques",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Hip Flexors",
  "Adductors",
  "Abductors",
  "Lats",
  "Traps",
  "Rhomboids",
  "Lower Back",
  "Upper Back",
  "Upper Chest",
  "Inner Chest",
  "Rear Delts",
  "Front Delts",
  "Side Delts",
  "Full Body",
  "Legs",
  "Arms",
  "Push",
  "Pull",
]

/**
 * Find exact match for a name (case-insensitive)
 */
export const findExactMatch = (
  name: string,
  allNames: string[],
): string | undefined => {
  const normalized = name.toLowerCase().trim()
  return allNames.find((n) => n.toLowerCase().trim() === normalized)
}

/**
 * Find similar names based on fuzzy matching.
 */
export const findSimilarNames = (
  name: string,
  allNames: string[],
  threshold: number = 0.6,
  maxResults: number = 3,
): SimilarityMatch[] => {
  if (!name || name.trim().length < 3) return []

  const normalized = name.toLowerCase().trim()

  return allNames
    .map((n) => {
      const candidate = n.toLowerCase().trim()
      const similarity = calculateSimilarity(name, n)
      const isPrefix = candidate.startsWith(normalized)
      return {
        name: n,
        similarity: isPrefix ? Math.max(similarity, 0.8) : similarity,
      }
    })
    .filter((match) => match.similarity >= threshold && match.similarity < 1.0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
}

/**
 * Find similar exercise names based on fuzzy matching
 * @deprecated Use findSimilarNames directly
 */
export const findSimilarExercises = (
  exerciseName: string,
  allExercises: string[],
  threshold: number = 0.6,
  maxResults: number = 3,
): SimilarityMatch[] =>
  findSimilarNames(exerciseName, allExercises, threshold, maxResults)

/**
 * Check if exercise name is a typo and suggest corrections.
 */
export const checkForTypo = (
  exerciseName: string,
  allExercises: string[],
): TypoCheckResult => {
  if (!exerciseName || !exerciseName.trim()) {
    return { isLikelyTypo: false, suggestions: [] }
  }

  const exactMatch = findExactMatch(exerciseName, allExercises)
  if (exactMatch) {
    return { isLikelyTypo: false, suggestions: [], exactMatch }
  }

  const suggestions = findSimilarNames(exerciseName, allExercises, 0.7, 3)
  const isLikelyTypo = suggestions.some((s) => s.similarity > 0.75)

  return { isLikelyTypo, suggestions, exactMatch: null }
}

/**
 * Check if muscle group is a typo and suggest corrections.
 */
export const checkMuscleGroupForTypo = (
  muscleGroup: string,
  allMuscleGroups: string[],
): TypoCheckResult => {
  if (!muscleGroup || !muscleGroup.trim()) {
    return { isLikelyTypo: false, suggestions: [] }
  }

  const exactMatch = findExactMatch(muscleGroup, allMuscleGroups)
  if (exactMatch) {
    return { isLikelyTypo: false, suggestions: [], exactMatch }
  }

  const suggestions = findSimilarNames(muscleGroup, allMuscleGroups, 0.7, 3)
  const isLikelyTypo = suggestions.some((s) => s.similarity > 0.75)

  return { isLikelyTypo, suggestions, exactMatch: null }
}

/**
 * Get canonical exercise name (handles case-insensitive matching).
 */
export const getCanonicalName = (
  exerciseName: string,
  allExercises: string[],
): string => {
  const exactMatch = findExactMatch(exerciseName, allExercises)
  return exactMatch || exerciseName
}

/**
 * Get canonical muscle group name (handles case-insensitive matching).
 */
export const getCanonicalMuscleGroup = (
  muscleGroup: string,
  allMuscleGroups: string[],
): string => {
  const exactMatch = findExactMatch(muscleGroup, allMuscleGroups)
  return exactMatch || muscleGroup
}
