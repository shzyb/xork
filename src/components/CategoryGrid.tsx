import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sheet } from '../theme';
import type { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';

// Four-column grid of round category icons for the black sheet.
export function CategoryGrid({ categories, selectedId, onSelect, onNew }: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <View style={styles.grid}>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === c.id }}
          onPress={() => onSelect(c.id)}
          style={styles.cell}
        >
          <View style={selectedId === c.id && styles.selected}>
            <CategoryIcon name={c.icon} color={c.color} size={48} />
          </View>
          <Text style={[styles.text, selectedId === c.id && { color: sheet.ink }]} numberOfLines={2}>
            {c.name}
          </Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="New category" onPress={onNew} style={styles.cell}>
        <View style={styles.newIcon}>
          <Plus color={sheet.ink2} size={22} />
        </View>
        <Text style={styles.text}>New</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
  selected: { padding: 3, borderRadius: 30, borderWidth: 2, borderColor: sheet.ink, margin: -5 },
  newIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  text: { color: sheet.ink2, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
