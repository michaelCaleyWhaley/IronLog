import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { Chips } from '@/src/components/Chips';
import { equipmentLabel, muscleGroupLabel } from '@/src/domain/labels';
import { listExercises } from '@/src/domain/selectors';
import type { Exercise } from '@/src/domain/types';
import { MUSCLE_GROUPS } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

const MUSCLE_FILTERS = [
  { value: 'all', label: 'All' },
  ...MUSCLE_GROUPS.map((value) => ({
    value,
    label: muscleGroupLabel(value),
  })),
];

export default function ExerciseLibraryScreen() {
  const { status, data } = useAppData();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('all');

  const exercises = useMemo(() => {
    if (!data) {
      return [];
    }
    const query = search.trim().toLowerCase();
    return listExercises(data)
      .filter(
        (exercise) =>
          muscleFilter === 'all' || exercise.muscleGroup === muscleFilter,
      )
      .filter(
        (exercise) => !query || exercise.name.toLowerCase().includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, muscleFilter]);

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

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Exercises</Text>
        <Link href="/exercises/new" asChild>
          <Pressable style={styles.newButton}>
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </Link>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercises"
        placeholderTextColor="#888"
      />

      <Chips
        options={MUSCLE_FILTERS}
        selected={muscleFilter}
        onSelect={setMuscleFilter}
      />

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.exerciseId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises match your search.</Text>
        }
        renderItem={({ item }) => <ExerciseRow exercise={item} />}
      />
    </View>
  );
}

function ExerciseRow({ exercise }: { exercise: Exercise }) {
  return (
    <Link href={`/exercises/${exercise.exerciseId}`} asChild>
      <Pressable style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{exercise.name}</Text>
          <Text style={styles.meta}>
            {muscleGroupLabel(exercise.muscleGroup)} ·{' '}
            {equipmentLabel(exercise.equipment)}
            {exercise.isCustom ? ' · Custom' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  newButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  list: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#999',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
});
