import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ExerciseForm } from '@/src/components/ExerciseForm';
import { useAppData } from '@/src/state/AppDataContext';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '@/src/domain/types';
import type { Equipment, MuscleGroup } from '@/src/domain/types';

export default function NewExerciseScreen() {
  const { mutate } = useAppData();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ExerciseForm
        initial={{
          name: '',
          muscleGroup: MUSCLE_GROUPS[0] as MuscleGroup,
          equipment: EQUIPMENT_TYPES[0] as Equipment,
        }}
        submitLabel="Create exercise"
        onSubmit={async (values) => {
          await mutate((repo) => repo.createExercise(values));
          router.back();
        }}
      />
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
});
