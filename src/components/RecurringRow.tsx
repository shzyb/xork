import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FREQUENCY_LABEL, prettyDate } from '../dates';
import { formatMoney } from '../money';
import { fontSize, useColors } from '../theme';
import type { RecurringRow as RecurringItem } from '../types';
import { CategoryIcon } from './CategoryIcon';

// One recurring item. With `date` it is one upcoming occurrence; without, it shows the item's next date or "Paused".
export function RecurringRow({ item, date }: { item: RecurringItem; date?: string }) {
  const colors = useColors();
  const router = useRouter();
  const income = item.type === 'income';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: String(item.id) } })}
      style={[styles.row, !item.active && { opacity: 0.55 }]}
    >
      <CategoryIcon name={item.category_icon} color={item.category_color} />
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{item.name}</Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>
          {FREQUENCY_LABEL[item.freq]} · {item.account_name}
        </Text>
      </View>
      <View style={styles.end}>
        <Text style={[styles.amount, { color: income ? colors.pos : colors.ink }]}>
          {income ? '+ ' : ''}{formatMoney(item.amount_minor)}
        </Text>
        <Text style={{ color: colors.ink2, fontSize: fontSize.small }} numberOfLines={1}>
          {date ? prettyDate(date) : item.active ? `Next ${prettyDate(item.next_date)}` : 'Paused'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1 },
  end: { alignItems: 'flex-end', maxWidth: '45%' },
  title: { fontSize: 16.5, fontWeight: '600' },
  amount: { fontSize: 16.5, fontWeight: '600' },
});
