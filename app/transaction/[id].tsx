import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeftRight, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { deleteTransaction, getTransaction } from '../../src/db';
import { fullDate } from '../../src/dates';
import { formatMoney } from '../../src/money';
import { sheet, spacing } from '../../src/theme';
import { useData } from '../../src/useData';

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useData(() => getTransaction(Number(id)), [id]);
  const [error, setError] = useState('');

  if (!t) return null;

  const income = t.type === 'income';
  const transfer = t.type === 'transfer';
  const details: [string, string][] = [];
  if (t.note) details.push([transfer ? 'Note' : income ? 'From' : 'Place', t.note]);
  if (t.category_name) details.push(['Category', t.category_name]);
  details.push(['Date', fullDate(t.date)]);
  details.push([transfer ? 'From' : income ? 'Into' : 'Paid from', t.account_name]);
  if (transfer) details.push(['To', t.to_account_name ?? 'Deleted account']);

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
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.round}>
          <X color={sheet.ink} size={18} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
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
          {details.map(([label, value], i) => (
            <View key={label} style={[styles.detailRow, i > 0 && styles.detailDivider]}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: spacing.md },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  transferIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: sheet.card2, alignItems: 'center', justifyContent: 'center' },
  kind: { color: sheet.ink2, fontSize: 15, marginTop: 6 },
  amount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  card: { backgroundColor: sheet.card, borderRadius: 20, paddingHorizontal: 16, marginTop: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sheet.card2 },
  detailLabel: { color: sheet.ink2, fontSize: 16 },
  detailValue: { color: sheet.ink, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'right' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
