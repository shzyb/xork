import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ArrowDown, ArrowUp, CalendarClock, Eye, EyeOff, Plus, Receipt, Settings } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RunningTotalChart } from '../../src/components/Charts';
import { EmptyState } from '../../src/components/EmptyState';
import { RecurringRow } from '../../src/components/RecurringRow';
import { SwipePages } from '../../src/components/SwipePages';
import { TransactionList } from '../../src/components/TransactionList';
import { getAccountsWithBalance, getRecurring, getSetting, getSpendTrend, getTransactions, NO_FILTER } from '../../src/db';
import { currentMonth, monthName, shiftMonth, today, upcomingOccurrences } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { spendComparison } from '../../src/insights';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { ACCOUNT_TYPES } from '../../src/types';
import type { DaySpend } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Tab = 'recent' | 'accounts' | 'upcoming';
const TABS: Tab[] = ['recent', 'accounts', 'upcoming'];
const TAB_LABELS: Record<Tab, string> = { recent: 'Recent', accounts: 'Accounts', upcoming: 'Upcoming' };

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('recent');
  const openingSettings = useRef(false);
  const hideOnOpen = useData(() => getSetting('hide_balances'));
  const [shown, setShown] = useState<boolean | null>(null);
  const hidden = shown === null ? hideOnOpen === '1' : !shown;
  // Changing "Hide balances on open" in Appearance takes over from the eye button.
  useEffect(() => setShown(null), [hideOnOpen]);
  // A quick double tap would otherwise push Settings twice.
  function openSettings() {
    if (openingSettings.current) return;
    openingSettings.current = true;
    setTimeout(() => { openingSettings.current = false; }, 700);
    router.push('/settings');
  }
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const accounts = useData(getAccountsWithBalance);
  const trend = useData(getSpendTrend);
  const { width } = useWindowDimensions();
  const recent = useData(() => getTransactions(NO_FILTER, 8));
  const recurring = useData(getRecurring);
  const upcoming = recurring ? upcomingOccurrences(recurring, today(), 7) : [];

  const seeAll = (label: string, to: '/activity' | '/recurring') => (
    <PressableScale accessibilityRole="button" onPress={() => router.navigate(to)} style={styles.seeAll}>
      <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </PressableScale>
  );

  // The small spending-vs-last-month block under the balance. A plain function, so the chart isn't remounted on every render.
  function renderTrend() {
    if (!trend) return null;
    const month = currentMonth();
    const prevMonth = shiftMonth(month, -1);
    const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);
    const spent = sum(trend.daily);
    const prevSamePoint = sum(trend.prevDaily.filter((d: DaySpend) => d.day <= Number(today().slice(8))));
    if (spent === 0 && sum(trend.prevDaily) === 0) return null;
    const comparison = spendComparison(spent, prevSamePoint, true, prevMonth);
    return (
      <View style={styles.trend}>
        <View style={styles.comparison}>
          {comparison && (comparison.more
            ? <ArrowUp color={colors.neg} size={16} strokeWidth={2.4} />
            : <ArrowDown color={colors.pos} size={16} strokeWidth={2.4} />)}
          <Text style={{ color: colors.ink2, fontSize: 15, flexShrink: 1 }}>
            {comparison
              ? `${mask(Math.abs(spent - prevSamePoint))} ${comparison.more ? 'more' : 'less'} than this point in ${monthName(prevMonth)}`
              : `${mask(spent)} expenses so far in ${monthName(month)}`}
          </Text>
        </View>
        <RunningTotalChart
          daily={trend.daily}
          prevDaily={trend.prevDaily}
          month={month}
          prevMonth={prevMonth}
          elapsed={Number(today().slice(8))}
          width={width - spacing.xl * 2}
          height={96}
          hidden={hidden}
        />
      </View>
    );
  }

  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.brand, { color: colors.ink }]}>Home</Text>
          <View style={styles.actions}>
            <PressableScale accessibilityRole="button" accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'} onPress={() => setShown(hidden)} style={styles.iconButton}>
              {hidden ? <EyeOff color={colors.ink} size={22} /> : <Eye color={colors.ink} size={22} />}
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Settings" onPress={openSettings} style={styles.iconButton}>
              <Settings color={colors.ink} size={22} />
            </PressableScale>
          </View>
        </View>

        <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.lg }}>Total balance</Text>
        {total !== undefined && hideOnOpen !== undefined && <Text style={[styles.balance, { color: colors.ink }]}>{mask(total)}</Text>}

        {hideOnOpen !== undefined && renderTrend()}

        <View style={[styles.tabs, { borderBottomColor: colors.line }]}>
          {TABS.map((key) => (
            <PressableScale key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}>
              <Text style={[styles.tab, { color: tab === key ? colors.ink : colors.ink3 }]}>
                {TAB_LABELS[key]}
              </Text>
            </PressableScale>
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
              <>
                <TransactionList rows={recent} />
                {seeAll('See all transactions', '/activity')}
              </>
            ))}

            {key === 'accounts' && accounts && hideOnOpen !== undefined && (
              <>
                {accounts.map((a) => (
                  <PressableScale
                    key={a.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/account/detail/[id]', params: { id: String(a.id) } })}
                    style={styles.row}
                  >
                    <View style={[styles.initial, { backgroundColor: a.color }]}>
                      <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.nameBox}>
                      <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
                      <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>
                        {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                      </Text>
                    </View>
                    <View style={styles.end}>
                      <Text style={[styles.amount, { color: colors.ink }]}>
                        {mask(a.type === 'credit' && a.limit_minor ? Math.max(0, a.limit_minor + a.balance_minor) : a.balance_minor)}
                      </Text>
                      {a.type === 'credit' && a.limit_minor && (
                        <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>Owed {mask(-a.balance_minor)}</Text>
                      )}
                    </View>
                  </PressableScale>
                ))}
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
                  style={styles.row}
                >
                  <View style={[styles.initial, { backgroundColor: colors.fill }]}>
                    <Plus color={colors.ink} size={20} />
                  </View>
                  <Text style={[styles.title, { color: colors.ink }]}>Add an account</Text>
                </PressableScale>
              </>
            )}

            {key === 'upcoming' && recurring && (upcoming.length === 0 ? (
              <EmptyState Icon={CalendarClock} title="Nothing due soon" text="Recurring bills and income due in the next 7 days will show up here." />
            ) : (
              <>
                {upcoming.map(({ item, date }) => <RecurringRow key={`${item.id}-${date}`} item={item} date={date} />)}
                {seeAll('See all recurring', '/recurring')}
              </>
            ))}
            </>
          )}
        />
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  brand: { fontSize: fontSize.screen, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  balance: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  trend: { marginTop: spacing.lg },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seeAll: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  tabs: { flexDirection: 'row', gap: 14, marginTop: 26, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { fontSize: fontSize.body, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  title: { flex: 1, fontSize: 16.5, fontWeight: '600' },
  nameBox: { flex: 1 },
  name: { fontSize: 16.5, fontWeight: '600' },
  end: { alignItems: 'flex-end' },
  amount: { fontSize: 16.5, fontWeight: '600' },
});
