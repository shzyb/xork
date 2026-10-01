import { ChevronDown, Receipt, Search, SearchX, X } from 'lucide-react-native';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { EmptyState } from '../../src/components/EmptyState';
import { PickerSheet } from '../../src/components/PickerSheet';
import type { PickerOption } from '../../src/components/PickerSheet';
import { TransactionList } from '../../src/components/TransactionList';
import {
  getAccountsWithBalance, getCategories, getTransactionMonths, getTransactions, getTransactionTotals, NO_FILTER,
} from '../../src/db';
import { monthLabel } from '../../src/dates';
import { fabClearance, fontSize, spacing, tabBarHeight, useColors } from '../../src/theme';
import type { TransactionFilter } from '../../src/types';
import { useData } from '../../src/useData';
import { Text, TextInput } from '../../src/components/Text';

const PAGE = 100;
type FilterKey = 'type' | 'month' | 'category' | 'account';
const TYPE_LABELS = { all: 'Everything', expense: 'Expenses', income: 'Income', transfer: 'Transfers' };

export default function Activity() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<TransactionFilter>(NO_FILTER);
  const [limit, setLimit] = useState(PAGE);
  const [picker, setPicker] = useState<FilterKey | null>(null);
  const rows = useData(() => getTransactions(filter, limit), [filter, limit]);
  const totals = useData(() => getTransactionTotals(filter), [filter]);
  const categories = useData(getCategories);
  const accounts = useData(getAccountsWithBalance);
  const months = useData(getTransactionMonths);

  const { search, type, month, categoryId, accountId } = filter;
  const filtered = search.trim() !== '' || type !== 'all' || month !== null || categoryId !== null || accountId !== null;
  const chipsOn = type !== 'all' || month !== null || categoryId !== null || accountId !== null;

  function change(update: Partial<TransactionFilter>) {
    setFilter({ ...filter, ...update });
    setLimit(PAGE);
  }

  const chips: { key: FilterKey; label: string; on: boolean; clear: () => void }[] = [
    { key: 'type', label: type === 'all' ? 'Type' : TYPE_LABELS[type], on: type !== 'all', clear: () => change({ type: 'all' }) },
    { key: 'month', label: month ? monthLabel(month) : 'Month', on: month !== null, clear: () => change({ month: null }) },
    {
      key: 'category',
      label: categories?.find((c) => c.id === categoryId)?.name ?? 'Category',
      on: categoryId !== null,
      clear: () => change({ categoryId: null }),
    },
    {
      key: 'account',
      label: accounts?.find((a) => a.id === accountId)?.name ?? 'Account',
      on: accountId !== null,
      clear: () => change({ accountId: null }),
    },
  ];

  function pickerSheet() {
    if (picker === 'type') {
      const options: PickerOption<TransactionFilter['type']>[] = (['all', 'expense', 'income', 'transfer'] as const).map((value) => ({
        value,
        label: TYPE_LABELS[value],
      }));
      return <PickerSheet title="Show" options={options} current={type} onPick={(v) => pick({ type: v })} onClose={() => setPicker(null)} />;
    }
    if (picker === 'month') {
      const options: PickerOption<string | null>[] = [
        { value: null, label: 'All time' },
        ...(months ?? []).map((m) => ({ value: m, label: monthLabel(m) })),
      ];
      return <PickerSheet title="Month" options={options} current={month} onPick={(v) => pick({ month: v })} onClose={() => setPicker(null)} />;
    }
    if (picker === 'category') {
      const options: PickerOption<number | null>[] = [
        { value: null, label: 'All categories' },
        ...(categories ?? []).map((c) => ({
          value: c.id,
          label: c.name,
          sub: c.kind === 'income' ? 'Income' : 'Spending',
          lead: <CategoryIcon name={c.icon} color={c.color} size={36} />,
        })),
      ];
      return <PickerSheet title="Category" options={options} current={categoryId} onPick={(v) => pick({ categoryId: v })} onClose={() => setPicker(null)} />;
    }
    if (picker === 'account') {
      const options: PickerOption<number | null>[] = [
        { value: null, label: 'All accounts' },
        ...(accounts ?? []).map((a) => ({
          value: a.id,
          label: a.name,
          lead: (
            <View style={[styles.initial, { backgroundColor: a.color }]}>
              <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
          ),
        })),
      ];
      return <PickerSheet title="Account" options={options} current={accountId} onPick={(v) => pick({ accountId: v })} onClose={() => setPicker(null)} />;
    }
    return null;
  }

  function pick(update: Partial<TransactionFilter>) {
    change(update);
    setPicker(null);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView fadeTop={false} stickyHeaderIndices={[0]} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, rows?.length === 0 && styles.contentEmpty, rows?.length === 0 && { paddingBottom: tabBarHeight + insets.bottom }]}>
        <View style={{ backgroundColor: colors.bg }}>
          <Text style={[styles.title, { color: colors.ink }]}>Activity</Text>

          <View style={[styles.filters, { backgroundColor: colors.bg }]}>
            <View style={[styles.search, { backgroundColor: colors.fill }]}>
              <Search color={colors.ink2} size={18} />
              <TextInput
                value={search}
                onChangeText={(text) => change({ search: text })}
                placeholder="Search"
                placeholderTextColor={colors.ink3}
                accessibilityLabel="Search"
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.ink }]}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {chipsOn && (
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => { setFilter({ ...NO_FILTER }); setLimit(PAGE); }}
                  style={[styles.chip, { backgroundColor: colors.fill }]}
                >
                  <Text style={[styles.chipText, { color: colors.ink }]}>Clear</Text>
                </PressableScale>
              )}
              {chips.map((c) => (
                <PressableScale
                  key={c.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.on }}
                  onPress={() => setPicker(c.key)}
                  style={[styles.chip, { backgroundColor: c.on ? colors.btnBg : colors.fill }]}
                >
                  <Text style={[styles.chipText, { color: c.on ? colors.btnFg : colors.ink }]} numberOfLines={1}>{c.label}</Text>
                  {c.on ? (
                    <PressableScale accessibilityRole="button" accessibilityLabel="Remove filter" onPress={c.clear} hitSlop={10} style={styles.chipX}>
                      <X color={colors.btnFg} size={11} strokeWidth={3} />
                    </PressableScale>
                  ) : (
                    <ChevronDown color={colors.ink2} size={15} strokeWidth={2.2} />
                  )}
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={rows?.length === 0 ? styles.fill : undefined}>
          {rows && totals && (rows.length === 0 ? (
            filtered ? (
              <EmptyState Icon={SearchX} title="No results" text="Nothing matches your search or filters.">
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => { setFilter({ ...NO_FILTER }); setLimit(PAGE); }}
                  style={[styles.pill, { backgroundColor: colors.fill, marginTop: spacing.sm }]}
                >
                  <Text style={[styles.chipText, { color: colors.ink }]}>Clear filters</Text>
                </PressableScale>
              </EmptyState>
            ) : (
              <EmptyState Icon={Receipt} title="No transactions yet" text="Everything you log shows up here, newest first." />
            )
          ) : (
            <>
              <Text style={[styles.summary, { color: colors.ink2 }]}>
                {totals.count} transaction{totals.count === 1 ? '' : 's'}
              </Text>
              <TransactionList rows={rows} />
              {totals.count > rows.length && (
                <View style={styles.empty}>
                  <PressableScale accessibilityRole="button" onPress={() => setLimit(limit + PAGE)} style={[styles.pill, { backgroundColor: colors.fill }]}>
                    <Text style={[styles.chipText, { color: colors.ink }]}>Show more</Text>
                  </PressableScale>
                </View>
              )}
            </>
          ))}
        </View>
      </FadeScrollView>
      {pickerSheet()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  contentEmpty: { flexGrow: 1 },
  fill: { flex: 1 },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  filters: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, borderRadius: 12, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontSize: fontSize.body, padding: 0 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingTop: 10, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, maxWidth: 220 },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  chipX: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(127,127,127,0.35)', alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  summary: { fontSize: 14, paddingTop: 10 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 36 },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
