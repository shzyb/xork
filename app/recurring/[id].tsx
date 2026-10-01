import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { StatusBar } from 'expo-status-bar';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountChips } from '../../src/components/AccountChips';
import { Button } from '../../src/components/Button';
import { CategoryGrid } from '../../src/components/CategoryGrid';
import { DateChips } from '../../src/components/DateChips';
import { Field } from '../../src/components/Field';
import { SheetHeader } from '../../src/components/SheetHeader';
import {
  addRecurring, deleteRecurring, getAccountsWithBalance, getCategories, getRecurringItem, updateRecurring,
} from '../../src/db';
import { FREQUENCY_LABEL, today, tomorrow } from '../../src/dates';
import { currentDecimals, minorToTyped, parseAmount } from '../../src/money';
import { sheet, spacing } from '../../src/theme';
import type { Account, Category, Frequency, Recurring } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

// /recurring/new adds a recurring item, /recurring/5 edits item 5.
export default function RecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const editing = useData(() => (isNew ? Promise.resolve(null) : getRecurringItem(Number(id))), [id]);
  const accounts = useData(getAccountsWithBalance);
  const categories = useData(getCategories);

  if (editing === undefined || !accounts || !categories) return null;
  if (!isNew && editing === null) return null;
  return <RecurringForm editing={editing} accounts={accounts} categories={categories} />;
}

function RecurringForm({ editing, accounts, categories }: {
  editing: Recurring | null;
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const [type, setType] = useState<Recurring['type']>(editing?.type ?? 'expense');
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? minorToTyped(editing.amount_minor) : '');
  const [accountId, setAccountId] = useState(editing?.account_id ?? accounts[0].id);
  const [freq, setFreq] = useState<Frequency>(editing?.freq ?? 'monthly');
  const [date, setDate] = useState(editing?.next_date ?? tomorrow());
  const [categoryId, setCategoryId] = useState<number | null>(editing?.category_id ?? null);
  const [active, setActive] = useState(editing ? editing.active === 1 : true);
  const [error, setError] = useState('');

  async function save() {
    if (name.trim() === '') return setError('Enter a name.');
    if (!/^\d*\.?\d*$/.test(amount.trim()) || parseAmount(amount.trim()) <= 0) return setError('Enter an amount above zero.');
    if (categoryId === null) return setError('Pick a category.');
    if (date < today()) return setError('Pick today or a later date.');
    const item = {
      name: name.trim(),
      type,
      amount_minor: parseAmount(amount.trim()),
      account_id: accountId,
      category_id: categoryId,
      freq,
      anchor_day: Number(date.slice(8, 10)),
      next_date: date,
      active: active ? 1 : 0,
    };
    try {
      if (editing) await updateRecurring(editing.id, item);
      else await addRecurring(item);
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(`Delete ${editing.name}?`, 'It stops repeating. Transactions it already logged stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurring(editing.id);
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
      <SheetHeader title={editing ? 'Edit recurring item' : 'New recurring item'} onClose={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FadeScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.segment}>
            {([['expense', 'Money out'], ['income', 'Money in']] as const).map(([key, label]) => (
              <PressableScale
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: type === key }}
                onPress={() => { setType(key); setCategoryId(null); }}
                style={[styles.segmentItem, type === key && { backgroundColor: sheet.card2 }]}
              >
                <Text style={[styles.segmentText, type === key && { color: sheet.ink }]}>{label}</Text>
              </PressableScale>
            ))}
          </View>
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Rent" maxLength={32} />
          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType={currentDecimals() === 0 ? 'number-pad' : 'decimal-pad'}
          />
          <AccountChips label={type === 'income' ? 'Into' : 'From'} accounts={accounts} selectedId={accountId} onSelect={setAccountId} />
          <Text style={styles.label}>How often</Text>
          <View style={styles.segment}>
            {(['weekly', 'monthly', 'yearly'] as const).map((key) => (
              <PressableScale
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: freq === key }}
                onPress={() => setFreq(key)}
                style={[styles.segmentItem, freq === key && { backgroundColor: sheet.card2 }]}
              >
                <Text style={[styles.segmentText, freq === key && { color: sheet.ink }]}>{FREQUENCY_LABEL[key]}</Text>
              </PressableScale>
            ))}
          </View>
          <Text style={styles.label}>{editing ? 'Next date' : 'First date'}</Text>
          <DateChips
            value={date}
            onChange={setDate}
            presets={[{ label: 'Today', date: today() }, { label: 'Tomorrow', date: tomorrow() }]}
          />
          <Text style={styles.label}>Category</Text>
          <CategoryGrid
            categories={categories.filter((c) => c.kind === type)}
            selectedId={categoryId}
            onSelect={setCategoryId}
            onNew={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind: type } })}
          />
          <View style={styles.activeRow}>
            <View style={styles.activeText}>
              <Text style={styles.activeTitle}>Active</Text>
              <Text style={styles.activeSub}>{active ? 'Logged automatically on the day' : 'Paused: nothing is logged'}</Text>
            </View>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: sheet.pos, false: sheet.card2 }} />
          </View>
          {error !== '' && <Text style={styles.error}>{error}</Text>}
        </FadeScrollView>
        <View style={styles.footer}>
          <Button title={editing ? 'Save changes' : 'Schedule it'} onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
          {editing && (
            <PressableScale accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
              <Trash2 color={sheet.neg} size={18} />
              <Text style={styles.deleteText}>Delete recurring item</Text>
            </PressableScale>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: sheet.card, borderRadius: 18, padding: 16, marginTop: 20 },
  activeText: { flex: 1 },
  activeTitle: { color: sheet.ink, fontSize: 16, fontWeight: '600' },
  activeSub: { color: sheet.ink2, fontSize: 13.5, marginTop: 2 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
