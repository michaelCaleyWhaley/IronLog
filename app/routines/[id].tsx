import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { ExercisePickerModal } from '@/src/components/ExercisePickerModal';
import { Stepper } from '@/src/components/Stepper';
import { LIMITS } from '@/src/domain/limits';
import type { RoutineExerciseInput } from '@/src/domain/routines';
import {
  getExercise,
  listExercises,
  listRoutines,
} from '@/src/domain/selectors';
import type { AppData, RoutineExercise } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 10;

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data, mutate } = useAppData();
  const [showPicker, setShowPicker] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);

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
        <Text>Could not load routine data.</Text>
      </View>
    );
  }

  const routine = id
    ? listRoutines(data).find((r) => r.routineId === id)
    : undefined;
  if (!routine) {
    return (
      <View style={styles.center}>
        <Text>Routine not found.</Text>
      </View>
    );
  }

  const toInputs = (entries: RoutineExercise[]): RoutineExerciseInput[] =>
    entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      targetSets: entry.targetSets,
      targetReps: entry.targetReps,
    }));

  const saveExercises = async (inputs: RoutineExerciseInput[]) => {
    await mutate((repo) =>
      repo.updateRoutine(routine.routineId, { exercises: inputs }),
    );
  };

  const updateEntry = async (
    index: number,
    patch: Partial<Pick<RoutineExerciseInput, 'targetSets' | 'targetReps'>>,
  ) => {
    const inputs = toInputs(routine.exercises);
    inputs[index] = { ...inputs[index], ...patch } as RoutineExerciseInput;
    await saveExercises(inputs);
  };

  const moveEntry = async (index: number, direction: -1 | 1) => {
    const inputs = toInputs(routine.exercises);
    const target = index + direction;
    if (target < 0 || target >= inputs.length) {
      return;
    }
    [inputs[index], inputs[target]] = [inputs[target], inputs[index]];
    await saveExercises(inputs);
  };

  const removeEntry = async (index: number) => {
    const inputs = toInputs(routine.exercises);
    inputs.splice(index, 1);
    await saveExercises(inputs);
  };

  const handleToggleExercise = async (exerciseId: string) => {
    const inputs = toInputs(routine.exercises);
    const existing = inputs.findIndex((i) => i.exerciseId === exerciseId);
    if (existing >= 0) {
      inputs.splice(existing, 1);
    } else {
      inputs.push({
        exerciseId,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
      });
    }
    await saveExercises(inputs);
  };

  const saveName = async () => {
    const trimmed = (nameDraft ?? '').trim();
    setNameDraft(null);
    if (!trimmed || trimmed === routine.name) {
      return;
    }
    await mutate((repo) =>
      repo.updateRoutine(routine.routineId, { name: trimmed }),
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete routine',
      `Delete "${routine.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await mutate((repo) => repo.deleteRoutine(routine.routineId));
            router.back();
          },
        },
      ],
    );
  };

  const selectedIds = new Set(routine.exercises.map((e) => e.exerciseId));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={nameDraft ?? routine.name}
        onChangeText={setNameDraft}
        onEndEditing={saveName}
        onSubmitEditing={saveName}
        placeholder="Routine name"
        placeholderTextColor="#888"
        maxLength={LIMITS.maxNameLength}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowPicker(true)}
          disabled={
            routine.exercises.length >= LIMITS.maxExercisesPerWorkoutOrRoutine
          }
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {routine.exercises.length === 0 ? (
        <Text style={styles.empty}>No exercises yet.</Text>
      ) : (
        routine.exercises.map((entry, index) => (
          <RoutineExerciseRow
            key={entry.exerciseId}
            entry={entry}
            index={index}
            count={routine.exercises.length}
            data={data}
            onMove={moveEntry}
            onRemove={removeEntry}
            onChangeTarget={updateEntry}
          />
        ))
      )}

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete routine</Text>
      </Pressable>

      <ExercisePickerModal
        visible={showPicker}
        exercises={listExercises(data)}
        selectedIds={selectedIds}
        onToggle={(exerciseId) => {
          void handleToggleExercise(exerciseId);
        }}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}

function RoutineExerciseRow({
  entry,
  index,
  count,
  data,
  onMove,
  onRemove,
  onChangeTarget,
}: {
  entry: RoutineExercise;
  index: number;
  count: number;
  data: AppData;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onChangeTarget: (
    index: number,
    patch: Partial<Pick<RoutineExerciseInput, 'targetSets' | 'targetReps'>>,
  ) => void;
}) {
  const exercise = getExercise(data, entry.exerciseId);
  const name = exercise?.name ?? 'Unavailable exercise';

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>
          {index + 1}. {name}
        </Text>
        <View style={styles.exerciseActions}>
          <Pressable
            onPress={() => onMove(index, -1)}
            disabled={index === 0}
            style={styles.iconButton}
          >
            <Text style={[styles.iconText, index === 0 && styles.iconDisabled]}>
              ↑
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onMove(index, 1)}
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
          <Pressable onPress={() => onRemove(index)} style={styles.iconButton}>
            <Text style={[styles.iconText, styles.removeText]}>✕</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.targets}>
        <View style={styles.targetGroup}>
          <Text style={styles.targetLabel}>Sets</Text>
          <Stepper
            value={entry.targetSets}
            min={LIMITS.minTargetSets}
            max={LIMITS.maxTargetSets}
            onDecrement={() =>
              onChangeTarget(index, { targetSets: entry.targetSets - 1 })
            }
            onIncrement={() =>
              onChangeTarget(index, { targetSets: entry.targetSets + 1 })
            }
          />
        </View>
        <View style={styles.targetGroup}>
          <Text style={styles.targetLabel}>Reps</Text>
          <Stepper
            value={entry.targetReps}
            min={LIMITS.minTargetReps}
            max={LIMITS.maxTargetReps}
            onDecrement={() =>
              onChangeTarget(index, { targetReps: entry.targetReps - 1 })
            }
            onIncrement={() =>
              onChangeTarget(index, { targetReps: entry.targetReps + 1 })
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    color: '#666',
    marginVertical: 16,
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
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
  targets: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 10,
  },
  targetGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetLabel: {
    fontSize: 13,
    color: '#666',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteButtonText: {
    color: '#b00020',
    fontWeight: '600',
  },
});
