import { ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { getAccountsWithBalance, getMonthSummary, getRecent } from '../../src/db';
import { currentMonth, monthLabel, prettyDate } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fontSize, spacing, useColors } from '../../src/theme';
import type { TransactionRow } from '../../src/types';
import { useData } from '../../src/useData';

type Tab = 'recent' | 'accounts';

export default function Home() {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('recent');
  const accounts = useData(getAccountsWithBalance);
  const month = useData(() => getMonthSummary(currentMonth()));
  const recent = useData(() => getRecent(8));

  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.brand, { color: colors.ink }]}>Hisaab</Text>

        <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.lg }}>Total balance</Text>
        {total !== undefined && <Text style={[styles.balance, { color: colors.ink }]}>{formatMoney(total)}</Text>}

        {month && (
          <>
            <Text style={{ color: colors.ink2, marginTop: spacing.lg }}>So far in {monthLabel(currentMonth()).split(' ')[0]}</Text>
            <View style={styles.chips}>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <ArrowUp color={colors.ink2} size={15} />
                <Text style={[styles.chipText, { color: colors.ink }]}>{formatMoney(month.out_minor)} spent</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <ArrowDown color={colors.pos} size={15} />
                <Text style={[styles.chipText, { color: colors.pos }]}>{formatMoney(month.in_minor)} in</Text>
              </View>
            </View>
          </>
        )}

        <View style={[styles.tabs, { borderBottomColor: colors.line }]}>
          {(['recent', 'accounts'] as const).map((key) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}>
              <Text style={[styles.tab, { color: tab === key ? colors.ink : colors.ink3 }]}>
                {key === 'recent' ? 'Recent' : 'Accounts'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'recent' && recent && (recent.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No transactions yet</Text>
            <Text style={{ color: colors.ink2 }}>Tap + to log your first expense or income.</Text>
          </View>
        ) : (
          recent.map((t, i) => (
            <View key={t.id}>
              {(i === 0 || recent[i - 1].date !== t.date) && (
                <Text style={[styles.dateHead, { color: colors.ink }]}>{prettyDate(t.date)}</Text>
              )}
              <TransactionLine t={t} />
            </View>
          ))
        ))}

        {tab === 'accounts' && accounts?.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={[styles.initial, { backgroundColor: a.color }]}>
              <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
            <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(a.balance_minor)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TransactionLine({ t }: { t: TransactionRow }) {
  const colors = useColors();

  if (t.type === 'transfer') {
    return (
      <View style={styles.row}>
        <View style={[styles.initial, { backgroundColor: colors.ink }]}>
          <ArrowLeftRight color={colors.bg} size={20} />
        </View>
        <View style={styles.main}>
          <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>Moved from {t.account_name}</Text>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>To {t.to_account_name ?? 'deleted account'}</Text>
        </View>
        <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(t.amount_minor)}</Text>
      </View>
    );
  }

  const income = t.type === 'income';
  return (
    <View style={styles.row}>
      <CategoryIcon name={t.category_icon} color={t.category_color} />
      <View style={styles.main}>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>
          {income ? 'Received' : 'Paid'} · {t.category_name ?? 'Other'}
        </Text>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{t.note || t.category_name || 'Other'}</Text>
      </View>
      <View style={styles.end}>
        <Text style={[styles.amount, { color: income ? colors.pos : colors.ink }]}>
          {income ? '+ ' : ''}{formatMoney(t.amount_minor)}
        </Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>{t.account_name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  brand: { fontSize: 25, fontWeight: '700', marginTop: spacing.md },
  balance: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 14, marginTop: 26, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { fontSize: fontSize.body, fontWeight: '700' },
  dateHead: { fontSize: 17, fontWeight: '700', paddingTop: 22, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  title: { flex: 1, fontSize: 16.5, fontWeight: '600' },
  amount: { fontSize: 16.5, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
});
