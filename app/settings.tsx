import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { SheetHeader } from '../src/components/SheetHeader';
import { getCategories } from '../src/db';
import { formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { CategoryKind } from '../src/types';
import { useData } from '../src/useData';

export default function Settings() {
  const router = useRouter();
  const categories = useData(getCategories);
  const [kind, setKind] = useState<CategoryKind>('expense');

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <SheetHeader title="Settings" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Categories</Text>
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
        {categories?.filter((c) => c.kind === kind).map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(c.id) } })}
            style={styles.row}
          >
            <CategoryIcon name={c.icon} color={c.color} />
            <View style={styles.main}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              {c.budget_minor !== null && <Text style={styles.sub}>Budget {formatMoney(c.budget_minor)}</Text>}
            </View>
            <ChevronRight color={sheet.ink3} size={20} />
          </Pressable>
        ))}
        <View style={styles.footer}>
          <Button
            title={kind === 'income' ? 'New income category' : 'New spending category'}
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
            background={sheet.btnBg}
            color={sheet.btnFg}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  content: { paddingBottom: spacing.xxl },
  section: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3, marginBottom: 8 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1 },
  name: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  sub: { color: sheet.ink2, fontSize: 13 },
  footer: { marginTop: spacing.lg },
});
