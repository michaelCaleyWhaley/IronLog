import { Link } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { groupWorkoutsByDate } from '@/src/domain/stats';
import type { Workout } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

function formatDateHeader(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) {
    return 'Today';
  }
  if (sameDay(date, yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} min`;
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const duration = workout.completedAt
    ? Math.round(
        (new Date(workout.completedAt).getTime() -
          new Date(workout.startedAt).getTime()) /
          1000,
      )
    : 0;
  return (
    <Link href={`/history/${workout.workoutId}`} asChild>
      <Pressable style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{workout.name}</Text>
          <Text style={styles.rowMeta}>
            {workout.exercises.length} exercise
            {workout.exercises.length === 1 ? '' : 's'} · {totalSets} sets ·{' '}
            {formatDuration(duration)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

export default function HistoryScreen() {
  const { status, data } = useAppData();
  const groups = useMemo(() => (data ? groupWorkoutsByDate(data) : []), [data]);

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
        <Text>Could not load history.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>History</Text>
      {groups.length === 0 ? (
        <Text style={styles.empty}>
          No completed workouts yet. Finish a workout to see it here.
        </Text>
      ) : (
        groups.map((group) => (
          <View key={group.localDate} style={styles.group}>
            <Text style={styles.groupHeader}>
              {formatDateHeader(group.localDate)}
            </Text>
            {group.workouts.map((workout) => (
              <WorkoutRow key={workout.workoutId} workout={workout} />
            ))}
          </View>
        ))
      )}
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
    marginBottom: 16,
  },
  empty: {
    color: '#666',
    marginTop: 24,
    textAlign: 'center',
  },
  group: {
    marginBottom: 20,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: '#999',
    marginLeft: 8,
  },
});
