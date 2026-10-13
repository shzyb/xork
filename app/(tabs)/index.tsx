import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { CalendarClock, Check, ChevronDown, Eye, EyeOff, Plus, Receipt, Settings } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText } from '../../src/components/AmountText';
import { EmptyState } from '../../src/components/EmptyState';
import { HomeHero } from '../../src/components/HomeHero';
import { RecurringRow } from '../../src/components/RecurringRow';
import { SwipePages } from '../../src/components/SwipePages';
import { TransactionList } from '../../src/components/TransactionList';
import { getAccountsWithBalance, getRecurring, getSetting, getTransactions, NO_FILTER } from '../../src/db';
import { today, upcomingOccurrences } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { ACCOUNT_TYPES } from '../../src/types';
import type { HomeMetric } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Tab = 'recent' | 'accounts' | 'upcoming';
const TABS: Tab[] = ['recent', 'accounts', 'upcoming'];
const TAB_LABELS: Record<Tab, string> = { recent: 'Recent', accounts: 'Accounts', upcoming: 'Upcoming' };
const METRIC_LABELS: Record<HomeMetric, string> = { balance: 'Balance', expense: 'Expense' };
const METRICS = Object.keys(METRIC_LABELS) as HomeMetric[];

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('recent');
  const [metric, setMetric] = useState<HomeMetric>('balance');
  const screenRef = useRef<View>(null);
  const titleRef = useRef<View>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
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
  // The dropdown opens just under the title, wherever it is on the screen. Both are measured the same way, so the
  // difference is right whatever the status bar does.
  const openMenu = () => screenRef.current?.measureInWindow((screenX, screenY) => {
    titleRef.current?.measureInWindow((x, y, _w, h) => setMenuAt({ x: x - screenX, y: y + h - screenY }));
  });
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const accounts = useData(getAccountsWithBalance);
  const recent = useData(() => getTransactions(NO_FILTER, 8));
  const recurring = useData(getRecurring);
  const upcoming = recurring ? upcomingOccurrences(recurring, today(), 7) : [];

  const seeAll = (label: string, to: '/activity' | '/recurring') => (
    <PressableScale accessibilityRole="button" onPress={() => router.navigate(to)} style={styles.seeAll}>
      <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </PressableScale>
  );

  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0);

  return (
    <SafeAreaView ref={screenRef} style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View ref={titleRef} collapsable={false}>
            <PressableScale accessibilityRole="button" accessibilityLabel={`Showing ${METRIC_LABELS[metric]}. Change`} onPress={openMenu} style={styles.metricButton}>
              <Text style={[styles.brand, { color: colors.ink }]}>{METRIC_LABELS[metric]}</Text>
              <View style={styles.chevron}><ChevronDown color={colors.ink} size={24} strokeWidth={2.4} /></View>
            </PressableScale>
          </View>
          <View style={styles.actions}>
            <PressableScale accessibilityRole="button" accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'} onPress={() => setShown(hidden)} style={styles.iconButton}>
              {hidden ? <EyeOff color={colors.ink} size={22} /> : <Eye color={colors.ink} size={22} />}
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Settings" onPress={openSettings} style={styles.iconButton}>
              <Settings color={colors.ink} size={22} />
            </PressableScale>
          </View>
        </View>

        {hideOnOpen !== undefined && <HomeHero metric={metric} total={total} hidden={hidden} />}

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
                      {hidden ? (
                        <Text style={[styles.amount, { color: colors.ink }]}>{mask(0)}</Text>
                      ) : (
                        <AmountText minor={a.type === 'credit' && a.limit_minor ? Math.max(0, a.limit_minor + a.balance_minor) : a.balance_minor} style={[styles.amount, { color: colors.ink }]} />
                      )}
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
      {menuAt && (
        <>
          <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={() => setMenuAt(null)} />
          <View style={[styles.menu, { left: menuAt.x, top: menuAt.y + 8, backgroundColor: colors.bg, borderColor: colors.line }]}>
            {METRICS.map((value) => (
              <PressableScale
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: value === metric }}
                onPress={() => { setMetric(value); setMenuAt(null); }}
                style={styles.menuRow}
              >
                <Text style={[styles.menuLabel, { color: colors.ink }]}>{METRIC_LABELS[value]}</Text>
                {value === metric && <Check color={colors.ink} size={18} strokeWidth={2.4} />}
              </PressableScale>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  menu: {
    position: 'absolute', minWidth: 180, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 44, paddingHorizontal: 16 },
  menuLabel: { fontSize: 17, fontWeight: '600' },
  chevron: { marginTop: 4 }, // the big title's line box sits a little high, so centring alone leaves the icon looking too high
  metricButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  brand: { fontSize: fontSize.screen, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
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
