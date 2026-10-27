import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { currentMonth, shiftMonth, today } from '../dates';
import { formatMoney } from '../money';
import { fontSize, spacing, useColors } from '../theme';
import type { DaySpend } from '../types';
import { ChangeLine } from './ChangeLine';
import { RunningTotalChart } from './Charts';
import { Bone } from './Skeleton';
import { Text } from './Text';

const sum = (rows: { total_minor: number }[]) => rows.reduce((n, r) => n + r.total_minor, 0);

// The top of Home: this month's expense so far, how it compares with the same point last month, and its chart.
// Until the data arrives it shows grey blocks of about the same size, so nothing below it jumps when the chart appears.
export function HomeHero({ spend, hidden }: { spend: { daily: DaySpend[]; prevDaily: DaySpend[] } | undefined; hidden: boolean }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  if (!spend) {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <Bone width={190} height={fontSize.big - 8} radius={14} style={{ alignSelf: 'center' }} />
        <Bone width={140} height={16} style={{ alignSelf: 'center', marginTop: 8 }} />
        <Bone width="100%" height={158} radius={14} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  const month = currentMonth();
  const elapsed = Number(today().slice(8));
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const amount = sum(spend.daily);
  const lastMonthSoFar = sum(spend.prevDaily.filter((d) => d.day <= elapsed));
  const change = lastMonthSoFar > 0 ? amount - lastMonthSoFar : null;

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <Text style={[styles.big, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{mask(amount)}</Text>
      <View style={styles.change}>
        {!!change && <ChangeLine up={change > 0} good={change < 0}>{`${mask(Math.abs(change))} vs last month`}</ChangeLine>}
      </View>
      <RunningTotalChart
        daily={spend.daily}
        prevDaily={spend.prevDaily}
        month={month}
        prevMonth={shiftMonth(month, -1)}
        elapsed={elapsed}
        width={width - spacing.xl * 2}
        height={120}
        hidden={hidden}
        legend={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
});
