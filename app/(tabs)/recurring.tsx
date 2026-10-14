import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { PressableScale } from '../../src/components/PressableScale';
import { RecurringRow } from '../../src/components/RecurringRow';
import { Text } from '../../src/components/Text';
import { getAccountsWithBalance, getMonthRecurringActivity, getRecurring } from '../../src/db';
import {
  currentMonth, dueDateIn, FREQUENCY_LABEL, monthGrid, monthLabel, monthRange, occurrencesBetween, prettyDate, shiftMonth, today,
} from '../../src/dates';
import { formatMoney } from '../../src/money';
import { actionColors, fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { useData } from '../../src/useData';

type Kind = 'income' | 'expense' | 'card';

// One payment on the calendar: already logged, still to come, or a credit card's due day.
type Entry = {
  key: string; date: string; kind: Kind; title: string; sub: string; amount: number;
  emoji: string | null; color: string; path: string; id: number;
};

const DOT: Record<Kind, string> = { income: actionColors.income, expense: actionColors.expense, card: actionColors.transfer };

export default function Recurring() {
  const colors = useColors();
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'all'>('upcoming');
  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const items = useData(getRecurring);
  const accounts = useData(getAccountsWithBalance);
  const logged = useData(() => getMonthRecurringActivity(month), [month]);

  const openNew = () => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } });
  const cards = (accounts ?? []).filter((a) => a.type === 'credit' && a.due_day);
  const owed = (balance: number) => Math.max(0, -balance);

  const { start, end } = monthRange(month);
  const entries: Entry[] = [];
  for (const t of logged ?? []) {
    entries.push({
      key: `t${t.id}`, date: t.date, kind: t.type === 'income' ? 'income' : 'expense', title: t.recurring_name ?? t.note,
      sub: `${t.type === 'income' ? 'Received' : 'Paid'} · ${t.account_name}`, amount: t.amount_minor,
      emoji: t.category_icon, color: t.category_color ?? '#64748B', path: '/transaction/[id]', id: t.id,
    });
  }
  for (const o of occurrencesBetween(items ?? [], start > today() ? start : today(), end)) {
    entries.push({
      key: `r${o.item.id}-${o.date}`, date: o.date, kind: o.item.type, title: o.item.name,
      sub: `${FREQUENCY_LABEL[o.item.freq]} · ${o.item.account_name}`, amount: o.item.amount_minor,
      emoji: o.item.category_icon, color: o.item.category_color, path: '/recurring/detail/[id]', id: o.item.id,
    });
  }
  for (const a of cards) {
    const date = dueDateIn(month, a.due_day!);
    if (date < a.created_at.slice(0, 10)) continue;
    entries.push({
      key: `c${a.id}`, date, kind: 'card', title: a.name, sub: 'Card payment due', amount: owed(a.balance_minor),
      emoji: '💳', color: a.color, path: '/account/detail/[id]', id: a.id,
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  const shown = selected ? entries.filter((e) => e.date === selected) : entries;

  const sorted = (type: 'income' | 'expense') =>
    (items ?? []).filter((r) => r.type === type).sort((a, b) =>
      a.active !== b.active ? (a.active ? -1 : 1) : a.next_date.localeCompare(b.next_date));
  const nextDue = (day: number) => {
    const date = dueDateIn(currentMonth(), day);
    return date >= today() ? date : dueDateIn(shiftMonth(currentMonth(), 1), day);
  };

  const heading = (text: string) => <Text style={[styles.heading, { color: colors.ink2 }]}>{text}</Text>;

  const row = (e: Entry) => (
    <PressableScale
      key={e.key}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: e.path as '/transaction/[id]', params: { id: String(e.id) } })}
      style={styles.row}
    >
      <CategoryIcon name={e.emoji} color={e.color} recurring={e.kind !== 'card'} />
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{e.title}</Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>{e.sub}</Text>
      </View>
      <View style={styles.end}>
        <Text style={[styles.title, { color: e.kind === 'income' ? colors.pos : colors.ink }]}>
          {e.kind === 'income' ? '+ ' : ''}{formatMoney(e.amount)}
        </Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }}>{prettyDate(e.date)}</Text>
      </View>
    </PressableScale>
  );

  const calendar = (
    <View>
      <View style={styles.monthBar}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Previous month" style={styles.iconButton}
          onPress={() => { setMonth(shiftMonth(month, -1)); setSelected(null); }}>
          <ChevronLeft color={colors.ink} size={24} />
        </PressableScale>
        <Text style={[styles.monthName, { color: colors.ink }]}>{monthLabel(month)}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel="Next month" style={styles.iconButton}
          onPress={() => { setMonth(shiftMonth(month, 1)); setSelected(null); }}>
          <ChevronRight color={colors.ink} size={24} />
        </PressableScale>
      </View>
      <View style={styles.week}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={[styles.cell, styles.weekday, { color: colors.ink3 }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.week}>
        {monthGrid(month).map((day, i) => {
          if (!day) return <View key={`b${i}`} style={styles.cell} />;
          const kinds = [...new Set(entries.filter((e) => e.date === day).map((e) => e.kind))];
          const on = day === selected;
          return (
            <PressableScale key={day} accessibilityRole="button" accessibilityLabel={prettyDate(day)}
              onPress={() => setSelected(on ? null : day)} style={styles.cell}>
              <View style={[styles.day, on && { backgroundColor: colors.ink }, !on && day === today() && { backgroundColor: colors.fill }]}>
                <Text style={{ fontSize: fontSize.body, fontWeight: day === today() ? '800' : '500', color: on ? colors.bg : colors.ink }}>
                  {Number(day.slice(8))}
                </Text>
              </View>
              <View style={styles.dots}>
                {kinds.map((k) => <View key={k} style={[styles.dot, { backgroundColor: DOT[k] }]} />)}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  const group = (label: string, rows: React.ReactNode[]) => rows.length > 0 && (
    <View>
      {heading(label)}
      {rows}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.screenTitle, { color: colors.ink }]}>Recurring</Text>
          <PressableScale accessibilityRole="button" accessibilityLabel="Add recurring item" onPress={openNew} style={styles.iconButton}>
            <Plus color={colors.ink} size={24} />
          </PressableScale>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.fill }]}>
          {(['upcoming', 'all'] as const).map((t) => (
            <PressableScale key={t} accessibilityRole="button" onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { backgroundColor: colors.bg }]}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: tab === t ? colors.ink : colors.ink2 }}>
                {t === 'upcoming' ? 'Upcoming' : 'All'}
              </Text>
            </PressableScale>
          ))}
        </View>

        {tab === 'upcoming' && items && accounts && (
          <>
            {calendar}
            {heading(selected ? prettyDate(selected) : monthLabel(month))}
            {shown.length > 0 ? shown.map(row) : (
              <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.sm }}>
                {selected ? 'Nothing on this day.' : 'Nothing this month.'}
              </Text>
            )}
          </>
        )}

        {tab === 'all' && items && accounts && (
          items.length === 0 && cards.length === 0 ? (
            <EmptyState
              Icon={Repeat}
              title="Nothing scheduled yet"
              text="Add rent, bills, subscriptions or your salary so you can see what's coming before it lands."
            />
          ) : (
            <>
              {group('Income', sorted('income').map((item) => <RecurringRow key={item.id} item={item} />))}
              {group('Expenses', sorted('expense').map((item) => <RecurringRow key={item.id} item={item} />))}
              {group('Credit cards', cards.map((a) => row({
                key: `c${a.id}`, date: nextDue(a.due_day!), kind: 'card', title: a.name,
                sub: `Due on day ${a.due_day} each month`, amount: owed(a.balance_minor),
                emoji: '💳', color: a.color, path: '/account/detail/[id]', id: a.id,
              })))}
            </>
          )
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  screenTitle: { fontSize: fontSize.screen, fontWeight: '800' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 3, marginTop: spacing.md },
  tab: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  monthName: { fontSize: 17, fontWeight: '700' },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center' },
  weekday: { height: 28, textAlign: 'center', fontSize: 12.5, fontWeight: '600' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  heading: { fontSize: fontSize.small, fontWeight: '700', marginTop: 26, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  title: { fontSize: 16.5, fontWeight: '600' },
});
