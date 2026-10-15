import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ChangeLine } from '../../src/components/ChangeLine';
import { CashFlowChart } from '../../src/components/Charts';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { InsightCards } from '../../src/components/InsightCards';
import { ListHeading } from '../../src/components/ListHeading';
import { MonthChips } from '../../src/components/MonthChips';
import { PressableScale } from '../../src/components/PressableScale';
import { Text } from '../../src/components/Text';
import { getInsights } from '../../src/db';
import { currentMonth, daysInMonth, monthName, today } from '../../src/dates';
import { biggestPriceRise, categoryUsual, creditStatus, dueText, forecast, keptPercent, runway, stillDue, usual, vsUsual, yearlyCost } from '../../src/insights';
import { formatMoney } from '../../src/money';
import { buildNotes } from '../../src/notes';
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

  // The group of smaller categories folds back up when you leave the tab or change month.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>
        {data && (
          <Body
            data={data}
            month={month}
            contentWidth={width - spacing.xl * 2}
            onSelectMonth={(m) => { setExpanded(false); setMonth(m); }}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((e) => !e)}
          />
        )}
      </FadeScrollView>
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
  const due = isCurrent ? stillDue(data.recurring, todayDate, month) : { bills: 0, income: 0 };
  const result = isCurrent
    ? forecast({ inSoFar: summary.in_minor, outSoFar: out, fixedPaid: recurringOut, due, elapsedDays: Number(todayDate.slice(8)), days: daysInMonth(month) })
    : { income: summary.in_minor, spend: out };
  const saved = result.income - result.spend;
  const rate = keptPercent(result.income, result.spend);
  const noIncome = result.income === 0;
  const heading = noIncome ? (isCurrent ? 'On track to spend' : 'Spent')
    : saved >= 0 ? (isCurrent ? 'On track to save' : 'Saved')
    : isCurrent ? 'On track to overspend by' : 'Overspent by';
  const incomeDiff = vsUsual(summary.in_minor, usualIncome, isCurrent);

  const fixed = recurringOut + due.bills;
  const fixedShare = result.income > 0 ? Math.round((fixed / result.income) * 100) : null;
  const subscriptions = data.recurring.filter((r) => r.active && r.type === 'expense' && r.category_name === 'Subscriptions');
  const rise = biggestPriceRise(data.recurring, data.recurringLogs);

  const notes = buildNotes({
    month, isCurrent, todayDate, spent: out, usualSpent, spending, usualByCategory, biggest: data.biggest,
    recurring: data.recurring, payday: data.payday, dayToDay: data.dayToDay, monthly: data.monthly,
  });

  const cards = data.accounts.filter((a) => a.type === 'credit' && a.limit_minor);
  const safety = isCurrent && usualSpent ? runway(data.accounts, usualSpent) : null;

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
          <Text style={{ color: colors.ink2, fontSize: 14 }}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>
          {diff !== null && (
            <ChangeLine up={diff > 0} good={diff < 0}>{`${formatMoney(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} your usual`}</ChangeLine>
          )}
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
      <CashFlowChart monthly={data.monthly} selected={month} onSelect={onSelectMonth} width={contentWidth} />
      <MonthChips selected={month} earliest={data.earliestMonth} onSelect={onSelectMonth} />

      <ListHeading>Did you live within your means?</ListHeading>
      <Text style={[styles.label, { color: colors.ink2 }]}>{heading}</Text>
      <Text style={[styles.big, { color: !noIncome && saved < 0 ? colors.neg : colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(noIncome ? result.spend : Math.abs(saved))}
      </Text>
      {noIncome && <Text style={[styles.line, { color: colors.ink2 }]}>No income logged{isCurrent ? ' yet' : ''} in {monthName(month)}.</Text>}
      {rate !== null && rate >= 0 && (usualRate !== null && rate !== usualRate
        ? <ChangeLine up={rate > usualRate} good={rate > usualRate}>{`${rate}% of income · your usual is ${usualRate}%`}</ChangeLine>
        : <Text style={[styles.line, { color: colors.ink2 }]}>{rate}% of income</Text>)}
      <View style={styles.details}>
        <Text style={[styles.small, { color: colors.ink2 }]}>
          {isCurrent ? 'So far: ' : ''}In {formatMoney(summary.in_minor)} · Out {formatMoney(out)}
        </Text>
        {(due.bills > 0 || due.income > 0) && (
          <Text style={[styles.small, { color: colors.ink2 }]}>
            {due.bills > 0 ? `${formatMoney(due.bills)} of bills still due this month` : ''}
            {due.bills > 0 && due.income > 0 ? ', ' : ''}
            {due.income > 0 ? `${formatMoney(due.income)} of income to come` : ''}
          </Text>
        )}
        {incomeDiff !== null && (
          <ChangeLine up={incomeDiff > 0} good={incomeDiff > 0}>{`Income ${formatMoney(Math.abs(incomeDiff))} ${incomeDiff > 0 ? 'above' : 'below'} your usual`}</ChangeLine>
        )}
        {income.length > 1 && (
          <Text style={[styles.small, { color: colors.ink2 }]}>
            {income.slice(0, 3).map((c) => `${c.name} ${percent(c.total_minor, summary.in_minor)}`).join(' · ')}
          </Text>
        )}
      </View>

      {(fixed > 0 || (isCurrent && (subscriptions.length > 0 || rise))) && (
        <>
          <ListHeading>What's already spoken for</ListHeading>
          {fixedShare !== null && fixed > 0 && (
            <>
              <Bar parts={[{ value: Math.min(fixed, result.income), color: colors.ink }, { value: Math.max(0, result.income - fixed), color: colors.fill2 }]} />
              <View style={styles.barLabels}>
                <Text style={[styles.small, { color: colors.ink }]}>Fixed {Math.min(100, fixedShare)}%</Text>
                <Text style={[styles.small, { color: colors.ink2 }]}>Flexible {Math.max(0, 100 - fixedShare)}%</Text>
              </View>
            </>
          )}
          {fixed > 0 && (
            <Text style={[styles.line, { color: colors.ink2 }]}>
              Bills and subscriptions {isCurrent ? 'take' : 'took'} {formatMoney(fixed)}
              {fixedShare === null ? '.' : fixedShare >= 100 ? ', more than your income.' : `, ${fixedShare}% of your income. ${isCurrent ? 'You choose' : 'You chose'} the rest.`}
            </Text>
          )}
          {isCurrent && subscriptions.length > 0 && (
            <Text style={[styles.line, { color: colors.ink }]}>
              {subscriptions.length} {subscriptions.length === 1 ? 'subscription' : 'subscriptions'} · {formatMoney(yearlyCost(subscriptions))} a year
            </Text>
          )}
          {isCurrent && rise && (
            <ChangeLine up good={false}>{`${rise.name} went up ${rise.percent}% since ${monthName(rise.since)}`}</ChangeLine>
          )}
        </>
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
        <Bar
          parts={[
            ...(expanded ? spending : top).map((c) => ({ value: c.total_minor, color: c.color })),
            ...(grouped && !expanded ? [{ value: restTotal, color: colors.ink3 }] : []),
          ]}
        />
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

      {safety && (
        <>
          <ListHeading>How long your money lasts</ListHeading>
          <Text style={[styles.big, { color: colors.ink }]}>{safety.months} {safety.months === 1 ? 'month' : 'months'}</Text>
          <Text style={[styles.line, { color: colors.ink2 }]}>
            What your accounts would cover at your usual spending of {formatMoney(usualSpent ?? 0)} a month.
          </Text>
          <StatRow label="Cash, bank and savings" value={formatMoney(safety.have)} />
          {safety.owed > 0 && <StatRow label="Owed on cards" value={`− ${formatMoney(safety.owed)}`} />}
          {cards.map((a) => {
            const status = creditStatus(-a.balance_minor, a.limit_minor ?? 0);
            const tint = status.state === 'ok' ? colors.ink2 : status.state === 'warn' ? colors.warn : colors.neg;
            const due = a.due_day ? dueText(a.due_day, todayDate) : '';
            return (
              <View key={a.id} style={styles.row}>
                <CategoryIcon name="💳" color={a.color} size={36} />
                <View style={styles.main}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
                  <Text style={{ color: tint, fontSize: 14 }}>{status.percent}% of limit used</Text>
                </View>
                {!!due && <Text style={{ color: colors.ink2, fontSize: 14 }}>{due.charAt(0).toUpperCase() + due.slice(1)}</Text>}
              </View>
            );
          })}
        </>
      )}

      <Text style={[styles.foot, { color: colors.ink3 }]}>
        Moving money between your own accounts isn't counted as expense or income.
      </Text>
    </>
  );
}

// A row of coloured segments sized by value, e.g. each category's share of spending.
function Bar({ parts }: { parts: { value: number; color: string }[] }) {
  return (
    <View style={styles.bar}>
      {parts.filter((p) => p.value > 0).map((p, i) => (
        <View key={i} style={{ flex: p.value, backgroundColor: p.color, minWidth: 3 }} />
      ))}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.line }]}>
      <Text style={{ color: colors.ink2, fontSize: 16 }}>{label}</Text>
      <Text style={[styles.rowTitle, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  label: { fontSize: 15, marginTop: 4 },
  big: { fontSize: 40, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
  line: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  small: { fontSize: 14, lineHeight: 20 },
  details: { gap: 4, marginTop: spacing.md },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 4 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  more: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  bar: { flexDirection: 'row', height: 20, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 8, marginBottom: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
