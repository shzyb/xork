import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountDot } from '../../../src/components/AccountButton';
import { FadeScrollView } from '../../../src/components/FadeScrollView';
import { MonthChips } from '../../../src/components/MonthChips';
import { PressableScale } from '../../../src/components/PressableScale';
import { Bone, RowBones } from '../../../src/components/Skeleton';
import { Text } from '../../../src/components/Text';
import { TransactionList } from '../../../src/components/TransactionList';
import { getAccountsWithBalance, getAccountStats, getEarliestMonth, getTransactions, NO_FILTER } from '../../../src/db';
import { currentMonth, monthName, today } from '../../../src/dates';
import { creditStatus, dueText } from '../../../src/insights';
import { formatMoney } from '../../../src/money';
import { spacing, useColors } from '../../../src/theme';
import { useData } from '../../../src/useData';

// What an account is and has done, with its transactions for the chosen month. Editing and deleting live in the edit form.
export default function AccountDetail() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [month, setMonth] = useState(currentMonth());
  const data = useData(async () => {
    const account = (await getAccountsWithBalance()).find((a) => a.id === Number(id));
    if (!account) return null;
    return {
      account,
      stats: await getAccountStats(account.id, currentMonth()),
      rows: await getTransactions({ ...NO_FILTER, accountId: account.id, month }, 1000),
      earliest: await getEarliestMonth(),
    };
  }, [id, month]);

  // Deleting the account in the edit form leaves this page with nothing to show, so it closes too.
  useEffect(() => {
    if (data === null) router.back();
  }, [data, router]);

  if (data === undefined) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.topbar}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
            <ChevronLeft color={colors.ink} size={26} />
          </PressableScale>
        </View>
        <View style={[styles.content, styles.hero]}>
          <Bone width={64} height={64} radius={32} />
          <Bone width={110} height={15} />
          <Bone width={170} height={40} radius={12} />
          <Bone width="100%" height={170} radius={20} style={{ marginTop: 14 }} />
          <RowBones count={3} />
        </View>
      </SafeAreaView>
    );
  }
  if (data === null) return null;
  const { account, stats, rows, earliest } = data;
  const credit = account.type === 'credit';
  const status = credit && account.limit_minor ? creditStatus(-account.balance_minor, account.limit_minor) : null;
  const tint = status?.state === 'warn' ? colors.warn : status && status.state !== 'ok' ? colors.neg : colors.ink2;
  const thisMonth = monthName(currentMonth());

  const details: [string, string][] = [];
  if (!credit) details.push(['Starting balance', formatMoney(account.opening_minor)]);
  if (credit && account.limit_minor) {
    details.push(['Credit limit', formatMoney(account.limit_minor)]);
    if (status) details.push(['Available', formatMoney(status.left)]);
  }
  if (credit && account.due_day) {
    const due = dueText(account.due_day, today());
    details.push(['Payment', due.charAt(0).toUpperCase() + due.slice(1)]);
  }
  details.push([credit ? `Spent in ${thisMonth}` : `Expense in ${thisMonth}`, formatMoney(stats.spent_minor)]);
  if (!credit) details.push([`Income in ${thisMonth}`, formatMoney(stats.in_minor)]);
  details.push(['Transactions', String(stats.count)]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.topbar}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={26} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Edit account"
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(account.id) } })}
          style={styles.edit}
        >
          <Text style={{ color: colors.ink, fontSize: 16.5, fontWeight: '600' }}>Edit</Text>
        </PressableScale>
      </View>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AccountDot account={account} size={64} />
          <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 6, maxWidth: '80%' }} numberOfLines={1}>{account.name}</Text>
          <Text style={[styles.amount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(credit ? -account.balance_minor : account.balance_minor)}
          </Text>
          <Text style={{ color: colors.ink3, fontSize: 13.5 }}>{credit ? 'Owed' : 'Balance'}</Text>
          {status && (
            <View style={[styles.tag, { borderColor: status.state === 'ok' ? colors.line : tint }]}>
              <Text style={{ color: tint, fontSize: 12.5, fontWeight: '600' }}>
                {status.state === 'full' ? 'At the limit' : `${status.percent}% of limit used`}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.fill }]}>
          {details.map(([label, value], i) => (
            <View key={label} style={[styles.detailRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
              <Text style={{ color: colors.ink2, fontSize: 16 }}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.ink }]}>{value}</Text>
            </View>
          ))}
        </View>

        <MonthChips selected={month} earliest={earliest} onSelect={setMonth} />

        {rows.length === 0 ? (
          <Text style={{ color: colors.ink2, paddingVertical: spacing.lg }}>No transactions in {monthName(month)}.</Text>
        ) : (
          <TransactionList rows={rows} />
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  edit: { minWidth: 44, height: 44, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  amount: { fontSize: 40, fontWeight: '800', letterSpacing: -1, maxWidth: '100%' },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center', marginTop: 4 },
  card: { borderRadius: 20, paddingHorizontal: 16, marginTop: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  detailValue: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
});
