import { StyleSheet, View } from 'react-native';
import { currentMonth, lastMonths, monthName, monthShort } from '../dates';
import { useColors } from '../theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// The last six months as chips. Months before your first transaction are disabled.
export function MonthChips({ selected, earliest, onSelect }: {
  selected: string;
  earliest: string | null;
  onSelect: (month: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {lastMonths(currentMonth(), 6).map((m) => {
        const on = m === selected;
        const disabled = earliest === null ? m !== currentMonth() : m < earliest;
        return (
          <View key={m} style={[styles.chipHit, disabled && { opacity: 0.35 }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={monthName(m)}
              accessibilityState={{ selected: on, disabled }}
              disabled={disabled}
              onPress={() => onSelect(m)}
              style={[styles.chip, { backgroundColor: on ? colors.fill : 'transparent' }]}
            >
              <Text style={[styles.chipText, { color: on ? colors.ink : colors.ink3 }]}>{monthShort(m)}</Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chipHit: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: { minWidth: 48, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  chipText: { fontSize: 14, fontWeight: '600' },
});
