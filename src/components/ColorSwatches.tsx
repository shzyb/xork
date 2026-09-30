import { Pressable, StyleSheet, View } from 'react-native';
import { sheet } from '../theme';

export function ColorSwatches({ colors, selected, onSelect }: {
  colors: string[];
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <View style={styles.row}>
      {colors.map((color) => (
        <Pressable
          key={color}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${color}`}
          accessibilityState={{ selected: color === selected }}
          onPress={() => onSelect(color)}
          style={[styles.swatch, { backgroundColor: color }, color === selected && styles.selected]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: sheet.bg },
  selected: { borderColor: sheet.ink },
});
