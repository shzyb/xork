import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { MonthChips } from '../src/components/MonthChips';
import { TransactionList } from '../src/components/TransactionList';
import { getCategory, getEarliestMonth, getTotalsByCategory, getTransactions, NO_FILTER } from '../src/db';
import { monthName } from '../src/dates';
import { budgetStatus } from '../src/insights';
import { formatMoney } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

// Opened from Insights: every transaction in one category, for the month that was on screen. The chips change month.
export default function CategoryActivity() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; month: string }>();
  const [month, setMonth] = useState(params.month);
  const id = Number(params.id);
  const data = useData(async () => {
    const category = await getCategory(id);
    if (!category) return null;
    const [rows, thisMonth, earliest] = await Promise.all([
      getTransactions({ ...NO_FILTER, categoryId: id, month }, 1000),
      getTotalsByCategory(category.kind, month),
      getEarliestMonth(),
    ]);
    return {
      category, rows, earliest,
      mine: thisMonth.find((c) => c.id === id),
    };
  }, [id, month]);

  if (!data) return null;
  const { category, rows, earliest, mine } = data;
  const total = mine?.total_minor ?? 0;
  const budget = category.budget_minor && category.kind === 'expense' ? budgetStatus(total, category.budget_minor) : null;
  const meter = budget?.state === 'over' ? colors.neg : budget?.state === 'warn' ? colors.warn : colors.ink;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <CategoryIcon name={category.icon} color={category.color} size={64} />
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{category.name}</Text>
          <Text style={[styles.total, { color: category.kind === 'income' ? colors.pos : colors.ink }]}>
            {formatMoney(total)}
          </Text>
        </View>

        {budget && (
          <View style={styles.budget}>
            <View style={[styles.meter, { backgroundColor: colors.fill }]}>
              <View style={{ width: `${Math.min(100, budget.percent)}%`, height: '100%', borderRadius: 3, backgroundColor: meter }} />
            </View>
            <Text style={{ color: colors.ink2, fontSize: 12.5, marginTop: 4 }}>{budget.text}</Text>
          </View>
        )}

        <MonthChips selected={month} earliest={earliest} onSelect={setMonth} />

        {rows.length === 0 ? (
          <Text style={{ color: colors.ink2, paddingVertical: spacing.lg }}>
            No {category.name} transactions in {monthName(month)}.
          </Text>
        ) : (
          <TransactionList rows={rows} />
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: spacing.md, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: 4, marginBottom: spacing.md },
  name: { fontSize: fontSize.title, fontWeight: '700', marginTop: spacing.sm },
  total: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5 },
  budget: { marginTop: spacing.lg },
  meter: { height: 5, borderRadius: 3, overflow: 'hidden' },
});
