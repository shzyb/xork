import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ArrowLeftRight, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { Sheet } from '../../src/components/Sheet';
import { SheetHeader } from '../../src/components/SheetHeader';
import { deleteTransaction, getTransaction } from '../../src/db';
import { FREQUENCY_LABEL, fullDate } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { sheet, spacing } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useData(() => getTransaction(Number(id)), [id]);
  const [error, setError] = useState('');

  if (!t) return null;

  const income = t.type === 'income';
  const transfer = t.type === 'transfer';
  const details: { label: string; value: string; onPress?: () => void }[] = [];
  if (t.note) details.push({ label: transfer ? 'Note' : income ? 'From' : 'Place', value: t.note });
  if (t.category_name) details.push({ label: 'Category', value: t.category_name });
  details.push({ label: 'Date', value: fullDate(t.date) });
  details.push({ label: transfer ? 'From' : income ? 'Into' : 'Paid from', value: t.account_name });
  if (transfer) details.push({ label: 'To', value: t.to_account_name ?? 'Deleted account' });
  if (t.recurring_id !== null && t.recurring_name && t.recurring_freq) {
    const recurringId = t.recurring_id;
    details.push({
      label: 'Repeats',
      value: `${t.recurring_name} · ${FREQUENCY_LABEL[t.recurring_freq]}`,
      onPress: () => router.push({ pathname: '/recurring/detail/[id]', params: { id: String(recurringId) } }),
    });
  }

  function confirmDelete() {
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(t!.id);
            router.back();
          } catch {
            setError('Could not delete. Try again.');
          }
        },
      },
    ]);
  }

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {transfer ? (
            <View style={styles.transferIcon}>
              <ArrowLeftRight color={sheet.ink} size={28} />
            </View>
          ) : (
            <CategoryIcon name={t.category_icon} color={t.category_color} size={64} />
          )}
          <Text style={styles.kind}>{transfer ? 'Moved between your accounts' : income ? 'Received' : 'Spent'}</Text>
          <Text style={[styles.amount, income && { color: sheet.pos }]}>
            {income ? '+ ' : ''}{formatMoney(t.amount_minor)}
          </Text>
        </View>

        <View style={styles.card}>
          {details.map(({ label, value, onPress }, i) => (
            <Pressable
              key={label}
              disabled={!onPress}
              accessibilityRole={onPress ? 'button' : undefined}
              onPress={onPress}
              style={[styles.detailRow, i > 0 && styles.detailDivider]}
            >
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={[styles.detailValue, onPress && styles.detailLink]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FadeScrollView>
      <View style={styles.footer}>
        <Button
          title="Edit"
          onPress={() => router.push({ pathname: '/add', params: { id: String(t.id) } })}
          background={sheet.btnBg}
          color={sheet.btnFg}
        />
        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <Trash2 color={sheet.neg} size={18} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  transferIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: sheet.card2, alignItems: 'center', justifyContent: 'center' },
  kind: { color: sheet.ink2, fontSize: 15, marginTop: 6 },
  amount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  card: { backgroundColor: sheet.card, borderRadius: 20, paddingHorizontal: 16, marginTop: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sheet.card2 },
  detailLabel: { color: sheet.ink2, fontSize: 16 },
  detailLink: { textDecorationLine: 'underline' },
  detailValue: { color: sheet.ink, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
