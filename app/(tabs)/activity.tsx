import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TransactionList } from '../../src/components/TransactionList';
import { getTransactions, getTransactionTotals } from '../../src/db';
import { currentMonth, monthLabel, shiftMonth } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { fontSize, spacing, useColors } from '../../src/theme';
import type { TransactionFilter } from '../../src/types';
import { useData } from '../../src/useData';

const PAGE = 100;
const TYPES: { key: TransactionFilter['type']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfers' },
];

export default function Activity() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionFilter['type']>('all');
  const [month, setMonth] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const filter: TransactionFilter = { search, type, month };
  const rows = useData(() => getTransactions(filter, limit), [search, type, month, limit]);
  const totals = useData(() => getTransactionTotals(filter), [search, type, month]);
  const filtered = search.trim() !== '' || type !== 'all' || month !== null;

  function change(update: () => void) {
    update();
    setLimit(PAGE);
  }

  function clearFilters() {
    change(() => {
      setSearch('');
      setType('all');
      setMonth(null);
    });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.ink }]}>Activity</Text>

        <View style={[styles.filters, { backgroundColor: colors.bg }]}>
          <View style={[styles.search, { backgroundColor: colors.fill }]}>
            <Search color={colors.ink2} size={18} />
            <TextInput
              value={search}
              onChangeText={(text) => change(() => setSearch(text))}
              placeholder="Search"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Search"
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.ink }]}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {TYPES.map((t) => (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t.key }}
                onPress={() => change(() => setType(t.key))}
                style={[styles.chip, { backgroundColor: type === t.key ? colors.btnBg : colors.fill }]}
              >
                <Text style={[styles.chipText, { color: type === t.key ? colors.btnFg : colors.ink }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => change(() => setMonth(shiftMonth(month ?? currentMonth(), -1)))}
              style={[styles.arrow, { backgroundColor: colors.fill }]}
            >
              <ChevronLeft color={colors.ink} size={18} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={month ? 'Show all time' : 'Show this month'}
              onPress={() => change(() => setMonth(month ? null : currentMonth()))}
              style={styles.monthLabel}
            >
              <Text style={[styles.chipText, { color: colors.ink }]}>{month ? monthLabel(month) : 'All time'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => change(() => setMonth(shiftMonth(month ?? currentMonth(), 1)))}
              style={[styles.arrow, { backgroundColor: colors.fill }]}
            >
              <ChevronRight color={colors.ink} size={18} />
            </Pressable>
          </View>
        </View>

        <View>
          {rows && totals && (rows.length === 0 ? (
            filtered ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>Your filters returned no results</Text>
                <Pressable accessibilityRole="button" onPress={clearFilters} style={[styles.pill, { backgroundColor: colors.fill }]}>
                  <Text style={[styles.chipText, { color: colors.ink }]}>Clear filters</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>No transactions yet</Text>
                <Text style={{ color: colors.ink2 }}>Everything you log shows up here, newest first.</Text>
              </View>
            )
          ) : (
            <>
              <Text style={[styles.summary, { color: colors.ink2 }]}>
                {totals.count} transaction{totals.count === 1 ? '' : 's'}  ·  Out{' '}
                <Text style={{ color: colors.ink, fontWeight: '700' }}>{formatMoney(totals.out_minor)}</Text>  ·  In{' '}
                <Text style={{ color: colors.pos, fontWeight: '700' }}>{formatMoney(totals.in_minor)}</Text>
              </Text>
              <TransactionList rows={rows} />
              {totals.count > rows.length && (
                <View style={styles.empty}>
                  <Pressable accessibilityRole="button" onPress={() => setLimit(limit + PAGE)} style={[styles.pill, { backgroundColor: colors.fill }]}>
                    <Text style={[styles.chipText, { color: colors.ink }]}>Show more</Text>
                  </Pressable>
                </View>
              )}
            </>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  filters: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, borderRadius: 12, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontSize: fontSize.body, padding: 0 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingTop: 10 },
  chip: { height: 34, paddingHorizontal: 13, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { fontSize: 14, paddingTop: 10 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
