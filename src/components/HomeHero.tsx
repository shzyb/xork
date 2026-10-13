import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const AXIS = 44; // width of the chart's y-axis labels, which the wipe leaves alone
const FEATHER = 28; // the soft edge of the wipe

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
    Animated.timing(progress, { toValue: 1, duration: 300, easing: EASE_IN_OUT, useNativeDriver: false }).start();
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
  // On a switch the change line slides in from the side the new metric lives on, and the chart is wiped on from the left
  // (a cover in the screen colour slides off it). Neither plays on the first draw.
  const slide = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(1)).current;
  const firstDraw = useRef(true);
  // Before paint, so the new chart is never seen uncovered for a frame.
  useLayoutEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    if (isReduceMotion()) return;
    slide.setValue(0);
    reveal.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 220, delay: 40, easing: EASE_OUT, useNativeDriver: true }).start();
    Animated.timing(reveal, { toValue: 1, duration: 320, easing: EASE_IN_OUT, useNativeDriver: true }).start();
  }, [metric, slide, reveal]);
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

  const from = metric === 'expense' ? 16 : -16;
  const slideIn = { opacity: slide, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] };
  const cover = { transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, chartWidth - AXIS + FEATHER] }) }] };

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <CountUp value={amount} format={mask} style={[styles.big, { color: colors.ink }]} />
      <Animated.View style={[styles.change, slideIn]}>
        {!!change && (
          <>
            {change > 0 ? <ArrowUp color={colors.pos} size={16} strokeWidth={2.4} /> : <ArrowDown color={colors.neg} size={16} strokeWidth={2.4} />}
            <Text style={{ color: colors.ink2, opacity: 0.8, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{mask(Math.abs(change))} vs last month</Text>
          </>
        )}
      </Animated.View>
      <View style={styles.chart}>
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
        <Animated.View pointerEvents="none" style={[styles.cover, { backgroundColor: colors.bg }, cover]}>
          <LinearGradient colors={[`${colors.bg}00`, colors.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.feather} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
  cover: { position: 'absolute', top: 0, bottom: 0, left: AXIS, right: 0 },
  feather: { position: 'absolute', top: 0, bottom: 0, right: '100%', width: FEATHER },
  chart: { marginTop: spacing.lg }, // on top of the chart's own margin, for some breathing room
});
