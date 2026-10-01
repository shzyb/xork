import { ScrollView, StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { sheet } from '../theme';
import { Text } from './Text';

// A "From" / "To" row of account chips for the black sheet.
export function AccountChips({ label, accounts, selectedId, onSelect }: {
  label: string;
  accounts: { id: number; name: string; color: string }[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {accounts.map((a) => (
          <PressableScale
            key={a.id}
            accessibilityRole="button"
            accessibilityState={{ selected: a.id === selectedId }}
            onPress={() => onSelect(a.id)}
            style={[styles.chip, { backgroundColor: a.id === selectedId ? sheet.card2 : sheet.card }]}
          >
            <View style={[styles.dot, { backgroundColor: a.color }]}>
              <Text style={styles.initial}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={[styles.name, a.id !== selectedId && { color: sheet.ink2 }]} numberOfLines={1}>{a.name}</Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: sheet.card, borderRadius: 16, marginTop: 10, paddingLeft: 14, minHeight: 54 },
  label: { color: sheet.ink2, fontSize: 15, minWidth: 44 },
  chips: { gap: 6, paddingVertical: 6, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingLeft: 4, paddingRight: 12, borderRadius: 21 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  name: { color: sheet.ink, fontSize: 15, fontWeight: '600', maxWidth: 140 },
});
