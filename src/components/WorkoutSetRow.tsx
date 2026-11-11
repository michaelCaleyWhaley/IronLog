import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { setTypeLabel } from '@/src/domain/labels';
import type { SetType, WeightUnit, WorkoutSet } from '@/src/domain/types';
import { kgToUnit, unitToKg } from '@/src/domain/weight';
import type { WorkoutSetPatch } from '@/src/domain/workouts';

interface WorkoutSetRowProps {
  set: WorkoutSet;
  setNumber: number;
  weightUnit: WeightUnit;
  onCommit: (patch: WorkoutSetPatch) => void;
  onCycleType: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

const TYPE_COLORS: Partial<Record<SetType, string>> = {
  warmup: '#b26a00',
  drop: '#6a4fd0',
  failure: '#b00020',
};

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function WorkoutSetRow({
  set,
  setNumber,
  weightUnit,
  onCommit,
  onCycleType,
  onToggleComplete,
  onDelete,
}: WorkoutSetRowProps) {
  const [repsText, setRepsText] = useState(
    set.reps !== undefined ? String(set.reps) : '',
  );
  const [weightText, setWeightText] = useState(
    set.weightKg !== undefined
      ? String(Math.round(kgToUnit(set.weightKg, weightUnit) * 10) / 10)
      : '',
  );
  const [rpeText, setRpeText] = useState(
    set.rpe !== undefined ? String(set.rpe) : '',
  );
  const [notesText, setNotesText] = useState(set.notes ?? '');

  // Re-sync fields when the committed values change externally (e.g. app
  // restart). Comparing a signature avoids wiping in-progress typing when an
  // unrelated mutation reloads the document.
  const signature = `${set.reps}|${set.weightKg}|${set.rpe}|${set.notes}`;
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setRepsText(set.reps !== undefined ? String(set.reps) : '');
    setWeightText(
      set.weightKg !== undefined
        ? String(Math.round(kgToUnit(set.weightKg, weightUnit) * 10) / 10)
        : '',
    );
    setRpeText(set.rpe !== undefined ? String(set.rpe) : '');
    setNotesText(set.notes ?? '');
  }

  const commit = (
    field: 'reps' | 'weightKg' | 'rpe' | 'notes',
    raw: string,
    convert?: (value: number) => number,
  ) => {
    const trimmed = raw.trim();
    if (field === 'notes') {
      onCommit({ notes: trimmed === '' ? null : trimmed });
      return;
    }
    if (trimmed === '') {
      onCommit({ [field]: null });
      return;
    }
    const parsed = parseNumber(trimmed);
    if (Number.isNaN(parsed)) {
      Alert.alert('Invalid value', 'Please enter a number.');
      return;
    }
    let value = parsed as number;
    if (convert) {
      value = convert(value);
    }
    if (field === 'reps') {
      value = Math.round(value);
    }
    if (field === 'rpe') {
      value = Math.round(value * 2) / 2;
    }
    if (field === 'weightKg') {
      value = Math.round(value * 100) / 100;
    }
    onCommit({ [field]: value } as WorkoutSetPatch);
  };

  const typeColor = TYPE_COLORS[set.type];

  return (
    <View style={[styles.card, set.completed && styles.cardCompleted]}>
      <View style={styles.headerRow}>
        <Text style={styles.setNumber}>{setNumber}</Text>
        <Pressable onPress={onCycleType} style={styles.typeChip}>
          <Text
            style={[styles.typeText, typeColor ? { color: typeColor } : null]}
          >
            {setTypeLabel(set.type)}
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={onToggleComplete} style={styles.doneButton}>
            <Text style={[styles.doneText, set.completed && styles.doneActive]}>
              {set.completed ? '✓' : '○'}
            </Text>
          </Pressable>
          <Pressable onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>✕</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.inputsRow}>
        <LabeledInput
          label="Reps"
          value={repsText}
          onChangeText={setRepsText}
          onCommit={() => commit('reps', repsText)}
          keyboardType="number-pad"
          width={64}
        />
        <LabeledInput
          label={weightUnit === 'lb' ? 'Weight (lb)' : 'Weight (kg)'}
          value={weightText}
          onChangeText={setWeightText}
          onCommit={() =>
            commit('weightKg', weightText, (v) => unitToKg(v, weightUnit))
          }
          keyboardType="decimal-pad"
          width={72}
        />
        <LabeledInput
          label="RPE"
          value={rpeText}
          onChangeText={setRpeText}
          onCommit={() => commit('rpe', rpeText)}
          keyboardType="decimal-pad"
          width={56}
        />
        <LabeledInput
          label="Notes"
          value={notesText}
          onChangeText={setNotesText}
          onCommit={() => commit('notes', notesText)}
          width={0}
          flex
        />
      </View>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  onCommit,
  keyboardType = 'default',
  width = 0,
  flex = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onCommit: () => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  width?: number;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && styles.fieldFlex]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          width ? { width } : null,
          flex && styles.inputFlex,
        ]}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onCommit}
        onBlur={onCommit}
        onSubmitEditing={onCommit}
        keyboardType={keyboardType}
        placeholder="—"
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  cardCompleted: {
    borderColor: '#9ccc9c',
    backgroundColor: '#f4fbf4',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumber: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 12,
  },
  doneButton: {
    paddingHorizontal: 4,
  },
  doneText: {
    fontSize: 18,
    color: '#999',
  },
  doneActive: {
    color: '#2e7d32',
  },
  deleteButton: {
    paddingHorizontal: 4,
  },
  deleteText: {
    fontSize: 14,
    color: '#b00020',
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  field: {
    gap: 2,
  },
  fieldFlex: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'center',
  },
  inputFlex: {
    flex: 1,
    textAlign: 'left',
  },
});
