import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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

  const handleExport = async () => {
    setBusy(true);
    try {
      const json = await mutate(async (repo) => repo.exportJson());
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `ironlog-backup-${stamp}.json`);
      if (!file.exists) {
        file.create({ overwrite: true });
      }
      await file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export ironLog data',
        });
      } else {
        Alert.alert('Export', `Backup written to ${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];
      const text = await new File(asset.uri).text();
      await mutate((repo) => repo.importJson(text));
      Alert.alert('Import complete', 'Your data was restored.');
    } catch (error) {
      Alert.alert('Import failed', String(error));
    } finally {
      setBusy(false);
    }
  };

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
      <Pressable
        style={[styles.dataButton, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void handleExport()}
      >
        <Text style={styles.dataButtonText}>Export data (JSON)</Text>
      </Pressable>
      <Pressable
        style={[styles.dataButton, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void handleImport()}
      >
        <Text style={styles.dataButtonText}>Import data (JSON)</Text>
      </Pressable>
      <Text style={styles.versionNote}>
        ironLog {Constants.expoConfig?.version ?? ''} · data schema v
        {data.schemaVersion}
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
  dataButton: {
    borderWidth: 1,
    borderColor: '#2f95dc',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dataButtonText: {
    color: '#2f95dc',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  versionNote: {
    color: '#999',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
});
