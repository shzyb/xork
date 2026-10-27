import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { FadeScrollView } from './FadeScrollView';
import { PressableScale } from './PressableScale';
import { sheet, spacing } from '../theme';
import type { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Text } from './Text';

// Round category icons in one row that scrolls sideways.
// Cells are 1/4.5 of the width so the next one peeks in and shows that the list scrolls.
export function CategoryGrid({ categories, selectedId, onSelect }: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const cellWidth = (useWindowDimensions().width - spacing.xl * 2) / 4.5;
  const scroll = useRef<ScrollViewInstance>(null);
  const jumped = useRef(false);

  // On first layout, scroll so an already selected category (when editing) is in view.
  function jumpToSelected() {
    if (jumped.current) return;
    jumped.current = true;
    const index = categories.findIndex((c) => c.id === selectedId);
    if (index > 2) scroll.current?.scrollTo({ x: (index - 2) * cellWidth, animated: false });
  }

  return (
    <View style={styles.row}>
      <FadeScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={jumpToSelected} keyboardShouldPersistTaps="handled">
        {categories.map((c) => (
          <PressableScale
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === c.id }}
            onPress={() => onSelect(c.id)}
            style={[styles.cell, { width: cellWidth }]}
          >
            <View style={selectedId === c.id && styles.selected}>
              <CategoryIcon name={c.icon} color={c.color} size={48} />
            </View>
            <Text style={[styles.text, selectedId === c.id && { color: sheet.ink }]} numberOfLines={1}>
              {c.name}
            </Text>
          </PressableScale>
        ))}
      </FadeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
  selected: { padding: 3, borderRadius: 30, borderWidth: 2, borderColor: sheet.ink, margin: -5 },
  text: { color: sheet.ink2, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
