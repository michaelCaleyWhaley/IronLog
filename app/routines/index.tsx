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
import { getExercise, listRoutines } from '@/src/domain/selectors';
import type { AppData, Routine } from '@/src/domain/types';
import { useAppData } from '@/src/state/AppDataContext';

export default function RoutineListScreen() {
  const { status, data } = useAppData();
  const [search, setSearch] = useState('');

  const routines = useMemo(() => {
    if (!data) {
      return [];
    }
    const query = search.trim().toLowerCase();
    return listRoutines(data)
      .filter((routine) => !query || routine.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search]);

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
        <Text>Could not load routine data.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Routines</Text>
        <Link href="/routines/new" asChild>
          <Pressable style={styles.newButton}>
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </Link>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search routines"
        placeholderTextColor="#888"
      />

      <FlatList
        data={routines}
        keyExtractor={(item) => item.routineId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No routines yet.</Text>}
        renderItem={({ item }) => <RoutineRow routine={item} data={data} />}
      />
    </View>
  );
}

function RoutineRow({ routine, data }: { routine: Routine; data: AppData }) {
  const preview = routine.exercises
    .slice(0, 3)
    .map((entry) => {
      const exercise = getExercise(data, entry.exerciseId);
      return exercise?.name ?? 'Unavailable exercise';
    })
    .join(', ');

  return (
    <Link href={`/routines/${routine.routineId}`} asChild>
      <Pressable style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{routine.name}</Text>
          <Text style={styles.meta}>
            {routine.exercises.length} exercise
            {routine.exercises.length === 1 ? '' : 's'}
            {preview ? ` · ${preview}` : ''}
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
