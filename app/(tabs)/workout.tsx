import { Link, router } from 'expo-router';
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
import { ActiveWorkoutExistsError } from '@/src/domain/errors';
import { getActiveWorkout, listRoutines } from '@/src/domain/selectors';
import type { Routine } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

export default function WorkoutScreen() {
  const { status, data, mutate } = useAppData();
  const [starting, setStarting] = useState(false);

  const activeWorkout = useMemo(
    () => (data ? getActiveWorkout(data) : undefined),
    [data],
  );
  const routines = useMemo(
    () =>
      data
        ? listRoutines(data).sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [data],
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
        <Text>Could not load workout data.</Text>
      </View>
    );
  }

  const startBlank = async () => {
    setStarting(true);
    try {
      await mutate((repo) => repo.startBlankWorkout());
      router.push('/workout/active');
    } catch (error) {
      Alert.alert('Could not start workout', String(error));
    } finally {
      setStarting(false);
    }
  };

  const startFromRoutine = async (routine: Routine) => {
    setStarting(true);
    try {
      await mutate((repo) => repo.startWorkoutFromRoutine(routine.routineId));
      router.push('/workout/active');
    } catch (error) {
      if (error instanceof ActiveWorkoutExistsError) {
        router.push('/workout/active');
      } else {
        Alert.alert('Could not start workout', String(error));
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout</Text>

      {activeWorkout ? (
        <Pressable
          style={styles.activeCard}
          onPress={() => router.push('/workout/active')}
        >
          <View style={styles.activeDot} />
          <View style={styles.activeText}>
            <Text style={styles.activeTitle}>Workout in progress</Text>
            <Text style={styles.activeSubtitle}>
              {activeWorkout.name} · {activeWorkout.exercises.length} exercise
              {activeWorkout.exercises.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={styles.resume}>Resume ›</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.primaryButton, starting && styles.disabled]}
          onPress={startBlank}
          disabled={starting}
        >
          <Text style={styles.primaryButtonText}>Start blank workout</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Routines</Text>
      {routines.length === 0 ? (
        <Text style={styles.empty}>
          No routines yet.{' '}
          <Link href="/routines" style={styles.inlineLink}>
            Create one
          </Link>
          .
        </Text>
      ) : (
        routines.map((routine) => (
          <View key={routine.routineId} style={styles.routineRow}>
            <View style={styles.routineText}>
              <Text style={styles.routineName}>{routine.name}</Text>
              <Text style={styles.routineMeta}>
                {routine.exercises.length} exercise
                {routine.exercises.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Pressable
              style={[styles.startButton, starting && styles.disabled]}
              onPress={() => startFromRoutine(routine)}
              disabled={starting || !!activeWorkout}
            >
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.manageLinks}>
        <Link href="/routines" style={styles.manageLink}>
          Manage routines
        </Link>
        <Link href="/exercises" style={styles.manageLink}>
          Exercise library
        </Link>
      </View>
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
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2f95dc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e07b00',
  },
  activeText: {
    flex: 1,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  resume: {
    color: '#2f95dc',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  empty: {
    color: '#666',
    marginBottom: 16,
  },
  inlineLink: {
    color: '#2f95dc',
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  routineText: {
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    fontWeight: '600',
  },
  routineMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  manageLinks: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 24,
    justifyContent: 'center',
  },
  manageLink: {
    color: '#2f95dc',
    fontSize: 14,
  },
});
