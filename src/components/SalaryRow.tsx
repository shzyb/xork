import { StyleSheet, View } from 'react-native';
import { sheet } from '../theme';
import { Text } from './Text';
import { Toggle } from './Toggle';

// Shown on the black forms when an income uses the Salary category. On means it can start a pay period.
export function SalaryRow({ value, onValueChange }: { value: boolean; onValueChange: (on: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>Salary</Text>
        <Text style={styles.sub}>{value ? 'Starts a new pay period on Payday' : "Doesn't start a pay period"}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} onSheet accessibilityLabel="Salary" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: sheet.card, borderRadius: 18, padding: 16, marginTop: 14 },
  text: { flex: 1 },
  title: { color: sheet.ink, fontSize: 16, fontWeight: '600' },
  sub: { color: sheet.ink2, fontSize: 13.5, marginTop: 2 },
});
