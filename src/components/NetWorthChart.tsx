import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { daysInMonth, monthName } from '../dates';
import { netWorthSeries } from '../insights';
import { compactMoney, formatMoney } from '../money';
import { useColors } from '../theme';
import type { NetWorthTrend } from '../types';
import { LegendItem, niceTop } from './Charts';
import { Text } from './Text';

const TIP = 110; // width of the touch tooltip

// Total balance through this month, one line up to today. The y-axis starts near the lowest point, not at zero,
// so a small change still shows. The library only draws from zero, so the line is shifted down by `base`
// and the axis labels add it back. Touch and drag to read a day.
export function NetWorthChart({ trend, month, elapsed, width, height, hidden }: {
  trend: NetWorthTrend;
  month: string;
  elapsed: number;
  width: number;
  height: number;
  hidden: boolean; // balances are hidden: no amounts on the axis or in the tooltip
}) {
  const colors = useColors();
  const money = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const days = daysInMonth(month);
  // Reaches the last day with a transaction, so one dated ahead of today still draws.
  const lastDay = Math.max(elapsed, ...trend.daily.map((d) => d.day));
  const series = netWorthSeries(trend.startMinor, trend.daily, lastDay);

  const low = Math.min(...series);
  const high = Math.max(...series);
  const stepMinor = (niceTop(Math.max(high - low, 10000)) / 3) * 100;
  const base = Math.floor(low / stepMinor) * stepMinor;
  const top = niceTop(Math.max(high - base, stepMinor));

  const chartWidth = width - 56;
  const edge = 8; // room so the dot on the last day and the first day isn't cut off
  const gap = (chartWidth - edge * 2) / (days - 1);

  return (
    <View style={styles.chartBox}>
      <LineChart
        data={series.map((value, i) => ({ value: (value - base) / 100, hideDataPoint: i !== series.length - 1 }))}
        color1={colors.ink}
        thickness1={3}
        hideDataPoints={false}
        dataPointsColor1={colors.ink}
        dataPointsRadius1={5}
        curved
        width={chartWidth}
        height={height}
        initialSpacing={edge}
        endSpacing={edge}
        spacing={gap}
        noOfSections={3}
        maxValue={top}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => {
          if (hidden) return '•••';
          const minor = Math.round(Number(label) * 100 + base);
          return (minor < 0 ? '-' : '') + compactMoney(minor);
        }}
        disableScroll
        pointerConfig={{
          hidePointer1: true,
          pointerStripColor: colors.ink3,
          pointerLabelWidth: TIP,
          pointerLabelHeight: 48,
          autoAdjustPointerLabelPosition: false,
          shiftPointerLabelY: TIP / 2 - 4,
          pointerLabelComponent: (_items: unknown, _secondary: unknown, index: number) => {
            const x = edge + index * gap; // where the line is, from the start of the lines
            const origin = x - 6; // where the library puts the left edge of the label
            const offset = Math.min(Math.max(-TIP / 2 + 6, -origin), chartWidth - TIP - origin);
            return (
              <View style={[styles.tooltip, { backgroundColor: colors.btnBg, width: TIP, marginLeft: offset }]}>
                <Text style={{ color: colors.btnFg, fontWeight: '700', fontSize: 12.5 }}>Day {index + 1}</Text>
                <Text style={{ color: colors.btnFg, fontSize: 12.5 }}>{money(series[Math.min(index, series.length - 1)])}</Text>
              </View>
            );
          },
        }}
      />
      <View style={{ height: 18, marginLeft: 44, marginTop: 6 }}>
        {[1, 8, 15, 22, 29].map((day) => (
          <Text key={day} style={{ position: 'absolute', left: edge + (day - 1) * gap - 14, width: 28, textAlign: 'center', color: colors.ink3, fontSize: 11 }}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <LegendItem color={colors.ink} label={`Net worth in ${monthName(month)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartBox: { marginTop: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  tooltip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, gap: 1 },
});
