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
import { LIMITS } from '@/src/domain/limits';
import type { RoutineExerciseInput } from '@/src/domain/routines';
import {
  getExercise,
  listExercises,
  listRoutines,
} from '@/src/domain/selectors';
import type {
  AppData,
  RoutineExercise,
  RoutineSetTarget,
  WeightUnit,
} from '@/src/domain/types';
import { kgToUnit, unitToKg } from '@/src/domain/weight';
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
      sets: entry.sets.map((set) => ({ ...set })),
    }));

  const saveExercises = async (inputs: RoutineExerciseInput[]) => {
    await mutate((repo) =>
      repo.updateRoutine(routine.routineId, { exercises: inputs }),
    );
  };

  const updateEntrySets = async (index: number, sets: RoutineSetTarget[]) => {
    const inputs = toInputs(routine.exercises);
    inputs[index] = { ...inputs[index], sets };
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
        sets: Array.from({ length: DEFAULT_TARGET_SETS }, () => ({
          reps: DEFAULT_TARGET_REPS,
        })),
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
            onChangeSets={updateEntrySets}
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

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function SetTargetRow({
  target,
  setNumber,
  weightUnit,
  onChange,
  onRemove,
}: {
  target: RoutineSetTarget;
  setNumber: number;
  weightUnit: WeightUnit;
  onChange: (patch: RoutineSetTarget) => void;
  onRemove?: () => void;
}) {
  const [repsText, setRepsText] = useState(
    target.reps !== undefined ? String(target.reps) : '',
  );
  const [weightText, setWeightText] = useState(
    target.weightKg !== undefined
      ? String(Math.round(kgToUnit(target.weightKg, weightUnit) * 10) / 10)
      : '',
  );

  // Re-sync when the committed values change externally. Comparing a
  // signature avoids wiping in-progress typing on unrelated reloads.
  const signature = `${target.reps}|${target.weightKg}`;
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setRepsText(target.reps !== undefined ? String(target.reps) : '');
    setWeightText(
      target.weightKg !== undefined
        ? String(Math.round(kgToUnit(target.weightKg, weightUnit) * 10) / 10)
        : '',
    );
  }

  const commitReps = () => {
    const parsed = parseNumber(repsText);
    if (parsed === null) {
      onChange({ reps: undefined });
      return;
    }
    if (Number.isNaN(parsed)) {
      Alert.alert('Invalid value', 'Please enter a number.');
      return;
    }
    onChange({
      reps: clamp(Math.round(parsed), LIMITS.minReps, LIMITS.maxReps),
    });
  };

  const commitWeight = () => {
    const parsed = parseNumber(weightText);
    if (parsed === null) {
      onChange({ weightKg: undefined });
      return;
    }
    if (Number.isNaN(parsed)) {
      Alert.alert('Invalid value', 'Please enter a number.');
      return;
    }
    const kg = unitToKg(parsed, weightUnit);
    onChange({
      weightKg: clamp(
        Math.round(kg * 100) / 100,
        LIMITS.minWeightKg,
        LIMITS.maxWeightKg,
      ),
    });
  };

  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>Set {setNumber}</Text>
      <View style={styles.setFields}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Reps</Text>
          <TextInput
            style={[styles.setInput, styles.repsInput]}
            value={repsText}
            onChangeText={setRepsText}
            onEndEditing={commitReps}
            onBlur={commitReps}
            onSubmitEditing={commitReps}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#bbb"
            accessibilityLabel={`Set ${setNumber} target reps`}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            {weightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)'}
          </Text>
          <TextInput
            style={[styles.setInput, styles.weightInput]}
            value={weightText}
            onChangeText={setWeightText}
            onEndEditing={commitWeight}
            onBlur={commitWeight}
            onSubmitEditing={commitWeight}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor="#bbb"
            accessibilityLabel={`Set ${setNumber} target weight`}
          />
        </View>
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setNumber}`}
        >
          <Text style={[styles.iconText, styles.removeText]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RoutineExerciseRow({
  entry,
  index,
  count,
  data,
  onMove,
  onRemove,
  onChangeSets,
}: {
  entry: RoutineExercise;
  index: number;
  count: number;
  data: AppData;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onChangeSets: (index: number, sets: RoutineSetTarget[]) => void;
}) {
  const exercise = getExercise(data, entry.exerciseId);
  const name = exercise?.name ?? 'Unavailable exercise';
  const weightUnit = data.preferences.weightUnit;

  const updateSet = (setIndex: number, patch: RoutineSetTarget) => {
    const sets = entry.sets.map((set, i) =>
      i === setIndex ? { ...set, ...patch } : set,
    );
    onChangeSets(index, sets);
  };

  const removeSet = (setIndex: number) => {
    onChangeSets(
      index,
      entry.sets.filter((_, i) => i !== setIndex),
    );
  };

  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChangeSets(index, [...entry.sets, last ? { ...last } : {}]);
  };

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
      {entry.sets.map((set, setIndex) => (
        <SetTargetRow
          key={setIndex}
          target={set}
          setNumber={setIndex + 1}
          weightUnit={weightUnit}
          onChange={(patch) => updateSet(setIndex, patch)}
          onRemove={
            entry.sets.length > 1 ? () => removeSet(setIndex) : undefined
          }
        />
      ))}
      <Pressable
        onPress={addSet}
        disabled={entry.sets.length >= LIMITS.maxSetsPerExercise}
        style={styles.addSetButton}
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${name}`}
      >
        <Text
          style={[
            styles.addSetText,
            entry.sets.length >= LIMITS.maxSetsPerExercise &&
              styles.iconDisabled,
          ]}
        >
          + Add set
        </Text>
      </Pressable>
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  setNumber: {
    width: 44,
    fontSize: 12,
    color: '#666',
  },
  setFields: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  field: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
  },
  setInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'center',
  },
  repsInput: {
    width: 64,
  },
  weightInput: {
    width: 76,
  },
  addSetButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  addSetText: {
    color: '#2f95dc',
    fontWeight: '600',
    fontSize: 13,
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
