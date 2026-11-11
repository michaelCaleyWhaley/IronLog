import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { Chips } from '@/src/components/Chips';
import { LIMITS } from '@/src/domain/limits';
import type { PreferencesPatch } from '@/src/domain/preferences';
import { formatRemaining } from '@/src/domain/restTimer';
import { userStats } from '@/src/domain/stats';
import type { WeightUnit } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

const DURATION_STEP_SECONDS = 15;

export default function ProfileScreen() {
  const { status, data, mutate } = useAppData();
  const [busy, setBusy] = useState(false);

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
        <Text>Could not load profile data.</Text>
      </View>
    );
  }

  const prefs = data.preferences;

  const runUpdate = async (patch: PreferencesPatch) => {
    setBusy(true);
    try {
      await mutate((repo) => repo.updatePreferences(patch));
    } catch (error) {
      Alert.alert('Could not save preference', String(error));
    } finally {
      setBusy(false);
    }
  };

  const clampDuration = (seconds: number) =>
    Math.min(
      Math.max(seconds, LIMITS.minRestDurationSeconds),
      LIMITS.maxRestDurationSeconds,
    );

  const stats = userStats(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.section}>Statistics</Text>
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
          <Text style={styles.statLabel}>Total workouts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.currentStreakDays}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {stats.lastWorkoutLocalDate ?? '—'}
          </Text>
          <Text style={styles.statLabel}>Last workout</Text>
        </View>
      </View>

      <Text style={styles.section}>Units</Text>
      <Chips
        options={[
          { value: 'kg', label: 'Kilograms (kg)' },
          { value: 'lb', label: 'Pounds (lb)' },
        ]}
        selected={prefs.weightUnit}
        onSelect={(value) =>
          void runUpdate({ weightUnit: value as WeightUnit })
        }
      />

      <Text style={styles.section}>Rest timer</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auto-start after completing a set</Text>
        <Switch
          value={prefs.autoStartRestTimer}
          onValueChange={(value) =>
            void runUpdate({ autoStartRestTimer: value })
          }
          disabled={busy}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Default rest duration</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            disabled={busy}
            onPress={() =>
              void runUpdate({
                defaultRestDuration: clampDuration(
                  prefs.defaultRestDuration - DURATION_STEP_SECONDS,
                ),
              })
            }
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.durationValue}>
            {formatRemaining(prefs.defaultRestDuration * 1000)}
          </Text>
          <Pressable
            style={styles.stepButton}
            disabled={busy}
            onPress={() =>
              void runUpdate({
                defaultRestDuration: clampDuration(
                  prefs.defaultRestDuration + DURATION_STEP_SECONDS,
                ),
              })
            }
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>Data</Text>
      <Text style={styles.comingSoon}>
        Export, import and statistics are on the way.
      </Text>
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
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 18,
    fontWeight: '700',
  },
  durationValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  comingSoon: {
    color: '#666',
    marginTop: 8,
  },
});
