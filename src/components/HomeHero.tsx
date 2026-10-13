import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { currentMonth, shiftMonth, today } from '../dates';
import { getNetWorthTrend, getSpendTrend } from '../db';
import { formatMoney } from '../money';
import { fontSize, spacing, useColors } from '../theme';
import type { DaySpend, HomeMetric } from '../types';
import { useData } from '../useData';
import { RunningTotalChart } from './Charts';
import { NetWorthChart } from './NetWorthChart';
import { Text } from './Text';

const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);

// The top of Home: the balance or this month's expense, how it compares with last month, and its chart.
export function HomeHero({ metric, total, hidden }: { metric: HomeMetric; total: number | undefined; hidden: boolean }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const netWorth = useData(getNetWorthTrend);
  const spend = useData(getSpendTrend);
  if (total === undefined || !netWorth || !spend) return null;

  const chartWidth = width - spacing.xl * 2;
  const month = currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const elapsed = Number(today().slice(8));
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));

  // This month so far against the same point last month. Null when there is nothing to compare with.
  let amount = total;
  let change: number | null = null;
  if (metric === 'balance') {
    change = netWorth.startMinor + sum(netWorth.daily.filter((d) => d.day <= elapsed)) - netWorth.prevPointMinor;
  } else {
    amount = sum(spend.daily);
    const prevSamePoint = sum(spend.prevDaily.filter((d: DaySpend) => d.day <= elapsed));
    if (prevSamePoint > 0) change = amount - prevSamePoint;
  }

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Text style={[styles.big, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{mask(amount)}</Text>
      <View style={styles.change}>
        {!!change && (
          <>
            {change > 0 ? <ArrowUp color={colors.ink2} size={16} strokeWidth={2.4} /> : <ArrowDown color={colors.ink2} size={16} strokeWidth={2.4} />}
            <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{mask(Math.abs(change))} vs last month</Text>
          </>
        )}
      </View>
      <View style={styles.chart}>
        {metric === 'balance' ? (
          <NetWorthChart trend={netWorth} month={month} elapsed={elapsed} width={chartWidth} height={96} hidden={hidden} />
        ) : (
          <RunningTotalChart
            daily={spend.daily}
            prevDaily={spend.prevDaily}
            month={month}
            prevMonth={prevMonth}
            elapsed={elapsed}
            width={chartWidth}
            height={96}
            hidden={hidden}
            legend={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
  chart: { marginTop: spacing.lg }, // on top of the chart's own margin, for some breathing room
});
