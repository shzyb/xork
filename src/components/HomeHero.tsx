import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { currentMonth, shiftMonth, today } from '../dates';
import { getNetWorthTrend, getSpendTrend } from '../db';
import { formatMoney } from '../money';
import { fontSize, spacing, useColors } from '../theme';
import type { DaySpend, HomeMetric } from '../types';
import { useData } from '../useData';
import { RunningTotalChart } from './Charts';
import { NetWorthChart } from './NetWorthChart';
import { isReduceMotion } from './PressableScale';
import { Text } from './Text';

const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// An amount that counts from what it showed to its new value, so switching Balance and Expense reads as one number changing.
function CountUp({ value, format, style }: { value: number; format: (minor: number) => string; style: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    const from = shownRef.current;
    if (isReduceMotion() || from === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const progress = new Animated.Value(0);
    const id = progress.addListener(({ value: p }) => {
      shownRef.current = Math.round(from + (value - from) * p);
      setShown(shownRef.current);
    });
    Animated.timing(progress, { toValue: 1, duration: 450, easing: EASE_OUT, useNativeDriver: false }).start();
    return () => {
      progress.removeListener(id);
      progress.stopAnimation();
    };
  }, [value]);
  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{format(shown)}</Text>;
}

// The top of Home: the balance or this month's expense, how it compares with last month, and its chart.
export function HomeHero({ metric, total, hidden }: { metric: HomeMetric; total: number | undefined; hidden: boolean }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const netWorth = useData(getNetWorthTrend);
  const spend = useData(getSpendTrend);
  // The change line and the chart rise in each time the metric switches (not on the first draw).
  const enter = useRef(new Animated.Value(1)).current;
  const firstDraw = useRef(true);
  useEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    if (isReduceMotion()) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 400, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [metric, enter]);
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

  const rise = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <CountUp value={amount} format={mask} style={[styles.big, { color: colors.ink }]} />
      <Animated.View style={[styles.change, rise]}>
        {!!change && (
          <>
            {change > 0 ? <ArrowUp color={colors.pos} size={16} strokeWidth={2.4} /> : <ArrowDown color={colors.neg} size={16} strokeWidth={2.4} />}
            <Text style={{ color: colors.ink2, opacity: 0.8, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{mask(Math.abs(change))} vs last month</Text>
          </>
        )}
      </Animated.View>
      <Animated.View style={[styles.chart, rise]}>
        {metric === 'balance' ? (
          <NetWorthChart trend={netWorth} month={month} elapsed={elapsed} width={chartWidth} height={120} hidden={hidden} />
        ) : (
          <RunningTotalChart
            daily={spend.daily}
            prevDaily={spend.prevDaily}
            month={month}
            prevMonth={prevMonth}
            elapsed={elapsed}
            width={chartWidth}
            height={120}
            hidden={hidden}
            legend={false}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
  chart: { marginTop: spacing.lg }, // on top of the chart's own margin, for some breathing room
});
