import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function WorkoutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout</Text>
      <Text>Workout logging coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
