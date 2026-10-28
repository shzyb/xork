import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { daysInMonth, monthName, monthShort, prettyDate } from '../dates';
import { dayParts, runningTotal } from '../insights';
import { compactMoney, formatMoney } from '../money';
import { spacing, useColors } from '../theme';
import type { CategorySpend, DaySpend, InsightsData } from '../types';
import { Text } from './Text';

// The top of the y-axis for a biggest value in minor units: rounded up so the three sections get round numbers.
export function niceTop(maxMinor: number): number {
  const rawStep = maxMinor / 100 / 3;
  const unit = 10 ** Math.floor(Math.log10(rawStep));
  return Math.ceil(rawStep / unit) * unit * 3;
}

const TIP = 130; // width of the touch tooltip
const PLOT = 160; // the bars' area in the bar charts: their height of 150 plus the 10 the library adds above it
const BAR_TIP = 150; // the same for the bar charts, whose rows carry a category name

// The whole month on the x-axis: last month dashed in full, this month solid up to today with a dot at the end.
// Last month is the first line because the chart takes its day labels from it. Touch and drag to read a day.
export function RunningTotalChart({ daily, prevDaily, month, prevMonth, elapsed, width, height, hidden, legend }: {
  daily: DaySpend[];
  prevDaily: DaySpend[];
  month: string;
  prevMonth: string;
  elapsed: number | undefined;
  width: number;
  height: number;
  hidden: boolean; // balances are hidden: no amounts on the axis or in the tooltip
  legend: boolean; // names the two lines under the chart
}) {
  const colors = useColors();
  const money = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  const days = Math.max(daysInMonth(month), daysInMonth(prevMonth));
  // Reaches the last day with spending, so a transaction dated ahead of today still draws.
  const lastDay = Math.max(elapsed ?? 0, ...daily.map((d) => d.day));
  const current = runningTotal(daily, elapsed === undefined ? daysInMonth(month) : lastDay);
  // What was spent on one day of this month (not the running total), for the touch tooltip.
  const daySpend = (day: number) => daily.find((d) => d.day === day)?.total_minor ?? 0;
  const previous = runningTotal(prevDaily, days);
  // No spending yet: keep the empty plane (grid and day labels) but draw no lines, dots, Y labels or touch tooltip.
  const empty = current[current.length - 1] === 0 && previous[days - 1] === 0;

  // The library sizes the y-axis from the first line only, so give it the bigger of the two months, rounded up.
  const top = niceTop(empty ? 10000 : Math.max(current[current.length - 1], previous[days - 1]));

  const chartWidth = width - 56;
  const edge = 8; // room so the dot on the last day and the first day isn't cut off
  const gap = (chartWidth - edge * 2) / (days - 1);

  return (
    <View style={styles.chartBox}>
      <LineChart
        data={previous.map((value) => ({ value: value / 100 }))}
        data2={current.map((value, i) => ({ value: value / 100, hideDataPoint: i !== current.length - 1 }))}
        color1={empty ? 'transparent' : colors.ink3}
        color2={empty ? 'transparent' : colors.ink}
        thickness1={2}
        thickness2={3}
        strokeDashArray1={[6, 5]}
        hideDataPoints1
        hideDataPoints2={empty}
        dataPointsColor2={colors.ink}
        dataPointsRadius2={5}
        width={chartWidth}
        height={height}
        initialSpacing={edge}
        endSpacing={edge}
        spacing={gap}
        noOfSections={3}
        maxValue={top}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.line}
        xAxisType="dashed"
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => (hidden ? '•••' : compactMoney(Number(label) * 100))}
        disableScroll
        // The library parks a marker on each line, and on a day with no data yet (after today) it leaves this month's
        // marker stranded at its last position. The strip and tooltip already show both values, so no markers.
        // Nothing to touch on an empty plane, so no pointer at all.
        pointerConfig={empty ? undefined : {
          hidePointer1: true,
          hidePointer2: true,
          pointerStripColor: colors.ink3,
          pointerColor: colors.ink,
          radius: 4,
          // The library only places the label next to the touch point on its own. Pinned to the top instead:
          // it sits at a fixed height, and the label centres itself on the line, kept inside the chart.
          pointerLabelWidth: TIP,
          pointerLabelHeight: 64,
          autoAdjustPointerLabelPosition: false,
          shiftPointerLabelY: TIP / 2 - 4,
          pointerLabelComponent: (_items: unknown, _secondary: unknown, index: number) => {
            const x = edge + index * gap; // where the line is, from the start of the lines
            const origin = x - 6; // where the library puts the left edge of the label
            const offset = Math.min(Math.max(-TIP / 2 + 6, -origin), chartWidth - TIP - origin);
            return (
              <View style={[styles.tooltip, { backgroundColor: colors.btnBg, width: TIP, marginLeft: offset }]}>
                <Text style={{ color: colors.btnFg, fontWeight: '700', fontSize: 12.5 }}>Day {index + 1}</Text>
                {index < current.length && (
                  <Text style={{ color: colors.btnFg, fontSize: 12.5 }}>Expense {money(daySpend(index + 1))}</Text>
                )}
                {index < current.length && (
                  <Text style={{ color: colors.btnFg, fontSize: 12.5 }}>{monthShort(month)} {money(current[index])}</Text>
                )}
                <Text style={{ color: colors.btnFg, fontSize: 12.5, opacity: 0.7 }}>
                  {monthShort(prevMonth)} {money(previous[index])}
                </Text>
              </View>
            );
          },
        }}
      />
      <View style={{ height: 18, marginLeft: 44, marginTop: 0 }}>
        {[1, 8, 15, 22, 29].map((day) => (
          <Text key={day} style={{ position: 'absolute', left: edge + (day - 1) * gap - 14, width: 28, textAlign: 'center', color: colors.ink3, fontSize: 11 }}>
            {day}
          </Text>
        ))}
      </View>
      {legend && (
        <View style={styles.legend}>
          <LegendItem color={colors.ink} label={monthName(month)} />
          <LegendItem color={colors.ink3} label={monthName(prevMonth)} dashed />
        </View>
      )}
    </View>
  );
}

// Money in (green) and out (red) for the last six months. The colours say which is which, so there is no legend.
// The selected month is highlighted. Touching a bar shows that month's income and expense under the chart; it doesn't change the month.
export function CashFlowChart({ monthly, selected, width }: {
  monthly: InsightsData['monthly'];
  selected: string;
  width: number;
}) {
  const colors = useColors();
  const [touched, setTouched] = useState<number | null>(null);
  const chartWidth = width - 56;
  const barWidth = 14;
  const gap = 4;
  const group = chartWidth / monthly.length;
  const between = group - (barWidth * 2 + gap);
  const biggest = Math.max(...monthly.flatMap((m) => [m.in_minor, m.out_minor]));
  // No money yet: keep the empty plane (axis and month labels) with no bars and no touch tooltip.
  const empty = biggest === 0;
  const top = niceTop(empty ? 10000 : biggest);

  const bars = monthly.flatMap((m, i) => {
    const on = m.month === selected;
    const press = (bar: number) => () => setTouched(touched === bar ? null : bar);
    return [
      {
        value: m.in_minor / 100,
        frontColor: colors.pos,
        opacity: on ? 1 : 0.35,
        spacing: gap,
        label: monthShort(m.month),
        labelWidth: group,
        labelTextStyle: { color: on ? colors.ink : colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular', textAlign: 'center' as const, marginLeft: -(group - barWidth * 2 - gap) / 2 },
        onPress: press(i * 2),
      },
      { value: m.out_minor / 100, frontColor: colors.neg, opacity: on ? 1 : 0.35, spacing: between, onPress: press(i * 2 + 1) },
    ];
  });

  return (
    <View style={styles.chartBox}>
      <BarChart
        data={bars}
        barWidth={barWidth}
        barBorderRadius={3}
        width={chartWidth}
        height={150}
        initialSpacing={between / 2}
        endSpacing={0}
        noOfSections={3}
        maxValue={top}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => compactMoney(Number(label) * 100)}
        disableScroll
      />
      {touched !== null && !empty && (
        <ChartTip
          x={group * Math.floor(touched / 2) + between / 2 + barWidth / 2 + (touched % 2) * (barWidth + gap)}
          barHeight={(((touched % 2 ? monthly[touched >> 1].out_minor : monthly[touched >> 1].in_minor) / 100) / top) * PLOT}
          lines={3}
          chartWidth={chartWidth}
        >
          <Text style={{ color: colors.btnFg, fontWeight: '700', fontSize: 12.5 }}>{monthName(monthly[touched >> 1].month)}</Text>
          <TipRow color={colors.pos} label="Income" value={formatMoney(monthly[touched >> 1].in_minor)} />
          <TipRow color={colors.neg} label="Expense" value={formatMoney(monthly[touched >> 1].out_minor)} />
        </ChartTip>
      )}
    </View>
  );
}

// Spending for every day of the month, one bar per day, split into coloured blocks by category (see dayParts).
// A few huge days (rent) would flatten all the others, so the axis stops at about the 90th percentile and a bar taller
// than that is cut short with a small arrow; touching it still shows the real amounts. Touch a bar to read the day.
export function DailyCategoryChart({ byDay, categories, month, today, width }: {
  byDay: InsightsData['byDay'];
  categories: CategorySpend[];
  month: string;
  today: number | null; // the day of the month it is now, for a month that is still running
  width: number;
}) {
  const colors = useColors();
  const [touched, setTouched] = useState<number | null>(null);
  const days = daysInMonth(month);
  const parts = dayParts(byDay, days);
  const totals = parts.map((p) => p.reduce((sum, x) => sum + x.total_minor, 0));
  if (totals.every((t) => t === 0)) return null;

  const sorted = totals.filter((t) => t > 0).sort((a, b) => a - b);
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  const top = niceTop(Math.min(sorted[sorted.length - 1], p90 * 1.25));
  const chartWidth = width - 56;
  const edge = 4;
  const slot = (chartWidth - edge * 2) / days;
  const barWidth = Math.max(3, Math.floor(slot * 0.7));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const colorOf = (id: number | null) => (id === null ? colors.ink3 : byId.get(id)?.color ?? colors.ink3);

  const data = parts.map((day, i) => {
    const cut = totals[i] > top * 100;
    const scale = cut ? (top * 100) / totals[i] : 1;
    return {
      stacks: day.length > 0
        ? day.map((x, j) => ({ value: (x.total_minor * scale) / 100, color: colorOf(x.category_id), marginBottom: j > 0 ? 2 : 0, borderRadius: 2 }))
        : [{ value: top * 0.03, color: colors.fill }], // a short grey bar on a day with no spending
      spacing: slot - barWidth,
      onPress: () => setTouched(touched === i ? null : i),
      topLabelComponent: cut ? () => <Text style={{ color: colors.ink3, fontSize: 9, textAlign: 'center', width: 12 }}>▲</Text> : undefined,
    };
  });
  const labels = [1, 8, 15, 22, 29].filter((d) => d <= days && (today === null || Math.abs(d - today) > 2));
  if (today !== null) labels.push(today);

  return (
    <View style={styles.chartBox}>
      <BarChart
        stackData={data}
        barWidth={barWidth}
        barBorderRadius={2}
        width={chartWidth}
        height={150}
        initialSpacing={edge + (slot - barWidth) / 2}
        endSpacing={0}
        noOfSections={3}
        maxValue={top}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={colors.line}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 11, fontFamily: 'OpenRunde-Regular' }}
        yAxisLabelWidth={44}
        formatYLabel={(label) => compactMoney(Number(label) * 100)}
        disableScroll
      />
      <View style={{ height: 18, marginLeft: 44 }}>
        {labels.map((day) => (
          <Text
            key={day}
            style={{ position: 'absolute', left: edge + (day - 0.5) * slot - 14, width: 28, textAlign: 'center', fontSize: 11, color: day === today ? colors.ink : colors.ink3, fontWeight: day === today ? '700' : '400' }}
          >
            {day}
          </Text>
        ))}
      </View>
      {touched !== null && touched < days && (
        <ChartTip
          x={edge + (touched + 0.5) * slot}
          barHeight={(Math.min(totals[touched], top * 100) / (top * 100)) * PLOT}
          lines={2 + parts[touched].length}
          chartWidth={chartWidth}
        >
          <Text style={{ color: colors.btnFg, fontWeight: '700', fontSize: 12.5 }}>
            {prettyDate(`${month}-${String(touched + 1).padStart(2, '0')}`)}
          </Text>
          {parts[touched].length === 0 && <Text style={{ color: colors.btnFg, opacity: 0.7, fontSize: 12.5 }}>No spending</Text>}
          {parts[touched].map((x) => (
            <TipRow key={x.category_id ?? 'other'} color={colorOf(x.category_id)} label={x.category_id === null ? 'Other' : byId.get(x.category_id)?.name ?? ''} value={formatMoney(x.total_minor)} />
          ))}
          {parts[touched].length > 1 && <TipRow label="Total" value={formatMoney(totals[touched])} bold />}
        </ChartTip>
      )}
    </View>
  );
}

// The popup for a touched bar, on the chart like the one on Home's line chart. It sits just above the bar, centred on it
// and kept inside the chart. `x` is the bar's centre across the chart (without the y-axis labels), `barHeight` how tall
// the bar is, and `lines` how many lines the popup has, so a tall bar can't push it off the top of the chart.
function ChartTip({ x, barHeight, lines, chartWidth, children }: {
  x: number;
  barHeight: number;
  lines: number;
  chartWidth: number;
  children: ReactNode;
}) {
  const colors = useColors();
  const left = 44 + Math.min(Math.max(4, x - BAR_TIP / 2), chartWidth - BAR_TIP - 4); // 44 = the y-axis labels
  const above = Math.min(barHeight + 6, Math.max(0, PLOT - (lines * 17 + 12)));
  return (
    <View pointerEvents="none" style={[styles.tipArea, { paddingBottom: above }]}>
      <View style={[styles.tooltip, { marginLeft: left, width: BAR_TIP, backgroundColor: colors.btnBg }]}>{children}</View>
    </View>
  );
}

function TipRow({ color, label, value, bold }: { color?: string; label: string; value: string; bold?: boolean }) {
  const colors = useColors();
  const text = { color: colors.btnFg, fontSize: 12.5, fontWeight: bold ? ('700' as const) : ('400' as const) };
  return (
    <View style={styles.panelRow}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color ?? 'transparent' }} />
      <Text style={[text, { flex: 1 }]} numberOfLines={1}>{label}</Text>
      <Text style={text}>{value}</Text>
    </View>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
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
  tipArea: { position: 'absolute', top: 0, left: 0, right: 0, height: PLOT, justifyContent: 'flex-end' },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
