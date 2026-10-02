import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountChips } from '../src/components/AccountChips';
import { Button } from '../src/components/Button';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { DateChips } from '../src/components/DateChips';
import { Keypad } from '../src/components/Keypad';
import { addTransaction, checkCreditLimit, getAccountsWithBalance, getCategories, getTransaction, isOverLimit, updateTransaction } from '../src/db';
import { today, yesterday } from '../src/dates';
import { creditStatus } from '../src/insights';
import { currentDecimals, currentSymbol, formatMoney, formatTyped, minorToTyped, parseAmount } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { Account, Category, TransactionRow, TransactionType } from '../src/types';
import { useData } from '../src/useData';
import { Text, TextInput } from '../src/components/Text';

const TITLES = { expense: 'Expense', income: 'Income', transfer: 'Move money' };
const EDIT_TITLES = { expense: 'Edit expense', income: 'Edit income', transfer: 'Edit transfer' };
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
  const type = editing?.type ?? startType;
  const [amount, setAmount] = useState(editing ? minorToTyped(editing.amount_minor) : '');
  const [fromSel, setFromSel] = useState<number | null>(editing?.account_id ?? null);
  const [toSel, setToSel] = useState<number | null>(editing?.to_account_id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(editing?.category_id ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [error, setError] = useState('');
  const scroll = useRef<ScrollView>(null);

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

  const draft = () => ({
    type,
    amount_minor: minor,
    account_id: fromId,
    to_account_id: type === 'transfer' ? toId : null,
    category_id: type === 'transfer' ? null : categoryId,
    note: note.trim(),
    date,
  });

  // A credit card at its limit refuses new spending. Checked on Continue so nobody fills in details first.
  async function goToDetails() {
    if (minor <= 0) return setError('Enter an amount above zero.');
    if (type === 'transfer') {
      if (accounts.length < 2) return setError('Add a second account to move money.');
      if (fromId === toId) return setError('Choose two different accounts.');
    }
    try {
      await checkCreditLimit(draft(), editing?.id);
    } catch (e) {
      return setError(isOverLimit(e) ? e.message : 'Something went wrong. Try again.');
    }
    setError('');
    setStep(2);
  }

  async function save() {
    if (type !== 'transfer' && categoryId === null) return setError('Pick a category.');
    try {
      if (editing) await updateTransaction(editing.id, draft());
      else await addTransaction(draft());
      router.back();
    } catch (e) {
      setError(isOverLimit(e) ? e.message : 'Could not save. Try again.');
    }
  }

  // For a credit card, show what is left and warn as the typed amount takes it near the limit.
  const card = from.type === 'credit' && from.limit_minor ? from : null;
  const oldOutflow = card && editing && editing.account_id === card.id ? (editing.type === 'income' ? -editing.amount_minor : editing.amount_minor) : 0;
  const cardOwed = card ? -card.balance_minor - oldOutflow + (type === 'income' ? -minor : minor) : 0;
  const cardStatus = card?.limit_minor ? creditStatus(cardOwed, card.limit_minor) : null;
  let underText = `${from.name} has ${formatMoney(from.balance_minor)}`;
  let underColor: string | undefined;
  if (card?.limit_minor && cardStatus) {
    const verb = minor > 0 ? 'would be' : 'is';
    if (cardOwed > card.limit_minor) {
      underText = `${formatMoney(cardOwed - card.limit_minor)} over the limit on ${card.name}`;
      underColor = sheet.neg;
    } else if (cardStatus.state === 'full') {
      underText = `${card.name} ${verb} at its limit`;
      underColor = sheet.neg;
    } else if (cardStatus.state === 'ok') {
      underText = `${card.name}: ${formatMoney(cardStatus.left)} left of ${formatMoney(card.limit_minor)}`;
    } else {
      underText = `${card.name} ${verb} at ${cardStatus.percent}% of its limit`;
      underColor = cardStatus.state === 'warn' ? sheet.warn : sheet.neg;
    }
  }

  const kindCategories = categories.filter((c) => c.kind === type);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {step === 1 ? (
          editing ? (
            <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
          ) : (
            <RoundButton label="Back to menu" onPress={() => router.replace('/add-menu')}>
              <ChevronLeft color={sheet.ink} size={20} />
            </RoundButton>
          )
        ) : (
          <RoundButton label="Back" onPress={() => { setError(''); setStep(1); }}>
            <ChevronLeft color={sheet.ink} size={20} />
          </RoundButton>
        )}
        <Text style={styles.headerTitle}>{step === 1 ? (editing ? EDIT_TITLES[type] : TITLES[type]) : type === 'transfer' ? 'Details' : type === 'income' ? 'Where from?' : 'What for?'}</Text>
        {step === 2 ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {step === 1 ? (
        <>
          <View style={styles.body}>
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
              <Text style={[styles.under, underColor !== undefined && { color: underColor, fontWeight: '600' }]}>{underText}</Text>
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
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <FadeScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.details} keyboardShouldPersistTaps="handled">
            <PressableScale accessibilityRole="button" accessibilityLabel="Change amount" onPress={() => setStep(1)} style={styles.hero}>
              <Text style={styles.heroAmount}>
                {type === 'income' ? '+ ' : ''}{formatMoney(minor)}
              </Text>
              <Text style={styles.under}>
                {from.name}{type === 'transfer' ? ` → ${to.name}` : ''} · tap to change
              </Text>
            </PressableScale>

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
              onFocus={() => setTimeout(() => scroll.current?.scrollToEnd(), 250)}
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
          </FadeScrollView>
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
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round}>
      {children}
    </PressableScale>
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
