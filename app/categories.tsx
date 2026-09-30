import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { getCategories, getTotalsByCategory } from '../src/db';
import { currentMonth } from '../src/dates';
import { formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { CategoryKind } from '../src/types';
import { useData } from '../src/useData';

// Every category with what it added up to this month. Tap one to edit it.
export default function Categories() {
  const router = useRouter();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const data = useData(async () => {
    const categories = await getCategories();
    const spent = await getTotalsByCategory('expense', currentMonth());
    const received = await getTotalsByCategory('income', currentMonth());
    return { categories, totals: new Map([...spent, ...received].map((c) => [c.id, c.total_minor])) };
  });

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="Categories" onClose={() => router.back()} />
      <View style={styles.segment}>
        {([['expense', 'Spending'], ['income', 'Income']] as const).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === key }}
            onPress={() => setKind(key)}
            style={[styles.segmentItem, kind === key && { backgroundColor: sheet.card2 }]}
          >
            <Text style={[styles.segmentText, kind === key && { color: sheet.ink }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {data?.categories.filter((c) => c.kind === kind).map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(c.id) } })}
            style={styles.row}
          >
            <CategoryIcon name={c.icon} color={c.color} />
            <View style={styles.main}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.sub}>
                {formatMoney(data.totals.get(c.id) ?? 0)} this month{c.budget_minor !== null ? ` · budget ${formatMoney(c.budget_minor)}` : ''}
              </Text>
            </View>
            <ChevronRight color={sheet.ink3} size={20} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={kind === 'income' ? 'New income category' : 'New spending category'}
          onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
          background={sheet.btnBg}
          color={sheet.btnFg}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3, marginBottom: 8 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  content: { paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1 },
  name: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  sub: { color: sheet.ink2, fontSize: 13 },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
