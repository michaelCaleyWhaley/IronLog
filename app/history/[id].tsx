import { router, useLocalSearchParams } from 'expo-router';
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
import { setTypeLabel } from '@/src/domain/labels';
import type { WorkoutSet } from '@/src/domain/types';
import { kgToUnit } from '@/src/domain/weight';
import { useAppData } from '@/src/state/AppDataContext';

function formatDateTime(iso: string | undefined): string {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSetLine(set: WorkoutSet, unit: 'kg' | 'lb'): string {
  const parts: string[] = [];
  if (set.type !== 'normal') {
    parts.push(setTypeLabel(set.type));
  }
  if (set.reps !== undefined) {
    parts.push(`${set.reps} reps`);
  }
  if (set.weightKg !== undefined) {
    const value = kgToUnit(set.weightKg, unit);
    parts.push(`${Math.round(value * 10) / 10} ${unit}`);
  }
  if (set.rpe !== undefined) {
    parts.push(`RPE ${set.rpe}`);
  }
  if (set.notes) {
    parts.push(set.notes);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data, mutate } = useAppData();
  const [deleting, setDeleting] = useState(false);

  const workout = useMemo(
    () => data?.workouts.find((w) => w.workoutId === id),
    [data, id],
  );

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'error' || !data || !workout) {
    return (
      <View style={styles.center}>
        <Text>Workout not found.</Text>
      </View>
    );
  }

  const unit = data.preferences.weightUnit;
  const routine = workout.routineId
    ? data.routines.find((r) => r.routineId === workout.routineId)
    : undefined;
  const durationSeconds = workout.completedAt
    ? Math.max(
        0,
        Math.round(
          (new Date(workout.completedAt).getTime() -
            new Date(workout.startedAt).getTime()) /
            1000,
        ),
      )
    : 0;
  const minutes = Math.floor(durationSeconds / 60);

  const handleDelete = () => {
    Alert.alert(
      'Delete workout',
      `Permanently delete "${workout.name}"? This removes it from history and statistics.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void mutate((repo) => repo.deleteWorkout(workout.workoutId))
              .then(() => router.back())
              .catch((error) =>
                Alert.alert('Could not delete workout', String(error)),
              )
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{workout.name}</Text>
      <Text style={styles.meta}>
        {formatDateTime(workout.completedAt ?? workout.startedAt)} · {minutes}{' '}
        min · {workout.status}
      </Text>
      {routine ? (
        <Text style={styles.meta}>Routine: {routine.name}</Text>
      ) : null}

      {workout.exercises.map((entry, index) => (
        <View key={entry.exerciseId} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>
            {index + 1}. {entry.name}
          </Text>
          {entry.sets.map((set, setIndex) => (
            <View key={set.setId} style={styles.setRow}>
              <Text style={styles.setNumber}>{setIndex + 1}</Text>
              <Text
                style={[
                  styles.setText,
                  set.completed ? styles.setDone : styles.setPending,
                ]}
              >
                {formatSetLine(set, unit)}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {workout.status === 'completed' ? (
        <Pressable
          style={[styles.deleteButton, deleting && styles.disabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          <Text style={styles.deleteText}>Delete workout</Text>
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
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    marginTop: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  setNumber: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  setText: {
    flex: 1,
    fontSize: 14,
  },
  setDone: {
    color: '#222',
  },
  setPending: {
    color: '#999',
  },
  deleteButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#b00020',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
