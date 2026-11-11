import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useAppData } from '@/src/state/AppDataContext';

export default function NewRoutineScreen() {
  const { mutate } = useAppData();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && !busy;

  const handleCreate = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    try {
      const routine = await mutate((repo) =>
        repo.createRoutine({ name: name.trim() }),
      );
      router.replace(`/routines/${routine.routineId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Routine name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Push Day"
        placeholderTextColor="#888"
        maxLength={100}
        autoFocus
      />
      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={!canSubmit}
      >
        <Text style={styles.buttonText}>Create routine</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
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
