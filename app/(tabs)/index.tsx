import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, CalendarClock, Eye, EyeOff, Plus, Receipt, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { RecurringRow } from '../../src/components/RecurringRow';
import { SwipePages } from '../../src/components/SwipePages';
import { TransactionList } from '../../src/components/TransactionList';
import { getAccountsWithBalance, getMonthSummary, getRecurring, getTransactions, NO_FILTER } from '../../src/db';
import { currentMonth, monthLabel, today, upcomingOccurrences } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fontSize, spacing, useColors } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Tab = 'recent' | 'accounts' | 'upcoming';
const TABS: Tab[] = ['recent', 'accounts', 'upcoming'];
const TAB_LABELS: Record<Tab, string> = { recent: 'Recent', accounts: 'Accounts', upcoming: 'Upcoming' };

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('recent');
  const [hidden, setHidden] = useState(false);
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const accounts = useData(getAccountsWithBalance);
  const month = useData(() => getMonthSummary(currentMonth()));
  const recent = useData(() => getTransactions(NO_FILTER, 8));
  const recurring = useData(getRecurring);
  const upcoming = recurring ? upcomingOccurrences(recurring, today(), 7) : [];

  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.brand, { color: colors.ink }]}>Home</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'} onPress={() => setHidden(!hidden)} style={styles.iconButton}>
              {hidden ? <EyeOff color={colors.ink} size={22} /> : <Eye color={colors.ink} size={22} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.iconButton}>
              <Settings color={colors.ink} size={22} />
            </Pressable>
          </View>
        </View>

        <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.lg }}>Total balance</Text>
        {total !== undefined && <Text style={[styles.balance, { color: colors.ink }]}>{mask(total)}</Text>}

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
          {TABS.map((key) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}>
              <Text style={[styles.tab, { color: tab === key ? colors.ink : colors.ink3 }]}>
                {TAB_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        <SwipePages
          keys={TABS}
          active={tab}
          onChange={setTab}
          renderPage={(key) => (
            <>
            {key === 'recent' && recent && (recent.length === 0 ? (
              <EmptyState Icon={Receipt} title="No transactions yet" text="Tap + to log your first expense or income." />
            ) : (
              <TransactionList rows={recent} />
            ))}

            {key === 'accounts' && accounts && (
              <>
                {accounts.map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(a.id) } })}
                    style={styles.row}
                  >
                    <View style={[styles.initial, { backgroundColor: a.color }]}>
                      <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
                    <Text style={[styles.amount, { color: colors.ink }]}>{mask(a.balance_minor)}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
                  style={styles.row}
                >
                  <View style={[styles.initial, { backgroundColor: colors.fill }]}>
                    <Plus color={colors.ink} size={20} />
                  </View>
                  <Text style={[styles.title, { color: colors.ink }]}>Add an account</Text>
                </Pressable>
              </>
            )}

            {key === 'upcoming' && recurring && (upcoming.length === 0 ? (
              <EmptyState Icon={CalendarClock} title="Nothing due soon" text="Recurring bills and income due in the next 7 days will show up here." />
            ) : (
              upcoming.map(({ item, date }) => <RecurringRow key={`${item.id}-${date}`} item={item} date={date} />)
            ))}
            </>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  brand: { fontSize: 25, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  balance: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 14, marginTop: 26, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { fontSize: fontSize.body, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  title: { flex: 1, fontSize: 16.5, fontWeight: '600' },
  amount: { fontSize: 16.5, fontWeight: '600' },
});
