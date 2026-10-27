import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CashFlowChart, DailyCategoryChart } from '../../src/components/Charts';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ListHeading } from '../../src/components/ListHeading';
import { PickerSheet } from '../../src/components/PickerSheet';
import { PressableScale } from '../../src/components/PressableScale';
import { Bone, RowBones } from '../../src/components/Skeleton';
import { Text } from '../../src/components/Text';
import { getInsights } from '../../src/db';
import { currentMonth, monthLabel, monthName, shiftMonth, today } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import type { InsightsData } from '../../src/types';
import { useData } from '../../src/useData';

const TOP_COUNT = 5;

function percent(part: number, total: number) {
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
}

export default function Insights() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(currentMonth());
  const data = useData(() => getInsights(month), [month]);
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);

  // The group of smaller categories folds back up when you leave the tab or change month.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  const selectMonth = (m: string) => { setExpanded(false); setMonth(m); };
  const canGoBack = !!data?.earliestMonth && month > data.earliestMonth;
  const canGoForward = month < currentMonth();
  // Every month from this one back to the first transaction, newest first.
  const months = [currentMonth()];
  while (data?.earliestMonth && shiftMonth(months[months.length - 1], -1) >= data.earliestMonth) {
    months.push(shiftMonth(months[months.length - 1], -1));
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>
        <View style={styles.monthRow}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            disabled={!canGoBack}
            onPress={() => selectMonth(shiftMonth(month, -1))}
            style={[styles.arrow, !canGoBack && { opacity: 0.3 }]}
          >
            <ChevronLeft color={colors.ink} size={24} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Month: ${monthLabel(month)}. Choose another`}
            onPress={() => setPicking(true)}
            style={styles.monthName}
          >
            <Text style={[styles.monthText, { color: colors.ink }]}>{monthLabel(month)}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={!canGoForward}
            onPress={() => selectMonth(shiftMonth(month, 1))}
            style={[styles.arrow, !canGoForward && { opacity: 0.3 }]}
          >
            <ChevronRight color={colors.ink} size={24} />
          </PressableScale>
        </View>
        {data ? (
          <Body
            data={data}
            month={month}
            contentWidth={width - spacing.xl * 2}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((e) => !e)}
          />
        ) : (
          <Loading />
        )}
      </FadeScrollView>
      {picking && (
        <PickerSheet
          title="Month"
          options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          current={month}
          onPick={(m) => { selectMonth(m); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </SafeAreaView>
  );
}

function Body({ data, month, contentWidth, expanded, onToggleExpanded }: {
  data: InsightsData;
  month: string;
  contentWidth: number;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { summary, spending } = data;
  const out = summary.out_minor;
  const saved = summary.in_minor - out;
  const noIncome = summary.in_minor === 0;
  const isCurrent = month === currentMonth();

  // The three amounts share one font size, small enough for the longest of them to fit in half the width.
  const incomeText = formatMoney(summary.in_minor);
  const expenseText = formatMoney(out);
  const savedText = noIncome ? '—' : formatMoney(saved);
  const longest = Math.max(incomeText.length, expenseText.length, savedText.length);
  const size = longest <= 12 ? 26 : longest <= 15 ? 22 : 18;

  const grouped = spending.length > TOP_COUNT;
  const top = grouped ? spending.slice(0, TOP_COUNT) : spending;
  const rest = grouped ? spending.slice(TOP_COUNT) : [];
  const open = (id: number) => router.push({ pathname: '/category-activity', params: { id: String(id), month } });

  const spendingRow = (c: InsightsData['spending'][number]) => (
    <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} transactions`} onPress={() => open(c.id)} style={styles.row}>
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
      <View style={styles.totals}>
        <Total label="Income" value={incomeText} size={size} half />
        <Total label="Expense" value={expenseText} size={size} half />
        <Total label="Saved" value={savedText} size={size} />
      </View>

      <CashFlowChart monthly={data.monthly} selected={month} width={contentWidth} />

      <ListHeading>Monthly Spending</ListHeading>
      <DailyCategoryChart
        byDay={data.byDay}
        categories={spending}
        month={month}
        today={isCurrent ? Number(today().slice(8)) : null}
        width={contentWidth}
      />

      <ListHeading>Top categories</ListHeading>
      {spending.length === 0 && (
        <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>No expenses in {monthName(month)}.</Text>
      )}
      {top.map((c) => spendingRow(c))}
      {expanded && rest.map((c) => spendingRow(c))}
      {grouped && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer categories' : `Show ${rest.length} more categories`}
          onPress={onToggleExpanded}
          style={[styles.more, { backgroundColor: colors.fill }]}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{expanded ? 'Show less' : 'Show more'}</Text>
        </PressableScale>
      )}

      <Text style={[styles.foot, { color: colors.ink3 }]}>
        Moving money between your own accounts isn't counted as expense or income.
      </Text>
    </>
  );
}

// Grey blocks where the totals, the two charts and the category rows will be.
function Loading() {
  return (
    <>
      <View style={styles.totals}>
        <Bone width="47%" height={52} style={{ flexGrow: 1 }} />
        <Bone width="47%" height={52} style={{ flexGrow: 1 }} />
        <Bone width="100%" height={52} />
      </View>
      <Bone width="100%" height={190} radius={14} style={{ marginTop: spacing.lg }} />
      <ListHeading>Monthly Spending</ListHeading>
      <Bone width="100%" height={190} radius={14} style={{ marginTop: spacing.lg }} />
      <ListHeading>Top categories</ListHeading>
      <RowBones count={5} />
    </>
  );
}

function Total({ label, value, size, half }: { label: string; value: string; size: number; half?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.total, half && styles.half]}>
      <Text style={{ color: colors.ink2, fontSize: 13 }}>{label}</Text>
      <Text style={[styles.totalValue, { color: colors.ink, fontSize: size }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthName: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 17, fontWeight: '600' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: spacing.lg, marginTop: spacing.lg },
  total: { width: '100%', gap: 2 },
  half: { width: '47%', flexGrow: 1 },
  totalValue: { fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  more: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
