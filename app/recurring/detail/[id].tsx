import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../../src/components/FadeScrollView';
import { Pause, Play, SkipForward, Trash2, Pencil } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../../src/components/PressableScale';
import { Button } from '../../../src/components/Button';
import { CategoryIcon } from '../../../src/components/CategoryIcon';
import { Sheet } from '../../../src/components/Sheet';
import { SheetHeader } from '../../../src/components/SheetHeader';
import { TransactionList } from '../../../src/components/TransactionList';
import {
  deleteRecurring, getRecurring, getRecurringActivity, logRecurringNow, setRecurringActive, skipRecurring,
} from '../../../src/db';
import { FREQUENCY_LABEL, fullDate, prettyDate, today } from '../../../src/dates';
import { formatMoney } from '../../../src/money';
import { sheet, spacing, useTrayColor } from '../../../src/theme';
import { useData } from '../../../src/useData';
import { Text } from '../../../src/components/Text';

// What a recurring item is and has done. Log now, skip, pause, edit and delete live here.
export default function RecurringDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData(async () => {
    const item = (await getRecurring()).find((r) => r.id === Number(id));
    return item ? { item, activity: await getRecurringActivity(item.id) } : null;
  }, [id]);
  const [error, setError] = useState('');
  const trayColor = useTrayColor();

  if (!data) return null;
  const { item, activity } = data;
  const income = item.type === 'income';
  const year = today().slice(0, 4);

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
    } catch {
      setError('Something went wrong. Try again.');
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${item.name}?`, 'It stops repeating. Transactions it already logged stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => run(async () => {
          await deleteRecurring(item.id);
          router.back();
        }),
      },
    ]);
  }

  const details: [string, string][] = [
    ['Frequency', FREQUENCY_LABEL[item.freq] + (item.freq === 'monthly' ? `, day ${item.anchor_day}` : '')],
    ['Next', item.active ? fullDate(item.next_date) : 'Paused'],
    [income ? 'Paid into' : 'Paid from', item.account_name],
    ['Category', item.category_name],
    ['Logging', 'Automatic on the day'],
    [`${income ? 'Income' : 'Expense'} in ${year}`, `${formatMoney(activity.yearTotal)} · ${activity.yearCount}×`],
  ];

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <CategoryIcon name={item.category_icon} color={item.category_color} size={64} recurring surface={trayColor} />
          <Text style={styles.kind}>{item.name}</Text>
          <Text style={[styles.amount, income && { color: sheet.pos }]}>
            {income ? '+ ' : ''}{formatMoney(item.amount_minor)}
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {FREQUENCY_LABEL[item.freq]}{item.active ? ` · next ${prettyDate(item.next_date).toLowerCase()}` : ' · paused'}
            </Text>
          </View>
        </View>

        {item.active && (
          <View style={styles.logButton}>
            <Button
              title="Log next payment now"
              onPress={() => run(() => logRecurringNow(item.id))}
              background={sheet.btnBg}
              color={sheet.btnFg}
            />
          </View>
        )}

        <View style={styles.card}>
          {details.map(([label, value], i) => (
            <View key={label} style={[styles.detailRow, i > 0 && styles.detailDivider]}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {activity.history.length > 0 && (
          <>
            <Text style={styles.section}>History</Text>
            <TransactionList rows={activity.history} />
          </>
        )}

        <View style={styles.actions}>
          <ActionButton
            Icon={Pencil}
            label="Edit"
            onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: String(item.id) } })}
          />
          {item.active && <ActionButton Icon={SkipForward} label="Skip" onPress={() => run(() => skipRecurring(item.id))} />}
          <ActionButton
            Icon={item.active ? Pause : Play}
            label={item.active ? 'Pause' : 'Resume'}
            onPress={() => run(() => setRecurringActive(item.id, !item.active))}
          />
        </View>
        <PressableScale accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <Trash2 color={sheet.neg} size={18} />
          <Text style={styles.deleteText}>Delete recurring item</Text>
        </PressableScale>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FadeScrollView>
    </Sheet>
  );
}

function ActionButton({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Icon color={sheet.ink} size={17} />
      <Text style={styles.actionText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  kind: { color: sheet.ink2, fontSize: 15, marginTop: 6 },
  amount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: sheet.card2, justifyContent: 'center', marginTop: 4 },
  tagText: { color: sheet.ink2, fontSize: 12.5, fontWeight: '600' },
  logButton: { marginTop: 16 },
  card: { backgroundColor: sheet.card, borderRadius: 20, paddingHorizontal: 16, marginTop: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sheet.card2 },
  detailLabel: { color: sheet.ink2, fontSize: 16 },
  detailValue: { color: sheet.ink, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
  section: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 22, marginBottom: -12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  action: { flex: 1, height: 50, borderRadius: 25, backgroundColor: sheet.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: sheet.ink, fontSize: 15, fontWeight: '600' },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
});
