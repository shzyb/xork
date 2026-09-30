import { useRouter } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { prettyDate } from '../dates';
import { formatMoney } from '../money';
import { fontSize, useColors } from '../theme';
import type { TransactionRow } from '../types';
import { CategoryIcon } from './CategoryIcon';

// Transactions grouped under a date heading. Tapping a row opens its detail sheet.
export function TransactionList({ rows }: { rows: TransactionRow[] }) {
  const colors = useColors();

  return (
    <View>
      {rows.map((t, i) => (
        <View key={t.id}>
          {(i === 0 || rows[i - 1].date !== t.date) && (
            <Text style={[styles.dateHead, { color: colors.ink }]}>{prettyDate(t.date)}</Text>
          )}
          <Line t={t} />
        </View>
      ))}
    </View>
  );
}

function Line({ t }: { t: TransactionRow }) {
  const colors = useColors();
  const router = useRouter();
  const income = t.type === 'income';
  const transfer = t.type === 'transfer';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/transaction/${t.id}`)}
      style={styles.row}
    >
      {transfer ? (
        <View style={[styles.transferIcon, { backgroundColor: colors.ink }]}>
          <ArrowLeftRight color={colors.bg} size={20} />
        </View>
      ) : (
        <CategoryIcon name={t.category_icon} color={t.category_color} recurring={t.recurring_id !== null} />
      )}
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          {transfer ? 'Transfer' : t.category_name ?? 'Other'}
        </Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>
          {transfer ? `${t.account_name} → ${t.to_account_name ?? 'deleted account'}` : t.account_name}
        </Text>
      </View>
      <Text style={[styles.amount, { color: income ? colors.pos : colors.ink }]}>
        {income ? '+ ' : ''}{formatMoney(t.amount_minor)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dateHead: { fontSize: 17, fontWeight: '700', paddingTop: 22, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  transferIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1 },
  title: { fontSize: 16.5, fontWeight: '600' },
  amount: { fontSize: 16.5, fontWeight: '600' },
});
