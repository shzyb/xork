import { StyleSheet, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { monthName, monthShort } from '../dates';
import { chartDays, runningTotal } from '../insights';
import { compactMoney, formatMoney } from '../money';
import { spacing, useColors } from '../theme';
import type { InsightsData } from '../types';
import { Text } from './Text';

// This month's running total by day, with the same days of last month dashed behind it. Touch and drag to read a day.
export function RunningTotalChart({ data, month, prevMonth, elapsed, width }: {
  data: InsightsData;
  month: string;
  prevMonth: string;
  elapsed: number | undefined;
  width: number;
}) {
  const colors = useColors();
  const days = chartDays(month, elapsed);
  const current = runningTotal(data.daily, days);
  const previous = runningTotal(data.prevDaily, days);
  if (current[days - 1] === 0 && previous[days - 1] === 0) return null;

  const point = (value: number, i: number) => ({ value: value / 100, label: i % 7 === 0 ? String(i + 1) : '' });
  const chartWidth = width - 56;

  return (
    <View style={styles.chartBox}>
      <LineChart
        data={current.map(point)}
        data2={previous.map(point)}
        color1={colors.ink}
        color2={colors.ink3}
        thickness1={3}
        thickness2={2}
        strokeDashArray2={[6, 5]}
        hideDataPoints
        curved
        width={chartWidth}
        height={170}
        initialSpacing={0}
        endSpacing={0}
        spacing={chartWidth / Math.max(days - 1, 1)}
        noOfSections={3}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        xAxisLabelTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => compactMoney(Number(label) * 100)}
        disableScroll
        pointerConfig={{
          pointerStripColor: colors.ink3,
          pointerColor: colors.ink,
          radius: 4,
          pointerLabelWidth: 150,
          pointerLabelHeight: 64,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (items: { value: number }[], _secondary: unknown, index: number) => (
            <View style={[styles.tooltip, { backgroundColor: colors.btnBg }]}>
              <Text style={{ color: colors.btnFg, fontWeight: '700', fontSize: 12.5 }}>Day {index + 1}</Text>
              <Text style={{ color: colors.btnFg, fontSize: 12.5 }}>{monthShort(month)} {formatMoney(Math.round(items[0].value * 100))}</Text>
              <Text style={{ color: colors.btnFg, fontSize: 12.5, opacity: 0.7 }}>
                {monthShort(prevMonth)} {formatMoney(Math.round((items[1]?.value ?? 0) * 100))}
              </Text>
            </View>
          ),
        }}
      />
      <View style={styles.legend}>
        <LegendItem color={colors.ink} label={monthName(month)} />
        <LegendItem color={colors.ink3} label={monthName(prevMonth)} dashed />
        <Text style={{ color: colors.ink2, fontSize: 12.5 }}>Running total by day</Text>
      </View>
    </View>
  );
}

// Money in (green) and out for the last six months. Tap a month to open it.
export function CashFlowChart({ monthly, selected, onSelect, width }: {
  monthly: InsightsData['monthly'];
  selected: string;
  onSelect: (month: string) => void;
  width: number;
}) {
  const colors = useColors();
  const chartWidth = width - 56;
  const barWidth = 14;
  const gap = 4;
  const group = chartWidth / monthly.length;
  const between = group - (barWidth * 2 + gap);
  const chosen = monthly.find((m) => m.month === selected);

  const bars = monthly.flatMap((m) => {
    const on = m.month === selected;
    const press = () => onSelect(m.month);
    return [
      {
        value: m.in_minor / 100,
        frontColor: colors.pos,
        opacity: on ? 1 : 0.35,
        spacing: gap,
        label: monthShort(m.month),
        labelWidth: group,
        labelTextStyle: { color: on ? colors.ink : colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular', textAlign: 'center' as const, marginLeft: -(group - barWidth * 2 - gap) / 2 },
        onPress: press,
      },
      { value: m.out_minor / 100, frontColor: colors.ink, opacity: on ? 1 : 0.35, spacing: between, onPress: press },
    ];
  });

  return (
    <View style={styles.chartBox}>
      <BarChart
        data={bars}
        barWidth={barWidth}
        barBorderRadius={7}
        width={chartWidth}
        height={150}
        initialSpacing={between / 2}
        endSpacing={0}
        noOfSections={3}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => compactMoney(Number(label) * 100)}
        disableScroll
      />
      <View style={styles.legend}>
        <LegendItem color={colors.pos} label="Money in" />
        <LegendItem color={colors.ink} label="Money out" />
      </View>
      {chosen && (
        <Text style={{ color: colors.ink2, fontSize: 13.5, marginTop: 6 }}>
          {monthShort(chosen.month)}: in {formatMoney(chosen.in_minor)}, out {formatMoney(chosen.out_minor)}
        </Text>
      )}
    </View>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.legendItem}>
      {dashed ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ width: 4, height: 2, backgroundColor: color }} />)}
        </View>
      ) : (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      )}
      <Text style={{ color: colors.ink2, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chartBox: { marginTop: spacing.lg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, gap: 1 },
});
