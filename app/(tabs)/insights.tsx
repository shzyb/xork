import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CashFlowChart, DailyCategoryChart, SplitBars } from '../../src/components/Charts';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ListHeading } from '../../src/components/ListHeading';
import { PickerSheet } from '../../src/components/PickerSheet';
import { PressableScale } from '../../src/components/PressableScale';
import { Text } from '../../src/components/Text';
import { currentPeriodKey, getEarliestMonth, getInsights, getYearInsights, periodDates } from '../../src/db';
import { monthLabel, shiftMonth, shortRange, today } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import type { CategorySpend } from '../../src/types';
import { useData } from '../../src/useData';

const TOP_COUNT = 5;

function percent(part: number, total: number) {
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
}

// Month or year. A month is one pay period; a year is its twelve periods named January to December.
export default function Insights() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(currentPeriodKey());
  const [year, setYear] = useState(currentPeriodKey().slice(0, 4));
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  const earliest = useData(getEarliestMonth);
  const monthData = useData(() => (scope === 'month' ? getInsights(month) : Promise.resolve(null)), [scope, month]);
  const yearData = useData(() => (scope === 'year' ? getYearInsights(year) : Promise.resolve(null)), [scope, year]);
  const contentWidth = width - spacing.xl * 2;

  // The group of smaller categories folds back up when you leave the tab or change period.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  const current = currentPeriodKey();
  const earliestYear = earliest ? earliest.slice(0, 4) : null;
  const canGoBack = scope === 'month' ? !!earliest && month > earliest : !!earliestYear && year > earliestYear;
  const canGoForward = scope === 'month' ? month < current : year < current.slice(0, 4);
  // Every month from this one back to the first transaction, newest first.
  const months = [current];
  while (earliest && shiftMonth(months[months.length - 1], -1) >= earliest) {
    months.push(shiftMonth(months[months.length - 1], -1));
  }

  function step(by: number) {
    setExpanded(false);
    if (scope === 'month') setMonth(shiftMonth(month, by));
    else setYear(String(Number(year) + by));
  }

  function switchScope(next: 'month' | 'year') {
    setExpanded(false);
    setScope(next);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>
        <View style={[styles.segment, { backgroundColor: colors.fill }]}>
          {(['month', 'year'] as const).map((s) => {
            const on = scope === s;
            return (
              <PressableScale
                key={s}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => switchScope(s)}
                style={[styles.segmentItem, on && { backgroundColor: colors.ink }]}
              >
                <Text style={[styles.segmentText, { color: on ? colors.bg : colors.ink2 }]}>{s === 'month' ? 'Month' : 'Year'}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.periodRow}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={scope === 'month' ? 'Previous month' : 'Previous year'}
            disabled={!canGoBack}
            onPress={() => step(-1)}
            style={styles.arrow}
          >
            <ChevronLeft color={canGoBack ? colors.ink : colors.ink3} size={24} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={scope === 'month' ? `Month: ${monthLabel(month)}. Choose another` : `Year ${year}`}
            disabled={scope === 'year'}
            onPress={() => setPicking(true)}
            style={styles.periodName}
          >
            <Text style={[styles.periodTitle, { color: colors.ink }]}>{scope === 'month' ? monthLabel(month) : year}</Text>
            <Text style={{ color: colors.ink2, fontSize: 13 }}>{scope === 'month' ? shortRange(periodDates(month)) : 'January to December'}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={scope === 'month' ? 'Next month' : 'Next year'}
            disabled={!canGoForward}
            onPress={() => step(1)}
            style={styles.arrow}
          >
            <ChevronRight color={canGoForward ? colors.ink : colors.ink3} size={24} />
          </PressableScale>
        </View>

      </View>
      <FadeScrollView contentContainerStyle={styles.content}>
        {scope === 'month' && monthData && (
          <>
            <SplitBars income={monthData.summary.in_minor} expense={monthData.summary.out_minor} previous={monthData.previous} comparedTo="last period" width={contentWidth} />
            {monthData.spending.length === 0 ? (
              <EmptyState Icon={Receipt} title="No expenses this month" text="Enter a transaction for this month to see it here." />
            ) : (
              <>
                <ListHeading>Daily expense</ListHeading>
                <DailyCategoryChart
                  byDay={monthData.byDay}
                  categories={monthData.spending}
                  month={month}
                  today={month === current ? Number(today().slice(8)) : null}
                  width={contentWidth}
                />
                <ListHeading>Top categories</ListHeading>
                <CategoryList
                  rows={monthData.spending}
                  out={monthData.summary.out_minor}
                  expanded={expanded}
                  onToggle={() => setExpanded((e) => !e)}
                  onOpen={(id) => router.push({ pathname: '/category-activity', params: { id: String(id), month } })}
                />
              </>
            )}
          </>
        )}

        {scope === 'year' && yearData && (
          <>
            <SplitBars income={yearData.summary.in_minor} expense={yearData.summary.out_minor} previous={yearData.previous} comparedTo="last year" width={contentWidth} />
            <ListHeading>Cashflow</ListHeading>
            <CashFlowChart monthly={yearData.monthly} selected="" width={contentWidth} />
            {yearData.spending.length === 0 ? (
              <EmptyState Icon={Receipt} title="No expenses this year" text="Enter a transaction in this year to see it here." />
            ) : (
              <>
                <ListHeading>Top categories</ListHeading>
                <CategoryList
                  rows={yearData.spending}
                  out={yearData.summary.out_minor}
                  expanded={expanded}
                  onToggle={() => setExpanded((e) => !e)}
                  onOpen={(id) => router.push({ pathname: '/category-activity', params: { id: String(id), year } })}
                />
              </>
            )}
          </>
        )}

        <Text style={[styles.foot, { color: colors.ink3 }]}>
          Moving money between your own accounts isn't counted as expense or income.
        </Text>
      </FadeScrollView>

      {picking && scope === 'month' && (
        <PickerSheet
          title="Month"
          options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          current={month}
          onPick={(m) => { setExpanded(false); setMonth(m); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </SafeAreaView>
  );
}

// The top categories, biggest first, as rows with the icon, a count or "Over budget", the amount and its share of spending.
// The first few show; "Show more" opens the rest. Tapping a row opens its transactions, when `onOpen` is given.
function CategoryList({ rows, out, expanded, onToggle, onOpen }: {
  rows: CategorySpend[];
  out: number;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: (id: number) => void;
}) {
  const colors = useColors();
  const grouped = rows.length > TOP_COUNT;
  const top = grouped ? rows.slice(0, TOP_COUNT) : rows;
  const rest = grouped ? rows.slice(TOP_COUNT) : [];
  const spendingRow = (c: CategorySpend) => (
    <PressableScale
      key={c.id}
      accessibilityRole="button"
      accessibilityLabel={`${c.name} transactions`}
      disabled={!onOpen}
      onPress={() => onOpen?.(c.id)}
      style={styles.row}
    >
      <CategoryIcon name={c.icon} color={c.color} size={36} />
      <View style={styles.main}>
        <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
        {c.budget_minor !== null && c.total_minor > c.budget_minor
          ? <Text style={{ color: colors.neg, fontSize: 14 }}>Over budget</Text>
          : <Text style={{ color: colors.ink2, fontSize: 14 }}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>}
      </View>
      <View style={styles.end}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(c.total_minor)}</Text>
        <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 2 }}>{percent(c.total_minor, out)}</Text>
      </View>
    </PressableScale>
  );
  return (
    <>
      {top.map((c) => spendingRow(c))}
      {expanded && rest.map((c) => spendingRow(c))}
      {grouped && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer categories' : `Show ${rest.length} more categories`}
          onPress={onToggle}
          style={[styles.more, { backgroundColor: colors.fill }]}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{expanded ? 'Show less' : 'Show more'}</Text>
        </PressableScale>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  segment: { flexDirection: 'row', borderRadius: 22, padding: 3, marginTop: spacing.md },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14.5, fontWeight: '600' },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  periodName: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  periodTitle: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  more: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
