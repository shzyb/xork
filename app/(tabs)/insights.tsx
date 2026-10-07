import { ChevronDown, ChevronUp, Gauge, Repeat, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react-native';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import type { LucideIcon } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CashFlowChart, RunningTotalChart } from '../../src/components/Charts';
import { MonthChips } from '../../src/components/MonthChips';
import { StatTile } from '../../src/components/StatTile';
import { getInsights } from '../../src/db';
import { currentMonth, daysInMonth, monthName, monthShort, shiftMonth, today } from '../../src/dates';
import { buildNotes, keptPercent, spendComparison } from '../../src/insights';
import type { Note } from '../../src/insights';
import { formatMoney } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import type { InsightsData } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

const NOTE_ICONS: Record<Note['icon'], LucideIcon> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  gauge: Gauge,
  repeat: Repeat,
  'triangle-alert': TriangleAlert,
};

// The colour of the notes that are neither good nor bad news.
const TOP_COUNT = 5;

function percent(part: number, total: number) {
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
}

const NEUTRAL_COLORS: Partial<Record<Note['icon'], string>> = { gauge: '#3B82F6', repeat: '#8B5CF6' };

export default function Insights() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(currentMonth());
  const data = useData(() => getInsights(month), [month]);
  const [expanded, setExpanded] = useState(false);

  // The group of smaller categories folds back up when you leave the tab or change month.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  const isCurrent = month === currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const elapsed = isCurrent ? Number(today().slice(8)) : undefined;
  const contentWidth = width - spacing.xl * 2;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>

        {data && (
          <Body
            data={data}
            month={month}
            prevMonth={prevMonth}
            isCurrent={isCurrent}
            elapsed={elapsed}
            contentWidth={contentWidth}
            onSelectMonth={(m) => { setExpanded(false); setMonth(m); }}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((e) => !e)}
          />
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

function Body({ data, month, prevMonth, isCurrent, elapsed, contentWidth, onSelectMonth, expanded, onToggleExpanded }: {
  data: InsightsData;
  month: string;
  prevMonth: string;
  isCurrent: boolean;
  elapsed: number | undefined;
  contentWidth: number;
  onSelectMonth: (month: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { summary, prevSummary, spending, prevSpending, income, recurringOut } = data;
  const out = summary.out_minor;
  const prevSamePointOut = prevSpending.reduce((sum, c) => sum + c.total_minor, 0);
  const comparison = spendComparison(out, prevSamePointOut, isCurrent, prevMonth);
  const kept = keptPercent(summary.in_minor, out);
  const notes = buildNotes({
    month, prevMonth, isCurrent, elapsedDays: elapsed ?? 1, spent: out, prevFullSpent: prevSummary.out_minor,
    recurringOut, spending, prevSpending,
  });
  const noteWidth = Math.round(contentWidth * 0.72);
  const grouped = spending.length > TOP_COUNT;
  const top = grouped ? spending.slice(0, TOP_COUNT) : spending;
  const rest = grouped ? spending.slice(TOP_COUNT) : [];
  const restTotal = rest.reduce((sum, c) => sum + c.total_minor, 0);
  const open = (id: number) => router.push({ pathname: '/category-activity', params: { id: String(id), month } });

  const spendingRow = (c: InsightsData['spending'][number]): ReactNode => (
    <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} transactions`} onPress={() => open(c.id)} style={styles.row}>
      <CategoryIcon name={c.icon} color={c.color} size={36} />
      <View style={styles.main}>
        <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
        <Text style={{ color: colors.ink2, fontSize: 14 }}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>
      </View>
      <View style={styles.end}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(c.total_minor)}</Text>
        <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 2 }}>{percent(c.total_minor, out)}</Text>
      </View>
    </PressableScale>
  );

  return (
    <>
      <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.lg }}>
        Expenses in {monthName(month)}{isCurrent ? ' so far' : ''}
      </Text>
      <Text style={[styles.big, { color: colors.ink }]}>{formatMoney(out)}</Text>
      <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 6 }}>
        {comparison ? comparison.text : 'Nothing to compare with last month yet'}
      </Text>

      <RunningTotalChart daily={data.daily} prevDaily={data.prevDaily} height={170} hidden={false} month={month} prevMonth={prevMonth} elapsed={elapsed} width={contentWidth} />
      <MonthChips selected={month} earliest={data.earliestMonth} onSelect={onSelectMonth} />

      <View style={styles.duo}>
        <View style={styles.duoCell}>
          <Text style={{ color: colors.ink2, fontSize: 14 }}>Income</Text>
          <Text style={[styles.duoValue, { color: colors.pos }]}>{formatMoney(summary.in_minor)}</Text>
        </View>
        <View style={[styles.duoCell, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.fill2 }]}>
          <Text style={{ color: colors.ink2, fontSize: 14 }}>Left over</Text>
          <Text style={[styles.duoValue, { color: colors.ink }]}>{formatMoney(summary.in_minor - out)}</Text>
        </View>
      </View>
      {kept !== null && (
        <View style={[styles.kept, { borderColor: colors.fill2 }]}>
          <Text style={{ color: colors.ink2, fontSize: 15 }}>
            You kept <Text style={{ color: colors.ink, fontWeight: '700' }}>{kept}%</Text> of your income
          </Text>
        </View>
      )}

      {notes.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>What stood out</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={noteWidth + 12}
            style={styles.notes}
            contentContainerStyle={styles.notesContent}
          >
            {notes.map((note, i) => {
              const Icon = NOTE_ICONS[note.icon];
              const tone = note.tone === 'good' ? colors.pos : note.tone === 'bad' ? colors.neg : note.tone === 'warn' ? colors.warn : (NEUTRAL_COLORS[note.icon] ?? colors.ink);
              const categoryId = note.categoryId;
              return (
                <PressableScale
                  key={i}
                  accessibilityRole={categoryId === undefined ? undefined : 'button'}
                  disabled={categoryId === undefined}
                  onPress={() => categoryId !== undefined && open(categoryId)}
                  style={[styles.note, { width: noteWidth, backgroundColor: `${tone}26` }]}
                >
                  <View style={[styles.noteIcon, { backgroundColor: tone }]}>
                    <Icon color="#FFFFFF" size={17} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={[styles.noteTitle, { color: colors.ink }]}>{note.title}</Text>
                    <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{note.detail}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={[styles.section, { color: colors.ink }]}>Top categories</Text>
      {spending.length > 0 && (
        <View style={styles.stack}>
          {top.map((c) => (
            <View key={c.id} style={{ flex: c.total_minor, backgroundColor: c.color, minWidth: 3 }} />
          ))}
          {grouped && <View style={{ flex: restTotal, backgroundColor: colors.ink3, minWidth: 3 }} />}
        </View>
      )}
      {spending.length === 0 && income.length === 0 && (
        <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>Nothing logged in {monthName(month)}.</Text>
      )}
      {top.map((c) => spendingRow(c))}
      {grouped && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${rest.length} other categories`}
          accessibilityState={{ expanded }}
          onPress={onToggleExpanded}
          style={styles.row}
        >
          <View style={[styles.groupIcon, { backgroundColor: colors.ink3 }]}>
            {expanded ? <ChevronUp size={18} color="#fff" /> : <ChevronDown size={18} color="#fff" />}
          </View>
          <View style={styles.main}>
            <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{rest.length} other categories</Text>
            <Text style={{ color: colors.ink2, fontSize: 14 }}>{expanded ? 'Tap to hide' : 'Tap to show'}</Text>
          </View>
          <View style={styles.end}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(restTotal)}</Text>
            <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 2 }}>{percent(restTotal, out)}</Text>
          </View>
        </PressableScale>
      )}
      {expanded && rest.map((c) => spendingRow(c))}
      {income.map((c) => (
        <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} transactions`} onPress={() => open(c.id)} style={styles.row}>
          <CategoryIcon name={c.icon} color={c.color} size={36} />
          <View style={styles.main}>
            <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
            <Text style={{ color: colors.ink2, fontSize: 14 }}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>
          </View>
          <View style={styles.end}>
            <Text style={[styles.rowTitle, { color: colors.pos }]}>+ {formatMoney(c.total_minor)}</Text>
            <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 2 }}>{percent(c.total_minor, summary.in_minor)}</Text>
          </View>
        </PressableScale>
      ))}

      <View style={styles.tiles}>
        <StatTile label="Daily average" value={formatMoney(Math.round(out / (elapsed ?? daysInMonth(month))))}
          sub={prevSummary.out_minor > 0 ? `${formatMoney(Math.round(prevSummary.out_minor / daysInMonth(prevMonth)))} in ${monthShort(prevMonth)}` : 'Per day so far'} />
        <StatTile label="Savings rate" value={kept === null ? '–' : `${kept}%`} sub={kept === null ? 'No income logged' : 'Of income kept'} />
        <StatTile label="Biggest expense" value={data.biggest ? formatMoney(data.biggest.amount_minor) : '–'} sub={data.biggest?.label ?? 'Nothing yet'} />
        <StatTile label="No-spend days" value={String(Math.max(0, (elapsed ?? daysInMonth(month)) - data.spendDays))} sub={`Of ${elapsed ?? daysInMonth(month)} days, bills aside`} />
      </View>

      <Text style={[styles.section, { color: colors.ink }]}>Cash flow</Text>
      <CashFlowChart monthly={data.monthly} selected={month} onSelect={onSelectMonth} width={contentWidth} />

      <Text style={[styles.foot, { color: colors.ink3 }]}>
        Moving money between your own accounts isn't counted as expense or income.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  chipText: { fontSize: 14, fontWeight: '600' },
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  duo: { flexDirection: 'row', marginTop: 22 },
  duoCell: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  duoValue: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  kept: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginTop: spacing.lg },
  section: { fontSize: 20, fontWeight: '700', marginTop: 30, marginBottom: 6 },
  notes: { marginHorizontal: -spacing.xl, marginTop: spacing.sm },
  notesContent: { paddingHorizontal: spacing.xl, gap: 12 },
  note: { borderRadius: 20, padding: 16, gap: 12 },
  noteTitle: { fontSize: 17, fontWeight: '700' },
  noteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  groupIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', height: 20, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 8, marginBottom: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 30 },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
