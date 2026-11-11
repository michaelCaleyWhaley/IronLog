import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';

interface StepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
}

/** Compact - value + control used for target sets/reps. */
export function Stepper({
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: StepperProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, value <= min && styles.disabled]}
        onPress={onDecrement}
        disabled={value <= min}
      >
        <Text style={styles.buttonText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={[styles.button, value >= max && styles.disabled]}
        onPress={onIncrement}
        disabled={value >= max}
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
});
