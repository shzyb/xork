import { useRouter } from 'expo-router';
import { ArrowDown, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { RecurringRow } from '../../src/components/RecurringRow';
import { getRecurring } from '../../src/db';
import { prettyDate, today, upcomingOccurrences } from '../../src/dates';
import { formatMoney, monthlyMinor } from '../../src/money';
import { fontSize, spacing, useColors } from '../../src/theme';
import type { RecurringRow as RecurringItem } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

type Show = 'all' | 'subscriptions' | 'income';
const SHOW_LABELS: Record<Show, string> = { all: 'All', subscriptions: 'Subscriptions', income: 'Income' };
const isSubscription = (r: RecurringItem) => r.type === 'expense' && r.category_name === 'Subscriptions';

export default function Recurring() {
  const colors = useColors();
  const router = useRouter();
  const [show, setShow] = useState<Show>('all');
  const items = useData(getRecurring);

  const openNew = () => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } });
  const active = items?.filter((r) => r.active) ?? [];
  const monthly = (type: 'expense' | 'income') =>
    active.filter((r) => r.type === type).reduce((sum, r) => sum + monthlyMinor(r.amount_minor, r.freq), 0);
  const subscriptionsPerYear = active.filter(isSubscription).reduce((sum, r) => sum + monthlyMinor(r.amount_minor, r.freq), 0) * 12;
  const keep = (r: RecurringItem) => show === 'all' || (show === 'income' ? r.type === 'income' : isSubscription(r));
  const shown = items?.filter(keep) ?? [];
  const upcoming = items ? upcomingOccurrences(shown, today(), 30) : [];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.title, { color: colors.ink }]}>Recurring</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add recurring item" onPress={openNew} style={styles.iconButton}>
            <Plus color={colors.ink} size={24} />
          </Pressable>
        </View>

        {items && (
          <>
            <Text style={{ color: colors.ink2, fontSize: fontSize.body, marginTop: spacing.md }}>Goes out every month</Text>
            <Text style={[styles.big, { color: colors.ink }]}>{formatMoney(monthly('expense'))}</Text>
            <View style={styles.chips}>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <ArrowDown color={colors.pos} size={15} />
                <Text style={[styles.chipText, { color: colors.pos }]}>{formatMoney(monthly('income'))} comes in</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.fill }]}>
                <Repeat color={colors.ink2} size={15} />
                <Text style={[styles.chipText, { color: colors.ink }]}>Subscriptions {formatMoney(subscriptionsPerYear)}/yr</Text>
              </View>
            </View>

            <View style={[styles.tabs, { borderBottomColor: colors.line }]}>
              {(Object.keys(SHOW_LABELS) as Show[]).map((key) => (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: show === key }} onPress={() => setShow(key)}>
                  <Text style={[styles.tab, { color: show === key ? colors.ink : colors.ink3 }]}>{SHOW_LABELS[key]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.section, { color: colors.ink }]}>Next 30 days</Text>
            {upcoming.length === 0 ? (
              <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>Nothing scheduled in the next 30 days.</Text>
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

            <Text style={[styles.section, { color: colors.ink }]}>
              Everything scheduled <Text style={{ color: colors.ink3 }}>· {shown.length}</Text>
            </Text>
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nothing scheduled yet</Text>
                <Text style={{ color: colors.ink2, textAlign: 'center' }}>
                  Add rent, bills, subscriptions or your salary so you can see what's coming before it lands.
                </Text>
              </View>
            ) : shown.length === 0 ? (
              <Text style={{ color: colors.ink2, paddingVertical: spacing.md }}>Nothing here yet.</Text>
            ) : (
              shown.map((item) => <RecurringRow key={item.id} item={item} />)
            )}

            <View style={styles.footer}>
              <Button title="Add a recurring item" onPress={openNew} background={colors.btnBg} color={colors.btnFg} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
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
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  footer: { marginTop: spacing.xl },
});
