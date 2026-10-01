import { ArrowDown, ArrowUp, Gauge, Repeat, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react-native';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CashFlowChart, RunningTotalChart } from '../../src/components/Charts';
import { StatTile } from '../../src/components/StatTile';
import { getInsights } from '../../src/db';
import { currentMonth, daysInMonth, lastMonths, monthName, monthShort, shiftMonth, today } from '../../src/dates';
import { budgetStatus, buildNotes, creditStatus, delta, dueText, keptPercent, spendComparison } from '../../src/insights';
import type { Note } from '../../src/insights';
import { formatMoney } from '../../src/money';
import { fontSize, spacing, useColors } from '../../src/theme';
import type { CardInsight, InsightsData } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

const NOTE_ICONS: Record<Note['icon'], LucideIcon> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  gauge: Gauge,
  repeat: Repeat,
  'triangle-alert': TriangleAlert,
};

export default function Insights() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(currentMonth());
  const [showAll, setShowAll] = useState(false);
  const data = useData(() => getInsights(month), [month]);

  const isCurrent = month === currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const elapsed = isCurrent ? Number(today().slice(8)) : undefined;
  const contentWidth = width - spacing.xl * 2;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Insights</Text>

        {data && (
          <Body
            data={data}
            month={month}
            prevMonth={prevMonth}
            isCurrent={isCurrent}
            elapsed={elapsed}
            contentWidth={contentWidth}
            showAll={showAll}
            onToggleAll={() => setShowAll(!showAll)}
            onSelectMonth={setMonth}
          />
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

function Body({ data, month, prevMonth, isCurrent, elapsed, contentWidth, showAll, onToggleAll, onSelectMonth }: {
  data: InsightsData;
  month: string;
  prevMonth: string;
  isCurrent: boolean;
  elapsed: number | undefined;
  contentWidth: number;
  showAll: boolean;
  onToggleAll: () => void;
  onSelectMonth: (month: string) => void;
}) {
  const colors = useColors();
  const { summary, prevSummary, spending, prevSpending, income, recurringOut } = data;
  const out = summary.out_minor;
  const prevSamePointOut = prevSpending.reduce((sum, c) => sum + c.total_minor, 0);
  const comparison = spendComparison(out, prevSamePointOut, isCurrent, prevMonth);
  const kept = keptPercent(summary.in_minor, out);
  const notes = buildNotes({
    month, prevMonth, isCurrent, elapsedDays: elapsed ?? 1, spent: out, prevFullSpent: prevSummary.out_minor,
    recurringOut, spending, prevSpending,
  });
  const shown = showAll ? spending : spending.slice(0, 6);

  return (
    <>
      <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.lg }}>
        You spent in {monthName(month)}{isCurrent ? ' so far' : ''}
      </Text>
      <Text style={[styles.big, { color: colors.ink }]}>{formatMoney(out)}</Text>
      <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 6 }}>
        {comparison ? comparison.text : 'Nothing to compare with last month yet'}
      </Text>

      <RunningTotalChart data={data} month={month} prevMonth={prevMonth} elapsed={elapsed} width={contentWidth} />
      <MonthChips selected={month} earliest={data.earliestMonth} onSelect={onSelectMonth} />

      <View style={styles.duo}>
        <View style={styles.duoCell}>
          <Text style={{ color: colors.ink2, fontSize: 14 }}>Money in</Text>
          <Text style={[styles.duoValue, { color: colors.pos }]}>{formatMoney(summary.in_minor)}</Text>
        </View>
        <View style={[styles.duoCell, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.fill2 }]}>
          <Text style={{ color: colors.ink2, fontSize: 14 }}>Left over</Text>
          <Text style={[styles.duoValue, { color: colors.ink }]}>{formatMoney(summary.in_minor - out)}</Text>
        </View>
      </View>
      <View style={[styles.kept, { borderColor: colors.fill2 }]}>
        <Text style={{ color: colors.ink2, fontSize: 15 }}>
          {kept === null ? 'No income logged this month' : (
            <>You kept <Text style={{ color: colors.ink, fontWeight: '700' }}>{kept}%</Text> of what came in</>
          )}
        </Text>
      </View>

      {notes.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>What stood out</Text>
          {notes.map((note, i) => {
            const Icon = NOTE_ICONS[note.icon];
            return (
              <View key={i} style={styles.note}>
                <View style={[styles.noteIcon, { backgroundColor: note.color }]}>
                  <Icon color="#FFFFFF" size={17} strokeWidth={2.2} />
                </View>
                <Text style={[styles.noteText, { color: colors.ink }]}>
                  {note.segments.map((s, j) => (
                    <Text key={j} style={s.bold ? { fontWeight: '700' } : undefined}>{s.text}</Text>
                  ))}
                </Text>
              </View>
            );
          })}
        </>
      )}

      <View style={styles.sectionHead}>
        <Text style={[styles.section, { color: colors.ink, marginTop: 0 }]}>Where it went</Text>
        <Text style={{ color: colors.ink2, fontSize: 13.5 }}>
          vs {isCurrent ? 'same point in ' : ''}{monthShort(prevMonth)}
        </Text>
      </View>
      {spending.length === 0 ? (
        <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>No spending logged in {monthName(month)}.</Text>
      ) : (
        <>
          <View style={styles.stack}>
            {spending.map((c) => (
              <View key={c.id} style={{ flex: c.total_minor, backgroundColor: c.color, minWidth: 3 }} />
            ))}
          </View>
          {shown.map((c) => {
            const change = delta(c.total_minor, prevSpending.find((p) => p.id === c.id)?.total_minor ?? 0);
            const budget = c.budget_minor ? budgetStatus(c.total_minor, c.budget_minor) : null;
            return (
              <View key={c.id}>
                <View style={styles.row}>
                  <CategoryIcon name={c.icon} color={c.color} size={36} />
                  <View style={styles.main}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={{ color: colors.ink2, fontSize: 14 }}>{Math.round((c.total_minor / out) * 100)}% of spending</Text>
                  </View>
                  <View style={styles.end}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(c.total_minor)}</Text>
                    {change && (
                      <View style={styles.delta}>
                        {change.kind === 'up' && <ArrowUp color={colors.neg} size={12} strokeWidth={2.6} />}
                        {change.kind === 'down' && <ArrowDown color={colors.pos} size={12} strokeWidth={2.6} />}
                        <Text style={[styles.deltaText, { color: change.kind === 'up' ? colors.neg : change.kind === 'down' ? colors.pos : colors.ink2 }]}>
                          {change.kind === 'new' ? 'New' : change.kind === 'same' ? '≈ same' : `${change.percent}%`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {budget && (
                  <View style={styles.budget}>
                    <View style={[styles.meter, { backgroundColor: colors.fill }]}>
                      <View
                        style={{
                          width: `${Math.min(100, budget.percent)}%`,
                          height: '100%',
                          borderRadius: 3,
                          backgroundColor: budget.state === 'over' ? colors.neg : budget.state === 'warn' ? colors.warn : colors.ink,
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.ink2, fontSize: 12.5, marginTop: 4 }}>{budget.text}</Text>
                  </View>
                )}
              </View>
            );
          })}
          {spending.length > 6 && (
            <Pressable accessibilityRole="button" onPress={onToggleAll} style={[styles.pill, { backgroundColor: colors.fill }]}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{showAll ? 'Show top 6' : `Show all ${spending.length} categories`}</Text>
            </Pressable>
          )}
        </>
      )}

      {income.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>Where money came from</Text>
          {income.map((c) => (
            <View key={c.id} style={styles.row}>
              <CategoryIcon name={c.icon} color={c.color} size={36} />
              <View style={styles.main}>
                <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
                <Text style={{ color: colors.ink2, fontSize: 14 }}>{Math.round((c.total_minor / summary.in_minor) * 100)}% of income</Text>
              </View>
              <Text style={[styles.rowTitle, { color: colors.pos }]}>+ {formatMoney(c.total_minor)}</Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.tiles}>
        <StatTile label="Daily average" value={formatMoney(Math.round(out / (elapsed ?? daysInMonth(month))))}
          sub={prevSummary.out_minor > 0 ? `${formatMoney(Math.round(prevSummary.out_minor / daysInMonth(prevMonth)))} in ${monthShort(prevMonth)}` : 'Per day so far'} />
        <StatTile label="Savings rate" value={kept === null ? '–' : `${kept}%`} sub={kept === null ? 'No income logged' : 'Of income kept'} />
        <StatTile label="Biggest expense" value={data.biggest ? formatMoney(data.biggest.amount_minor) : '–'} sub={data.biggest?.label ?? 'Nothing yet'} />
        <StatTile label="No-spend days" value={String(Math.max(0, (elapsed ?? daysInMonth(month)) - data.spendDays))} sub={`Of ${elapsed ?? daysInMonth(month)} days, bills aside`} />
      </View>

      <Text style={[styles.section, { color: colors.ink }]}>Cash flow</Text>
      <CashFlowChart monthly={data.monthly} selected={month} onSelect={onSelectMonth} width={contentWidth} />

      {data.cards.length > 0 && <CreditCards cards={data.cards} month={month} />}

      <Text style={[styles.foot, { color: colors.ink3 }]}>
        Moving money between your own accounts isn't counted as spending or income.
      </Text>
    </>
  );
}

// One panel per credit card, with chips to switch when there is more than one. Owed and limit are right now;
// spent and paid follow the month picked above.
function CreditCards({ cards, month }: { cards: CardInsight[]; month: string }) {
  const colors = useColors();
  const [selectedId, setSelectedId] = useState(cards[0].id);
  const card = cards.find((c) => c.id === selectedId) ?? cards[0];
  const status = card.limit_minor ? creditStatus(card.owed_minor, card.limit_minor) : null;
  const tint = status?.state === 'warn' ? colors.warn : status && status.state !== 'ok' ? colors.neg : colors.ink;
  return (
    <>
      <Text style={[styles.section, { color: colors.ink }]}>{cards.length > 1 ? 'Credit cards' : 'Credit card'}</Text>
      {cards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardChips}>
          {cards.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: c.id === card.id }}
              onPress={() => setSelectedId(c.id)}
              style={[styles.cardChip, { backgroundColor: c.id === card.id ? colors.fill : 'transparent' }]}
            >
              <Text style={[styles.chipText, { color: c.id === card.id ? colors.ink : colors.ink3 }]} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.sectionHead}>
        <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{card.name}</Text>
        {status && <Text style={{ color: tint, fontSize: 14, fontWeight: '700' }}>{status.percent}% used</Text>}
      </View>
      {status && (
        <View style={[styles.meter, { backgroundColor: colors.fill }]}>
          <View style={{ width: `${Math.min(100, status.percent)}%`, height: '100%', borderRadius: 3, backgroundColor: tint }} />
        </View>
      )}
      {card.due_day && (
        <Text style={{ color: colors.ink2, fontSize: 14, marginTop: 8 }}>Payment {dueText(card.due_day, today())}</Text>
      )}
      <View style={[styles.tiles, { marginTop: 14 }]}>
        <StatTile label="Owed now" value={formatMoney(card.owed_minor)} sub={card.limit_minor ? `Limit ${formatMoney(card.limit_minor)}` : 'No limit set'} />
        {status && <StatTile label="Available" value={formatMoney(status.left)} sub={status.state === 'full' ? 'At the limit' : 'Left to spend'} />}
        <StatTile label={`Spent in ${monthName(month)}`} value={formatMoney(card.spent_minor)} sub="On this card" />
        <StatTile label={`Paid in ${monthName(month)}`} value={formatMoney(card.paid_minor)} sub="Into this card" />
      </View>
    </>
  );
}

// The last six months as chips under the chart. Months before your first transaction are disabled.
function MonthChips({ selected, earliest, onSelect }: {
  selected: string;
  earliest: string | null;
  onSelect: (month: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {lastMonths(currentMonth(), 6).map((m) => {
        const on = m === selected;
        const disabled = earliest === null ? m !== currentMonth() : m < earliest;
        return (
          <View key={m} style={[styles.chipHit, disabled && { opacity: 0.35 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={monthName(m)}
              accessibilityState={{ selected: on, disabled }}
              disabled={disabled}
              onPress={() => onSelect(m)}
              style={[styles.chip, { backgroundColor: on ? colors.fill : 'transparent' }]}
            >
              <Text style={[styles.chipText, { color: on ? colors.ink : colors.ink3 }]}>{monthShort(m)}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  chips: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  chipHit: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: { minWidth: 48, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  chipText: { fontSize: 14, fontWeight: '600' },
  cardChips: { gap: 6 },
  cardChip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', maxWidth: 200 },
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  duo: { flexDirection: 'row', marginTop: 22 },
  duoCell: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  duoValue: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  kept: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginTop: spacing.lg },
  section: { fontSize: 20, fontWeight: '700', marginTop: 30, marginBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 30, marginBottom: 6 },
  note: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 8 },
  noteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, fontSize: 15.5, lineHeight: 22, paddingTop: 6 },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  deltaText: { fontSize: 12.5, fontWeight: '700' },
  budget: { marginLeft: 50, marginTop: -6, marginBottom: 8 },
  meter: { height: 5, borderRadius: 3, overflow: 'hidden' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 30 },
  pill: { height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  foot: { fontSize: 12.5, lineHeight: 19, marginTop: 26 },
});
