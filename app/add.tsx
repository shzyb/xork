import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountChips } from '../src/components/AccountChips';
import { Button } from '../src/components/Button';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { DateChips } from '../src/components/DateChips';
import { Keypad } from '../src/components/Keypad';
import { addTransaction, getAccountsWithBalance, getCategories, getTransaction, updateTransaction } from '../src/db';
import { today, yesterday } from '../src/dates';
import { currentDecimals, currentSymbol, formatMoney, formatTyped, minorToTyped, parseAmount } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { Account, Category, TransactionRow, TransactionType } from '../src/types';
import { useData } from '../src/useData';

const TYPES: { key: TransactionType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Move' },
];
const TITLES = { expense: 'Expense', income: 'Income', transfer: 'Move money' };
const SAVE_LABELS = { expense: 'Add expense', income: 'Add income', transfer: 'Move money' };

// With ?id=5 the form edits that transaction; without it, it adds a new one, starting as ?type= (default expense).
export default function Add() {
  const { id, type } = useLocalSearchParams<{ id?: string; type?: string }>();
  const accounts = useData(getAccountsWithBalance);
  const categories = useData(getCategories);
  const editing = useData(() => (id ? getTransaction(Number(id)) : Promise.resolve(null)), [id]);

  if (!accounts || !categories || editing === undefined) return null;
  const startType = type === 'income' || type === 'transfer' ? type : 'expense';
  return <AddForm accounts={accounts} categories={categories} editing={editing} startType={startType} />;
}

function AddForm({ accounts, categories, editing, startType }: {
  accounts: (Account & { balance_minor: number })[];
  categories: Category[];
  editing: TransactionRow | null;
  startType: TransactionType;
}) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<TransactionType>(editing?.type ?? startType);
  const [amount, setAmount] = useState(editing ? minorToTyped(editing.amount_minor) : '');
  const [fromSel, setFromSel] = useState<number | null>(editing?.account_id ?? null);
  const [toSel, setToSel] = useState<number | null>(editing?.to_account_id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(editing?.category_id ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [error, setError] = useState('');

  const fromId = fromSel ?? accounts[0].id;
  const toId = toSel ?? accounts.find((a) => a.id !== fromId)?.id ?? fromId;
  const from = accounts.find((a) => a.id === fromId) ?? accounts[0];
  const to = accounts.find((a) => a.id === toId) ?? from;
  const minor = parseAmount(amount);
  const decimals = currentDecimals();

  function pressKey(key: string) {
    setError('');
    if (key === 'back') return setAmount(amount.slice(0, -1));
    if (key === '.') {
      if (decimals === 0 || amount.includes('.')) return;
      return setAmount((amount || '0') + '.');
    }
    if (amount.includes('.')) {
      if (amount.split('.')[1].length >= decimals) return;
    } else if (amount.length >= 9) {
      return;
    }
    setAmount(amount === '0' ? key : amount + key);
  }

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    setError('');
  }

  function goToDetails() {
    if (minor <= 0) return setError('Enter an amount above zero.');
    if (type === 'transfer') {
      if (accounts.length < 2) return setError('Add a second account to move money.');
      if (fromId === toId) return setError('Choose two different accounts.');
    }
    setError('');
    setStep(2);
  }

  async function save() {
    if (type !== 'transfer' && categoryId === null) return setError('Pick a category.');
    try {
      const transaction = {
        type,
        amount_minor: minor,
        account_id: fromId,
        to_account_id: type === 'transfer' ? toId : null,
        category_id: type === 'transfer' ? null : categoryId,
        note: note.trim(),
        date,
      };
      if (editing) await updateTransaction(editing.id, transaction);
      else await addTransaction(transaction);
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  const kindCategories = categories.filter((c) => c.kind === type);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {step === 1 ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <RoundButton label="Back" onPress={() => { setError(''); setStep(1); }}>
            <ChevronLeft color={sheet.ink} size={20} />
          </RoundButton>
        )}
        <Text style={styles.headerTitle}>{step === 1 ? (editing ? 'Edit transaction' : TITLES[type]) : type === 'transfer' ? 'Details' : type === 'income' ? 'Where from?' : 'What for?'}</Text>
        {step === 2 ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {step === 1 ? (
        <>
          <View style={styles.body}>
            <View style={styles.segment}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === t.key }}
                  onPress={() => changeType(t.key)}
                  style={[styles.segmentItem, type === t.key && { backgroundColor: sheet.card2 }]}
                >
                  <Text style={[styles.segmentText, type === t.key && { color: sheet.ink }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <AccountChips
              label={type === 'income' ? 'Into' : 'From'}
              accounts={accounts}
              selectedId={fromId}
              onSelect={setFromSel}
            />
            {type === 'transfer' && (
              <AccountChips label="To" accounts={accounts} selectedId={toId} onSelect={setToSel} />
            )}

            <View style={styles.amountBox}>
              <Text
                style={[styles.amount, !amount && { color: sheet.ink3 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                <Text style={styles.symbol}>{currentSymbol()} </Text>
                {amount ? formatTyped(amount) : '0'}
              </Text>
              <Text style={styles.under}>{from.name} has {formatMoney(from.balance_minor)}</Text>
              {error !== '' && <Text style={styles.error}>{error}</Text>}
            </View>
          </View>

          <View style={styles.footer}>
            <Keypad onKey={pressKey} decimals={decimals} />
            <Button
              title="Continue"
              onPress={goToDetails}
              background={minor > 0 ? sheet.btnBg : sheet.card2}
              color={minor > 0 ? sheet.btnFg : sheet.ink3}
            />
          </View>
        </>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.details} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel="Change amount" onPress={() => setStep(1)} style={styles.hero}>
              <Text style={[styles.heroAmount, type === 'income' && { color: sheet.pos }]}>
                {type === 'income' ? '+ ' : ''}{formatMoney(minor)}
              </Text>
              <Text style={styles.under}>
                {from.name}{type === 'transfer' ? ` → ${to.name}` : ''} · tap to change
              </Text>
            </Pressable>

            {type !== 'transfer' && (
              <>
                <Text style={styles.label}>Category</Text>
                <CategoryGrid
                  categories={kindCategories}
                  selectedId={categoryId}
                  onSelect={(id) => { setCategoryId(id); setError(''); }}
                  onNew={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind: type } })}
                />
              </>
            )}

            <Text style={styles.label}>
              {type === 'expense' ? 'Place or note' : type === 'income' ? 'From who or what' : 'Note'}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={60}
              placeholder={type === 'expense' ? 'e.g. Imtiaz Supermarket' : type === 'income' ? 'e.g. September salary' : 'e.g. Monthly saving'}
              placeholderTextColor={sheet.ink3}
              style={styles.input}
            />

            <Text style={styles.label}>Date</Text>
            <DateChips
              value={date}
              onChange={setDate}
              presets={[{ label: 'Today', date: today() }, { label: 'Yesterday', date: yesterday() }]}
            />

            {error !== '' && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          <View style={styles.footer}>
            <Button title={editing ? 'Save changes' : SAVE_LABELS[type]} onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  headerTitle: { color: sheet.ink, fontSize: 17, fontWeight: '600' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 44 },
  body: { flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  amountBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  amount: { color: sheet.ink, fontSize: 68, fontWeight: '800', letterSpacing: -2, maxWidth: '100%' },
  symbol: { color: sheet.ink2, fontSize: 32, fontWeight: '700', letterSpacing: 0 },
  under: { color: sheet.ink2, fontSize: 15, marginTop: 10, textAlign: 'center' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  footer: { paddingTop: 6, paddingBottom: spacing.lg },
  details: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: 4 },
  heroAmount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: { height: 50, borderRadius: 16, backgroundColor: sheet.card, paddingHorizontal: 14, color: sheet.ink, fontSize: 16 },
});
