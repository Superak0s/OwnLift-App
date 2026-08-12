import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { ThemeColors } from "@shared/context/ThemeContext";
import { normalizeExerciseName } from "@utils/exerciseMatching";
import type { SetDetail } from "../types";
import { kgToDisplay } from "../utils";
import type { makeStyles } from "../WorkoutScreen";
import {
  PartnerExercisePill,
  PartnerExerciseMatchBadge,
  PriorityMuscleGroupBadge,
} from "./PartnerBadges";

// ─── Partner-matching helpers for the exercise list ────────────────────────
// Extracted so the .map() callback below doesn't itself add to
// WorkoutScreen's Cognitive Complexity score.

type PartnerMatchInfo = {
  partnerMatchesByName: boolean;
  partnerOnThis: boolean;
  partnerSetCount: number | null;
};

function getPartnerMatchInfo(
  isInJointSession: boolean,
  partnerNameSet: Set<string>,
  partnerProgress: Record<string, unknown> | null,
  partnerParticipant:
    | { exerciseNames?: Array<string | { name: string; sets?: number }> }
    | null
    | undefined,
  exerciseNameLower: string,
): PartnerMatchInfo {
  const partnerMatchesByName =
    isInJointSession && partnerNameSet.has(exerciseNameLower);
  const partnerActiveExercise = partnerProgress?.exerciseName as
    | string
    | undefined;
  const partnerActiveNameLower = partnerActiveExercise
    ? normalizeExerciseName(partnerActiveExercise)
    : undefined;
  const partnerOnThis =
    isInJointSession &&
    !!partnerActiveNameLower &&
    partnerMatchesByName &&
    partnerActiveNameLower === exerciseNameLower;

  let partnerSetCount: number | null = null;
  if (partnerMatchesByName) {
    const entry = (partnerParticipant?.exerciseNames ?? []).find(
      (e) =>
        (typeof e === "string" ? e : e.name).trim().toLowerCase() ===
        exerciseNameLower,
    );
    partnerSetCount = typeof entry === "object" ? (entry?.sets ?? null) : null;
  }

  return { partnerMatchesByName, partnerOnThis, partnerSetCount };
}

// ─── Exercise card ──────────────────────────────────────────────────────────
// Memoized so the per-second rest-timer tick in WorkoutScreen (which re-renders
// the whole screen) doesn't also re-render and recompute every exercise/set row.
// partnerProgress/partnerCompletedSets get a new reference on every joint-session
// websocket message even when they don't touch this card's exercise, so plain
// shallow-compare memo would re-render every card on every partner rep. The
// custom comparator below re-derives the per-exercise match info instead of
// comparing references, so unrelated cards actually skip re-rendering.

type ExerciseCardStyles = ReturnType<typeof makeStyles>;

type ExerciseCardProps = {
  exercise: { name: string; sets: number; muscleGroup?: string };
  exerciseIndex: number;
  isPriorityMuscleGroup?: boolean;
  currentDay: number;
  isCurrentDayLocked: boolean;
  colors: ThemeColors;
  styles: ExerciseCardStyles;
  weightUnit: "kg" | "lbs";
  isInJointSession: boolean;
  partnerNameSet: Set<string>;
  partnerProgress: Record<string, unknown> | null;
  partnerParticipant:
    | { exerciseNames?: Array<string | { name: string; sets?: number }> }
    | null
    | undefined;
  partnerCompletedSets: Array<{ exerciseName?: string; setIndex: number }>;
  partnerUsername: string;
  getExerciseCompletedSets: (currentDay: number, exerciseIndex: number) => unknown;
  isSetComplete: (
    currentDay: number,
    exerciseIndex: number,
    setIndex: number,
  ) => boolean;
  getSetDetails: (
    currentDay: number,
    exerciseIndex: number,
    setIndex: number,
  ) => unknown;
  isAssistedExercise: (name: string) => boolean;
  onEditExerciseName: (exerciseIndex: number) => void;
  onSetPress: (exerciseIndex: number, setIndex: number) => void;
  onQuickAddSet: (exerciseIndex: number) => void;
  onAddMultipleSets: (exerciseIndex: number) => void;
};

export function exerciseCardPropsAreEqual(
  prev: Readonly<ExerciseCardProps>,
  next: Readonly<ExerciseCardProps>,
): boolean {
  const shallowKeys: (keyof ExerciseCardProps)[] = [
    "exercise",
    "exerciseIndex",
    "isPriorityMuscleGroup",
    "currentDay",
    "isCurrentDayLocked",
    "colors",
    "styles",
    "weightUnit",
    "isInJointSession",
    "partnerNameSet",
    "partnerParticipant",
    "partnerUsername",
    "getExerciseCompletedSets",
    "isSetComplete",
    "getSetDetails",
    "isAssistedExercise",
    "onEditExerciseName",
    "onSetPress",
    "onQuickAddSet",
    "onAddMultipleSets",
  ];
  if (shallowKeys.some((key) => prev[key] !== next[key])) return false;

  if (
    prev.partnerProgress === next.partnerProgress &&
    prev.partnerCompletedSets === next.partnerCompletedSets
  ) {
    return true;
  }

  const exerciseNameLower = next.exercise.name
    ? normalizeExerciseName(next.exercise.name)
    : "";
  const prevMatch = getPartnerMatchInfo(
    prev.isInJointSession,
    prev.partnerNameSet,
    prev.partnerProgress,
    prev.partnerParticipant,
    exerciseNameLower,
  );
  const nextMatch = getPartnerMatchInfo(
    next.isInJointSession,
    next.partnerNameSet,
    next.partnerProgress,
    next.partnerParticipant,
    exerciseNameLower,
  );
  if (
    prevMatch.partnerOnThis !== nextMatch.partnerOnThis ||
    prevMatch.partnerMatchesByName !== nextMatch.partnerMatchesByName ||
    prevMatch.partnerSetCount !== nextMatch.partnerSetCount ||
    (prev.partnerProgress?.setIndex as number | undefined) !==
      (next.partnerProgress?.setIndex as number | undefined)
  ) {
    return false;
  }

  const relevantSetsKey = (sets: ExerciseCardProps["partnerCompletedSets"]) =>
    sets
      .filter(
        (s) =>
          (s.exerciseName ? normalizeExerciseName(s.exerciseName) : undefined) ===
          exerciseNameLower,
      )
      .map((s) => s.setIndex)
      .sort((a, b) => a - b)
      .join(",");

  return (
    relevantSetsKey(prev.partnerCompletedSets) ===
    relevantSetsKey(next.partnerCompletedSets)
  );
}

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  exerciseIndex,
  isPriorityMuscleGroup = false,
  currentDay,
  isCurrentDayLocked,
  colors,
  styles,
  weightUnit,
  isInJointSession,
  partnerNameSet,
  partnerProgress,
  partnerParticipant,
  partnerCompletedSets,
  partnerUsername,
  getExerciseCompletedSets,
  isSetComplete,
  getSetDetails,
  isAssistedExercise,
  onEditExerciseName,
  onSetPress,
  onQuickAddSet,
  onAddMultipleSets,
}: Readonly<ExerciseCardProps>) {
  const completedSets = getExerciseCompletedSets(
    currentDay,
    exerciseIndex,
  ) as number;
  const allDone = completedSets === exercise.sets;
  const isAssisted = isAssistedExercise(exercise.name);
  const exerciseNameLower = exercise.name
    ? normalizeExerciseName(exercise.name)
    : "";
  const { partnerMatchesByName, partnerOnThis, partnerSetCount } =
    getPartnerMatchInfo(
      isInJointSession,
      partnerNameSet,
      partnerProgress,
      partnerParticipant,
      exerciseNameLower,
    );

  return (
    <View
      style={[
        styles.exerciseCard,
        allDone && styles.exerciseCardComplete,
        isCurrentDayLocked && styles.exerciseCardLocked,
        partnerMatchesByName && styles.exerciseCardShared,
        partnerOnThis && styles.exerciseCardPartner,
      ]}
    >
      {partnerOnThis && <PartnerExercisePill username={partnerUsername} />}
      {partnerMatchesByName && !partnerOnThis && partnerSetCount !== null && (
        <PartnerExerciseMatchBadge
          partnerSets={partnerSetCount}
          mySets={exercise.sets}
        />
      )}
      {isPriorityMuscleGroup && exercise.muscleGroup && (
        <PriorityMuscleGroupBadge muscleGroup={exercise.muscleGroup} />
      )}

      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <View style={styles.exerciseNameRow}>
            <Text
              style={[styles.exerciseName, allDone && styles.exerciseNameComplete]}
            >
              {exercise.name}
              {isAssisted && " 🤝"}
            </Text>
            {!isCurrentDayLocked && (
              <TouchableOpacity
                onPress={() => onEditExerciseName(exerciseIndex)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          {exercise.muscleGroup && (
            <Text style={styles.muscleGroup}>{exercise.muscleGroup}</Text>
          )}
        </View>
        <View style={styles.exerciseProgress}>
          <Text style={styles.exerciseProgressText}>
            {completedSets}/{exercise.sets}
          </Text>
        </View>
      </View>

      <View style={styles.setsContainer}>
        {Array.from({ length: exercise.sets }, (_, setIndex) => {
          const done = isSetComplete(currentDay, exerciseIndex, setIndex);
          if (isCurrentDayLocked && !done) return null;
          const setDetails = getSetDetails(
            currentDay,
            exerciseIndex,
            setIndex,
          ) as SetDetail | null;
          const partnerDoneThisSet =
            isInJointSession &&
            partnerCompletedSets.some(
              (s) =>
                (s.exerciseName
                  ? normalizeExerciseName(s.exerciseName)
                  : undefined) === exerciseNameLower && s.setIndex === setIndex,
            );
          const partnerOnSet =
            partnerOnThis &&
            (partnerProgress?.setIndex as number | undefined) === setIndex;
          return (
            <TouchableOpacity
              key={`${exercise.name || exerciseIndex}-set-${setIndex}`}
              style={[
                styles.setButton,
                done && styles.setButtonComplete,
                isCurrentDayLocked && done && styles.setButtonLocked,
                setDetails?.isWarmup && styles.setButtonWarmup,
                partnerDoneThisSet && styles.setButtonPartnerDone,
                partnerOnSet && styles.setButtonPartner,
              ]}
              onPress={() => onSetPress(exerciseIndex, setIndex)}
              activeOpacity={isCurrentDayLocked ? 1 : 0.7}
              disabled={isCurrentDayLocked && !done}
            >
              {partnerOnSet && <View style={styles.partnerSetDot} />}
              <Text
                style={[
                  styles.setButtonNumber,
                  done && styles.setButtonNumberComplete,
                  isCurrentDayLocked && done && { color: colors.textPrimary },
                  setDetails?.isWarmup && styles.warmupText,
                  partnerDoneThisSet && done && { color: colors.accentDark },
                ]}
              >
                {setDetails?.isWarmup ? "W" : setIndex + 1}
              </Text>
              {done && setDetails && (
                <View style={styles.setDetailsPreview}>
                  <Text
                    style={[
                      styles.setDetailsText,
                      isCurrentDayLocked && { color: colors.textPrimary },
                    ]}
                  >
                    {setDetails.weight ? kgToDisplay(setDetails.weight, weightUnit) : "0"}
                    {weightUnit}
                  </Text>
                  <Text
                    style={[
                      styles.setDetailsText,
                      isCurrentDayLocked && { color: colors.textPrimary },
                    ]}
                  >
                    ×{setDetails.reps || 0}
                  </Text>
                  {setDetails.note && (
                    <Text style={styles.setNoteIndicator}>📝</Text>
                  )}
                </View>
              )}
              {done && (
                <View style={styles.setCheckmark}>
                  <Text style={styles.setCheckmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {!isCurrentDayLocked && (
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => onQuickAddSet(exerciseIndex)}
            onLongPress={() => onAddMultipleSets(exerciseIndex)}
          >
            <Text style={styles.addSetButtonIcon}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isCurrentDayLocked && (
        <View style={styles.exerciseHint}>
          <Text style={styles.exerciseHintText}>
            Tap + to add 1 set · Long press for multiple
          </Text>
        </View>
      )}
    </View>
  );
}, exerciseCardPropsAreEqual);
