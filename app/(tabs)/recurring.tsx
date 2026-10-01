import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ArrowDown, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { RecurringRow } from '../../src/components/RecurringRow';
import { SwipePages } from '../../src/components/SwipePages';
import { getRecurring } from '../../src/db';
import { prettyDate, today, upcomingOccurrences } from '../../src/dates';
import { formatMoney, monthlyMinor } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Show = 'all' | 'expense' | 'income';
const SHOWS: Show[] = ['all', 'expense', 'income'];
const SHOW_LABELS: Record<Show, string> = { all: 'All', expense: 'Expenses', income: 'Income' };

export default function Recurring() {
  const colors = useColors();
  const router = useRouter();
  const [show, setShow] = useState<Show>('all');
  const items = useData(getRecurring);

  const openNew = () => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } });
  const active = items?.filter((r) => r.active) ?? [];
  const coming = upcomingOccurrences(active, today(), 30);
  const sumComing = (type: 'expense' | 'income') =>
    coming.filter((o) => o.item.type === type).reduce((sum, o) => sum + o.item.amount_minor, 0);
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((sum, r) => sum + monthlyMinor(r.amount_minor, r.freq), 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.title, { color: colors.ink }]}>Recurring</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add recurring item" onPress={openNew} style={styles.iconButton}>
            <Plus color={colors.ink} size={24} />
          </Pressable>
        </View>

        {items && items.length > 0 && (
          <>
            <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.md }}>Going out in the next 30 days</Text>
            <Text style={[styles.big, { color: colors.ink }]}>{formatMoney(sumComing('expense'))}</Text>
            <View style={styles.chips}>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <ArrowDown color={colors.pos} size={15} />
                <Text style={[styles.chipText, { color: colors.pos }]}>{formatMoney(sumComing('income'))} coming in</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <Repeat color={colors.ink2} size={15} />
                <Text style={[styles.chipText, { color: colors.ink }]}>About {formatMoney(monthlyOut)} a month</Text>
              </View>
            </View>
          </>
        )}

        {items && (
          <>
            <View style={[styles.tabs, { borderBottomColor: colors.line }]}>
              {SHOWS.map((key) => (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: show === key }} onPress={() => setShow(key)}>
                  <Text style={[styles.tab, { color: show === key ? colors.ink : colors.ink3 }]}>{SHOW_LABELS[key]}</Text>
                </Pressable>
              ))}
            </View>

            <SwipePages
              keys={SHOWS}
              active={show}
              onChange={setShow}
              renderPage={(key) => {
                const shown = items.filter((r) => key === 'all' || r.type === key);
                if (shown.length === 0) {
                  return (
                    <EmptyState
                      Icon={Repeat}
                      title={items.length === 0 ? 'Nothing scheduled yet' : key === 'income' ? 'No recurring income' : 'No recurring expenses'}
                      text={items.length === 0
                        ? "Add rent, bills, subscriptions or your salary so you can see what's coming before it lands."
                        : 'Tap + to add one.'}
                    />
                  );
                }
                const upcoming = upcomingOccurrences(shown, today(), 30);
                const later = shown.filter((r) => r.active && !upcoming.some((o) => o.item.id === r.id));
                const paused = shown.filter((r) => !r.active);
                return (
                  <>
                    <Text style={[styles.section, { color: colors.ink }]}>Coming up</Text>
                    {upcoming.length === 0 ? (
                      <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>Nothing due in the next 30 days.</Text>
                    ) : (
                      upcoming.map(({ item, date }, i) => (
                        <View key={`${item.id}-${date}`}>
                          {(i === 0 || upcoming[i - 1].date !== date) && (
                            <Text style={[styles.dateHead, { color: colors.ink2 }]}>{prettyDate(date)}</Text>
                          )}
                          <RecurringRow item={item} date={date} />
                        </View>
                      ))
                    )}

                    {later.length > 0 && (
                      <>
                        <Text style={[styles.section, { color: colors.ink }]}>Later</Text>
                        {later.map((item) => <RecurringRow key={item.id} item={item} />)}
                      </>
                    )}

                    {paused.length > 0 && (
                      <>
                        <Text style={[styles.section, { color: colors.ink }]}>Paused</Text>
                        {paused.map((item) => <RecurringRow key={item.id} item={item} />)}
                      </>
                    )}
                  </>
                );
              }}
            />
          </>
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  tabs: { flexDirection: 'row', gap: 14, marginTop: 26, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { fontSize: fontSize.body, fontWeight: '700' },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  section: { fontSize: 20, fontWeight: '700', marginTop: 24 },
  dateHead: { fontSize: 14, fontWeight: '600', paddingTop: 14, paddingBottom: 2 },
});
