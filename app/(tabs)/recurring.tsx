import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ArrowDown, Plus, Repeat } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { RecurringRow } from '../../src/components/RecurringRow';
import { getRecurring } from '../../src/db';
import { today, upcomingOccurrences } from '../../src/dates';
import { formatMoney, monthlyMinor } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

export default function Recurring() {
  const colors = useColors();
  const router = useRouter();
  const items = useData(getRecurring);

  const openNew = () => router.push({ pathname: '/recurring/[id]', params: { id: 'new' } });
  const active = items?.filter((r) => r.active) ?? [];
  const coming = upcomingOccurrences(active, today(), 30);
  const sumComing = (type: 'expense' | 'income') =>
    coming.filter((o) => o.item.type === type).reduce((sum, o) => sum + o.item.amount_minor, 0);
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((sum, r) => sum + monthlyMinor(r.amount_minor, r.freq), 0);
  // One list: active items first by next date, paused items last.
  const list = items ? [...items].sort((a, b) =>
    a.active !== b.active ? (a.active ? -1 : 1) : a.next_date.localeCompare(b.next_date)) : [];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.title, { color: colors.ink }]}>Recurring</Text>
          <PressableScale accessibilityRole="button" accessibilityLabel="Add recurring item" onPress={openNew} style={styles.iconButton}>
            <Plus color={colors.ink} size={24} />
          </PressableScale>
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
          items.length === 0 ? (
            <EmptyState
              Icon={Repeat}
              title="Nothing scheduled yet"
              text="Add rent, bills, subscriptions or your salary so you can see what's coming before it lands."
            />
          ) : (
            <View style={styles.list}>
              {list.map((item) => <RecurringRow key={item.id} item={item} />)}
            </View>
          )
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
  chipText: { fontSize: 13.5, fontWeight: '600' },
  list: { marginTop: 26 },
});
