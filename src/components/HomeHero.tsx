import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { currentMonth, shiftMonth, today } from '../dates';
import { spendComparison } from '../insights';
import { getIncomeTrend, getNetWorthTrend, getSpendTrend } from '../db';
import { formatMoney } from '../money';
import { fontSize, spacing, useColors } from '../theme';
import type { DaySpend, HomeMetric } from '../types';
import { useData } from '../useData';
import { RunningTotalChart } from './Charts';
import { NetWorthChart } from './NetWorthChart';
import { Text } from './Text';

const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);

// The top of Home: this month's balance, expense or income, how it compares with last month, and its chart.
export function HomeHero({ metric, total, hidden }: { metric: HomeMetric; total: number | undefined; hidden: boolean }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const netWorth = useData(getNetWorthTrend);
  const spend = useData(getSpendTrend);
  const income = useData(getIncomeTrend);
  if (total === undefined || !netWorth || !spend || !income) return null;

  const chartWidth = width - spacing.xl * 2;
  const month = currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const elapsed = Number(today().slice(8));
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));

  // This month so far against the same point last month. Null when there is nothing to compare with.
  let amount = total;
  let change: number | null = null;
  const flow = metric === 'expense' ? spend : income;
  if (metric === 'balance') {
    change = netWorth.startMinor + sum(netWorth.daily.filter((d) => d.day <= elapsed)) - netWorth.prevPointMinor;
  } else {
    amount = sum(flow.daily);
    const prevSamePoint = sum(flow.prevDaily.filter((d: DaySpend) => d.day <= elapsed));
    change = spendComparison(amount, prevSamePoint, true, prevMonth) && amount - prevSamePoint;
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[styles.big, { color: colors.ink }]}>{mask(amount)}</Text>
      <View style={styles.change}>
        {!!change && (
          <>
            {change > 0 ? <ArrowUp color={colors.ink2} size={16} strokeWidth={2.4} /> : <ArrowDown color={colors.ink2} size={16} strokeWidth={2.4} />}
            <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{mask(Math.abs(change))} vs last month</Text>
          </>
        )}
      </View>
      {metric === 'balance' ? (
        <NetWorthChart trend={netWorth} month={month} elapsed={elapsed} width={chartWidth} height={96} hidden={hidden} />
      ) : (
        <RunningTotalChart
          daily={flow.daily}
          prevDaily={flow.prevDaily}
          month={month}
          prevMonth={prevMonth}
          elapsed={elapsed}
          width={chartWidth}
          height={96}
          hidden={hidden}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
});
