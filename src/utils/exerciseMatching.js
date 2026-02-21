// Utility functions for exercise name matching and suggestions

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of exercise names
 */
export const levenshteinDistance = (str1, str2) => {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  const matrix = []

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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[s2.length][s1.length]
}

/**
 * Calculate similarity score between two strings (0-1 range)
 * Higher score = more similar
 */
export const calculateSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  return 1 - distance / maxLength
}

/**
 * Find all unique exercise names from workout data and session history
 */
export const getAllExerciseNames = (workoutData, selectedPerson) => {
  const exerciseNames = new Set()

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
 * Also merges in the canonical list so common groups are always available
 * even if the current program doesn't use them yet.
 */
export const getAllMuscleGroups = (workoutData, selectedPerson) => {
  const groups = new Set(CANONICAL_MUSCLE_GROUPS)

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
 * Used as the baseline for typo-checking so users always get suggestions
 * even on their first exercise entry.
 */
export const CANONICAL_MUSCLE_GROUPS = [
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
export const findExactMatch = (name, allNames) => {
  const normalized = name.toLowerCase().trim()
  return allNames.find((n) => n.toLowerCase().trim() === normalized)
}

/**
 * Find similar names based on fuzzy matching.
 * Returns array of { name, similarity } sorted by similarity (highest first).
 */
export const findSimilarNames = (
  name,
  allNames,
  threshold = 0.6,
  maxResults = 3,
) => {
  if (!name || name.trim().length < 3) return []

  const normalized = name.toLowerCase().trim()

  return allNames
    .map((n) => {
      const candidate = n.toLowerCase().trim()
      const similarity = calculateSimilarity(name, n)
      // Boost score if candidate starts with the typed input
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

// ─── Exercise name helpers (kept for backwards compatibility) ─────────────────

/**
 * Find similar exercise names based on fuzzy matching
 * @deprecated Use findSimilarNames directly
 */
export const findSimilarExercises = (
  exerciseName,
  allExercises,
  threshold = 0.6,
  maxResults = 3,
) => findSimilarNames(exerciseName, allExercises, threshold, maxResults)

/**
 * Check if exercise name is a typo and suggest corrections.
 * Returns { isLikelyTypo, suggestions, exactMatch }
 */
export const checkForTypo = (exerciseName, allExercises) => {
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
 * Works identically to checkForTypo but operates on muscle group lists.
 * Returns { isLikelyTypo, suggestions, exactMatch }
 */
export const checkMuscleGroupForTypo = (muscleGroup, allMuscleGroups) => {
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
 * Returns the original casing from the exercise database.
 */
export const getCanonicalName = (exerciseName, allExercises) => {
  const exactMatch = findExactMatch(exerciseName, allExercises)
  return exactMatch || exerciseName
}

/**
 * Get canonical muscle group name (handles case-insensitive matching).
 * Returns the original casing from the muscle group list.
 */
export const getCanonicalMuscleGroup = (muscleGroup, allMuscleGroups) => {
  const exactMatch = findExactMatch(muscleGroup, allMuscleGroups)
  return exactMatch || muscleGroup
}
