import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { ExercisePickerModal } from '@/src/components/ExercisePickerModal';
import { RestTimerCard } from '@/src/components/RestTimerCard';
import { WorkoutSetRow } from '@/src/components/WorkoutSetRow';
import { LIMITS } from '@/src/domain/limits';
import { shouldAutoStartRest } from '@/src/domain/restTimer';
import {
  getActiveWorkout,
  listExercises,
  workoutDurationSeconds,
} from '@/src/domain/selectors';
import type { SetType, WorkoutExercise } from '@/src/domain/types';
import { SET_TYPES } from '@/src/domain/types';
import type { WorkoutSetPatch } from '@/src/domain/workouts';
import { useAppData } from '@/src/state/AppDataContext';
import {
  restTimerAutoStart,
  restTimerSyncPreference,
} from '@/src/state/restTimerStore';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

function nextSetType(current: SetType): SetType {
  const index = SET_TYPES.indexOf(current);
  return SET_TYPES[(index + 1) % SET_TYPES.length] as SetType;
}

export default function ActiveWorkoutScreen() {
  const { status, data, mutate } = useAppData();
  const [now, setNow] = useState(() => new Date());
  const [showPicker, setShowPicker] = useState(false);

  // Live duration ticker.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const workout = useMemo(
    () => (data ? getActiveWorkout(data) : undefined),
    [data],
  );

  // Keep the timer's configured duration in step with the preference.
  const defaultRestDuration = data?.preferences.defaultRestDuration;
  useEffect(() => {
    if (defaultRestDuration !== undefined) {
      restTimerSyncPreference(defaultRestDuration);
    }
  }, [defaultRestDuration]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'error' || !data) {
    return (
      <View style={styles.center}>
        <Text>Could not load workout data.</Text>
      </View>
    );
  }
  if (!workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No active workout</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const weightUnit = data.preferences.weightUnit;
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const completedSets = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0,
  );

  const runMutation = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      Alert.alert('Workout update failed', String(error));
    }
  };

  const handleToggleExercise = (exerciseId: string) => {
    const present = workout.exercises.some((e) => e.exerciseId === exerciseId);
    void runMutation(() =>
      present
        ? mutate((repo) =>
            repo.removeExerciseFromWorkout(workout.workoutId, exerciseId),
          )
        : mutate((repo) =>
            repo.addExerciseToWorkout(workout.workoutId, exerciseId),
          ),
    );
  };

  const handleComplete = () => {
    Alert.alert(
      'Complete workout',
      `Finish "${workout.name}"? ${completedSets} of ${totalSets} sets completed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            void runMutation(async () => {
              await mutate((repo) => repo.completeWorkout(workout.workoutId));
              router.back();
            });
          },
        },
      ],
    );
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard workout',
      'Delete this workout and all logged sets? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            void runMutation(async () => {
              await mutate((repo) => repo.discardWorkout(workout.workoutId));
              router.back();
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.meta}>
            {formatDuration(workoutDurationSeconds(workout, now))} ·{' '}
            {completedSets}/{totalSets} sets
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <RestTimerCard />
        {workout.exercises.length === 0 ? (
          <Text style={styles.empty}>
            No exercises yet — tap “Add exercise” below.
          </Text>
        ) : (
          workout.exercises.map((entry, index) => (
            <ExerciseCard
              key={entry.exerciseId}
              entry={entry}
              index={index}
              count={workout.exercises.length}
              weightUnit={weightUnit}
              onMove={(direction) =>
                void runMutation(() =>
                  mutate((repo) =>
                    repo.moveWorkoutExercise(
                      workout.workoutId,
                      entry.exerciseId,
                      direction,
                    ),
                  ),
                )
              }
              onRemove={() => {
                Alert.alert(
                  'Remove exercise',
                  `Remove "${entry.name}" and its sets?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        void runMutation(() =>
                          mutate((repo) =>
                            repo.removeExerciseFromWorkout(
                              workout.workoutId,
                              entry.exerciseId,
                            ),
                          ),
                        ),
                    },
                  ],
                );
              }}
              onAddSet={() =>
                void runMutation(() =>
                  mutate((repo) =>
                    repo.addSetToWorkout(workout.workoutId, entry.exerciseId),
                  ),
                )
              }
              onCommitSet={(setId, patch) =>
                void runMutation(() =>
                  mutate((repo) =>
                    repo.updateWorkoutSet(
                      workout.workoutId,
                      entry.exerciseId,
                      setId,
                      patch,
                    ),
                  ),
                )
              }
              onCycleType={(setId, current) =>
                void runMutation(() =>
                  mutate((repo) =>
                    repo.updateWorkoutSet(
                      workout.workoutId,
                      entry.exerciseId,
                      setId,
                      { type: nextSetType(current) },
                    ),
                  ),
                )
              }
              onToggleComplete={(setId, completed) => {
                const nextCompleted = !completed;
                if (nextCompleted) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                    () => {},
                  );
                  if (shouldAutoStartRest(data.preferences)) {
                    restTimerAutoStart(data.preferences.defaultRestDuration);
                  }
                }
                void runMutation(() =>
                  mutate((repo) =>
                    repo.updateWorkoutSet(
                      workout.workoutId,
                      entry.exerciseId,
                      setId,
                      { completed: nextCompleted },
                    ),
                  ),
                );
              }}
              onDeleteSet={(setId) =>
                void runMutation(() =>
                  mutate((repo) =>
                    repo.removeSetFromWorkout(
                      workout.workoutId,
                      entry.exerciseId,
                      setId,
                    ),
                  ),
                )
              }
            />
          ))
        )}

        <Pressable
          style={styles.addExerciseButton}
          onPress={() => setShowPicker(true)}
          disabled={
            workout.exercises.length >= LIMITS.maxExercisesPerWorkoutOrRoutine
          }
        >
          <Text style={styles.addExerciseText}>+ Add exercise</Text>
        </Pressable>

        <View style={styles.footer}>
          <Pressable style={styles.discardButton} onPress={handleDiscard}>
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
          <Pressable style={styles.completeButton} onPress={handleComplete}>
            <Text style={styles.completeText}>Complete workout</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ExercisePickerModal
        visible={showPicker}
        exercises={listExercises(data)}
        selectedIds={new Set(workout.exercises.map((e) => e.exerciseId))}
        onToggle={handleToggleExercise}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

function ExerciseCard({
  entry,
  index,
  count,
  weightUnit,
  onMove,
  onRemove,
  onAddSet,
  onCommitSet,
  onCycleType,
  onToggleComplete,
  onDeleteSet,
}: {
  entry: WorkoutExercise;
  index: number;
  count: number;
  weightUnit: 'kg' | 'lb';
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onCommitSet: (setId: string, patch: WorkoutSetPatch) => void;
  onCycleType: (setId: string, current: SetType) => void;
  onToggleComplete: (setId: string, completed: boolean) => void;
  onDeleteSet: (setId: string) => void;
}) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>
          {index + 1}. {entry.name}
        </Text>
        <View style={styles.exerciseActions}>
          <Pressable
            onPress={() => onMove(-1)}
            disabled={index === 0}
            style={styles.iconButton}
          >
            <Text style={[styles.iconText, index === 0 && styles.iconDisabled]}>
              ↑
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onMove(1)}
            disabled={index === count - 1}
            style={styles.iconButton}
          >
            <Text
              style={[
                styles.iconText,
                index === count - 1 && styles.iconDisabled,
              ]}
            >
              ↓
            </Text>
          </Pressable>
          <Pressable onPress={onRemove} style={styles.iconButton}>
            <Text style={[styles.iconText, styles.removeText]}>✕</Text>
          </Pressable>
        </View>
      </View>

      {entry.sets.map((set, setIndex) => (
        <WorkoutSetRow
          key={set.setId}
          set={set}
          setNumber={setIndex + 1}
          weightUnit={weightUnit}
          onCommit={(patch) => onCommitSet(set.setId, patch)}
          onCycleType={() => onCycleType(set.setId, set.type)}
          onToggleComplete={() => onToggleComplete(set.setId, set.completed)}
          onDelete={() => onDeleteSet(set.setId)}
        />
      ))}

      <Pressable style={styles.addSetButton} onPress={onAddSet}>
        <Text style={styles.addSetText}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f6',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  workoutName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconText: {
    fontSize: 16,
  },
  iconDisabled: {
    opacity: 0.3,
  },
  removeText: {
    color: '#b00020',
  },
  addSetButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  addSetText: {
    color: '#2f95dc',
    fontWeight: '600',
  },
  addExerciseButton: {
    borderWidth: 1,
    borderColor: '#2f95dc',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addExerciseText: {
    color: '#2f95dc',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  discardButton: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  discardText: {
    color: '#b00020',
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
