import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../../src/components/FadeScrollView';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { Sheet } from '../../../src/components/Sheet';
import { SheetHeader } from '../../../src/components/SheetHeader';
import { getAccountsWithBalance, getAccountStats } from '../../../src/db';
import { currentMonth, monthName, today } from '../../../src/dates';
import { creditStatus, dueText } from '../../../src/insights';
import { formatMoney } from '../../../src/money';
import { sheet, spacing } from '../../../src/theme';
import { ACCOUNT_TYPES } from '../../../src/types';
import { useData } from '../../../src/useData';
import { Text } from '../../../src/components/Text';

// What an account is and has done. Editing and deleting it live in the edit form.
export default function AccountDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData(async () => {
    const account = (await getAccountsWithBalance()).find((a) => a.id === Number(id));
    return account ? { account, stats: await getAccountStats(account.id, currentMonth()) } : null;
  }, [id]);

  if (!data) return null;
  const { account, stats } = data;
  const credit = account.type === 'credit';
  const status = credit && account.limit_minor ? creditStatus(-account.balance_minor, account.limit_minor) : null;
  const tint = status?.state === 'warn' ? sheet.warn : status && status.state !== 'ok' ? sheet.neg : sheet.ink2;
  const month = monthName(currentMonth());

  const details: [string, string][] = [
    ['Type', ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? ''],
    [credit ? 'Starting amount owed' : 'Starting balance', formatMoney(Math.abs(account.opening_minor))],
  ];
  if (credit && account.limit_minor) {
    details.push(['Credit limit', formatMoney(account.limit_minor)]);
    if (status) details.push(['Available', formatMoney(status.left)]);
  }
  if (credit && account.due_day) {
    const due = dueText(account.due_day, today());
    details.push(['Payment', due.charAt(0).toUpperCase() + due.slice(1)]);
  }
  details.push([`Spent in ${month}`, formatMoney(stats.spent_minor)]);
  details.push([`Received in ${month}`, formatMoney(stats.in_minor)]);
  details.push(['Transactions', String(stats.count)]);

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.initial, { backgroundColor: account.color }]}>
            <Text style={styles.initialText}>{account.name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.kind} numberOfLines={1}>{account.name}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(credit ? -account.balance_minor : account.balance_minor)}
          </Text>
          <Text style={styles.sub}>{credit ? 'Owed' : 'Balance'}</Text>
          {status && (
            <View style={[styles.tag, { borderColor: status.state === 'ok' ? sheet.card2 : tint }]}>
              <Text style={[styles.tagText, { color: tint }]}>
                {status.state === 'full' ? 'At the limit' : `${status.percent}% of limit used`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          {details.map(([label, value], i) => (
            <View key={label} style={[styles.detailRow, i > 0 && styles.detailDivider]}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>
      </FadeScrollView>
      <View style={styles.footer}>
        <Button
          title="Edit"
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(account.id) } })}
          background={sheet.btnBg}
          color={sheet.btnFg}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  initial: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  kind: { color: sheet.ink2, fontSize: 15, marginTop: 6, maxWidth: '80%' },
  amount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1, maxWidth: '100%' },
  sub: { color: sheet.ink3, fontSize: 13.5 },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center', marginTop: 4 },
  tagText: { fontSize: 12.5, fontWeight: '600' },
  card: { backgroundColor: sheet.card, borderRadius: 20, paddingHorizontal: 16, marginTop: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sheet.card2 },
  detailLabel: { color: sheet.ink2, fontSize: 16 },
  detailValue: { color: sheet.ink, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
  footer: { paddingTop: 6, paddingBottom: spacing.lg },
});
