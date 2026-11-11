import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { useAppData } from '@/src/state/AppDataContext';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
