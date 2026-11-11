import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipsProps {
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
}

/** Horizontally scrollable selectable chips. */
export function Chips({ options, selected, onSelect }: ChipsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              {
                borderColor: isSelected ? colors.tint : colors.tabIconDefault,
                backgroundColor: isSelected ? colors.tint : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: isSelected ? colors.background : colors.text,
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
