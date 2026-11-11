import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { Chips } from '@/src/components/Chips';
import { equipmentLabel, muscleGroupLabel } from '@/src/domain/labels';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from '@/src/domain/types';
import type { Equipment, MuscleGroup } from '@/src/domain/types';

export interface ExerciseFormValues {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
}

interface ExerciseFormProps {
  initial: ExerciseFormValues;
  submitLabel: string;
  onSubmit: (values: ExerciseFormValues) => void | Promise<void>;
}

const MUSCLE_OPTIONS = MUSCLE_GROUPS.map((value) => ({
  value,
  label: muscleGroupLabel(value),
}));

const EQUIPMENT_OPTIONS = EQUIPMENT_TYPES.map((value) => ({
  value,
  label: equipmentLabel(value),
}));

export function ExerciseForm({
  initial,
  submitLabel,
  onSubmit,
}: ExerciseFormProps) {
  const [name, setName] = useState(initial.name);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(
    initial.muscleGroup,
  );
  const [equipment, setEquipment] = useState<Equipment>(initial.equipment);
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        muscleGroup,
        equipment,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Incline Dumbbell Press"
        placeholderTextColor="#888"
        maxLength={100}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Muscle group</Text>
      <Chips
        options={MUSCLE_OPTIONS}
        selected={muscleGroup}
        onSelect={(value) => setMuscleGroup(value as MuscleGroup)}
      />

      <Text style={styles.label}>Equipment</Text>
      <Chips
        options={EQUIPMENT_OPTIONS}
        selected={equipment}
        onSelect={(value) => setEquipment(value as Equipment)}
      />

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
