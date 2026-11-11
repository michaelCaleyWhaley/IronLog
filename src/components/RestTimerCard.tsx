import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { isTimerActive } from '@/src/domain/restTimer';
import { useRestTimer } from '@/src/state/restTimerStore';

const ADJUST_STEP_SECONDS = 15;

/** Compact rest-timer controls shown on the active workout screen. */
export function RestTimerCard() {
  const timer = useRestTimer();
  const { status, durationSeconds } = timer.state;
  const active = isTimerActive(timer.state);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>Rest timer</Text>
        <Text
          style={[
            styles.display,
            status === 'finished' && styles.displayFinished,
          ]}
        >
          {status === 'finished' ? 'Rest over!' : timer.display}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          style={styles.button}
          onPress={() => timer.adjustDuration(-ADJUST_STEP_SECONDS)}
          accessibilityLabel="Decrease rest duration"
        >
          <Text style={styles.buttonText}>−{ADJUST_STEP_SECONDS}s</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() => timer.adjustDuration(ADJUST_STEP_SECONDS)}
          accessibilityLabel="Increase rest duration"
        >
          <Text style={styles.buttonText}>+{ADJUST_STEP_SECONDS}s</Text>
        </Pressable>
        {status === 'running' ? (
          <Pressable style={styles.button} onPress={timer.pause}>
            <Text style={styles.buttonText}>Pause</Text>
          </Pressable>
        ) : status === 'paused' ? (
          <Pressable style={styles.button} onPress={timer.resume}>
            <Text style={styles.buttonText}>Resume</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => timer.start(durationSeconds)}
          >
            <Text style={styles.primaryText}>Start</Text>
          </Pressable>
        )}
        {active || status === 'finished' ? (
          <Pressable style={styles.button} onPress={timer.reset}>
            <Text style={styles.buttonText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  display: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  displayFinished: {
    color: '#b00020',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: '#2f95dc',
    borderColor: '#2f95dc',
  },
  primaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
