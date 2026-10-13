import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { currentMonth, monthName, shiftMonth, today } from '../dates';
import { spendComparison } from '../insights';
import { getNetWorthTrend, getSpendTrend } from '../db';
import { formatMoney } from '../money';
import { fontSize, spacing, useColors } from '../theme';
import type { DaySpend } from '../types';
import { useData } from '../useData';
import { RunningTotalChart } from './Charts';
import { NetWorthChart } from './NetWorthChart';
import { Text } from './Text';

const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);

// The top of Home: two slides you swipe between, each a number, how it compares with last month, and its chart.
export function HomeHero({ total, hidden }: { total: number | undefined; hidden: boolean }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const netWorth = useData(getNetWorthTrend);
  const spend = useData(getSpendTrend);
  if (total === undefined || !netWorth || !spend) return null;

  const pageWidth = width - spacing.xl * 2;
  const month = currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const elapsed = Number(today().slice(8));
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));

  const netNow = netWorth.startMinor + sum(netWorth.daily.filter((d) => d.day <= elapsed));
  const netChange = netNow - netWorth.prevPointMinor;

  const spent = sum(spend.daily);
  const prevSamePoint = sum(spend.prevDaily.filter((d: DaySpend) => d.day <= elapsed));
  const spendChange = spendComparison(spent, prevSamePoint, true, prevMonth) && spent - prevSamePoint;

  // Spending up is bad (red), net worth up is good (green).
  function change(amount: number | null, upIsGood: boolean) {
    if (!amount) return <View style={styles.change} />;
    const color = amount > 0 === upIsGood ? colors.pos : colors.neg;
    const Arrow = amount > 0 ? ArrowUp : ArrowDown;
    return (
      <View style={styles.change}>
        <Arrow color={color} size={16} strokeWidth={2.4} />
        <Text style={{ color, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{mask(Math.abs(amount))} vs last month</Text>
      </View>
    );
  }

  const slides = [
    <>
      <Text style={{ color: colors.ink2, fontSize: fontSize.body }}>Total balance</Text>
      <Text style={[styles.big, { color: colors.ink }]}>{mask(total)}</Text>
      {change(netChange, true)}
      <NetWorthChart trend={netWorth} month={month} elapsed={elapsed} width={pageWidth} height={96} hidden={hidden} />
    </>,
    <>
      <Text style={{ color: colors.ink2, fontSize: fontSize.body }}>Spent in {monthName(month)}</Text>
      <Text style={[styles.big, { color: colors.ink }]}>{mask(spent)}</Text>
      {change(spendChange, false)}
      <RunningTotalChart
        daily={spend.daily}
        prevDaily={spend.prevDaily}
        month={month}
        prevMonth={prevMonth}
        elapsed={elapsed}
        width={pageWidth}
        height={96}
        hidden={hidden}
      />
    </>,
  ];

  return (
    <View style={{ marginTop: spacing.lg }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        contentContainerStyle={{ alignItems: 'flex-start' }}
      >
        {slides.map((slide, i) => <View key={i} style={{ width: pageWidth }}>{slide}</View>)}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? colors.ink : colors.fill2 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
