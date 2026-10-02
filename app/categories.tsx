import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { DragList } from '../src/components/DragList';
import { getCategories, getTotalsByCategory, reorderCategories } from '../src/db';
import { currentMonth } from '../src/dates';
import { formatMoney } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import type { Category, CategoryKind } from '../src/types';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

const ROW_HEIGHT = 64;

// Every category with what it added up to this month. Tap one to edit it; press and hold to drag it to a new place.
// This is the order the add forms show. The Other category always stays last.
export default function Categories() {
  const colors = useColors();
  const router = useRouter();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const data = useData(async () => {
    const categories = await getCategories();
    const spent = await getTotalsByCategory('expense', currentMonth());
    const received = await getTotalsByCategory('income', currentMonth());
    return { categories, totals: new Map([...spent, ...received].map((c) => [c.id, c.total_minor])) };
  });

  const ofKind = data?.categories.filter((c) => c.kind === kind) ?? [];

  function renderRow(c: Category) {
    return (
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(c.id) } })}
        style={styles.row}
      >
        <CategoryIcon name={c.icon} color={c.color} />
        <View style={styles.main}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
          <Text style={{ color: colors.ink2, fontSize: 13 }}>
            {formatMoney(data?.totals.get(c.id) ?? 0)} this month{c.budget_minor !== null ? ` · budget ${formatMoney(c.budget_minor)}` : ''}
          </Text>
        </View>
        <ChevronRight color={colors.ink3} size={20} />
      </PressableScale>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <DragList
        style={styles.flex}
        contentContainerStyle={styles.content}
        items={ofKind.filter((c) => !c.is_default)}
        rowHeight={ROW_HEIGHT}
        renderRow={renderRow}
        onReorder={reorderCategories}
        header={
          <>
            <Text style={[styles.title, { color: colors.ink }]}>Categories</Text>
            <View style={[styles.segment, { backgroundColor: colors.fill }]}>
              {([['expense', 'Spending'], ['income', 'Income']] as const).map(([key, label]) => (
                <PressableScale
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === key }}
                  onPress={() => setKind(key)}
                  style={[styles.segmentItem, kind === key && { backgroundColor: colors.bg }]}
                >
                  <Text style={[styles.segmentText, { color: kind === key ? colors.ink : colors.ink2 }]}>{label}</Text>
                </PressableScale>
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.ink3 }]}>Press and hold a category, then drag it to reorder.</Text>
          </>
        }
        footer={ofKind.filter((c) => c.is_default).map((c) => <View key={c.id} style={styles.fixed}>{renderRow(c)}</View>)}
      />
      <View style={styles.footer}>
        <Button
          title={kind === 'income' ? 'New income category' : 'New spending category'}
          onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
          background={colors.btnBg}
          color={colors.btnFg}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.lg },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: 22, padding: 3, gap: 3, marginTop: spacing.md, marginBottom: 8 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14.5, fontWeight: '600' },
  hint: { fontSize: 13, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, height: ROW_HEIGHT },
  fixed: { height: ROW_HEIGHT },
  main: { flex: 1 },
  name: { fontSize: 16.5, fontWeight: '600' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
