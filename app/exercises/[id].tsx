import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { ExerciseForm } from '@/src/components/ExerciseForm';
import { equipmentLabel, muscleGroupLabel } from '@/src/domain/labels';
import { getExercise } from '@/src/domain/selectors';
import { exerciseHistory, personalRecords } from '@/src/domain/stats';
import { kgToUnit } from '@/src/domain/weight';
import { useAppData } from '@/src/state/AppDataContext';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data, mutate } = useAppData();
  const [busy, setBusy] = useState(false);
  const exerciseId = id ?? '';

  const records = useMemo(
    () => (data ? personalRecords(data, exerciseId) : {}),
    [data, exerciseId],
  );
  const history = useMemo(
    () => (data ? exerciseHistory(data, exerciseId).slice(0, 10) : []),
    [data, exerciseId],
  );

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
        <Text>Could not load exercise data.</Text>
      </View>
    );
  }

  const exercise = id ? getExercise(data, id) : undefined;
  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text>Exercise not found.</Text>
      </View>
    );
  }

  const isEditable = exercise.isCustom && !exercise.deletedAt;

  const unit = data.preferences.weightUnit;

  const handleDelete = () => {
    Alert.alert(
      'Delete exercise',
      `Soft-delete "${exercise.name}"? It will be hidden from pickers but kept for history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await mutate((repo) => repo.deleteExercise(exercise.exerciseId));
              router.back();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {exercise.deletedAt ? (
        <Text style={styles.deletedNote}>
          This exercise was deleted and is kept only for history.
        </Text>
      ) : null}
      {!exercise.isCustom ? (
        <Text style={styles.builtInNote}>
          Built-in exercises are read-only.
        </Text>
      ) : null}

      {isEditable ? (
        <ExerciseForm
          key={exercise.exerciseId}
          initial={{
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            equipment: exercise.equipment,
          }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await mutate((repo) =>
              repo.updateExercise(exercise.exerciseId, values),
            );
            router.back();
          }}
        />
      ) : (
        <View style={styles.readOnly}>
          <Text style={styles.name}>{exercise.name}</Text>
          <Text style={styles.meta}>
            {muscleGroupLabel(exercise.muscleGroup)} ·{' '}
            {equipmentLabel(exercise.equipment)}
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Personal records</Text>
      {records.heaviestWeight ||
      records.bestEstimated1RM ||
      records.mostRepsBodyweight ? (
        <View style={styles.recordsCard}>
          {records.heaviestWeight ? (
            <Text style={styles.recordLine}>
              Heaviest: {kgToUnit(records.heaviestWeight.weightKg ?? 0, unit)}{' '}
              {unit} × {records.heaviestWeight.reps} reps
            </Text>
          ) : null}
          {records.bestEstimated1RM ? (
            <Text style={styles.recordLine}>
              Est. 1RM:{' '}
              {Math.round(kgToUnit(records.bestEstimated1RM.value, unit) * 10) /
                10}{' '}
              {unit}
            </Text>
          ) : null}
          {records.mostRepsBodyweight ? (
            <Text style={styles.recordLine}>
              Most reps (bodyweight): {records.mostRepsBodyweight.reps} reps
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyNote}>No logged sets yet.</Text>
      )}

      <Text style={styles.sectionTitle}>Recent workouts</Text>
      {history.length === 0 ? (
        <Text style={styles.emptyNote}>Not performed yet.</Text>
      ) : (
        history.map((workout) => (
          <Link
            key={workout.workoutId}
            href={`/history/${workout.workoutId}`}
            asChild
          >
            <Pressable style={styles.historyRow}>
              <Text style={styles.historyName}>{workout.name}</Text>
              <Text style={styles.historyDate}>
                {workout.completedLocalDate}
              </Text>
            </Pressable>
          </Link>
        ))
      )}

      {isEditable && !exercise.deletedAt ? (
        <Pressable
          style={[styles.deleteButton, busy && styles.disabled]}
          onPress={handleDelete}
          disabled={busy}
        >
          <Text style={styles.deleteButtonText}>Delete exercise</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builtInNote: {
    color: '#666',
    marginBottom: 12,
  },
  deletedNote: {
    color: '#b00020',
    marginBottom: 12,
    fontWeight: '600',
  },
  readOnly: {
    gap: 4,
    marginTop: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  meta: {
    color: '#666',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  recordsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    gap: 4,
  },
  recordLine: {
    fontSize: 14,
  },
  emptyNote: {
    color: '#666',
    fontSize: 14,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    marginBottom: 8,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  historyDate: {
    fontSize: 12,
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
  disabled: {
    opacity: 0.5,
  },
});
