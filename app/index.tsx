import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTotalBalance } from '../src/db';
import { formatMoney } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import { useData } from '../src/useData';

export default function Home() {
  const colors = useColors();
  const balance = useData(getTotalBalance);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.ink2, fontSize: fontSize.body }}>Total balance</Text>
      {balance !== undefined && (
        <Text style={[styles.balance, { color: colors.ink }]}>{formatMoney(balance)}</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.xl },
  balance: { fontSize: fontSize.big, fontWeight: '800' },
});
