import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Plus, Settings } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecurringRow } from '../../src/components/RecurringRow';
import { TransactionList } from '../../src/components/TransactionList';
import { getAccountsWithBalance, getMonthSummary, getRecurring, getTransactions, NO_FILTER } from '../../src/db';
import { currentMonth, monthLabel, today, upcomingOccurrences } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fontSize, spacing, tabBarHeight, useColors } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Tab = 'recent' | 'accounts' | 'upcoming';
const TABS: Tab[] = ['recent', 'accounts', 'upcoming'];
const TAB_LABELS: Record<Tab, string> = { recent: 'Recent', accounts: 'Accounts', upcoming: 'Upcoming' };

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('recent');
  const [pagerTop, setPagerTop] = useState(0);
  const [heights, setHeights] = useState<Record<Tab, number>>({ recent: 0, accounts: 0, upcoming: 0 });
  const accounts = useData(getAccountsWithBalance);
  const month = useData(() => getMonthSummary(currentMonth()));
  const recent = useData(() => getTransactions(NO_FILTER, 8));
  const recurring = useData(getRecurring);
  const upcoming = recurring ? upcomingOccurrences(recurring, today(), 7) : [];

  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0);
  const pageWidth = width - spacing.xl * 2;
  // The pager always fills the screen below the tab labels, so a swipe works even when the list is short.
  const minPagerHeight = Math.max(0, height - insets.top - pagerTop - tabBarHeight - insets.bottom);

  function goTo(key: Tab) {
    setTab(key);
    pager.current?.scrollTo({ x: TABS.indexOf(key) * pageWidth, animated: true });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.brand, { color: colors.ink }]}>Home</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.iconButton}>
            <Settings color={colors.ink} size={22} />
          </Pressable>
        </View>

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
          {TABS.map((key) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => goTo(key)}>
              <Text style={[styles.tab, { color: tab === key ? colors.ink : colors.ink3 }]}>
                {TAB_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setTab(TABS[Math.round(e.nativeEvent.contentOffset.x / pageWidth)] ?? tab)}
          contentContainerStyle={styles.pages}
          onLayout={(e) => setPagerTop(e.nativeEvent.layout.y)}
          style={[heights[tab] > 0 && { height: heights[tab] }, { minHeight: minPagerHeight }]}
        >
          {TABS.map((key) => (
            <View
              key={key}
              style={{ width: pageWidth }}
              onLayout={(e) => {
                const height = e.nativeEvent.layout.height;
                setHeights((prev) => (prev[key] === height ? prev : { ...prev, [key]: height }));
              }}
            >
              {key === 'recent' && recent && (recent.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyTitle, { color: colors.ink }]}>No transactions yet</Text>
                  <Text style={{ color: colors.ink2 }}>Tap + to log your first expense or income.</Text>
                </View>
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
                      <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(a.balance_minor)}</Text>
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
                <View style={styles.empty}>
                  <Text style={{ color: colors.ink2 }}>Nothing due in the next 7 days.</Text>
                </View>
              ) : (
                upcoming.map(({ item, date }) => <RecurringRow key={`${item.id}-${date}`} item={item} date={date} />)
              ))}
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  brand: { fontSize: 25, fontWeight: '700' },
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
  pages: { alignItems: 'flex-start' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
});
