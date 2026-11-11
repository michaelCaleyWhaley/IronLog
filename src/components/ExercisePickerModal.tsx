import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { equipmentLabel, muscleGroupLabel } from '@/src/domain/labels';
import type { Exercise } from '@/src/domain/types';

interface ExercisePickerModalProps {
  visible: boolean;
  exercises: Exercise[];
  selectedIds: ReadonlySet<string>;
  onToggle: (exerciseId: string) => void;
  onClose: () => void;
}

/** Searchable multi-select exercise picker shown in a modal. */
export function ExercisePickerModal({
  visible,
  exercises,
  selectedIds,
  onToggle,
  onClose,
}: ExercisePickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
    if (!query) {
      return sorted;
    }
    return sorted.filter((exercise) =>
      exercise.name.toLowerCase().includes(query),
    );
  }, [exercises, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add exercise</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor="#888"
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.exerciseId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.exerciseId);
            return (
              <Pressable
                style={styles.row}
                onPress={() => onToggle(item.exerciseId)}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {muscleGroupLabel(item.muscleGroup)} ·{' '}
                    {equipmentLabel(item.equipment)}
                  </Text>
                </View>
                <Text style={styles.check}>{selected ? '✓' : ''}</Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  done: {
    fontSize: 16,
    color: '#2f95dc',
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
  check: {
    fontSize: 18,
    color: '#2f95dc',
    width: 24,
    textAlign: 'right',
  },
});
