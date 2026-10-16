import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ChangeLine } from '../../src/components/ChangeLine';
import { CashFlowChart, SavingsChart } from '../../src/components/Charts';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { InsightCards } from '../../src/components/InsightCards';
import { ListHeading } from '../../src/components/ListHeading';
import { PickerSheet } from '../../src/components/PickerSheet';
import { PressableScale } from '../../src/components/PressableScale';
import { Text } from '../../src/components/Text';
import { getInsights } from '../../src/db';
import { currentMonth, daysInMonth, monthLabel, monthName, monthShort, shiftMonth, today } from '../../src/dates';
import { biggestPriceRise, categoryUsual, creditStatus, dueByDay, dueText, forecast, keptPercent, runway, savingsPath, stillDue, usual, vsUsual, yearlyCost } from '../../src/insights';
import { formatMoney } from '../../src/money';
import { buildNotes } from '../../src/notes';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import type { InsightsData } from '../../src/types';
import { useData } from '../../src/useData';

const TOP_COUNT = 5;
const GAP = 12;

function percent(part: number, total: number) {
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
}

type Tile = { label: string; value: string; sub: string; subColor?: string };

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
  // Every month from this one back to the first transaction, newest first.
  const months = [currentMonth()];
  while (data?.earliestMonth && shiftMonth(months[months.length - 1], -1) >= data.earliestMonth) {
    months.push(shiftMonth(months[months.length - 1], -1));
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Month: ${monthLabel(month)}. Change`}
          onPress={() => setPicking(true)}
          style={[styles.chip, { backgroundColor: colors.btnBg }]}
        >
          <Text style={[styles.chipText, { color: colors.btnFg }]}>{monthLabel(month)}</Text>
          <ChevronDown color={colors.btnFg} size={15} strokeWidth={2.2} />
        </PressableScale>
        {data && (
          <Body
            data={data}
            month={month}
            contentWidth={width - spacing.xl * 2}
            onSelectMonth={selectMonth}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((e) => !e)}
          />
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

function Body({ data, month, contentWidth, onSelectMonth, expanded, onToggleExpanded }: {
  data: InsightsData;
  month: string;
  contentWidth: number;
  onSelectMonth: (month: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { summary, spending, income, recurringOut } = data;
  const out = summary.out_minor;
  const isCurrent = month === currentMonth();
  const todayDate = today();

  // Usual = the middle of the earlier months. Null until there are two of them.
  const usualSpent = usual(data.earlier.map((m) => m.out_minor));
  const usualIncome = usual(data.earlier.map((m) => m.in_minor));
  const usualRate = usual(data.earlier.filter((m) => m.in_minor > 0).map((m) => keptPercent(m.in_minor, m.out_minor) ?? 0));
  const usualByCategory = categoryUsual(data.earlierByCategory, data.earlierCategoryMonths);

  // A running month is judged on where it is heading; a finished one on what happened.
  const day = Number(todayDate.slice(8));
  const days = daysInMonth(month);
  const due = isCurrent ? stillDue(data.recurring, todayDate, month) : { bills: 0, income: 0 };
  const result = isCurrent
    ? forecast({ inSoFar: summary.in_minor, outSoFar: out, fixedPaid: recurringOut, due, elapsedDays: day, days })
    : { income: summary.in_minor, spend: out };
  const saved = result.income - result.spend;
  // The chart under it: what you've kept day by day, and for this month the days still to come, ending on the forecast.
  const path = savingsPath(data.dailyNet, days, isCurrent
    ? { today: day, due: dueByDay(data.recurring, todayDate, month), flexibleLeft: result.spend - due.bills - out }
    : undefined);
  const rate = keptPercent(result.income, result.spend);
  const noIncome = result.income === 0;
  // One word. For this month the amount is where it is heading; the dashed part of the chart shows that.
  const heading = noIncome ? 'Spending' : saved >= 0 ? 'Savings' : 'Overspent';

  const notes = buildNotes({
    month, isCurrent, todayDate, spent: out, usualSpent, spending, usualByCategory, biggest: data.biggest,
    recurring: data.recurring, payday: data.payday, dayToDay: data.dayToDay, monthly: data.monthly,
  });

  // The small facts, two to a row. Each shows only when it has something to say.
  const tiles: Tile[] = [];
  const fixed = recurringOut + due.bills;
  if (fixed > 0) {
    tiles.push(result.income > 0
      ? { label: 'Fixed costs', value: `${Math.round((fixed / result.income) * 100)}%`, sub: `of income, ${formatMoney(fixed)}` }
      : { label: 'Fixed costs', value: formatMoney(fixed), sub: 'bills and subscriptions' });
  }
  const safety = isCurrent && usualSpent ? runway(data.accounts, usualSpent) : null;
  if (safety) tiles.push({ label: 'Money lasts', value: `${safety.months} ${safety.months === 1 ? 'month' : 'months'}`, sub: 'at your usual spending' });
  if (due.bills > 0) tiles.push({ label: 'Bills still due', value: formatMoney(due.bills), sub: `by the end of ${monthName(month)}` });
  if (due.income > 0) tiles.push({ label: 'Income to come', value: formatMoney(due.income), sub: `by the end of ${monthName(month)}` });
  if (summary.in_minor > 0) {
    const diff = vsUsual(summary.in_minor, usualIncome, isCurrent);
    tiles.push({
      label: 'Income',
      value: formatMoney(summary.in_minor),
      sub: diff !== null ? `${formatMoney(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} usual`
        : income.length > 1 ? `${percent(income[0].total_minor, summary.in_minor)} from ${income[0].name}` : 'this month',
      subColor: diff === null ? undefined : diff > 0 ? colors.pos : colors.neg,
    });
  }
  const subscriptions = isCurrent ? data.recurring.filter((r) => r.active && r.type === 'expense' && r.category_name === 'Subscriptions') : [];
  if (subscriptions.length > 0) {
    tiles.push({ label: 'Subscriptions', value: formatMoney(yearlyCost(subscriptions)), sub: `a year for ${subscriptions.length}` });
  }
  const rise = isCurrent ? biggestPriceRise(data.recurring, data.recurringLogs) : null;
  if (rise) tiles.push({ label: 'Price rise', value: `+${rise.percent}%`, sub: `${rise.name} since ${monthShort(rise.since)}`, subColor: colors.neg });
  if (isCurrent) {
    for (const a of data.accounts) {
      if (a.type !== 'credit' || !a.limit_minor) continue;
      const status = creditStatus(-a.balance_minor, a.limit_minor);
      const payment = a.due_day ? dueText(a.due_day, todayDate) : 'of the limit used';
      tiles.push({
        label: a.name,
        value: `${status.percent}% used`,
        sub: payment.charAt(0).toUpperCase() + payment.slice(1),
        subColor: status.state === 'ok' ? undefined : status.state === 'warn' ? colors.warn : colors.neg,
      });
    }
  }

  const grouped = spending.length > TOP_COUNT;
  const top = grouped ? spending.slice(0, TOP_COUNT) : spending;
  const rest = grouped ? spending.slice(TOP_COUNT) : [];
  const restTotal = rest.reduce((sum, c) => sum + c.total_minor, 0);
  const open = (id: number) => router.push({ pathname: '/category-activity', params: { id: String(id), month } });

  const spendingRow = (c: InsightsData['spending'][number]): ReactNode => {
    const diff = vsUsual(c.total_minor, usualByCategory.get(c.id), isCurrent);
    return (
      <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} transactions`} onPress={() => open(c.id)} style={styles.row}>
        <CategoryIcon name={c.icon} color={c.color} size={36} />
        <View style={styles.main}>
          <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
          {diff === null
            ? <Text style={{ color: colors.ink2, fontSize: 14 }}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>
            : <ChangeLine up={diff > 0} good={diff < 0}>{`${formatMoney(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} usual`}</ChangeLine>}
        </View>
        <View style={styles.end}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(c.total_minor)}</Text>
          <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 2 }}>{percent(c.total_minor, out)}</Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <>
      <View style={styles.first}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Cashflow</Text>
        <Text style={[styles.sub, { color: colors.ink2 }]}>Last 6 months · tap a month to open it</Text>
        <CashFlowChart monthly={data.monthly} selected={month} onSelect={onSelectMonth} width={contentWidth} />
      </View>

      <View style={[styles.section, { borderTopColor: colors.line }]}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>{heading}</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.big, { color: !noIncome && saved < 0 ? colors.neg : colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(noIncome ? result.spend : Math.abs(saved))}
          </Text>
          {rate !== null && rate >= 0 && (usualRate !== null && rate !== usualRate
            ? <ChangeLine up={rate > usualRate} good={rate > usualRate}>{`${rate}% of income`}</ChangeLine>
            : <Text style={[styles.sub, { color: colors.ink2 }]}>{rate}% of income</Text>)}
        </View>
        <SavingsChart path={path} today={isCurrent ? day : null} width={contentWidth} />
        <View style={styles.split}>
          <Text style={[styles.sub, { color: colors.ink2 }]}>{isCurrent ? 'So far' : monthName(month)}</Text>
          <Text style={[styles.sub, { color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>
            In {formatMoney(summary.in_minor)} · Out {formatMoney(out)}
          </Text>
        </View>
      </View>

      {tiles.length > 0 && (
        <View style={styles.tiles}>
          {tiles.map((t, i) => (
            <View key={i} style={[styles.tile, { width: (contentWidth - GAP) / 2, backgroundColor: colors.fill }]}>
              <Text style={{ color: colors.ink2, fontSize: 13 }} numberOfLines={1}>{t.label}</Text>
              <Text style={[styles.tileValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
              <Text style={{ color: t.subColor ?? colors.ink2, fontSize: 13 }} numberOfLines={2}>{t.sub}</Text>
            </View>
          ))}
        </View>
      )}

      {notes.length > 0 && (
        <>
          <ListHeading>Worth a look</ListHeading>
          <InsightCards
            notes={notes}
            width={contentWidth}
            onOpen={(note) => {
              if (note.categoryId === undefined) return;
              if (note.budget === undefined) open(note.categoryId);
              else router.push({ pathname: '/category/[id]', params: { id: String(note.categoryId), budget: String(note.budget) } });
            }}
          />
        </>
      )}

      <ListHeading>Top categories</ListHeading>
      {spending.length > 0 && (
        <View style={styles.stack}>
          {(expanded ? spending : top).map((c) => (
            <View key={c.id} style={{ flex: c.total_minor, backgroundColor: c.color, minWidth: 3 }} />
          ))}
          {grouped && !expanded && <View style={{ flex: restTotal, backgroundColor: colors.ink3, minWidth: 3 }} />}
        </View>
      )}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  chip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, marginTop: 10 },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  // A section has no card around it, only a thin line above.
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.xl, paddingTop: spacing.lg },
  first: { marginTop: spacing.xl }, // the top section sits right under the month chip, so it has no line above

  sectionTitle: { fontSize: 17, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, marginTop: 4 },
  big: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  sub: { fontSize: 14 },
  split: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: spacing.xl },
  tile: { borderRadius: 20, padding: 16, gap: 2 },
  tileValue: { fontSize: 22, fontWeight: '700', marginVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  more: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  stack: { flexDirection: 'row', height: 20, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 8, marginBottom: 6 },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
